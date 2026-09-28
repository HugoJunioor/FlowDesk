/**
 * Exporta as demandas transferidas pra Engenharia (botao no detalhe da
 * demanda) pra planilha Suporte → Engenharia (Google Sheets), via o Apps
 * Script publicado nela
 * (scripts/sheets/flowdeskSheetSync.cjs). Setup completo em docs/SHEETS_SYNC.md.
 *
 * Roda no cron do sync, logo depois do syncSlack, dentro do mesmo container:
 *
 *   node --import tsx scripts/syncSheets.ts            (envia)
 *   node --import tsx scripts/syncSheets.ts --dry-run  (so mostra o que enviaria)
 *
 * E TypeScript de proposito: reusa o pipeline do navegador (demandsPipeline)
 * pra que prioridade, status e overrides na planilha sejam exatamente os da
 * tela — em vez de uma quarta copia dessas regras.
 *
 * Variaveis (no .env da raiz, que o cron repassa ao container):
 *   SHEETS_WEBHOOK_URL    URL /exec do App da Web do Apps Script
 *   SHEETS_WEBHOOK_TOKEN  mesmo valor da propriedade FLOWDESK_TOKEN do script
 *   FLOWDESK_STATE_FILE   (opcional) caminho do shared-state.json
 * Sem URL/token o export fica desligado e o script sai com sucesso.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { SlackDemand } from "@/types/demand";
import { processCurrentDemands, type DemandOverrides } from "@/data/demandsPipeline";
import { normalizeAutoAssignRules } from "@/lib/autoAssignRules";
import { buildSheetRows } from "@/lib/sheetsExport";

// Horario comercial, "a partir de hoje" das regras e prazos sao definidos no
// fuso de Sao Paulo — o mesmo do navegador de quem usa o FlowDesk. O container
// do cron roda em UTC por padrao; sem isto todo prazo sairia 3h deslocado.
process.env.TZ = process.env.FLOWDESK_TZ || "America/Sao_Paulo";

const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(WEB_DIR, "..", "..");
const REAL_DEMANDS_FILE = path.join(WEB_DIR, "src", "data", "realDemands.ts");
// Estado do ultimo envio (hash do payload). Fica no data/ do web, gitignored.
const EXPORT_STATE_FILE = path.join(WEB_DIR, "data", "sheets-export-state.json");
// Mesmo sem mudanca, reenvia de hora em hora: recria linha que alguem tenha
// apagado na planilha e corrige edicao feita por engano nas colunas do FlowDesk.
const FORCE_RESEND_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 120_000;

const DRY_RUN = process.argv.includes("--dry-run");

function log(msg: string): void {
  console.log(`[planilha] ${msg}`);
}

/**
 * `docker run --env-file` (usado pelo cron) passa aspas literalmente, ao
 * contrario do compose: SHEETS_WEBHOOK_URL="https://..." chegaria com aspas.
 */
