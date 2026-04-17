require('dotenv').config();
const { WebClient } = require('@slack/web-api');
const fs = require('fs');
const path = require('path');

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

// April 1st 2026 00:00 UTC-3
const OLDEST = new Date('2026-04-01T00:00:00-03:00').getTime() / 1000;
const NOW = Date.now() / 1000;

// Equipe interna (time interno). Qualquer usuario fora dessa lista = cliente externo.
// Configurar via variavel de ambiente TEAM_MEMBERS (JSON array) ou editar localmente.
const TEAM_NAMES = new Set(
  process.env.TEAM_MEMBERS ? JSON.parse(process.env.TEAM_MEMBERS) : []
);

// === CACHE GLOBAL DE USUARIOS (preenchido no inicio via users.list) ===
// Evita chamar users.info centenas de vezes (causa rate limit)
const USER_CACHE = new Map(); // userId -> { name, isBot, isTeam }

async function prefetchUsers() {
  console.log('Carregando lista de usuarios do workspace...');
  let cursor;
  let total = 0;
  do {
    const result = await client.users.list({ limit: 200, cursor });
    for (const u of result.members || []) {
      const realName = u.real_name || u.profile?.real_name || '';
      const displayName = u.profile?.display_name || '';
      const name = realName || u.name || u.id;
      const isBot = u.is_bot || u.id === 'USLACKBOT';
      const isTeam = !isBot && (TEAM_NAMES.has(realName) || TEAM_NAMES.has(displayName));
      USER_CACHE.set(u.id, { name, isBot, isTeam });
      total++;
    }
    cursor = result.response_metadata?.next_cursor;
  } while (cursor);
  console.log(`  ${total} usuarios carregados em cache\n`);
}

async function getUserInfo(userId) {
  if (USER_CACHE.has(userId)) return USER_CACHE.get(userId);
  // Fallback para usuarios criados depois do prefetch (raro)
  try {
    const info = await client.users.info({ user: userId });
    const u = info.user;
    const realName = u.real_name || u.profile?.real_name || '';
    const displayName = u.profile?.display_name || '';
    const name = realName || u.name || u.id;
    const isBot = u.is_bot || u.id === 'USLACKBOT';
    const isTeam = !isBot && (TEAM_NAMES.has(realName) || TEAM_NAMES.has(displayName));
    const entry = { name, isBot, isTeam };
    USER_CACHE.set(userId, entry);
    return entry;
  } catch {
    const entry = { name: userId, isBot: false, isTeam: false };
    USER_CACHE.set(userId, entry);
    return entry;
  }
}

function getUserName(userId) {
  const u = USER_CACHE.get(userId);
  return u ? u.name : userId;
}

function isTeamMemberSync(userId) {
  const u = USER_CACHE.get(userId);
  return u ? u.isTeam : false;
}

// Parse user mentions <@U12345> to names (sincrono, usa cache)
function resolveUserMentions(text) {
  return (text || '').replace(/<@(U[A-Z0-9]+)>/g, (_, uid) => `@${getUserName(uid)}`);
}

function parseWorkflowMessage(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const fields = {};
  let currentKey = null;

  for (const line of lines) {
    const boldMatch = line.match(/^\*(.+?)\*:?\s*(.*)/);
    if (boldMatch) {
      currentKey = boldMatch[1].replace(/\*/g, '').trim();
      const value = boldMatch[2].trim();
      if (value) fields[currentKey] = value;
      continue;
    }
    if (currentKey && !fields[currentKey]) {
      fields[currentKey] = line;
      currentKey = null;
    }
  }

  return fields;
}

// === BUSCA TODAS AS REPLIES (com paginacao) ===
async function fetchAllReplies(channelId, threadTs) {
  const all = [];
  let cursor;
  do {
    const result = await client.conversations.replies({
      channel: channelId,
      ts: threadTs,
      limit: 200,
      cursor,
    });
    all.push(...(result.messages || []));
    cursor = result.response_metadata?.next_cursor;
  } while (cursor);
  return all;
}

// Emojis de reacao que marcam uma demanda como concluida.
// Nao ha mais detecao por texto ("resolvido", "obrigado"): apenas reactions.
const CHECK_REACTIONS = [
  'large_green_circle',        // 🟢 circulo verde
  'white_check_mark',          // ✅ check (mais universal no Slack)
  'heavy_check_mark',          // ✔️ check pesado
  'ballot_box_with_check',     // ☑️ caixa marcada
];

