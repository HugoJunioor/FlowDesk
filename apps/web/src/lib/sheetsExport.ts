/**
 * Converte demandas processadas em linhas da planilha "Suporte → Engenharia".
 *
 * Usado pelo scripts/syncSheets.ts (roda no servidor, no cron do sync) — nao
 * entra no bundle da UI. Fica em src/lib pra reaproveitar tipos, regras de SLA
 * e a suite de testes do app.
 *
 * Escopo: as demandas que passaram pela Engenharia — transferidas no FlowDesk
 * (area definida no override), de qualquer formulario. As devolvidas ao
 * Suporte continuam indo, pra planilha refletir o "Time atual".
 *
 * Cada campo daqui corresponde a uma coluna que o FlowDesk e dono. As colunas
 * da Engenharia (Responsavel, Retorno, Proxima acao, Observacoes) nao
 * aparecem; "Time atual" so e escrito na transferencia/devolucao (timeAtualMudou).
 */
import { PRIORITY_CONFIG, areaOf, type DemandPriority, type SlackDemand } from "@/types/demand";
import { addBusinessHours } from "@/lib/businessHours";
import { extractClientName } from "@/data/mockDemands";
import { splitTicketDescription } from "../../scripts/lib/ticketParser.cjs";

export interface SheetRow {
  /** Coluna A — protocolo do "Novo chamado"; senao FD-<timestamp do Slack>. */
  id: string;
  /** Id interno da demanda, so pra diagnostico no log. */
  flowdeskId: string;
  /** B — ISO. */
  abertura: string;
  cliente: string;
  solicitante: string;
  canal: "Slack";
  tipo: SheetTipo;
  criticidade: SheetCriticidade;
  problema: string;
  testes: string;
  evidencias: string;
  /** N — horas de SLA de resolucao da criticidade; null sem prioridade. */
  slaHoras: number | null;
  /** O — prazo em horas UTEIS (mesma regra do dashboard). ISO ou null. */
  prazoSla: string | null;
  /** Dirige a coluna M: "Nova" ao criar, "Concluída" quando fecha no FlowDesk. */
  concluida: boolean;
  /** T — ISO, so quando concluida. */
  conclusao: string | null;
  /** W — ultima atividade conhecida (abertura, respostas, conclusao, transferencia). */
  ultimaAtualizacao: string;
  /** K — quem esta com a demanda no FlowDesk. */
  timeAtual: "Engenharia" | "Suporte";
  /**
   * Se a area mudou desde o ultimo envio. So entao o Apps Script escreve K —
   * entre uma transferencia e outra, a Engenharia pode mudar K a vontade.
   * toSheetRow devolve true; quem compara com o envio anterior e o exportador.
   */
  timeAtualMudou: boolean;
}

/** Valores aceitos pela validacao da coluna Tipo (aba Listas). */
export type SheetTipo = "Incidente" | "Bug" | "Dúvida técnica" | "Melhoria" | "Integração" | "Dados/Relatório" | "Infraestrutura" | "Outro";
/** Valores aceitos pela validacao da coluna Criticidade (aba Listas). */
export type SheetCriticidade = "Crítica" | "Alta" | "Média" | "Baixa" | "";

const TIPO_POR_DEMAND_TYPE: Partial<Record<string, SheetTipo>> = {
  "Problema/Bug": "Bug",
  "Tarefa/Ajuda": "Dúvida técnica",
  "Update": "Melhoria",
  "Remessa": "Dados/Relatório",
};

const CRITICIDADE_POR_PRIORIDADE: Record<DemandPriority, SheetCriticidade> = {
  p1: "Crítica",
  p2: "Alta",
  p3: "Média",
  sem_classificacao: "",
};

// Limite de celula do Sheets e 50.000 caracteres; folga pra nao estourar.
const MAX_CELL = 45_000;

// Campos tecnicos que ajudam a Engenharia a reproduzir. CNPJ fica de fora de
// proposito (minimizacao de dados — ID da organizacao e Cliente ja identificam).
const CONTEXT_FIELDS = ["Impacto", "Existe contorno?", "Ambiente"];
const TECH_FIELDS = ["Tipo de operação", "ID da organização", "ID do usuário", "Usuário/perfil afetado", "Navegador/versão"];

export function isNovoChamado(d: SlackDemand): boolean {
  return !!d.formFields && Object.keys(d.formFields).length > 0;
}

/** Ja foi transferida pra Engenharia (inclusive se depois voltou pro Suporte). */
export function wentToEngineering(d: SlackDemand): boolean {
  return d.area === "engenharia" || d.area === "suporte";
}

