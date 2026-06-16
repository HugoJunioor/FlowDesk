// override:true garante que .env sobrescreva variaveis persistentes da sessao
require('dotenv').config({ override: true });
const { WebClient } = require('@slack/web-api');
const fs = require('fs');
const path = require('path');

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

// Channels where the bot is intentionally not invited.
// Errors from these are silently skipped — no alert is fired.
const IGNORED_CHANNELS = new Set([
  'cliente-convenios',
  'cliente-cashtime',
  'cliente-keshbank',
  'cliente-bc-teste',
]);

// April 1st 2026 00:00 UTC-3
const OLDEST = new Date('2026-04-01T00:00:00-03:00').getTime() / 1000;
const NOW = Date.now() / 1000;

// === IDENTIFICACAO DE EQUIPE ===
// Regra primaria: dominio do email corporativo. Auto-atualiza pra novos
// funcionarios sem precisar editar config.
// Regra secundaria (fallback): lista manual de nomes — usar so pra
// usuarios sem email exposto no Slack (caso raro).
const TEAM_EMAIL_DOMAINS = (
  process.env.TEAM_EMAIL_DOMAINS ? JSON.parse(process.env.TEAM_EMAIL_DOMAINS) : ["wearejust.it"]
).map(d => d.toLowerCase());

const TEAM_NAMES = new Set(
  process.env.TEAM_MEMBERS ? JSON.parse(process.env.TEAM_MEMBERS) : []
);

function isTeamUser(slackUser) {
  if (slackUser.is_bot || slackUser.id === 'USLACKBOT') return false;
  const email = (slackUser.profile?.email || '').toLowerCase();
  if (email && TEAM_EMAIL_DOMAINS.some(d => email.endsWith('@' + d))) return true;
  // Fallback pra usuarios sem email exposto
  const realName = slackUser.real_name || slackUser.profile?.real_name || '';
  const displayName = slackUser.profile?.display_name || '';
  return TEAM_NAMES.has(realName) || TEAM_NAMES.has(displayName);
}

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
      const name = realName || u.name || u.id;
      const isBot = u.is_bot || u.id === 'USLACKBOT';
      const isTeam = isTeamUser(u);
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
    const name = realName || u.name || u.id;
    const isBot = u.is_bot || u.id === 'USLACKBOT';
    const isTeam = isTeamUser(u);
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

/**
 * Mapeia msg.files do Slack pra estrutura SlackFile do front.
 * Pega so os campos uteis (id, name, mimetype, size, urlPrivate,
 * thumb360, isPublic). Slack devolve dezenas de campos, mas a UI
 * so precisa desses.
 */