async function fetchChannelMessages(channelId, channelName) {
  const demands = [];
  let cursor;

  do {
    const result = await client.conversations.history({
      channel: channelId,
      oldest: String(OLDEST),
      latest: String(NOW),
      limit: 100,
      cursor,
    });

    for (const msg of result.messages) {
      const hasText = msg.text && msg.text.length > 20;
      if (!hasText) continue;

      const isBot = msg.subtype === 'bot_message' || !!msg.bot_id;
      if (!isBot) continue;

      const textCheck = (msg.text || '').toLowerCase();
      const isDemand = textCheck.includes('nova demanda') ||
                       textCheck.includes('solicitação') ||
                       textCheck.includes('solicitacao') ||
                       textCheck.includes('título da demanda') ||
                       textCheck.includes('titulo da demanda') ||
                       textCheck.includes('demanda enviada');
      if (!isDemand) continue;

      const skipSubtypes = ['channel_join', 'channel_leave', 'channel_topic', 'channel_purpose', 'channel_name', 'channel_archive', 'group_join', 'group_leave'];
      if (skipSubtypes.includes(msg.subtype)) continue;

      const textLower = (msg.text || '').toLowerCase();
      if (textLower.includes('entrou no canal') || textLower.includes('has joined the channel') || textLower.includes('was added to') || textLower.includes('set the channel')) continue;

      const resolvedText = resolveUserMentions(msg.text || '');
      const fields = parseWorkflowMessage(resolvedText);

      const parentCheckReaction = (msg.reactions || []).some(r => CHECK_REACTIONS.includes(r.name));

      // Get thread replies (TODAS, paginadas)
      const threadReplies = [];
      if (msg.reply_count > 0) {
        try {
          const replies = await fetchAllReplies(channelId, msg.ts);

          const parentFull = replies[0];
          const parentHasCheck = parentCheckReaction || (parentFull?.reactions || []).some(r => CHECK_REACTIONS.includes(r.name));

          if (parentHasCheck) {
            const checkReaction = (parentFull?.reactions || msg.reactions || []).find(r => CHECK_REACTIONS.includes(r.name));
            const reactorId = checkReaction?.users?.[0];
            const reactorInfo = reactorId ? await getUserInfo(reactorId) : { name: 'Equipe', isTeam: true };

            threadReplies.push({
              author: reactorInfo.name,
              text: '[✅ Reacao de conclusao na mensagem principal]',
              timestamp: new Date(parseFloat(parentFull?.ts || msg.ts) * 1000 + 1000).toISOString(),
              isTeamMember: reactorInfo.isTeam,
              hasCheckReaction: true,
            });
          }

          for (const reply of replies.slice(1)) {
            const info = reply.user ? await getUserInfo(reply.user) : { name: reply.username || 'Bot', isTeam: false };
            const replyText = resolveUserMentions(reply.text || '');
            const hasCheckReaction = (reply.reactions || []).some(r => CHECK_REACTIONS.includes(r.name));

            threadReplies.push({
              author: info.name,
              text: hasCheckReaction ? `${replyText} [✅ Reacao de conclusao]` : replyText,
              timestamp: new Date(parseFloat(reply.ts) * 1000).toISOString(),
              isTeamMember: info.isTeam,
              hasCheckReaction,
            });
          }
        } catch (e) {
          console.error(`  Erro ao buscar replies de ${msg.ts}:`, e.message);
        }
      } else if (parentCheckReaction) {
        const checkReaction = (msg.reactions || []).find(r => CHECK_REACTIONS.includes(r.name));
        const reactorId = checkReaction?.users?.[0];
        const reactorInfo = reactorId ? await getUserInfo(reactorId) : { name: 'Equipe', isTeam: true };

        threadReplies.push({
          author: reactorInfo.name,
          text: '[✅ Reacao de conclusao na mensagem principal]',
          timestamp: new Date(parseFloat(msg.ts) * 1000 + 1000).toISOString(),
          isTeamMember: reactorInfo.isTeam,
          hasCheckReaction: true,
        });
      }

      const title = fields['Título da demanda'] || fields['Titulo da demanda'] ||
                    fields['Solicitação'] || fields['Solicitacao'] ||
                    resolvedText.split('\n').find(l => l.length > 10 && !l.startsWith('*'))?.slice(0, 100) ||
                    resolvedText.slice(0, 80);

      const description = fields['Descrição da demanda'] || fields['Descricao da demanda'] ||
                          fields['Descrição'] || fields['Descricao'] ||
                          resolvedText;

      const priority = (() => {
        const p = (fields['Prioridade'] || '').toLowerCase();
        if (p.includes('p1') || p.includes('crítico') || p.includes('critico')) return 'p1';
        if (p.includes('p2') || p.includes('alta')) return 'p2';
        if (p.includes('p3') || p.includes('média') || p.includes('media')) return 'p3';
        return 'sem_classificacao';
      })();

      const demandType = (() => {
        const t = (fields['Tipo de demanda'] || fields['Tipo de execução'] || fields['Tipo de execucao'] || '').toLowerCase();
        if (t.includes('bug') || t.includes('problema')) return 'Problema/Bug';
        if (t.includes('update')) return 'Update';
        if (t.includes('remessa')) return 'Remessa';
        if (t.includes('tarefa') || t.includes('ajuda')) return 'Tarefa/Ajuda';
        return 'Outro';
      })();

      const requesterMatch = resolvedText.match(/enviada por @(.+?)[\s\n]/i) ||
                              resolvedText.match(/Solicitante[:\s]*\n?@?(.+?)[\n$]/i);
      const requesterName = fields['Solicitante']?.replace('@', '') ||
                            requesterMatch?.[1]?.trim() ||
                            (msg.user ? getUserName(msg.user) : 'Desconhecido');

      const assigneeField = fields['Responsável pela execução'] || fields['Responsavel pela execucao'] || '';
      const ccMatch = resolvedText.match(/cc\s+@(.+?)$/im);

      const assigneeName = assigneeField.replace(/@/g, '').trim() ||
                           ccMatch?.[1]?.trim() || null;

      const cc = [];
      if (ccMatch) cc.push(ccMatch[1].trim());
      if (assigneeField) {
        assigneeField.split(',').forEach(a => {
          const name = a.replace(/@/g, '').trim();
          if (name && !cc.includes(name)) cc.push(name);
        });
      }

      const dueDateField = fields['Data limite'] || fields['Prazo'] || null;
      let dueDate = null;
      if (dueDateField) {
        try {
          dueDate = new Date(dueDateField).toISOString();
        } catch {}
      }

      const isWorkflow = msg.subtype === 'bot_message' || !!msg.bot_id;
      const workflow = msg.username || (isWorkflow ? 'Fluxo de Trabalho' : 'Mensagem');

      const product = fields['Produto'] || '';

      const taskLinkMatch = resolvedText.match(/(https:\/\/app\.clickup\.com\/[^\s>]+)/i) ||
                            resolvedText.match(/Link da task[:\s]*\n?(https?:\/\/[^\s>]+)/i) ||
                            resolvedText.match(/Link da solicitação[:\s]*\n?(https?:\/\/[^\s>]+)/i) ||
                            resolvedText.match(/Link da solicitacao[:\s]*\n?(https?:\/\/[^\s>]+)/i);
      const taskLink = taskLinkMatch?.[1] || '';
      const hasTask = !!taskLink;

      const tags = [];
      if (product) tags.push(product.toLowerCase());
      if (demandType !== 'Outro') tags.push(demandType.toLowerCase().replace('/', '-'));

      const demand = {
        id: `slack_${channelId}_${msg.ts}`,
        title: title.replace(/\*/g, '').trim(),
        description: description.replace(/\*/g, '').slice(0, 500),
        priority,
        status: 'aberta',
        demandType,
        workflow,
        product,
        requester: { name: requesterName.replace(/@/g, ''), avatar: '' },
        assignee: assigneeName ? { name: assigneeName, avatar: '' } : null,
        cc,
        createdAt: new Date(parseFloat(msg.ts) * 1000).toISOString(),
        dueDate,
        completedAt: null,
        hasTask,
        taskLink,
        tags,
        slackChannel: `#${channelName}`,
        slackPermalink: `https://${process.env.SLACK_WORKSPACE || 'workspace'}.slack.com/archives/${channelId}/p${msg.ts.replace('.', '')}`,
        replies: msg.reply_count || 0,
        threadReplies,
      };

      demands.push(demand);
    }

    cursor = result.response_metadata?.next_cursor;
  } while (cursor);

  return demands;
}

