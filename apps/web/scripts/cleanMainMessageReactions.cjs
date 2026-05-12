#!/usr/bin/env node
/**
 * Script de migracao: limpa demandas que foram marcadas como "concluida"
 * por causa de reaction ✅/🟢 na mensagem principal (regra antiga).
 *
 * Regra nova: so reaction em RESPOSTA do thread fecha a demanda.
 *
 * O que faz:
 * 1. Le src/data/realDemands.ts
 * 2. Pra cada demanda:
 *    - Remove threadReplies sinteticos (texto comeca com "[✅ Reacao de conclusao na mensagem principal]")
 *    - Se a demanda virou concluida APENAS por causa desse sintetico (nao tem
 *      outra reply com hasCheckReaction), reseta:
 *        status = 'aberta' (ou 'em_andamento' se ha team reply)
 *        completedAt = null
 *        closureSource = null
 * 3. Sobrescreve o arquivo
 *
 * Uso: node scripts/cleanMainMessageReactions.cjs
 */

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "src", "data", "realDemands.ts");

const MAIN_REACTION_TEXT = "[✅ Reacao de conclusao na mensagem principal]";

function loadDemands() {
  const raw = fs.readFileSync(FILE, "utf8");
  // Arquivo: `import ...` + `export const mockDemands: SlackDemand[] = [...];`
  // + `export function extractClientName(...) {...}`
  // Extrai o array entre os colchetes do mockDemands.
  const startMarker = /export\s+const\s+mockDemands\s*:\s*SlackDemand\[\]\s*=\s*\[/;
  const startMatch = raw.match(startMarker);
  if (!startMatch) throw new Error("Nao encontrei 'export const mockDemands' em realDemands.ts");
  const arrayStart = startMatch.index + startMatch[0].length - 1; // posicao do '['
  // Acha o ']' que fecha o array (matching de brackets)
  let depth = 0;
  let arrayEnd = -1;
  let inString = false;
  let escape = false;
  for (let i = arrayStart; i < raw.length; i++) {
    const ch = raw[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) { arrayEnd = i; break; }
    }
  }
  if (arrayEnd < 0) throw new Error("Nao consegui achar o final do array");

  const json = raw.slice(arrayStart, arrayEnd + 1);
  return {
    array: JSON.parse(json),
    prefix: raw.slice(0, arrayStart),
    suffix: raw.slice(arrayEnd + 1),
  };
}

function saveDemands({ prefix, suffix }, array) {
  const json = JSON.stringify(array, null, 2);
  fs.writeFileSync(FILE, prefix + json + suffix, "utf8");
}

function main() {
  const loaded = loadDemands();
  const demands = loaded.array;
  let cleaned = 0;
  let resetToOpen = 0;
  let resetToInProgress = 0;

  for (const d of demands) {
    if (!Array.isArray(d.threadReplies)) continue;

    const hadSynthetic = d.threadReplies.some((r) => r && typeof r.text === "string" && r.text.startsWith(MAIN_REACTION_TEXT));
    if (!hadSynthetic) continue;

    // Remove os sintéticos
    d.threadReplies = d.threadReplies.filter((r) => !(typeof r.text === "string" && r.text.startsWith(MAIN_REACTION_TEXT)));
    cleaned++;

    // Se nao sobrou nenhuma reply com hasCheckReaction, reverte status
    const stillHasCheck = d.threadReplies.some((r) => r && r.hasCheckReaction);
    if (!stillHasCheck && d.status === "concluida") {
      const hasTeamReply = d.threadReplies.some((r) => r && r.isTeamMember);
      d.status = hasTeamReply ? "em_andamento" : "aberta";
      d.completedAt = null;
      if (d.closureSource) delete d.closureSource;
      if (hasTeamReply) resetToInProgress++;
      else resetToOpen++;
    }
  }

  saveDemands(loaded, demands);

  console.log("=== Limpeza de reaction na mensagem principal ===");
  console.log(`Demandas com reply sintetico removido: ${cleaned}`);
  console.log(`Demandas revertidas pra 'aberta':       ${resetToOpen}`);
  console.log(`Demandas revertidas pra 'em_andamento': ${resetToInProgress}`);
  console.log(`Demandas mantidas concluidas (tinham reaction em reply real): ${cleaned - resetToOpen - resetToInProgress}`);
}

main();
