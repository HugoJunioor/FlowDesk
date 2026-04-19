/**
 * LIMPEZA PONTUAL (uso unico):
 * Marca como 'concluida' demandas atualmente em_andamento cuja ultima
 * mensagem da equipe contem sinais de conclusao (emojis de check no
 * texto, palavras como "feito", "resolvido", "obrigado" do cliente).
 *
 * Nao altera o sync: e so para limpar o estado atual de uma vez.
 *
 * Uso: node scripts/cleanupExceptions.cjs
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'src', 'data', 'realDemands.ts');

// Unicode check marks diretos no texto
const CHECK_CHARS = /[✅✔☑🟢]|:white_check_mark:|:heavy_check_mark:|:ballot_box_with_check:|:large_green_circle:/;

// Padroes em texto da equipe indicando resolucao
const RESOLVED_PATTERNS = [
  /ajustad[oa]/i, /corrigid[oa]/i, /resolvid[oa]/i, /conclu[ií]d[oa]/i,
  /finalizado/i, /pronto/i, /feito/i, /realizado/i,
  /liberado/i, /publicado/i, /implantado/i, /deploy/i,
  /pode testar/i, /j[aá]\s+pode/i,
  /atualizado/i, /alterado conforme/i,
  /solicita[çc][ãa]o atendida/i,
  /problema resolvido/i, /tudo certo/i,
  /encaminhad[oa]/i, /repassad[oa]/i, /direcionad[oa]/i,
  /cadastrado com sucesso/i, /enviada com sucesso/i, /enviado com sucesso/i,
  /transferidas?/i, /transferidos?/i,
  /consegui(mos|ram)?\s+(ativar|fazer|resolver|criar|solucionar)/i,
];

// Sinais de gratidao do cliente (indicam resolucao quando equipe respondeu antes)
const GRATITUDE_PATTERNS = [
  /obrigad[oa]/i, /valeu/i, /agradec/i, /perfeito/i,
  /excelente/i, /\bshow{1,3}!?\b/i, /\btop\b/i, /\bmassa\b/i,
  /muito bom/i, /deu certo/i, /funcionou/i, /conseguimos\s+ativar/i,
];

function hasClosureSignal(text) {
  if (!text) return false;
  if (CHECK_CHARS.test(text)) return true;
  return RESOLVED_PATTERNS.some((p) => p.test(text));
}

function hasGratitude(text) {
  if (!text) return false;
  return GRATITUDE_PATTERNS.some((p) => p.test(text));
}

function main() {
  const content = fs.readFileSync(FILE, 'utf-8');
  const match = content.match(/export const mockDemands[^=]*=\s*(\[[\s\S]*?\]);/);
  if (!match) {
    console.error('Nao foi possivel encontrar o array de demandas');
    process.exit(1);
  }
  const demands = JSON.parse(match[1]);

  let promoted = 0;
  const promotedList = [];

  for (const d of demands) {
    if (d.status !== 'em_andamento') continue;

    const replies = [...(d.threadReplies || [])].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Verifica ultimos replies (equipe OU cliente com gratidao apos resposta da equipe)
    let concluded = false;
    let completedAt = null;

    for (let i = replies.length - 1; i >= 0; i--) {
      const r = replies[i];
      if (r.isTeamMember && hasClosureSignal(r.text)) {
        concluded = true;
        completedAt = r.timestamp;
        break;
      }
      if (!r.isTeamMember && hasGratitude(r.text)) {
        // Busca ultima resposta da equipe antes dessa mensagem
        const teamBefore = replies.slice(0, i).reverse().find((t) => t.isTeamMember);
        if (teamBefore) {
          concluded = true;
          completedAt = teamBefore.timestamp;
          break;
        }
      }
    }

    if (concluded) {
      d.status = 'concluida';
      d.completedAt = completedAt;
      promoted++;
      promotedList.push(`${d.slackChannel} | ${d.title.slice(0, 60)}`);
    }
  }

  // Re-serializar o arquivo
  const newContent = `import { SlackDemand } from "@/types/demand";

export const mockDemands: SlackDemand[] = ${JSON.stringify(demands, null, 2)};

/** Extrai nome do cliente do canal Slack (ex: #cliente-acme -> Acme) */
export function extractClientName(channel: string): string {
  const match = channel.match(/#cliente-(.+)/);
  if (!match) return channel;
  return match[1].charAt(0).toUpperCase() + match[1].slice(1);
}
`;
  fs.writeFileSync(FILE, newContent);

  console.log(`\n✓ Limpeza concluida`);
  console.log(`  ${promoted} demandas promovidas de 'em_andamento' para 'concluida':`);
  console.log('');
  for (const s of promotedList) console.log(`    - ${s}`);

  const concluidas = demands.filter((d) => d.status === 'concluida').length;
  const andamento = demands.filter((d) => d.status === 'em_andamento').length;
  const abertas = demands.filter((d) => d.status === 'aberta').length;
  console.log('');
  console.log(`  Estado final: ${concluidas} concluidas | ${andamento} em_andamento | ${abertas} abertas`);
}

main();
