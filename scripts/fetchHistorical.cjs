/**
 * Coleta dados historicos do Slack (Jan-Mar 2026) usando links da planilha.
 * Cruza com dados da planilha (datas, prioridade, motivo expiracao).
 * Gera src/data/historicalDemands.ts
 */
require('dotenv').config();
const { WebClient } = require('@slack/web-api');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

// === Caches ===
const USER_CACHE = {};
const TEAM_CACHE = {};

async function getUserName(userId) {
  if (USER_CACHE[userId]) return USER_CACHE[userId];
  try {
    const info = await client.users.info({ user: userId });
    const name = info.user.real_name || info.user.name || userId;
    USER_CACHE[userId] = name;
    return name;
  } catch { USER_CACHE[userId] = userId; return userId; }
}

// Equipe Just (time interno). Qualquer usuario fora dessa lista = cliente externo.
const JUST_TEAM_NAMES = new Set([
  'Hugo Cordeiro Junior', 'Daniel Bichof', 'Bruna Queiroz',
  'Cezar Felipe', 'Tiago Silva', 'Rafael Cursino',
  'Gabriel', 'Schai Bock', 'Vinicius Nunes', 'Erick Sousa', 'Luiza',
]);

async function isTeamMember(userId) {
  if (TEAM_CACHE[userId] !== undefined) return TEAM_CACHE[userId];
  try {
    const info = await client.users.info({ user: userId });
    const isBot = info.user.is_bot || info.user.id === 'USLACKBOT';
    if (isBot) { TEAM_CACHE[userId] = false; return false; }
    const realName = info.user.real_name || info.user.profile?.real_name || '';
    const displayName = info.user.profile?.display_name || '';
    const isTeam = JUST_TEAM_NAMES.has(realName) || JUST_TEAM_NAMES.has(displayName);
    TEAM_CACHE[userId] = isTeam;
    return isTeam;
  } catch { TEAM_CACHE[userId] = false; return false; }
}