function mapSlackFiles(rawFiles) {
  if (!Array.isArray(rawFiles) || rawFiles.length === 0) return undefined;
  return rawFiles
    .filter((f) => f && f.id && f.name)
    .map((f) => ({
      id: f.id,
      name: f.name,
      mimetype: f.mimetype || 'application/octet-stream',
      size: f.size || 0,
      urlPrivate: f.url_private,
      thumb360: f.thumb_360,
      isPublic: !!f.is_public,
      preview: typeof f.preview === 'string' ? f.preview.slice(0, 200) : undefined,
    }));
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

// UNICO sinal de conclusao: 🟢 circulo verde (large_green_circle).
// Sem deteccao por texto, sem outros emojis de check.
// Demandas ja fechadas antes sao preservadas pela logica de preservacao.
const CHECK_REACTIONS = ['large_green_circle'];

// Reactions que marcam INICIO de atendimento em demandas Sitef/Conciliacao.
// Quando equipe adiciona :loading: numa reply do thread, o timestamp daquela
// reply vira o serviceStartedAt da demanda (usado pra SLA de 1a resposta).
const LOADING_REACTIONS = ['loading', 'hourglass_flowing_sand', 'hourglass'];

async function fetchChannelMessages(channelId, channelName, previousPriorities = new Map(), existingIds = new Set(), previousThreadReplies = new Map(), previousLatestReplyTs = new Map(), previousConcluded = new Map()) {
  const demands = [];
  let cursor;
  let cacheHits = 0;
  let cacheMisses = 0;

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

      // Get thread replies (TODAS, paginadas).
      //
      // REGRA DE FECHAMENTO: o sinal de "concluida" eh APENAS reaction ✅/🟢
      // numa RESPOSTA do thread, nao na mensagem principal. Reaction na main
      // message eh ambigua (pode ser "li", "ack", "ciente") e nao representa
      // resolucao real — alem de gerar timestamps falsos (sync n/d quando
      // a reaction foi feita). Por isso nao geramos reply sintetico aqui.
      const threadReplies = [];
      if (msg.reply_count > 0) {
        // Cache hit APENAS para demandas ja concluidas (closureSource preserved).
        // Pra demandas em andamento NAO da pra cachear: latest_reply nao muda
        // quando alguem so adiciona uma REACAO (e a reacao 🟢 eh o sinal
        // de fechamento que precisamos detectar a cada ciclo).
        const demandIdGuess = `slack_${channelId}_${msg.ts}`;
        const isAlreadyConcluded = previousConcluded.has(demandIdGuess);
        const cached = previousThreadReplies.get(demandIdGuess);
        if (isAlreadyConcluded && cached) {
          threadReplies.push(...cached);
          cacheHits++;
        } else {
          cacheMisses++;
          try {
            await sleep(250); // throttle vs rate limit
            const replies = await fetchAllReplies(channelId, msg.ts);

            for (const reply of replies.slice(1)) {
              const info = reply.user ? await getUserInfo(reply.user) : { name: reply.username || 'Bot', isTeam: false };
              const replyText = resolveUserMentions(reply.text || '');
              const reactions = reply.reactions || [];
              const hasCheckReaction = reactions.some(r => CHECK_REACTIONS.includes(r.name));
              const hasLoadingReaction = reactions.some(r => LOADING_REACTIONS.includes(r.name));

              threadReplies.push({
                author: info.name,
                text: hasCheckReaction ? `${replyText} [✅ Reacao de conclusao]` : replyText,
                timestamp: new Date(parseFloat(reply.ts) * 1000).toISOString(),
                isTeamMember: info.isTeam,
                hasCheckReaction,
                ...(hasLoadingReaction ? { hasLoadingReaction: true } : {}),
                files: mapSlackFiles(reply.files),
              });
            }
          } catch (e) {
            console.error(`  Erro ao buscar replies de ${msg.ts}:`, e.message);
          }
        }
      }

      const title = fields['Título da demanda'] || fields['Titulo da demanda'] ||
                    fields['Solicitação'] || fields['Solicitacao'] ||
                    resolvedText.split('\n').find(l => l.length > 10 && !l.startsWith('*'))?.slice(0, 100) ||
                    resolvedText.slice(0, 80);

      // Extrai SO o conteudo apos "Descrição da demanda" ate o proximo campo
      // (ex: *Prioridade*, *Solicitante*, etc). Captura multi-linha completo.
      // Os outros campos ja sao mostrados em outras partes do UI — aqui so o corpo.
      const extractDescriptionBody = (raw) => {
        const headerRe = /\*\s*Descri[cç][aã]o(?:\s+da\s+demanda)?\s*\*:?\s*\n?/i;
        const m = raw.match(headerRe);
        if (!m) return null;
        const after = raw.slice(m.index + m[0].length);
        // Para no proximo header em negrito (*Campo*) — esses sao os outros campos
        const nextHeaderRe = /\n\s*\*[^*\n]+\*\s*:?\s*(?:\n|$)/;
        const stop = after.match(nextHeaderRe);
        const body = stop ? after.slice(0, stop.index) : after;
        return body.trim();
      };
      const description = extractDescriptionBody(resolvedText) ||
                          fields['Descrição da demanda'] || fields['Descricao da demanda'] ||
                          fields['Descrição'] || fields['Descricao'] ||
                          resolvedText;

      // Prioridade explicita no campo do Slack
      const demandId = `slack_${channelId}_${msg.ts}`;
      const priority = (() => {
        const p = (fields['Prioridade'] || '').toLowerCase();
        if (p.includes('p1') || p.includes('crítico') || p.includes('critico')) return 'p1';
        if (p.includes('p2') || p.includes('alta')) return 'p2';
        if (p.includes('p3') || p.includes('média') || p.includes('media')) return 'p3';
        // Sem prioridade explicita no Slack:
        // - Se a demanda ja existia no sync anterior, preserva a classificacao antiga
        // - Se e nova, atribui P3 (regra: conciliacao, remessa SITEF, etc viram P3)
        if (existingIds.has(demandId)) {
          return previousPriorities.get(demandId) || 'sem_classificacao';
        }
        return 'p3';
      })();

      // Workflows especificos (botname) tem precedencia sobre o campo "Tipo de demanda".
      // "Nova conciliação" e "Remessa Sitef" sao templates do Slack — identifica
      // unicamente pelo nome do bot/app emissor.
      const workflowName = (msg.username || '').toLowerCase();
      const isSitefWorkflow = workflowName.includes('remessa sitef') || workflowName.includes('sitef');
      const isConciliacaoWorkflow = workflowName.includes('nova conciliacao') ||
                                    workflowName.includes('nova conciliação') ||
                                    workflowName.includes('conciliacao') ||
                                    workflowName.includes('conciliação');

      const demandType = (() => {
        if (isSitefWorkflow) return 'Sitef';
        if (isConciliacaoWorkflow) return 'Conciliacao';
        const t = (fields['Tipo de demanda'] || fields['Tipo de execução'] || fields['Tipo de execucao'] || '').toLowerCase();
        if (t.includes('bug') || t.includes('problema')) return 'Problema/Bug';
        if (t.includes('update')) return 'Update';
        if (t.includes('remessa')) return 'Remessa';
        if (t.includes('tarefa') || t.includes('ajuda')) return 'Tarefa/Ajuda';
        return 'Outro';
      })();

      // Categoria pra Sitef/Conciliacao baseada no campo "Tipo" do form de conciliacao
      // (ex: "Criação de nova conciliação", "Inclusão de rede") — ou direto "Sitef".
      const autoCategoryFromWorkflow = (() => {
        if (isSitefWorkflow) return 'Sitef';
        if (isConciliacaoWorkflow) {
          const t = (fields['Tipo'] || '').toLowerCase();
          if (t.includes('inclus') && t.includes('rede')) return 'Inclusao de Rede';
          if (t.includes('cria') && t.includes('conciliac')) return 'Criacao de Nova Conciliacao';
          // Default Conciliacao: trata como criacao se nao especificar
          return 'Criacao de Nova Conciliacao';
        }
        return null;
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

      // Produto: priorizar campo "Produto" do formulario. Se vazio, detectar
      // pelo nome do workflow do bot (ex: "Nova solicitação KPI telemedicina"
      // → "Telemedicina"). Cobre KPI/Smartvale que tem 1 workflow por produto.
      const product = (() => {
        const explicit = fields['Produto'];
        if (explicit) return explicit;
        const w = (msg.username || '').toLowerCase();
        if (w.includes('telemedic')) return 'Telemedicina';
        if (w.includes('benefici') || w.includes('benefício')) return 'Beneficios';
        if (w.includes('frota')) return 'Frotas';
        return '';
      })();

      const taskLinkMatch = resolvedText.match(/(https:\/\/app\.clickup\.com\/[^\s>]+)/i) ||
                            resolvedText.match(/Link da task[:\s]*\n?(https?:\/\/[^\s>]+)/i) ||
                            resolvedText.match(/Link da solicitação[:\s]*\n?(https?:\/\/[^\s>]+)/i) ||
                            resolvedText.match(/Link da solicitacao[:\s]*\n?(https?:\/\/[^\s>]+)/i);
      const taskLink = taskLinkMatch?.[1] || '';
      const hasTask = !!taskLink;

      const tags = [];
      if (product) tags.push(product.toLowerCase());
      if (demandType !== 'Outro') tags.push(demandType.toLowerCase().replace('/', '-'));

      // Pra demandas Sitef/Conciliacao, pre-classifica categoria via closure object
      // (a UI de fechamento ja le isso; user pode sobrescrever depois)
      const closure = autoCategoryFromWorkflow
        ? { category: autoCategoryFromWorkflow }
        : undefined;

      // Inicio do atendimento: timestamp da PRIMEIRA reply (cronologica) com
      // reaction :loading:. Usado pra SLA de 1a resposta em Sitef/Conciliacao.
      // Replies ja vem em ordem cronologica do conversations.replies.
      const loadingReply = threadReplies.find(r => r.hasLoadingReaction);
      const serviceStartedAt = loadingReply ? loadingReply.timestamp : null;

      const demand = {
        id: demandId,
        title: title.replace(/\*/g, '').trim(),
        // So o corpo apos "Descrição da demanda" — outros campos ja aparecem
        // em locais proprios do UI (titulo, prioridade, solicitante, etc).
        description: description.replace(/\*/g, '').trim(),
        priority,
        status: 'aberta',
        demandType,
        workflow,
        product,
        requester: { name: requesterName.replace(/@/g, ''), avatar: '' },
        assignee: assigneeName ? { name: assigneeName, avatar: '' } : null,
        ...(closure ? { closure } : {}),
        cc,
        createdAt: new Date(parseFloat(msg.ts) * 1000).toISOString(),
        serviceStartedAt,
        dueDate,
        completedAt: null,
        hasTask,
        taskLink,
        tags,
        slackChannel: `#${channelName}`,
        slackPermalink: `https://${process.env.SLACK_WORKSPACE || 'workspace'}.slack.com/archives/${channelId}/p${msg.ts.replace('.', '')}`,
        replies: msg.reply_count || 0,
        threadReplies,
        files: mapSlackFiles(msg.files),
      };

      demands.push(demand);
    }

    cursor = result.response_metadata?.next_cursor;
  } while (cursor);

  if (cacheHits + cacheMisses > 0) {
    console.log(`  cache replies: ${cacheHits} hits, ${cacheMisses} misses`);
  }
  return demands;
}

// === PRESERVAR ESTADO CONCLUIDA DO SYNC ANTERIOR ===
// Evita regressao quando heuristicas nao detectam conclusao em nova rodada.
// Tambem preserva prioridade antiga (ex: sem_classificacao continua
// sem_classificacao em demandas anteriores; novas viram P3).
function loadPreviousState() {
  const previousFile = path.join(__dirname, '..', 'src', 'data', 'realDemands.ts');
  const empty = {
    concluded: new Map(),
    priorities: new Map(),
    existingIds: new Set(),
    threadReplies: new Map(),
    latestReplyTs: new Map(),
  };
  if (!fs.existsSync(previousFile)) return empty;
  try {
    const content = fs.readFileSync(previousFile, 'utf-8');
    const match = content.match(/export const mockDemands[^=]*=\s*(\[[\s\S]*?\]);/);
    if (!match) return empty;
    const demands = JSON.parse(match[1]);
    const concluded = new Map();
    const priorities = new Map();
    const existingIds = new Set();
    const threadReplies = new Map();
    const latestReplyTs = new Map();
    for (const d of demands) {
      existingIds.add(d.id);
      if (d.priority) priorities.set(d.id, d.priority);
      if (d.status === 'concluida' && d.completedAt) {
        concluded.set(d.id, { status: d.status, completedAt: d.completedAt });
      }
      if (Array.isArray(d.threadReplies) && d.threadReplies.length > 0) {
        threadReplies.set(d.id, d.threadReplies);
        // Ultimo reply (mais recente em timestamp ISO)
        const last = d.threadReplies[d.threadReplies.length - 1];
        if (last?.timestamp) latestReplyTs.set(d.id, last.timestamp);
      }
    }
    return { concluded, priorities, existingIds, threadReplies, latestReplyTs };
  } catch (e) {
    console.warn('  Aviso: nao foi possivel ler estado anterior:', e.message);
    return empty;
  }
}

// Throttle entre chamadas conversations.replies pra evitar rate limit.
// Slack tier-3 = 50 req/min/method. 250ms = 4/s = 240/min → ainda confortável.
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  console.log('Conectando ao Slack...');
  const auth = await client.auth.test();
  console.log(`Workspace: ${auth.team} | Bot: ${auth.user}`);
  console.log(`Periodo: 01/04/2026 ate hoje\n`);

  // PRE-FETCH todos os usuarios (elimina rate limiting)
  await prefetchUsers();

  // Carregar estado anterior para preservar concluidas + prioridades
  const previousState = loadPreviousState();
  const previousConcluded = previousState.concluded;
  const previousPriorities = previousState.priorities;
  const existingIds = previousState.existingIds;
  const previousThreadReplies = previousState.threadReplies;
  const previousLatestReplyTs = previousState.latestReplyTs;
  console.log(`${previousConcluded.size} demandas com status concluida no sync anterior (serao preservadas)`);
  console.log(`${existingIds.size} demandas no arquivo anterior — novas demandas sem prioridade serao classificadas como P3.\n`);

  const channelsResult = await client.conversations.list({ types: 'public_channel', limit: 200 });
  const clientChannels = channelsResult.channels.filter(c => c.name.startsWith('cliente-'));

  console.log(`${clientChannels.length} canais de clientes encontrados\n`);

  let allDemands = [];

  // Tracks channels that already fired a not_in_channel alert this run.
  // Prevents duplicate emails if the same error repeats across retries.
  const alertedChannels = new Set();

  for (const channel of clientChannels) {
    // Skip channels where the bot is intentionally absent — no error logged.
    if (IGNORED_CHANNELS.has(channel.name)) {
      console.log(`Pulando #${channel.name} (na lista de ignorados)`);
      continue;
    }

    console.log(`Buscando #${channel.name}...`);
    try {
      const demands = await fetchChannelMessages(channel.id, channel.name, previousPriorities, existingIds, previousThreadReplies, previousLatestReplyTs, previousConcluded);
      console.log(`  ${demands.length} demandas encontradas`);
      allDemands = allDemands.concat(demands);
    } catch (err) {
      const isNotInChannel = err.message && err.message.includes('not_in_channel');
      if (isNotInChannel) {
        // WARN only — not an error we can act on at sync time
        console.warn(`  [WARN] Bot nao esta em #${channel.name} (not_in_channel) — verificar convite`);
        if (!alertedChannels.has(channel.name)) {
          alertedChannels.add(channel.name);
          // Fire-and-forget alert to legacy-state; failure here must not break sync
          fetch('http://flowdesk-legacy-state:8090/internal-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subject: `[FlowDesk] Bot perdeu acesso ao canal #${channel.name}`,
              body: `O bot @justflow nao esta no canal #${channel.name} e nao conseguiu buscar mensagens.\n\nAcao necessaria: convidar o bot no Slack com "/invite @justflow" dentro do canal #${channel.name}.`,
            }),
          }).catch((fetchErr) => {
            console.warn(`  [WARN] Falha ao enviar alerta para legacy-state: ${fetchErr.message}`);
          });
        }
      } else {
        console.error(`  Erro: ${err.message}`);
      }
    }
    await new Promise(r => setTimeout(r, 500));
  }

  // === FILTRO POR ROTEAMENTO DE CANAIS ===
  // Le fd_channel_routing do shared-state.json (configurado via UI).
  // Mantem so demandas de canais marcados como "demandas" (geral) ou
  // sem cadastro com defaultRoute = demandas.
  try {
    const fs = require('fs');
    const path = require('path');
    const stateFile = path.join(__dirname, '..', 'data', 'shared-state.json');
    if (fs.existsSync(stateFile)) {
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      const routing = state.fd_channel_routing;
      if (routing && Array.isArray(routing.channels)) {
        const ruleByName = new Map(
          routing.channels.map((c) => [c.name.toLowerCase(), c.routeTo])
        );
        const defaultRoute = routing.defaultRoute || 'demandas';
        const before = allDemands.length;
        allDemands = allDemands.filter((d) => {
          const ch = (d.slackChannel || '').replace(/^#/, '').toLowerCase();
          const route = ruleByName.get(ch) ?? (
            /^cliente-/i.test(ch) ? 'demandas' :
            /^opera[çc][õo]es-sql$/i.test(ch) ? 'sql' :
            defaultRoute
          );
          return route === 'demandas';
        });
        if (before !== allDemands.length) {
          console.log(`Roteamento aplicado: ${before} -> ${allDemands.length} demandas (geral)`);
        }
      }
    }
  } catch (err) {
    console.warn('Roteamento nao aplicado (shared-state nao acessivel):', err.message);
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

    // 1) Tem emoji de check na thread? Concluida. (fonte de verdade mais forte)
    const checks = replies.filter(r => r.hasCheckReaction);
    if (checks.length > 0) {
      d.status = 'concluida';
      d.completedAt = checks[checks.length - 1].timestamp;
      d.closureSource = 'green_circle';  // fechada AGORA com 🟢
      statusConcluida++;
      continue;
    }

    // 2) Estava concluida no sync anterior? Preserva.
    //    Protege contra remocao acidental do emoji e mantem o estado
    //    manualmente ajustado (via UI ou script de limpeza).
    const prev = previousConcluded.get(d.id);
    if (prev) {
      d.status = prev.status;
      d.completedAt = prev.completedAt;
      d.closureSource = 'preserved';  // concluida antiga, preservada
      statusPreservadas++;
      continue;
    }

    // 3) Equipe ja respondeu? Em andamento.
    if (teamReplies.length > 0) {
      d.status = 'em_andamento';
      statusAndamento++;
      continue;
    }

    // 4) Ninguem da equipe respondeu ainda. Aberta.
    statusAberta++;
  }

  console.log(`\nTotal: ${allDemands.length} demandas sincronizadas`);
  console.log(`  Concluidas (circulo verde detectado): ${statusConcluida}`);
  console.log(`  Concluidas (preservadas do sync anterior): ${statusPreservadas}`);
  console.log(`  Em andamento: ${statusAndamento} | Abertas: ${statusAberta}`);

  const output = `import { SlackDemand } from "@/types/demand";

export const mockDemands: SlackDemand[] = ${JSON.stringify(allDemands, null, 2)};

/** Extrai nome do cliente do canal Slack (ex: #cliente-acme -> Acme) */
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