/**
 * ID da linha: o protocolo do "Novo chamado" ou, nos outros formularios,
 * FD- + timestamp da mensagem no Slack (unico no canal e estavel entre syncs;
 * da pra achar a mensagem por ele).
 */
function sheetId(d: SlackDemand): string {
  const protocolo = d.formFields?.["Protocolo"]?.trim();
  if (protocolo) return protocolo;
  const ts = d.id.match(/_(\d+)\.(\d+)$/);
  return ts ? `FD-${ts[1]}${ts[2]}` : d.id;
}

function clip(s: string): string {
  return s.length > MAX_CELL ? `${s.slice(0, MAX_CELL - 1)}…` : s;
}

function joinFields(fields: Record<string, string>, labels: string[]): string {
  return labels
    .filter((label) => fields[label]?.trim())
    .map((label) => `${label}: ${fields[label].trim()}`)
    .join(" · ");
}

function lastActivity(d: SlackDemand): string {
  const stamps = [d.createdAt, d.completedAt, d.areaChangedAt, ...(d.threadReplies || []).map((r) => r.timestamp)]
    .map((s) => (s ? Date.parse(s) : NaN))
    .filter((ms) => !Number.isNaN(ms));
  return new Date(Math.max(...stamps)).toISOString();
}

export function toSheetRow(d: SlackDemand): SheetRow {
  const fields = d.formFields || {};
  const ticket = isNovoChamado(d);
  const narrative = splitTicketDescription(ticket ? d.description : "");

  // "Novo chamado" tem campos estruturados; os outros formularios so titulo e corpo.
  const problema = ticket
    ? [
        d.title,
        [
          narrative.resultadoObtido && `Resultado obtido: ${narrative.resultadoObtido}`,
          narrative.resultadoEsperado && `Resultado esperado: ${narrative.resultadoEsperado}`,
        ].filter(Boolean).join("\n"),
        [joinFields(fields, CONTEXT_FIELDS), joinFields(fields, TECH_FIELDS)].filter(Boolean).join("\n"),
      ].filter(Boolean).join("\n\n")
    : [d.title, d.description !== d.title ? d.description : ""].filter(Boolean).join("\n\n");

  const evidencias = [
    d.slackPermalink && `Slack: ${d.slackPermalink}`,
    d.taskLink && `ClickUp: ${d.taskLink}`,
    d.files?.length ? `Anexos no Slack: ${d.files.length}` : "",
  ].filter(Boolean).join("\n");

  const slaHoras = PRIORITY_CONFIG[d.priority]?.sla?.resolutionHours ?? null;
  const concluida = d.status === "concluida";

  return {
    id: sheetId(d),
    flowdeskId: d.id,
    abertura: new Date(d.createdAt).toISOString(),
    cliente: fields["Cliente/Organização"]?.trim() || narrative.cliente || extractClientName(d.slackChannel),
    solicitante: d.requester?.name || "",
    canal: "Slack",
    tipo: TIPO_POR_DEMAND_TYPE[d.demandType] ?? "Outro",
    criticidade: CRITICIDADE_POR_PRIORIDADE[d.priority] ?? "",
    problema: clip(problema),
    testes: clip(narrative.tentouFazer),
    evidencias,
    slaHoras,
    prazoSla: slaHoras ? addBusinessHours(new Date(d.createdAt), slaHoras).toISOString() : null,
    concluida,
    conclusao: concluida && d.completedAt ? new Date(d.completedAt).toISOString() : null,
    ultimaAtualizacao: lastActivity(d),
    timeAtual: areaOf(d) === "engenharia" ? "Engenharia" : "Suporte",
    timeAtualMudou: true,
  };
}

/**
 * Filtra as demandas que passaram pela Engenharia, converte e ordena por
 * abertura (linhas novas entram na planilha em ordem cronologica). Se duas
 * trouxerem o mesmo ID, fica a mais antiga — a coluna A e a chave da planilha
 * e uma duplicata faria as duas brigarem pela mesma linha.
 */
export function buildSheetRows(demands: SlackDemand[]): { rows: SheetRow[]; duplicates: string[] } {
  const rows = demands
    .filter(wentToEngineering)
    .map(toSheetRow)
    .sort((a, b) => a.abertura.localeCompare(b.abertura));

  const seen = new Set<string>();
  const duplicates: string[] = [];
  const unique = rows.filter((r) => {
    if (seen.has(r.id)) {
      duplicates.push(`${r.id} (${r.flowdeskId})`);
      return false;
    }
    seen.add(r.id);
    return true;
  });

  return { rows: unique, duplicates };
}