async function resolveUserMentions(text) {
  const mentions = text.match(/<@(U[A-Z0-9]+)>/g) || [];
  let resolved = text;
  for (const m of mentions) {
    const uid = m.replace(/<@|>/g, '');
    const name = await getUserName(uid);
    resolved = resolved.replace(m, `@${name}`);
  }
  return resolved;
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

// Excel serial em BRT (UTC-3) -> ISO UTC
function excelSerialToISO(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const d = new Date((serial - 25569) * 86400 * 1000 + 3 * 3600 * 1000);
  return d.toISOString();
}

function mapPriority(prio) {
  if (!prio) return 'sem_classificacao';
  const p = prio.toLowerCase();
  if (p.includes('p1') || p.includes('crít')) return 'p1';
  if (p.includes('p2') || p.includes('alta')) return 'p2';
  if (p.includes('p3') || p.includes('méd')) return 'p3';
  return 'sem_classificacao';
}

function mapStatus(slaRes) {
  if (!slaRes) return 'concluida';
  const s = slaRes.toLowerCase();
  if (s.includes('expir')) return 'expirada';
  return 'concluida';
}

function mapDemandType(tipo) {
  if (!tipo) return 'Outro';
  if (tipo.includes('Tarefa') || tipo.includes('Ajuda')) return 'Tarefa/Ajuda';
  if (tipo.includes('Problema') || tipo.includes('Bug')) return 'Problema/Bug';
  if (tipo.includes('Update')) return 'Update';
  if (tipo.includes('Remessa')) return 'Remessa';
  return 'Outro';
}

// Map expiration reasons from spreadsheet to system values
function mapExpirationReason(reason) {
  if (!reason) return '';
  const r = reason.trim();
  const mapping = {
    'Falta de retorno do cliente': 'Falta de retorno do cliente',
    'Falta de retorno da Just': 'Falta de retorno da Just',
    'Demora para validar a correção': 'Demora para validar a correcao',
    'Demora no retorno da Just': 'Demora no retorno da Just',
    'Demora no primeiro atendimento': 'Demora no primeiro atendimento',
    'Demora no retorno do cliente': 'Demora no retorno do cliente',
    'Demanda fora do escopo': 'Demanda fora do escopo',
    'Dependência de terceiros': 'Dependencia de terceiros',
    'Ajuste na prioridade': 'Ajuste na prioridade',
    'Problema complexo': 'Demanda complexa',
    'Demanda complexa': 'Demanda complexa',
    'Muitas denandas juntas': 'Muitas demandas juntas',
    'Muitas demandas juntas': 'Muitas demandas juntas',
    'Resolução por task': 'Demanda fora do escopo',
    'Erro operacional': 'Demora no retorno da Just',
    'Mais de uma demanda no mesmo chamado': 'Muitas demandas juntas',
    'Prioridade incorreta': 'Ajuste na prioridade',
  };
  return mapping[r] || r;
}

async function main() {
  // Read spreadsheet
  const filePath = path.join('C:', 'Users', 'hugoc', 'Downloads', 'Demandas Suporte - Just.xlsx');
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets['Suporte 2026'];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', range: 0 });

  // Filter Jan-Mar 2026, excluir cashtime
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    const canal = String(row[7] || '').toLowerCase();
    if (canal.includes('cashtime')) continue; // Excluir cashtime
    const abertura = row[9];
    if (typeof abertura !== 'number') continue;
    const d = new Date((abertura - 25569) * 86400 * 1000);
    if (d.getFullYear() !== 2026 || d.getMonth() + 1 > 3) continue;
    rows.push(row);
  }

  console.log(`Total demandas Jan-Mar: ${rows.length}`);
  console.log('Conectando ao Slack...');

  const info = await client.auth.test();
  console.log(`Workspace: ${info.team} | Bot: ${info.user}\n`);

  const demands = [];
  let fetched = 0, errors = 0, noMsg = 0;

  for (const row of rows) {
    const link = String(row[14] || '');
    const match = link.match(/archives\/([A-Z0-9]+)\/p(\d+)/);
    if (!match) { errors++; continue; }

    const channelId = match[1];
    const ts = match[2].slice(0, 10) + '.' + match[2].slice(10);

    fetched++;
    if (fetched % 25 === 0) console.log(`  Processando ${fetched}/${rows.length}...`);

    try {
      // Fetch the original message
      const result = await client.conversations.replies({
        channel: channelId,
        ts: ts,
        limit: 50,
      });

      if (!result.messages || result.messages.length === 0) {
        noMsg++;
        // Use spreadsheet data only
        demands.push(buildFromSpreadsheet(row, channelId, ts, link));
        continue;
      }

      const parentMsg = result.messages[0];
      const resolvedText = await resolveUserMentions(parentMsg.text || '');
      const fields = parseWorkflowMessage(resolvedText);

      // Extract thread replies
      const threadReplies = [];
      // Check parent reactions
      const parentHasCheck = (parentMsg.reactions || []).some(r =>
        ['white_check_mark', 'heavy_check_mark', 'ballot_box_with_check', 'check'].includes(r.name)
      );
      if (parentHasCheck) {
        const checkReaction = (parentMsg.reactions || []).find(r =>
          ['white_check_mark', 'heavy_check_mark', 'ballot_box_with_check', 'check'].includes(r.name)
        );
        const reactorId = checkReaction?.users?.[0];
        const reactorName = reactorId ? await getUserName(reactorId) : 'Equipe';
        const isReactorTeam = reactorId ? await isTeamMember(reactorId) : true;
        threadReplies.push({
          author: reactorName,
          text: '[✅ Reacao de conclusao na mensagem principal]',
          timestamp: new Date(parseFloat(parentMsg.ts) * 1000 + 1000).toISOString(),
          isTeamMember: isReactorTeam,
          hasCheckReaction: true,
        });
      }

      for (const reply of result.messages.slice(1)) {
        const authorName = reply.user ? await getUserName(reply.user) : (reply.username || 'Bot');
        const isTeam = reply.user ? await isTeamMember(reply.user) : false;
        const replyText = await resolveUserMentions(reply.text || '');
        const hasCheck = (reply.reactions || []).some(r =>
          ['white_check_mark', 'heavy_check_mark', 'ballot_box_with_check', 'check'].includes(r.name)
        );
        threadReplies.push({
          author: authorName,
          text: hasCheck ? `${replyText} [✅ Reacao de conclusao]` : replyText,
          timestamp: new Date(parseFloat(reply.ts) * 1000).toISOString(),
          isTeamMember: isTeam,
          hasCheckReaction: hasCheck,
        });
      }

      // Find last team reply
      const teamReplies = threadReplies.filter(r => r.isTeamMember && !r.text.includes('Reacao de conclusao'));
      const lastTeamReply = teamReplies.length > 0 ? teamReplies[teamReplies.length - 1] : null;

      // Channel name from spreadsheet
      const canal = String(row[7] || '').replace('#', '');

      // Build demand using SLACK data + SPREADSHEET dates/priority
      const title = fields['Titulo da demanda'] || fields['Título da demanda'] || fields['Titulo'] || String(row[0] || '');
      const description = fields['Descricao'] || fields['Descrição'] || fields['Descricao detalhada'] || String(row[1] || '');
      const workflow = fields['Workflow'] || fields['Tipo de demanda'] || fields['Fluxo'] || '';
      const product = fields['Produto'] || fields['Sistema'] || '';
      const requesterName = (fields['Solicitante'] || String(row[6] || '')).replace('@', '').trim();
      const ccRaw = fields['Cc'] || fields['CC'] || fields['Em copia'] || '';
      const cc = ccRaw ? ccRaw.split(',').map(c => c.trim().replace('@', '')).filter(Boolean) : [];
      const hasTask = String(row[4] || '').toLowerCase() === 'sim';
      const taskLink = String(row[5] || '');
      const tags = [];

      // Spreadsheet overrides for dates and status
      const createdAt = excelSerialToISO(row[9]);
      const completedAt = excelSerialToISO(row[11]);
      const atendimentoAt = excelSerialToISO(row[10]); // Data 1o atendimento da planilha
      const priority = mapPriority(String(row[2] || ''));
      const status = mapStatus(String(row[17] || ''));
      const demandType = mapDemandType(String(row[3] || ''));
      const cliente = String(row[18] || '');
      const motivoExpiracao = mapExpirationReason(String(row[22] || ''));
      const nivelSuporte = String(row[24] || '').trim();
      const obs = String(row[25] || '').trim();
      const responsavel = String(row[27] || '').replace('@', '').trim();

      // Injetar reply sintetico de primeiro atendimento com data EXATA da planilha
      // A planilha é a fonte de verdade para o SLA de 1a resposta
      if (atendimentoAt) {
        const realTeamReplies = threadReplies.filter(r => r.isTeamMember && !r.text.includes('Reacao de conclusao'));
        const firstTeamAuthor = realTeamReplies.length > 0
          ? realTeamReplies.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0].author
          : 'Equipe Just';
        // Inserir no inicio para ser o primeiro reply cronologicamente
        threadReplies.unshift({
          author: firstTeamAuthor,
          text: '[Primeiro atendimento]',
          timestamp: atendimentoAt,
          isTeamMember: true,
          hasCheckReaction: false,
        });
      }

      // Recalcular last team reply apos ajustes
      const finalTeamReplies = threadReplies.filter(r => r.isTeamMember && !r.text.includes('Reacao de conclusao'));
      const finalLastTeamReply = finalTeamReplies.length > 0 ? finalTeamReplies[finalTeamReplies.length - 1] : null;

      const demand = {
        id: `hist_${channelId}_${ts.replace('.', '')}`,
        title: title || String(row[0] || ''),
        description: description || String(row[1] || ''),
        priority,
        status,
        demandType,
        workflow: workflow || 'Suporte',
        product: product || cliente,
        requester: { name: requesterName, avatar: '' },
        assignee: responsavel ? { name: responsavel, avatar: '' } : null,
        cc,
        createdAt,
        dueDate: null,
        completedAt,
        hasTask,
        taskLink,
        tags,
        slackChannel: `#${canal}`,
        slackPermalink: link,
        replies: result.messages.length - 1,
        threadReplies,
        lastTeamReply: finalLastTeamReply ? {
          author: finalLastTeamReply.author,
          text: finalLastTeamReply.text,
          timestamp: finalLastTeamReply.timestamp,
        } : undefined,
        closure: {
          category: '',
          expirationReason: status === 'expirada' ? motivoExpiracao : '',
          supportLevel: nivelSuporte,
          internalComment: '',
          observation: obs,
          autoFilled: { category: false, expirationReason: !!motivoExpiracao, supportLevel: !!nivelSuporte },
        },
      };

      demands.push(demand);
    } catch (err) {
      errors++;
      // Fallback to spreadsheet data only
      demands.push(buildFromSpreadsheet(row, channelId, ts, link));
      if (errors <= 5) console.log(`  Erro ao buscar ${link}: ${err.message}`);
    }
  }

  console.log(`\n=== RESULTADO ===`);
  console.log(`Total processadas: ${demands.length}`);
  console.log(`Com dados Slack: ${demands.length - noMsg - errors}`);
  console.log(`Sem mensagem (só planilha): ${noMsg}`);
  console.log(`Erros (fallback planilha): ${errors}`);

  // Stats
  const stats = {
    total: demands.length,
    concluidas: demands.filter(d => d.status === 'concluida').length,
    expiradas: demands.filter(d => d.status === 'expirada').length,
    comThread: demands.filter(d => d.replies > 0).length,
    comMotivo: demands.filter(d => d.closure?.expirationReason).length,
    comNivel: demands.filter(d => d.closure?.supportLevel).length,
    porPrioridade: { p1: 0, p2: 0, p3: 0, sem: 0 },
    porMes: {},
    porCanal: {},
  };
  demands.forEach(d => {
    if (d.priority === 'p1') stats.porPrioridade.p1++;
    else if (d.priority === 'p2') stats.porPrioridade.p2++;
    else if (d.priority === 'p3') stats.porPrioridade.p3++;
    else stats.porPrioridade.sem++;

    const m = new Date(d.createdAt).getMonth() + 1;
    const key = m + '/2026';
    stats.porMes[key] = (stats.porMes[key] || 0) + 1;
    stats.porCanal[d.slackChannel] = (stats.porCanal[d.slackChannel] || 0) + 1;
  });

  console.log(`\nConcluidas: ${stats.concluidas} | Expiradas: ${stats.expiradas}`);
  console.log(`Com thread replies: ${stats.comThread}`);
  console.log(`Com motivo expiracao: ${stats.comMotivo}`);
  console.log(`Com nivel suporte: ${stats.comNivel}`);
  console.log(`P1: ${stats.porPrioridade.p1} | P2: ${stats.porPrioridade.p2} | P3: ${stats.porPrioridade.p3}`);
  console.log('\nPor mes:', JSON.stringify(stats.porMes));
  console.log('Por canal:', JSON.stringify(stats.porCanal));

  // Save to JSON for analysis (before generating TS)
  const outputJson = path.join(__dirname, '..', 'src', 'data', 'historicalDemands.json');
  fs.writeFileSync(outputJson, JSON.stringify(demands, null, 2), 'utf-8');
  console.log(`\nJSON salvo: ${outputJson} (${(fs.statSync(outputJson).size / 1024).toFixed(0)} KB)`);
  console.log('Aguardando aprovacao para gerar .ts...');
}