// === PRESERVAR ESTADO CONCLUIDA DO SYNC ANTERIOR ===
// Evita regressao quando heuristicas nao detectam conclusao em nova rodada.
function loadPreviousState() {
  const previousFile = path.join(__dirname, '..', 'src', 'data', 'realDemands.ts');
  if (!fs.existsSync(previousFile)) return new Map();
  try {
    const content = fs.readFileSync(previousFile, 'utf-8');
    // Extrair o array JSON de dentro do arquivo .ts
    const match = content.match(/export const mockDemands[^=]*=\s*(\[[\s\S]*?\]);/);
    if (!match) return new Map();
    const demands = JSON.parse(match[1]);
    const map = new Map();
    for (const d of demands) {
      if (d.status === 'concluida' && d.completedAt) {
        map.set(d.id, { status: d.status, completedAt: d.completedAt });
      }
    }
    return map;
  } catch (e) {
    console.warn('  Aviso: nao foi possivel ler estado anterior:', e.message);
    return new Map();
  }
}

async function main() {
  console.log('Conectando ao Slack...');
  const auth = await client.auth.test();
  console.log(`Workspace: ${auth.team} | Bot: ${auth.user}`);
  console.log(`Periodo: 01/04/2026 ate hoje\n`);

  // PRE-FETCH todos os usuarios (elimina rate limiting)
  await prefetchUsers();

  // Carregar estado anterior para preservar concluidas
  const previousConcluded = loadPreviousState();
  console.log(`${previousConcluded.size} demandas com status concluida no sync anterior (serao preservadas)\n`);

  const channelsResult = await client.conversations.list({ types: 'public_channel', limit: 200 });
  const clientChannels = channelsResult.channels.filter(c => c.name.startsWith('cliente-'));

  console.log(`${clientChannels.length} canais de clientes encontrados\n`);

  let allDemands = [];

  for (const channel of clientChannels) {
    console.log(`Buscando #${channel.name}...`);
    try {
      const demands = await fetchChannelMessages(channel.id, channel.name);
      console.log(`  ${demands.length} demandas encontradas`);
      allDemands = allDemands.concat(demands);
    } catch (err) {
      console.error(`  Erro: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  allDemands.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // === ANALISE DE STATUS ===
  // Regras DETERMINISTICAS:
  //   concluida   = reacao de circulo verde :large_green_circle: na thread
  //   em_andamento = tem pelo menos uma resposta da equipe (sem circulo verde)
  //   aberta      = nenhuma resposta da equipe
  //
  // Nao ha detecao por texto ("resolvido", "obrigado", etc). Se precisa
  // marcar como concluida, reage com o circulo verde na thread do Slack.

  let statusConcluida = 0, statusAndamento = 0, statusAberta = 0, statusPreservadas = 0;

  for (const d of allDemands) {
    const replies = [...(d.threadReplies || [])].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const teamReplies = replies.filter(r => r.isTeamMember);

    // 1) Tem circulo verde na thread? Concluida.
    const checks = replies.filter(r => r.hasCheckReaction);
    if (checks.length > 0) {
      d.status = 'concluida';
      d.completedAt = checks[checks.length - 1].timestamp;
      statusConcluida++;
      continue;
    }

    // 2) Equipe ja respondeu? Em andamento.
    if (teamReplies.length > 0) {
      d.status = 'em_andamento';
      statusAndamento++;
      continue;
    }

    // 3) Ninguem da equipe respondeu. Preserva concluida anterior (se houve)
    //    para protecao contra remocao acidental do circulo verde.
    //    Caso contrario, fica aberta.
    const prev = previousConcluded.get(d.id);
    if (prev) {
      d.status = prev.status;
      d.completedAt = prev.completedAt;
      statusPreservadas++;
    } else {
      statusAberta++;
    }
  }

  console.log(`\nTotal: ${allDemands.length} demandas sincronizadas`);
  console.log(`  Concluidas (circulo verde detectado): ${statusConcluida}`);
  console.log(`  Concluidas (preservadas do sync anterior): ${statusPreservadas}`);
  console.log(`  Em andamento: ${statusAndamento} | Abertas: ${statusAberta}`);

  const output = `import { SlackDemand } from "@/types/demand";

export const mockDemands: SlackDemand[] = ${JSON.stringify(allDemands, null, 2)};

/** Extrai nome do cliente do canal Slack (ex: #cliente-vspay -> Vspay) */
export function extractClientName(channel: string): string {
  const match = channel.match(/#cliente-(.+)/);
  if (!match) return channel;
  return match[1].charAt(0).toUpperCase() + match[1].slice(1);
}
`;

  fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'realDemands.ts'), output);
  console.log('\nArquivo src/data/realDemands.ts atualizado com dados reais (gitignored)!');
}

main().catch(console.error);
