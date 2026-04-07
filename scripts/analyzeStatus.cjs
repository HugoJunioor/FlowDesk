/**
 * Analisa as respostas das threads de todas as demandas
 * e atualiza os status baseado no contexto da conversa.
 *
 * Logica principal:
 * 1. Equipe da retorno tecnico -> cliente agradece = CONCLUIDA (data da resposta da equipe)
 * 2. Equipe da retorno tecnico direto ("feito", "resolvido") = CONCLUIDA
 * 3. Equipe respondeu que esta analisando = EM ANDAMENTO
 * 4. Sem resposta da equipe = ABERTA
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'data', 'realDemands.ts');
const content = fs.readFileSync(filePath, 'utf8');

const jsonMatch = content.match(/export const mockDemands: SlackDemand\[\] = (\[[\s\S]*?\]);/);
if (!jsonMatch) { console.error('Could not parse demands file'); process.exit(1); }
const demands = JSON.parse(jsonMatch[1]);

// === PATTERNS ===

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
  "concluimos", "finalizamos", "realizamos",
  "segue o retorno", "segue retorno",
  "efetuado", "ja foi feito",
  "procedimento executado", "procedimento realizado",
  "fiz testes", "testei", "teste realizado",
  "esta ok", "tudo certo", "tudo ok",
  "alteracao feita", "troca realizada", "troca feita",
  "cadastrado com sucesso", "cadastrado", "cadastro realizado",
  "bloqueado", "desbloqueado", "liberado",
  "segue em anexo", "segue anexo",
  // Encaminhamento/redirecionamento = resolvido nesta thread
  "vou continuar", "continuar a tratativa", "tratativa em outro",
  "vamos tratar por", "tratar em outro canal", "tratar no privado",
  "encaminhei", "encaminhado", "direcionei", "direcionado",
  "abri uma demanda", "abri no canal", "vou tratar no",
  "segue no canal", "segue em outro", "vou direcionar",
  "transferi", "transferido", "movi para",
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
  "estamos atuando", "to levantando",
  "app.clickup.com",
];

// Patterns that indicate the client is thanking/acknowledging = confirms resolution
const GRATITUDE_PATTERNS = [
  "obrigada", "obrigado", "obg", "vlw", "valeu",
  "certinho", "perfeito", "show", "top", "massa",
  "verificado", "deu certo", "funcionou", "ok",
  "confirmado", "certo", "beleza",
  "muito obrigada", "muito obrigado",
  "agradeco", "agradeço",
];

function normalize(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function matchPatterns(text, patterns) {
  const norm = normalize(text);
  return patterns.filter(p => norm.includes(normalize(p)));
}

function isGratitude(text) {
  return matchPatterns(text, GRATITUDE_PATTERNS).length > 0;
}

console.log('=== Analise de Status das Demandas ===\n');

let updated = 0;
let totalAnalyzed = 0;

for (const d of demands) {
  if (d.status === 'concluida') continue;

  totalAnalyzed++;
  const allReplies = [...d.threadReplies].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const teamReplies = allReplies.filter(r => r.isTeamMember);

  if (teamReplies.length === 0) {
    console.log(`[ABERTA] ${d.title.slice(0, 60)}`);
    console.log(`  Canal: ${d.slackChannel} | Replies: ${d.replies} | Equipe: 0`);
    console.log(`  >> Sem resposta da equipe\n`);
    continue;
  }

  // === ANALISE POR CONTEXTO DA CONVERSA ===
  // Percorre de tras pra frente buscando o padrao: equipe resolve -> cliente agradece
  let detected = false;

  for (let i = allReplies.length - 1; i >= 0; i--) {
    const reply = allReplies[i];

    // Caso 0: Check reaction ✅ = conclusao definitiva
    if (reply.hasCheckReaction && reply.isTeamMember) {
      d.status = 'concluida';
      d.completedAt = reply.timestamp;
      updated++;
      detected = true;
      console.log(`[CONCLUIDA via ✅] ${d.title.slice(0, 60)}`);
      console.log(`  Canal: ${d.slackChannel} | Reacao check na msg de ${reply.author}`);
      console.log(`  Concluida em: ${new Date(reply.timestamp).toLocaleString('pt-BR')}\n`);
      break;
    }

    // Caso 1: Ultima mensagem e da equipe com padrao de resolucao
    if (reply.isTeamMember) {
      const resolvedMatches = matchPatterns(reply.text, RESOLVED_PATTERNS);
      if (resolvedMatches.length > 0) {
        d.status = 'concluida';
        d.completedAt = reply.timestamp;
        updated++;
        detected = true;
        console.log(`[CONCLUIDA] ${d.title.slice(0, 60)}`);
        console.log(`  Canal: ${d.slackChannel} | Resposta da equipe detectada`);
        console.log(`  ${reply.author}: "${reply.text.slice(0, 80)}..."`);
        console.log(`  Concluida em: ${new Date(reply.timestamp).toLocaleString('pt-BR')}`);
        console.log(`  Matches: ${resolvedMatches.join(', ')}\n`);
        break;
      }

      const progressMatches = matchPatterns(reply.text, IN_PROGRESS_PATTERNS);
      if (progressMatches.length > 0) {
        if (d.status === 'aberta') {
          d.status = 'em_andamento';
          updated++;
        }
        detected = true;
        console.log(`[EM ANDAMENTO] ${d.title.slice(0, 60)}`);
        console.log(`  Canal: ${d.slackChannel} | Equipe trabalhando`);
        console.log(`  ${reply.author}: "${reply.text.slice(0, 80)}..."`);
        console.log(`  Matches: ${progressMatches.join(', ')}\n`);
        break;
      }
      break; // Se a ultima msg e da equipe mas sem padrao, para aqui
    }

    // Caso 2: Ultima mensagem e do cliente (nao equipe)
    if (!reply.isTeamMember) {
      const clientIsGrateful = isGratitude(reply.text);

      if (clientIsGrateful) {
        // Cliente agradeceu - buscar a resposta da equipe ANTERIOR a esse agradecimento
        for (let j = i - 1; j >= 0; j--) {
          if (allReplies[j].isTeamMember) {
            const teamReply = allReplies[j];
            const resolvedMatches = matchPatterns(teamReply.text, RESOLVED_PATTERNS);
            const progressMatches = matchPatterns(teamReply.text, IN_PROGRESS_PATTERNS);

            if (resolvedMatches.length > 0 || progressMatches.length > 0) {
              // Equipe deu retorno tecnico + cliente agradeceu = CONCLUIDA
              // Data da conclusao = data da resposta da EQUIPE (nao do agradecimento)
              d.status = 'concluida';
              d.completedAt = teamReply.timestamp;
              updated++;
              detected = true;
              console.log(`[CONCLUIDA via agradecimento] ${d.title.slice(0, 60)}`);
              console.log(`  Canal: ${d.slackChannel}`);
              console.log(`  Equipe (${teamReply.author}): "${teamReply.text.slice(0, 80)}..."`);
              console.log(`  Cliente (${reply.author}): "${reply.text.slice(0, 60)}"`);
              console.log(`  Concluida em: ${new Date(teamReply.timestamp).toLocaleString('pt-BR')} (data do retorno)`);
              console.log(`  Matches equipe: ${[...resolvedMatches, ...progressMatches].join(', ')}\n`);
              break;
            }

            // Equipe respondeu algo generico + cliente agradeceu = tambem concluida
            d.status = 'concluida';
            d.completedAt = teamReply.timestamp;
            updated++;
            detected = true;
            console.log(`[CONCLUIDA via agradecimento generico] ${d.title.slice(0, 60)}`);
            console.log(`  Canal: ${d.slackChannel}`);
            console.log(`  Equipe (${teamReply.author}): "${teamReply.text.slice(0, 80)}..."`);
            console.log(`  Cliente (${reply.author}): "${reply.text.slice(0, 60)}"`);
            console.log(`  Concluida em: ${new Date(teamReply.timestamp).toLocaleString('pt-BR')} (data do retorno)\n`);
            break;
          }
        }
        if (detected) break;
      }

      // Cliente nao agradeceu - buscar ultima resposta da equipe
      for (let j = i - 1; j >= 0; j--) {
        if (allReplies[j].isTeamMember) {
          const teamReply = allReplies[j];
          const resolvedMatches = matchPatterns(teamReply.text, RESOLVED_PATTERNS);
          if (resolvedMatches.length > 0) {
            d.status = 'concluida';
            d.completedAt = teamReply.timestamp;
            updated++;
            detected = true;
            console.log(`[CONCLUIDA] ${d.title.slice(0, 60)}`);
            console.log(`  Canal: ${d.slackChannel} | Equipe resolveu antes do cliente responder`);
            console.log(`  ${teamReply.author}: "${teamReply.text.slice(0, 80)}..."`);
            console.log(`  Concluida em: ${new Date(teamReply.timestamp).toLocaleString('pt-BR')}\n`);
            break;
          }

          const progressMatches = matchPatterns(teamReply.text, IN_PROGRESS_PATTERNS);
          if (progressMatches.length > 0) {
            if (d.status === 'aberta') { d.status = 'em_andamento'; updated++; }
            detected = true;
            console.log(`[EM ANDAMENTO] ${d.title.slice(0, 60)}`);
            console.log(`  Canal: ${d.slackChannel}`);
            console.log(`  ${teamReply.author}: "${teamReply.text.slice(0, 80)}..."\n`);
            break;
          }

          // Equipe respondeu algo generico
          if (d.status === 'aberta') { d.status = 'em_andamento'; updated++; }
          detected = true;
          console.log(`[EM ANDAMENTO*] ${d.title.slice(0, 60)}`);
          console.log(`  Canal: ${d.slackChannel} | Equipe respondeu sem padrao claro`);
          console.log(`  ${teamReply.author}: "${teamReply.text.slice(0, 80)}..."\n`);
          break;
        }
      }
      if (detected) break;
    }
  }

  if (!detected && teamReplies.length > 0) {
    if (d.status === 'aberta') { d.status = 'em_andamento'; updated++; }
    console.log(`[EM ANDAMENTO*] ${d.title.slice(0, 60)}`);
    console.log(`  Canal: ${d.slackChannel} | Equipe respondeu\n`);
  }
}

console.log(`\n=== Resumo ===`);
console.log(`Total demandas analisadas: ${totalAnalyzed}`);
console.log(`Status atualizados: ${updated}`);
console.log(`Concluidas: ${demands.filter(d => d.status === 'concluida').length}`);
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
