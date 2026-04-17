require('dotenv').config();
const { WebClient } = require('@slack/web-api');
const fs = require('fs');
const path = require('path');

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

// April 1st 2026 00:00 UTC-3
const OLDEST = new Date('2026-04-01T00:00:00-03:00').getTime() / 1000;
const NOW = Date.now() / 1000;

// Team members (internal) - will be detected by checking if they're in the workspace
const TEAM_MEMBERS_CACHE = {};

// Equipe interna (time interno). Qualquer usuario fora dessa lista = cliente externo.
// Configurar via variavel de ambiente TEAM_MEMBERS (JSON array) ou editar localmente.
const TEAM_NAMES = new Set(
  process.env.TEAM_MEMBERS ? JSON.parse(process.env.TEAM_MEMBERS) : []
);

async function isTeamMember(userId) {
  if (TEAM_MEMBERS_CACHE[userId] !== undefined) return TEAM_MEMBERS_CACHE[userId];
  try {
    const info = await client.users.info({ user: userId });
    // Bot users and the workflow bot are not team members for our purposes
    const isBot = info.user.is_bot || info.user.id === 'USLACKBOT';
    if (isBot) { TEAM_MEMBERS_CACHE[userId] = false; return false; }
    const realName = info.user.real_name || info.user.profile?.real_name || '';
    const displayName = info.user.profile?.display_name || '';
    const isTeam = TEAM_NAMES.has(realName) || TEAM_NAMES.has(displayName);
    TEAM_MEMBERS_CACHE[userId] = isTeam;
    return isTeam;
  } catch {
    TEAM_MEMBERS_CACHE[userId] = false;
    return false;
  }
}

async function getUserName(userId) {
  try {
    const info = await client.users.info({ user: userId });
    return info.user.real_name || info.user.name || userId;
  } catch {
    return userId;
  }
}

// Parse user mentions <@U12345> to names
async function resolveUserMentions(text) {
  const mentions = text.match(/<@(U[A-Z0-9]+)>/g) || [];
  let resolved = text;
  for (const mention of mentions) {
    const userId = mention.replace(/<@|>/g, '');
    const name = await getUserName(userId);
    resolved = resolved.replace(mention, `@${name}`);
  }
  return resolved;
}