function buildFromSpreadsheet(row, channelId, ts, link) {
  const canal = String(row[7] || '').replace('#', '');
  const requesterName = String(row[6] || '').replace('@', '').trim();
  const status = mapStatus(String(row[17] || ''));
  const motivoExpiracao = mapExpirationReason(String(row[22] || ''));
  const nivelSuporte = String(row[24] || '').trim();
  const obs = String(row[25] || '').trim();
  const responsavel = String(row[27] || '').replace('@', '').trim();
  const atendimentoAt = excelSerialToISO(row[10]);

  // Injetar reply sintetico com data de atendimento da planilha
  const threadReplies = [];
  if (atendimentoAt) {
    threadReplies.push({
      author: 'Equipe Just',
      text: '[Primeiro atendimento registrado na planilha]',
      timestamp: atendimentoAt,
      isTeamMember: true,
      hasCheckReaction: false,
    });
  }

  return {
    id: `hist_${channelId}_${ts.replace('.', '')}`,
    title: String(row[0] || ''),
    description: String(row[1] || ''),
    priority: mapPriority(String(row[2] || '')),
    status,
    demandType: mapDemandType(String(row[3] || '')),
    workflow: 'Suporte',
    product: String(row[18] || ''),
    requester: { name: requesterName, avatar: '' },
    assignee: responsavel ? { name: responsavel, avatar: '' } : null,
    cc: [],
    createdAt: excelSerialToISO(row[9]),
    dueDate: null,
    completedAt: excelSerialToISO(row[11]),
    hasTask: String(row[4] || '').toLowerCase() === 'sim',
    taskLink: String(row[5] || ''),
    tags: [],
    slackChannel: `#${canal}`,
    slackPermalink: link,
    replies: threadReplies.length,
    threadReplies,
    closure: {
      category: '',
      expirationReason: status === 'expirada' ? motivoExpiracao : '',
      supportLevel: nivelSuporte,
      internalComment: '',
      observation: obs,
      autoFilled: { category: false, expirationReason: !!motivoExpiracao, supportLevel: !!nivelSuporte },
    },
  };
}

main().catch(err => { console.error('Erro fatal:', err); process.exit(1); });
