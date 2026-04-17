/**
 * Sync ISOLADO do canal #operacoes-sql.
 *
 * Regras de status EXCLUSIVAS deste canal:
 *   aberta      = ate alguem da equipe aprovar (primeira resposta da equipe)
 *   em_andamento = depois de aprovada, ate conclusao
 *   concluida   = emoji de check (🟢/✅/✔/☑) na demanda OU em mensagens da thread
 *                 OU mensagem com padroes tipo "concluida", "feita", "ok", "resolvido"
 *
 * Escreve em src/data/sqlDemands.ts (gitignored, isolado do fluxo principal).
 *
 * Uso: node scripts/syncSqlChannel.cjs
 */
require('dotenv').config();
const { WebClient } = require('@slack/web-api');
const fs = require('fs');
const path = require('path');

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

const CHANNEL_NAME = 'operacoes-sql';
// Janeiro 2026 00:00 UTC-3
const OLDEST = new Date('2026-01-01T00:00:00-03:00').getTime() / 1000;
const NOW = Date.now() / 1000;

const TEAM_NAMES = new Set(
  process.env.TEAM_MEMBERS ? JSON.parse(process.env.TEAM_MEMBERS) : []
);

// Cache global de usuarios (preenchido via users.list - evita rate limit)
const USER_CACHE = new Map();

async function prefetchUsers() {
  console.log('Carregando lista de usuarios do workspace...');
  let cursor, total = 0;
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

function resolveUserMentions(text) {
  return (text || '').replace(/<@(U[A-Z0-9]+)>/g, (_, uid) => `@${getUserName(uid)}`);
}

// === Emojis que marcam conclusao (regras SQL sao mais abrangentes) ===
const CHECK_REACTIONS = [
  'large_green_circle',
  'white_check_mark',
  'heavy_check_mark',
  'ballot_box_with_check',
  'check',
];

// === Padroes de conclusao por texto (so para o modulo SQL) ===
const SQL_RESOLVED_PATTERNS = [
  /\bconcluid[oa]\b/i,
  /\bfeito\b/i,
  /\bfeita\b/i,
  /\bok\b/i,
  /\bresolvid[oa]\b/i,
  /\bexecutad[oa]\b/i,
  /\bfinalizad[oa]\b/i,
  /\bpronto\b/i,
  /\brealizad[oa]\b/i,
  /\brodad[oa]\b/i,
  /\bjob finalizou\b/i,
];

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

async function fetchSqlMessages(channelId) {
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
      // Ignora mensagens de sistema e mensagens muito curtas
      if (!msg.text || msg.text.length < 10) continue;
      const skipSubtypes = ['channel_join', 'channel_leave', 'channel_topic', 'channel_purpose', 'channel_name', 'channel_archive', 'group_join', 'group_leave', 'bot_add', 'bot_remove'];
      if (skipSubtypes.includes(msg.subtype)) continue;

      const resolvedText = resolveUserMentions(msg.text || '');
      const requesterInfo = msg.user ? await getUserInfo(msg.user) : { name: msg.username || 'Bot', isTeam: false };

      // Reactions na mensagem principal
      const parentCheck = (msg.reactions || []).some(r => CHECK_REACTIONS.includes(r.name));

      // Thread replies
      const threadReplies = [];
      if (msg.reply_count > 0) {
        try {
          const replies = await fetchAllReplies(channelId, msg.ts);
          for (const reply of replies.slice(1)) {
            const info = reply.user ? await getUserInfo(reply.user) : { name: reply.username || 'Bot', isTeam: false };
            const replyText = resolveUserMentions(reply.text || '');
            const hasCheckReaction = (reply.reactions || []).some(r => CHECK_REACTIONS.includes(r.name));
            threadReplies.push({
              author: info.name,
              text: replyText,
              timestamp: new Date(parseFloat(reply.ts) * 1000).toISOString(),
              isTeamMember: info.isTeam,
              hasCheckReaction,
            });
          }
        } catch (e) {
          console.error(`  Erro ao buscar replies: ${e.message}`);
        }
      }

      // Extrair titulo (primeira linha nao vazia)
      const firstLine = resolvedText.split('\n').find((l) => l.trim().length > 0) || '';
      const title = firstLine.replace(/\*/g, '').slice(0, 100);

      const demand = {
        id: `sql_${channelId}_${msg.ts}`,
        title,
        description: resolvedText.slice(0, 500),
        priority: 'sem_classificacao', // SQL nao tem prioridade definida
        status: 'aberta',
        demandType: 'SQL',
        workflow: 'SQL',
        product: '',
        requester: { name: requesterInfo.name, avatar: '' },
        assignee: null,
        cc: [],
        createdAt: new Date(parseFloat(msg.ts) * 1000).toISOString(),
        dueDate: null,
        completedAt: null,
        hasTask: false,
        taskLink: '',
        tags: ['sql'],
        slackChannel: `#${CHANNEL_NAME}`,
        slackPermalink: `https://${process.env.SLACK_WORKSPACE || 'workspace'}.slack.com/archives/${channelId}/p${msg.ts.replace('.', '')}`,
        replies: msg.reply_count || 0,
        threadReplies,
        parentHasCheck: parentCheck,
      };

      demands.push(demand);
    }

    cursor = result.response_metadata?.next_cursor;
  } while (cursor);

  return demands;
}

