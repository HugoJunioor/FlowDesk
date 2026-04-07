/**
 * Analisa as respostas das threads de todas as demandas
 * e atualiza os status baseado nos comentarios
 */
const fs = require('fs');
const path = require('path');

// Read the current demands file
const filePath = path.join(__dirname, '..', 'src', 'data', 'mockDemands.ts');
const content = fs.readFileSync(filePath, 'utf8');

// Extract the JSON array from the TypeScript file
const jsonMatch = content.match(/export const mockDemands: SlackDemand\[\] = (\[[\s\S]*?\]);/);
if (!jsonMatch) {
  console.error('Could not parse demands file');
  process.exit(1);
}

const demands = JSON.parse(jsonMatch[1]);

// Status detection patterns
const RESOLVED_PATTERNS = [
  "resolvido", "concluido", "concluida", "finalizado", "finalizada",
  "feito", "pronto", "pronta", "ok feito",
  "ja foi ajustado", "ajustado", "corrigido", "corrigida",
  "normalizado", "restabelecido",
  "pode verificar", "pode conferir", "pode testar",
  "ja esta funcionando", "voltou a funcionar", "funcionando normalmente",
  "atualizado com sucesso", "realizado com sucesso", "executado com sucesso",
  "dados corrigidos", "alteracao realizada", "ajuste realizado",
  "executado", "aplicado", "processado",
  "segue ajustado", "segue corrigido", "segue atualizado",
  "problema resolvido", "situacao normalizada",
  "enviado", "encaminhado para o cliente",
  "concluimos", "finalizamos", "realizamos",
  "segue o retorno", "segue retorno", "segue a resposta",
  "realizado", "efetuado", "ja foi feito",
];

const IN_PROGRESS_PATTERNS = [
  "task criada", "abri no clickup", "vou criar a task", "criei a task",
  "abri uma task", "criada a task", "task aberta",
  "estamos analisando", "em andamento", "trabalhando nisso",
  "vou verificar", "ja estou olhando", "analisando",
  "estou verificando", "vamos analisar", "vamos verificar",
  "em analise", "em tratamento", "em atendimento",
  "ja peguei", "ja assumi", "estou cuidando",
  "vou tratar", "vou resolver", "inicio agora",
  "app.clickup.com",
];

function matchPatterns(text, patterns) {
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return patterns.filter(p => {
    const normalizedP = p.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return lower.includes(normalizedP);
  });
}

console.log('=== Analise de Status das Demandas ===\n');

let updated = 0;
let totalOpen = 0;

for (const d of demands) {
  if (d.status === 'concluida') continue; // Already done

  totalOpen++;
  const teamReplies = d.threadReplies.filter(r => r.isTeamMember);

  if (teamReplies.length === 0) {
    console.log(`[ABERTA] ${d.title.slice(0, 60)}`);
    console.log(`  Canal: ${d.slackChannel} | Replies: ${d.replies} | Equipe: 0`);
    console.log(`  >> Sem resposta da equipe\n`);
    continue;
  }

  // Check latest team reply
  const sorted = [...teamReplies].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const latest = sorted[0];

  const resolvedMatches = matchPatterns(latest.text, RESOLVED_PATTERNS);
  const progressMatches = matchPatterns(latest.text, IN_PROGRESS_PATTERNS);

  if (resolvedMatches.length > 0) {
    const oldStatus = d.status;
    d.status = 'concluida';
    d.completedAt = latest.timestamp;
    updated++;
    console.log(`[CONCLUIDA] ${d.title.slice(0, 60)}`);
    console.log(`  Canal: ${d.slackChannel} | De: ${oldStatus} -> concluida`);
    console.log(`  Ultimo reply (${latest.author}): "${latest.text.slice(0, 80)}..."`);
    console.log(`  Matches: ${resolvedMatches.join(', ')}\n`);
  } else if (progressMatches.length > 0) {
    if (d.status === 'aberta') {
      d.status = 'em_andamento';
      updated++;
      console.log(`[EM ANDAMENTO] ${d.title.slice(0, 60)}`);
      console.log(`  Canal: ${d.slackChannel} | De: aberta -> em_andamento`);
      console.log(`  Ultimo reply (${latest.author}): "${latest.text.slice(0, 80)}..."`);
      console.log(`  Matches: ${progressMatches.join(', ')}\n`);
    }
  } else {
    // Has team reply but no clear pattern - mark as em_andamento if aberta
    if (d.status === 'aberta') {
      d.status = 'em_andamento';
      updated++;
      console.log(`[EM ANDAMENTO*] ${d.title.slice(0, 60)}`);
      console.log(`  Canal: ${d.slackChannel} | Equipe respondeu mas sem padrao claro`);
      console.log(`  Ultimo reply (${latest.author}): "${latest.text.slice(0, 80)}..."\n`);
    } else {
      console.log(`[${d.status.toUpperCase()}] ${d.title.slice(0, 60)}`);
      console.log(`  Canal: ${d.slackChannel} | Mantido`);
      console.log(`  Ultimo reply (${latest.author}): "${latest.text.slice(0, 80)}..."\n`);
    }
  }
}

console.log(`\n=== Resumo ===`);
console.log(`Total demandas analisadas: ${totalOpen}`);
console.log(`Status atualizados: ${updated}`);
console.log(`Concluidas detectadas: ${demands.filter(d => d.status === 'concluida').length}`);
console.log(`Em andamento: ${demands.filter(d => d.status === 'em_andamento').length}`);
console.log(`Abertas: ${demands.filter(d => d.status === 'aberta').length}`);

// Write updated file
const output = `import { SlackDemand } from "@/types/demand";

export const mockDemands: SlackDemand[] = ${JSON.stringify(demands, null, 2)};

/** Extrai nome do cliente do canal Slack (ex: #cliente-vspay -> Vspay) */
export function extractClientName(channel: string): string {
  const match = channel.match(/#cliente-(.+)/);
  if (!match) return channel;
  return match[1].charAt(0).toUpperCase() + match[1].slice(1);
}
`;

fs.writeFileSync(filePath, output);
console.log(`\nArquivo atualizado com sucesso!`);