function parseWorkflowMessage(text, botName) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const fields = {};
  let currentKey = null;

  for (const line of lines) {
    // Bold field: *Field:* or **Field**
    const boldMatch = line.match(/^\*(.+?)\*:?\s*(.*)/);
    if (boldMatch) {
      currentKey = boldMatch[1].replace(/\*/g, '').trim();
      const value = boldMatch[2].trim();
      if (value) fields[currentKey] = value;
      continue;
    }
    // If we have a current key and this line is the value
    if (currentKey && !fields[currentKey]) {
      fields[currentKey] = line;
      currentKey = null;
    }
  }

  return fields;
}

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

      // ONLY import workflow/bot messages that are actual demands
      // Must have bot_id AND contain demand patterns (Nova demanda, Solicitação, etc.)
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

      // Skip system/join/leave messages
      const skipSubtypes = ['channel_join', 'channel_leave', 'channel_topic', 'channel_purpose', 'channel_name', 'channel_archive', 'group_join', 'group_leave'];
      if (skipSubtypes.includes(msg.subtype)) continue;

      // Skip "entrou no canal" / "joined" messages
      const textLower = (msg.text || '').toLowerCase();
      if (textLower.includes('entrou no canal') || textLower.includes('has joined the channel') || textLower.includes('was added to') || textLower.includes('set the channel')) continue;

      const resolvedText = await resolveUserMentions(msg.text || '');
      const fields = parseWorkflowMessage(resolvedText, '');

      // Check for ✅ reaction on parent message
      const parentCheckReaction = (msg.reactions || []).some(r =>
        ['white_check_mark', 'heavy_check_mark', 'ballot_box_with_check', 'check', 'large_green_circle'].includes(r.name)
      );

      // Get thread replies
      const threadReplies = [];
      if (msg.reply_count > 0) {
        try {
          const replies = await client.conversations.replies({
            channel: channelId,
            ts: msg.ts,
            limit: 50,
          });

          // Parent message (index 0) - check reactions from full API response
          const parentFull = replies.messages[0];
          const parentHasCheck = parentCheckReaction || (parentFull.reactions || []).some(r =>
            ['white_check_mark', 'heavy_check_mark', 'ballot_box_with_check', 'check', 'large_green_circle'].includes(r.name)
          );

          // If parent has check reaction, inject a synthetic "conclusion" reply
          if (parentHasCheck) {
            // Find who reacted with check
            const checkReaction = (parentFull.reactions || msg.reactions || []).find(r =>
              ['white_check_mark', 'heavy_check_mark', 'ballot_box_with_check', 'check', 'large_green_circle'].includes(r.name)
            );
            const reactorId = checkReaction?.users?.[0];
            const reactorName = reactorId ? await getUserName(reactorId) : 'Equipe';
            const isReactorTeam = reactorId ? await isTeamMember(reactorId) : true;

            threadReplies.push({
              author: reactorName,
              text: '[✅ Reacao de conclusao na mensagem principal]',
              timestamp: new Date(parseFloat(parentFull.ts) * 1000 + 1000).toISOString(),
              isTeamMember: isReactorTeam,
              hasCheckReaction: true,
            });
          }

          // Thread replies (skip parent at index 0)
          for (const reply of replies.messages.slice(1)) {
            const authorName = reply.user ? await getUserName(reply.user) : (reply.username || 'Bot');
            const isTeam = reply.user ? await isTeamMember(reply.user) : false;
            const replyText = await resolveUserMentions(reply.text || '');

            // Check for ✅ reaction on this reply
            const hasCheckReaction = (reply.reactions || []).some(r =>
              ['white_check_mark', 'heavy_check_mark', 'ballot_box_with_check', 'check', 'large_green_circle'].includes(r.name)
            );

            threadReplies.push({
              author: authorName,
              text: hasCheckReaction ? `${replyText} [✅ Reacao de conclusao]` : replyText,
              timestamp: new Date(parseFloat(reply.ts) * 1000).toISOString(),
              isTeamMember: isTeam,
              hasCheckReaction,
            });
          }
        } catch (e) {
          console.error(`  Erro ao buscar replies de ${msg.ts}:`, e.message);
        }
      } else if (parentCheckReaction) {
        // No replies but parent has check reaction
        const checkReaction = (msg.reactions || []).find(r =>
          ['white_check_mark', 'heavy_check_mark', 'ballot_box_with_check', 'check', 'large_green_circle'].includes(r.name)
        );
        const reactorId = checkReaction?.users?.[0];
        const reactorName = reactorId ? await getUserName(reactorId) : 'Equipe';
        const isReactorTeam = reactorId ? await isTeamMember(reactorId) : true;

        threadReplies.push({
          author: reactorName,
          text: '[✅ Reacao de conclusao na mensagem principal]',
          timestamp: new Date(parseFloat(msg.ts) * 1000 + 1000).toISOString(),
          isTeamMember: isReactorTeam,
          hasCheckReaction: true,
        });
      }

      // Extract demand info
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

      // Extract requester from "enviada por @Name" or "Solicitante" field
      const requesterMatch = resolvedText.match(/enviada por @(.+?)[\s\n]/i) ||
                              resolvedText.match(/Solicitante[:\s]*\n?@?(.+?)[\n$]/i);
      const requesterName = fields['Solicitante']?.replace('@', '') ||
                            requesterMatch?.[1]?.trim() ||
                            (msg.user ? await getUserName(msg.user) : 'Desconhecido');

      // Extract assignee from cc or "Responsável"
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

      // Due date
      const dueDateField = fields['Data limite'] || fields['Prazo'] || null;
      let dueDate = null;
      if (dueDateField) {
        try {
          dueDate = new Date(dueDateField).toISOString();
        } catch {}
      }

      // Workflow name from bot name
      const isWorkflow = msg.subtype === 'bot_message' || !!msg.bot_id;
      const workflow = msg.username || (isWorkflow ? 'Fluxo de Trabalho' : 'Mensagem');

      // Product
      const product = fields['Produto'] || '';

      // Task link
      const taskLinkMatch = resolvedText.match(/(https:\/\/app\.clickup\.com\/[^\s>]+)/i) ||
                            resolvedText.match(/Link da task[:\s]*\n?(https?:\/\/[^\s>]+)/i) ||
                            resolvedText.match(/Link da solicitação[:\s]*\n?(https?:\/\/[^\s>]+)/i) ||
                            resolvedText.match(/Link da solicitacao[:\s]*\n?(https?:\/\/[^\s>]+)/i);
      const taskLink = taskLinkMatch?.[1] || '';
      const hasTask = !!taskLink;

      // Tags from product, type, channel
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