function analyzeStatus(d) {
  const replies = [...(d.threadReplies || [])].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // 1) Check reaction no parent OU em qualquer reply = concluida
  if (d.parentHasCheck) {
    return { status: 'concluida', completedAt: new Date(parseFloat(d.id.split('_').pop()) * 1000).toISOString() };
  }
  const checkReply = replies.find((r) => r.hasCheckReaction);
  if (checkReply) {
    return { status: 'concluida', completedAt: checkReply.timestamp };
  }

  // 2) Mensagem com padrao de conclusao (equipe ou qualquer)
  for (let i = replies.length - 1; i >= 0; i--) {
    const r = replies[i];
    if (SQL_RESOLVED_PATTERNS.some((p) => p.test(r.text))) {
      return { status: 'concluida', completedAt: r.timestamp };
    }
  }

  // 3) Equipe respondeu? Em andamento. (primeira resposta da equipe = aprovacao)
  const teamReplies = replies.filter((r) => r.isTeamMember);
  if (teamReplies.length > 0) {
    return { status: 'em_andamento', completedAt: null, approvedAt: teamReplies[0].timestamp };
  }

  // 4) Sem aprovacao ainda
  return { status: 'aberta', completedAt: null };
}

async function main() {
  console.log('Conectando ao Slack...');
  const auth = await client.auth.test();
  console.log(`Workspace: ${auth.team} | Bot: ${auth.user}`);
  console.log(`Canal: #${CHANNEL_NAME} | Periodo: 01/01/2026 ate hoje\n`);

  await prefetchUsers();

  // Buscar o ID do canal
  const channelsResult = await client.conversations.list({ types: 'public_channel', limit: 500 });
  const channel = channelsResult.channels.find((c) => c.name === CHANNEL_NAME);
  if (!channel) {
    console.error(`Canal #${CHANNEL_NAME} nao encontrado.`);
    console.error('Verifique se o bot foi adicionado ao canal.');
    process.exit(1);
  }

  console.log(`Buscando mensagens de #${channel.name}...`);
  let demands;
  try {
    demands = await fetchSqlMessages(channel.id);
  } catch (err) {
    if (err.data?.error === 'not_in_channel') {
      console.error(`O bot nao esta no canal #${CHANNEL_NAME}. Adicione-o com /invite @flowdesk`);
      process.exit(1);
    }
    throw err;
  }
  console.log(`  ${demands.length} demandas encontradas\n`);

  // Ordenar por data (mais recente primeiro)
  demands.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Analisar status
  let stAberta = 0, stAndamento = 0, stConcluida = 0;
  for (const d of demands) {
    const result = analyzeStatus(d);
    d.status = result.status;
    d.completedAt = result.completedAt;
    if (result.approvedAt) d.approvedAt = result.approvedAt;
    delete d.parentHasCheck;

    if (d.status === 'aberta') stAberta++;
    else if (d.status === 'em_andamento') stAndamento++;
    else if (d.status === 'concluida') stConcluida++;
  }

  console.log(`Total: ${demands.length} demandas SQL`);
  console.log(`  Concluidas: ${stConcluida}`);
  console.log(`  Em andamento: ${stAndamento}`);
  console.log(`  Abertas: ${stAberta}`);

  // Escrever arquivo isolado
  const output = `import { SlackDemand } from "@/types/demand";

/** Demandas do canal #operacoes-sql — ISOLADO dos outros canais. */
export const sqlDemands: SlackDemand[] = ${JSON.stringify(demands, null, 2)};
`;

  fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'sqlDemands.ts'), output);
  console.log('\nArquivo src/data/sqlDemands.ts atualizado!');
}

main().catch((err) => {
  console.error('Erro:', err.message || err);
  process.exit(1);
});