function envValue(name: string): string | undefined {
  const raw = process.env[name]?.trim();
  return raw?.replace(/^(["'])(.*)\1$/, "$2").trim() || undefined;
}

/**
 * O shared-state de producao e o do legacy-state (<raiz>/data). O de
 * apps/web/data e o do plugin de dev — no servidor pode existir uma copia
 * antiga dele, por isso vem depois.
 */
function findStateFile(): string | null {
  const candidates = [
    process.env.FLOWDESK_STATE_FILE,
    path.join(REPO_ROOT, "data", "shared-state.json"),
    path.join(WEB_DIR, "data", "shared-state.json"),
  ].filter((p): p is string => !!p);
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

/** Valores do shared-state costumam vir como objeto; aceita string JSON tambem. */
function stateValue(state: Record<string, unknown>, key: string): unknown {
  const v = state[key];
  if (typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return undefined; }
}

function loadSharedState(): { overrides: DemandOverrides; rules: ReturnType<typeof normalizeAutoAssignRules> } {
  const file = findStateFile();
  if (!file) {
    log("aviso: shared-state.json nao encontrado — seguindo sem overrides e regras (prioridade/status podem divergir da tela)");
    return { overrides: {}, rules: [] };
  }
  const state = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  const overrides = stateValue(state, "fd_demand_overrides");
  return {
    overrides: overrides && typeof overrides === "object" && !Array.isArray(overrides) ? (overrides as DemandOverrides) : {},
    rules: normalizeAutoAssignRules(stateValue(state, "fd_auto_assign_rules")),
  };
}

interface ExportState {
  hash: string;
  lastSuccessAt: string;
  /** "Time atual" enviado por ID no ultimo envio — detecta transferencia/devolucao. */
  areas?: Record<string, string>;
}

function readExportState(): ExportState | null {
  try { return JSON.parse(fs.readFileSync(EXPORT_STATE_FILE, "utf8")) as ExportState; } catch { return null; }
}

function writeExportState(state: ExportState & Record<string, unknown>): void {
  try {
    fs.mkdirSync(path.dirname(EXPORT_STATE_FILE), { recursive: true });
    fs.writeFileSync(EXPORT_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    // So custa um reenvio no proximo ciclo; nao vale falhar o export por isso.
    log(`aviso: nao consegui gravar ${EXPORT_STATE_FILE}: ${(err as Error).message}`);
  }
}

async function main(): Promise<void> {
  const url = envValue("SHEETS_WEBHOOK_URL");
  const token = envValue("SHEETS_WEBHOOK_TOKEN");
  if (!DRY_RUN && (!url || !token)) {
    log("desativado (SHEETS_WEBHOOK_URL/SHEETS_WEBHOOK_TOKEN ausentes)");
    return;
  }

  if (!fs.existsSync(REAL_DEMANDS_FILE)) {
    log("realDemands.ts ausente — nada a exportar");
    return;
  }
  const mod = (await import(pathToFileURL(REAL_DEMANDS_FILE).href)) as { mockDemands?: SlackDemand[] };
  const demands = mod.mockDemands ?? [];

  const { overrides, rules } = loadSharedState();
  const processed = processCurrentDemands(demands, { rules, overrides });
  const built = buildSheetRows(processed);
  const { duplicates } = built;

  // "Time atual" so vai pra planilha quando a area mudou desde o ultimo envio
  // bem-sucedido. Sem estado anterior (primeiro envio, arquivo apagado), todas
  // as linhas contam como mudanca — K e reescrito uma vez e segue a vida.
  const previous = readExportState();
  const rows = built.rows.map((r) => ({ ...r, timeAtualMudou: previous?.areas?.[r.id] !== r.timeAtual }));

  const comEngenharia = rows.filter((r) => r.timeAtual === "Engenharia").length;
  log(`${rows.length} demanda(s) passaram pela Engenharia (${comEngenharia} com ela agora) de ${demands.length} do Slack`);
  if (duplicates.length) log(`aviso: ID repetido, mantida a mais antiga: ${duplicates.join(", ")}`);

  if (DRY_RUN) {
    console.log(JSON.stringify(rows.slice(-3), null, 2));
    log("dry-run: nada enviado");
    return;
  }

  // Destino entra no hash: trocar URL ou token (novo deploy do Apps Script)
  // precisa reenviar na hora, nao so depois do FORCE_RESEND_MS.
  const hash = crypto.createHash("sha256").update(`${url}\n${token}\n${JSON.stringify(rows)}`).digest("hex");
  if (previous?.hash === hash && Date.now() - Date.parse(previous.lastSuccessAt) < FORCE_RESEND_MS) {
    log("sem mudancas desde o ultimo envio");
    return;
  }

  // O /exec do Apps Script responde 302 pra googleusercontent; o fetch segue
  // com GET e recebe o JSON devolvido pelo doPost (que ja rodou no POST).
  const res = await fetch(url!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, version: 1, generatedAt: new Date().toISOString(), rows }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await res.text();
  let body: { ok?: boolean; error?: string; criadas?: number; atualizadas?: number; inalteradas?: number };
  try {
    body = JSON.parse(text);
  } catch {
    // Pagina HTML aqui = deploy sem acesso "Qualquer pessoa" ou URL errada.
    throw new Error(`resposta nao-JSON do Apps Script (HTTP ${res.status}): ${text.slice(0, 160).replace(/\s+/g, " ")}`);
  }
  if (!res.ok || !body.ok) {
    throw new Error(`Apps Script recusou (HTTP ${res.status}): ${body.error ?? "sem detalhe"}`);
  }

  writeExportState({
    hash,
    lastSuccessAt: new Date().toISOString(),
    areas: Object.fromEntries(rows.map((r) => [r.id, r.timeAtual])),
    rows: rows.length,
    result: body,
  });
  log(`enviado: ${body.criadas ?? 0} nova(s), ${body.atualizadas ?? 0} atualizada(s), ${body.inalteradas ?? 0} sem mudanca`);
}

main().catch((err) => {
  // "fetch failed" sozinho nao diz nada no log; a causa traz ECONNREFUSED, ENOTFOUND etc.
  const cause = (err as Error & { cause?: { code?: string } }).cause?.code;
  log(`erro: ${(err as Error).message}${cause ? ` (${cause})` : ""}`);
  // exitCode em vez de exit(): sai quando o socket do fetch fechar, sem
  // derrubar o processo no meio do fechamento.
  process.exitCode = 1;
});