async function main() {
  console.log('Conectando ao Slack...');
  const auth = await client.auth.test();
  console.log(`Workspace: ${auth.team} | Bot: ${auth.user}`);
  console.log(`Periodo: 01/04/2026 ate hoje\n`);

  // Get client channels
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
    // Rate limit
    await new Promise(r => setTimeout(r, 1200));
  }

  // Sort by date (newest first)
  allDemands.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // === ANALISE DE STATUS ===
  const RESOLVED_PATTERNS = [
    /ajustad[oa]/i, /corrigid[oa]/i, /resolvid[oa]/i, /conclu[ií]d[oa]/i,
    /finalizado/i, /pronto/i, /feito/i, /realizado/i,
    /liberado/i, /publicado/i, /implantado/i, /deploy/i,
    /pode testar/i, /já pode/i, /ja pode/i,
    /atualizado/i, /alterado conforme/i,
    /solicitação atendida/i, /solicitacao atendida/i,
    /problema resolvido/i, /tudo certo/i,
    /encaminhad[oa]/i, /repassad[oa]/i, /direcionad[oa]/i,
  ];
  const GRATITUDE_PATTERNS = [
    /obrigad[oa]/i, /valeu/i, /agradec/i, /perfeito/i,
    /excelente/i, /show/i, /top/i, /massa/i,
    /muito bom/i, /deu certo/i, /funcionou/i, /consegui/i,
  ];

  let statusConcluida = 0, statusAndamento = 0, statusAberta = 0;

  for (const d of allDemands) {
    const replies = [...(d.threadReplies || [])].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const teamReplies = replies.filter(r => r.isTeamMember);

    // Caso 0: Ultimo check reaction na thread = conclusao
    // Nao filtra por isTeamMember: equipe reage com check em mensagens do cliente para fechar
    const checks = replies.filter(r => r.hasCheckReaction);
    if (checks.length > 0) {
      d.status = 'concluida';
      d.completedAt = checks[checks.length - 1].timestamp;
      statusConcluida++;
      continue;
    }

    if (teamReplies.length === 0) { statusAberta++; continue; }

    // Analise do ultimo reply
    let analyzed = false;
    for (let i = replies.length - 1; i >= 0; i--) {
      const r = replies[i];
      if (r.isTeamMember) {
        if (RESOLVED_PATTERNS.some(p => p.test(r.text))) {
          d.status = 'concluida';
          d.completedAt = r.timestamp;
          statusConcluida++;
        } else {
          d.status = 'em_andamento';
          statusAndamento++;
        }
        analyzed = true;
        break;
      }
      if (!r.isTeamMember && GRATITUDE_PATTERNS.some(p => p.test(r.text))) {
        const teamBefore = replies.slice(0, i).reverse().find(t => t.isTeamMember);
        if (teamBefore) {
          d.status = 'concluida';
          d.completedAt = teamBefore.timestamp;
          statusConcluida++;
          analyzed = true;
          break;
        }
      }
    }
    if (!analyzed) statusAberta++;
  }

  console.log(`\nTotal: ${allDemands.length} demandas sincronizadas`);
  console.log(`  Concluidas: ${statusConcluida} | Em andamento: ${statusAndamento} | Abertas: ${statusAberta}`);

  // Write to file
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
