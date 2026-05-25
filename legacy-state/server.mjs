// Legacy state server — serve endpoints v1 que o frontend FlowDesk consome
// antes de migrar pra API nova. Persiste em JSON em /data.
//
// Endpoints:
//   GET/PUT  /__state            (snapshot inteiro)
//   GET/PUT  /__state/:key
//   GET/POST/PUT/DELETE /notes
//   GET/POST/PUT/DELETE /infra-demands
//   GET      /notifications?email=
//   POST     /notifications
//   PATCH    /notifications/:id
//   POST     /notifications/mark-all-read?email=
//   GET      /notifications/preferences?email=
//   PUT      /notifications/preferences
//   GET      /health

import express from 'express';
import fs from 'node:fs';
import path from 'node:path';

const app = express();
app.use(express.json({ limit: '20mb' }));

const DATA_DIR = process.env.DATA_DIR || '/data';
fs.mkdirSync(DATA_DIR, { recursive: true });

function readJson(file, fallback) {
  const p = path.join(DATA_DIR, file);
  try {
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}
function writeJson(file, data) {
  const p = path.join(DATA_DIR, file);
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

app.get('/health', (_req, res) => res.json({ ok: true }));

// ============ __state ============
app.get('/__state', (_req, res) => res.json(readJson('shared-state.json', {})));
app.put('/__state', (req, res) => { writeJson('shared-state.json', req.body || {}); res.json({ ok: true }); });
app.get('/__state/:key', (req, res) => {
  const s = readJson('shared-state.json', {});
  res.json({ key: req.params.key, value: s[req.params.key] ?? null });
});
app.put('/__state/:key', (req, res) => {
  const s = readJson('shared-state.json', {});
  s[req.params.key] = req.body?.value ?? req.body;
  writeJson('shared-state.json', s);
  res.json({ ok: true });
});

// ============ notes ============
app.get('/notes', (req, res) => {
  const email = String(req.query.email || '').toLowerCase();
  const arr = readJson('notes.json', []);
  const filtered = email
    ? arr.filter((n) => String(n.userEmail || '').toLowerCase() === email)
    : arr;
  res.json({ notes: filtered });
});
app.post('/notes', (req, res) => {
  const arr = readJson('notes.json', []);
  const note = {
    id: req.body.id || `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...req.body,
  };
  arr.push(note);
  writeJson('notes.json', arr);
  res.json({ note });
});
app.put('/notes/:id', (req, res) => {
  const arr = readJson('notes.json', []);
  const i = arr.findIndex((n) => n.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'not found' });
  arr[i] = { ...arr[i], ...req.body, updatedAt: new Date().toISOString() };
  writeJson('notes.json', arr);
  res.json({ note: arr[i] });
});
app.delete('/notes/:id', (req, res) => {
  const arr = readJson('notes.json', []).filter((n) => n.id !== req.params.id);
  writeJson('notes.json', arr);
  res.json({ ok: true });
});

// ============ infra/demands ============
function makeInfraId() {
  return `infra_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

app.get('/infra/demands', (_req, res) => {
  res.json({ demands: readJson('infraDemands.json', []) });
});

app.post('/infra/demands', (req, res) => {
  const b = req.body || {};
  if (!b.title || !String(b.title).trim()) {
    return res.status(400).json({ error: 'title obrigatorio' });
  }
  if (!b.infraKind || !['sql', 'deploy', 'suporte'].includes(b.infraKind)) {
    return res.status(400).json({ error: "infraKind deve ser 'sql', 'deploy' ou 'suporte'" });
  }
  const now = new Date().toISOString();
  const demand = {
    id: makeInfraId(),
    title: String(b.title).trim(),
    description: String(b.description || '').trim(),
    priority: b.priority || 'p3',
    status: 'aberta',
    demandType: 'Tarefa/Ajuda',
    workflow: 'Infra (interno)',
    product: b.client || '',
    source: 'internal',
    infraKind: b.infraKind,
    ...(b.infraQuery?.trim() ? { infraQuery: b.infraQuery.trim() } : {}),
    ...(b.infraDatabase?.trim() ? { infraDatabase: b.infraDatabase.trim() } : {}),
    ...(b.infraExternalLink?.trim() ? { infraExternalLink: b.infraExternalLink.trim() } : {}),
    ...(Array.isArray(b.infraAttachments) && b.infraAttachments.length ? { infraAttachments: b.infraAttachments } : {}),
    ...(b.infraSuporteContexto ? { infraSuporteContexto: b.infraSuporteContexto } : {}),
    ...(b.infraSuporteAconteceu ? { infraSuporteAconteceu: b.infraSuporteAconteceu } : {}),
    ...(b.infraSuporteImpactoNivel ? { infraSuporteImpactoNivel: b.infraSuporteImpactoNivel } : {}),
    ...(b.infraSuporteImpactoDescricao ? { infraSuporteImpactoDescricao: b.infraSuporteImpactoDescricao } : {}),
    ...(Array.isArray(b.infraSuporteQuemOlhar) && b.infraSuporteQuemOlhar.length ? { infraSuporteQuemOlhar: b.infraSuporteQuemOlhar } : {}),
    ...(b.infraSuporteProximoPasso ? { infraSuporteProximoPasso: b.infraSuporteProximoPasso } : {}),
    ...(b.infraSuporteInfoAdicionais ? { infraSuporteInfoAdicionais: b.infraSuporteInfoAdicionais } : {}),
    requester: b.requester || { name: 'Desconhecido', avatar: '' },
    assignee: b.assignee || { name: 'Tiago Silva', avatar: '' },
    cc: [],
    createdAt: now,
    dueDate: b.dueDate || null,
    completedAt: null,
    hasTask: !!(b.infraExternalLink && b.infraExternalLink.trim()),
    taskLink: (b.infraExternalLink && b.infraExternalLink.trim()) || '',
    tags: [`infra-${b.infraKind}`],
    slackChannel: b.infraKind === 'sql' ? '#infra-sql' : b.infraKind === 'suporte' ? '#infra-suporte' : '#infra-deploy',
    slackPermalink: '',
    replies: 0,
    threadReplies: [],
    files: [],
  };
  const demands = readJson('infraDemands.json', []);
  demands.unshift(demand);
  writeJson('infraDemands.json', demands);
  res.json({ demand });
});

app.patch('/infra/demands/:id', (req, res) => {
  const demands = readJson('infraDemands.json', []);
  const i = demands.findIndex((d) => d.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'demanda nao encontrada' });
  const allowed = [
    'status', 'assignee', 'priority', 'completedAt', 'description', 'title', 'threadReplies',
    'infraQuery', 'infraDatabase', 'infraExternalLink', 'infraAttachments', 'dueDate',
    'infraSuporteContexto', 'infraSuporteAconteceu', 'infraSuporteImpactoNivel',
    'infraSuporteImpactoDescricao', 'infraSuporteQuemOlhar', 'infraSuporteProximoPasso',
    'infraSuporteInfoAdicionais',
  ];
  for (const k of allowed) {
    if (req.body?.[k] !== undefined) demands[i][k] = req.body[k];
  }
  if (req.body?.status === 'concluida' && !demands[i].completedAt) {
    demands[i].completedAt = new Date().toISOString();
  }
  writeJson('infraDemands.json', demands);
  res.json({ demand: demands[i] });
});

app.delete('/infra/demands/:id', (req, res) => {
  const demands = readJson('infraDemands.json', []).filter((d) => d.id !== req.params.id);
  writeJson('infraDemands.json', demands);
  res.json({ ok: true });
});

app.get('/infra/demands/:id/chat', (req, res) => {
  const d = readJson('infraDemands.json', []).find((x) => x.id === req.params.id);
  if (!d) return res.status(404).json({ error: 'demanda nao encontrada' });
  res.json({ messages: d.chat || [] });
});

app.post('/infra/demands/:id/chat', (req, res) => {
  const { autor, texto, files } = req.body || {};
  if (!autor || !texto || !String(texto).trim()) {
    return res.status(400).json({ error: 'autor e texto sao obrigatorios' });
  }
  const demands = readJson('infraDemands.json', []);
  const i = demands.findIndex((d) => d.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'demanda nao encontrada' });
  if (!demands[i].chat) demands[i].chat = [];
  const msg = {
    id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    autor,
    texto: String(texto).trim(),
    timestamp: new Date().toISOString(),
    ...(Array.isArray(files) && files.length ? { files } : {}),
  };
  demands[i].chat.push(msg);
  writeJson('infraDemands.json', demands);
  res.json({ message: msg });
});

app.post('/infra/demands/:id/attachments', (req, res) => {
  const newAtts = req.body?.attachments;
  if (!Array.isArray(newAtts) || newAtts.length === 0) {
    return res.status(400).json({ error: 'attachments deve ser array nao-vazio' });
  }
  const demands = readJson('infraDemands.json', []);
  const i = demands.findIndex((d) => d.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'demanda nao encontrada' });
  if (!demands[i].infraAttachments) demands[i].infraAttachments = [];
  demands[i].infraAttachments.push(...newAtts);
  writeJson('infraDemands.json', demands);
  res.json({ infraAttachments: demands[i].infraAttachments });
});

// ============ notifications ============
// IMPORTANT: rotas estáticas (mark-all-read, preferences) ANTES de /:id

app.get('/notifications/preferences', (req, res) => {
  const email = String(req.query.email || '');
  const all = readJson('notificationPreferences.json', {});
  res.json({ preferences: all[email] ?? null });
});

app.put('/notifications/preferences', (req, res) => {
  const prefs = req.body || {};
  const email = prefs.userEmail;
  if (!email) return res.status(400).json({ error: 'userEmail obrigatorio' });
  const all = readJson('notificationPreferences.json', {});
  all[email] = prefs;
  writeJson('notificationPreferences.json', all);
  res.json({ preferences: prefs });
});

app.post('/notifications/mark-all-read', (req, res) => {
  const email = String(req.query.email || '');
  const arr = readJson('notifications.json', []);
  let count = 0;
  const now = new Date().toISOString();
  for (const n of arr) {
    if (n.userEmail === email && !n.read) {
      n.read = true;
      n.readAt = now;
      count++;
    }
  }
  writeJson('notifications.json', arr);
  res.json({ ok: true, count });
});

app.get('/notifications', (req, res) => {
  const email = String(req.query.email || '');
  const arr = readJson('notifications.json', []);
  const filtered = email ? arr.filter((n) => n.userEmail === email) : arr;
  filtered.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  res.json({ notifications: filtered });
});

app.post('/notifications', (req, res) => {
  const arr = readJson('notifications.json', []);
  const id = req.body.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const notification = {
    id,
    createdAt: new Date().toISOString(),
    read: false,
    ...req.body,
  };
  arr.push(notification);
  writeJson('notifications.json', arr);
  res.json({ notification });
});

app.patch('/notifications/:id', (req, res) => {
  const arr = readJson('notifications.json', []);
  const i = arr.findIndex((n) => n.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'not found' });
  if (typeof req.body?.read === 'boolean') {
    arr[i].read = req.body.read;
    arr[i].readAt = req.body.read ? new Date().toISOString() : undefined;
  }
  arr[i] = { ...arr[i], ...req.body };
  writeJson('notifications.json', arr);
  res.json({ notification: arr[i] });
});

// ============ Slack helpers ============

const SLACK_TOKENS_FILE = 'slack-user-tokens.json';

function readSlackTokens() {
  return readJson(SLACK_TOKENS_FILE, {});
}
function getUserSlackToken(email) {
  if (!email) return null;
  return readSlackTokens()[email.toLowerCase()] || null;
}
function saveUserSlackToken(email, payload) {
  const all = readSlackTokens();
  all[email.toLowerCase()] = payload;
  writeJson(SLACK_TOKENS_FILE, all);
}

async function slackApi(method, body, asForm = false, customToken) {
  const token = customToken || process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error('Token Slack nao disponivel');
  const headers = { Authorization: `Bearer ${token}` };
  let payload;
  if (asForm) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    payload = new URLSearchParams(body).toString();
  } else {
    headers['Content-Type'] = 'application/json; charset=utf-8';
    payload = JSON.stringify(body);
  }
  const r = await fetch(`https://slack.com/api/${method}`, { method: 'POST', headers, body: payload });
  const json = await r.json();
  if (!json.ok) throw new Error(`Slack API: ${json.error || 'unknown'}`);
  return json;
}

function parseSlackPermalink(permalink) {
  const m = String(permalink || '').match(/\/archives\/([A-Z0-9]+)\/p(\d+)/);
  if (!m) return null;
  const channel = m[1];
  const pTs = m[2];
  const ts = `${pTs.slice(0, -6)}.${pTs.slice(-6)}`;
  return { channel, thread_ts: ts };
}
function isoToSlackTs(iso) {
  return (new Date(iso).getTime() / 1000).toFixed(6);
}

// ============ /slack/* ============

app.get('/slack/status', async (_req, res) => {
  try {
    if (!process.env.SLACK_BOT_TOKEN) return res.json({ enabled: false });
    const r = await slackApi('auth.test', {});
    res.json({ enabled: true, team: r.team, user: r.user, botId: r.bot_id });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.post('/slack/reply', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.text || (!body.permalink && (!body.channel || !body.thread_ts))) {
      return res.status(400).json({ error: 'permalink+text OU channel+thread_ts+text' });
    }
    let { channel, thread_ts } = body;
    if (body.permalink) {
      const parsed = parseSlackPermalink(body.permalink);
      if (!parsed) return res.status(400).json({ error: 'Permalink invalido' });
      channel = parsed.channel; thread_ts = parsed.thread_ts;
    }
    let postedAs = 'FlowDesk Bot';
    let useUserToken;
    let finalText = body.text;
    if (body.senderEmail) {
      const userToken = getUserSlackToken(body.senderEmail);
      if (userToken?.accessToken) {
        useUserToken = userToken.accessToken;
        postedAs = userToken.teamName ? `${body.senderEmail} (via OAuth)` : body.senderEmail;
      } else {
        try {
          const lookup = await slackApi('users.lookupByEmail', { email: body.senderEmail }, true);
          if (lookup.user?.id) {
            finalText = `<@${lookup.user.id}>\n${body.text}`;
            postedAs = `${lookup.user.real_name || body.senderEmail} (via bot)`;
          }
        } catch { /* sem user_id */ }
      }
    }
    const r = await slackApi('chat.postMessage', { channel, thread_ts, text: finalText }, false, useUserToken);
    let permalink;
    try {
      const link = await slackApi('chat.getPermalink', { channel, message_ts: r.ts }, true);
      permalink = link.permalink;
    } catch { /* ignore */ }
    res.json({ ok: true, ts: r.ts, channel, permalink, postedAs });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get('/slack/thread-replies', async (req, res) => {
  try {
    const permalink = String(req.query.permalink || '');
    const parsed = parseSlackPermalink(permalink);
    if (!parsed) return res.status(400).json({ error: 'Permalink invalido' });
    const r = await slackApi('conversations.replies',
      { channel: parsed.channel, ts: parsed.thread_ts, limit: 200 }, true);
    const replies = (r.messages || []).slice(1).map((msg) => ({
      ts: msg.ts,
      text: msg.text || '',
      userId: msg.user,
      timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
      files: (msg.files || []).map((f) => ({
        id: f.id, name: f.name, mimetype: f.mimetype, size: f.size,
        urlPrivate: f.url_private, thumb360: f.thumb_360, isPublic: !!f.is_public,
      })),
    }));
    const uniqueUsers = [...new Set(replies.map((x) => x.userId).filter(Boolean))];
    const userMap = {};
    for (const uid of uniqueUsers) {
      try {
        const info = await slackApi('users.info', { user: uid }, true);
        userMap[uid] = {
          name: info.user.real_name || info.user.profile?.display_name || info.user.name,
          isBot: info.user.is_bot,
        };
      } catch { userMap[uid] = { name: uid, isBot: false }; }
    }
    const enriched = replies.map((x) => ({
      ...x,
      author: userMap[x.userId]?.name || '?',
      isBot: userMap[x.userId]?.isBot || false,
    }));
    res.json({ replies: enriched, count: enriched.length });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get('/slack/channel-members', async (req, res) => {
  try {
    const channel = String(req.query.channel || '');
    if (!channel) return res.status(400).json({ error: 'channel obrigatorio' });
    const cleanCh = channel.replace(/^#/, '');
    const diagnostics = [];
    let source = 'channel';
    let channelId = cleanCh;
    let users = [];

    try {
      if (!cleanCh.match(/^[A-Z0-9]{8,}$/)) {
        const list = await slackApi('conversations.list',
          { types: 'public_channel,private_channel', limit: 1000 }, true);
        const found = list.channels?.find((c) => c.name === cleanCh);
        if (!found) {
          diagnostics.push(`Canal "${cleanCh}" nao encontrado (bot pode nao estar no canal)`);
          throw new Error('channel_not_found');
        }
        channelId = found.id;
      }
      const memberIds = [];
      let cursor;
      do {
        const r = await slackApi('conversations.members',
          { channel: channelId, limit: 200, ...(cursor ? { cursor } : {}) }, true);
        memberIds.push(...(r.members || []));
        cursor = r.response_metadata?.next_cursor;
      } while (cursor);
      if (memberIds.length === 0) {
        diagnostics.push('conversations.members retornou 0 IDs');
        throw new Error('no_members');
      }
      const batchSize = 10;
      for (let i = 0; i < memberIds.length; i += batchSize) {
        const batch = memberIds.slice(i, i + batchSize);
        const infos = await Promise.all(batch.map((id) =>
          slackApi('users.info', { user: id }, true).catch(() => null)
        ));
        for (const u of infos) {
          if (u?.user && !u.user.deleted && !u.user.is_bot) {
            users.push({
              id: u.user.id,
              name: u.user.real_name || u.user.profile?.display_name || u.user.name,
              email: u.user.profile?.email,
              avatar: u.user.profile?.image_24,
            });
          }
        }
      }
    } catch (err) {
      diagnostics.push(`canal: ${err.message || err}`);
    }

    if (users.length === 0) {
      source = 'workspace';
      try {
        let cursor;
        do {
          const r = await slackApi('users.list',
            { limit: 200, ...(cursor ? { cursor } : {}) }, true);
          for (const m of (r.members || [])) {
            if (m.deleted || m.is_bot || m.id === 'USLACKBOT') continue;
            users.push({
              id: m.id,
              name: m.real_name || m.profile?.display_name || m.name,
              email: m.profile?.email,
              avatar: m.profile?.image_24,
            });
          }
          cursor = r.response_metadata?.next_cursor;
        } while (cursor);
      } catch (err) {
        diagnostics.push(`workspace fallback: ${err.message || err}`);
      }
    }

    users.sort((a, b) => a.name.localeCompare(b.name));
    res.json({
      channel: channelId,
      members: users,
      source,
      ...(diagnostics.length ? { diagnostics } : {}),
    });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.post('/slack/edit', async (req, res) => {
  try {
    const body = req.body || {};
    const parsed = parseSlackPermalink(body.permalink);
    if (!parsed) return res.status(400).json({ error: 'Permalink invalido' });
    // Prefere ts exato vindo do front (preserva microssegundos);
    // fallback pra conversao ISO (legacy).
    const ts = body.replyTs || isoToSlackTs(body.replyTimestamp);
    const userTok = body.senderEmail ? getUserSlackToken(body.senderEmail)?.accessToken : null;
    await slackApi('chat.update', { channel: parsed.channel, ts, text: body.newText }, false, userTok);
    res.json({ ok: true });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.post('/slack/delete', async (req, res) => {
  try {
    const body = req.body || {};
    const parsed = parseSlackPermalink(body.permalink);
    if (!parsed) return res.status(400).json({ error: 'Permalink invalido' });
    const ts = body.replyTs || isoToSlackTs(body.replyTimestamp);
    const userTok = body.senderEmail ? getUserSlackToken(body.senderEmail)?.accessToken : null;
    await slackApi('chat.delete', { channel: parsed.channel, ts }, true, userTok);
    res.json({ ok: true });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get('/slack/file/:fileId', async (req, res) => {
  try {
    const info = await slackApi('files.info', { file: req.params.fileId }, true);
    const file = info.file;
    if (!file?.url_private) return res.status(404).json({ error: 'Arquivo nao encontrado' });
    const r = await fetch(file.url_private, {
      headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
    });
    if (!r.ok) return res.status(502).json({ error: 'Download falhou' });
    res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`);
    res.send(Buffer.from(await r.arrayBuffer()));
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ============ /auth/slack/* (OAuth user token) ============

app.get('/auth/slack/start', (req, res) => {
  const email = String(req.query.email || '');
  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = process.env.SLACK_REDIRECT_URI ||
    `https://${process.env.DOMAIN || 'flow.justit.cloud'}/auth/slack/callback`;
  if (!clientId) return res.status(500).json({ error: 'SLACK_CLIENT_ID nao configurado' });
  const userScopes = ['chat:write', 'files:write', 'users.profile:read'].join(',');
  const state = encodeURIComponent(email);
  const authUrl =
    `https://slack.com/oauth/v2/authorize?client_id=${clientId}` +
    `&user_scope=${encodeURIComponent(userScopes)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}`;
  res.redirect(302, authUrl);
});

app.get('/auth/slack/callback', async (req, res) => {
  const code = String(req.query.code || '');
  const email = decodeURIComponent(String(req.query.state || ''));
  if (!code) return res.status(400).send('<h1>Erro</h1><p>code ausente</p>');
  try {
    const redirectUri = process.env.SLACK_REDIRECT_URI ||
      `https://${process.env.DOMAIN || 'flow.justit.cloud'}/auth/slack/callback`;
    const params = new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID,
      client_secret: process.env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    });
    const r = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const json = await r.json();
    if (!json.ok) throw new Error(`Slack OAuth: ${json.error}`);
    const userToken = json.authed_user?.access_token;
    const slackUserId = json.authed_user?.id;
    if (!userToken || !slackUserId) throw new Error('Resposta OAuth sem user token');
    saveUserSlackToken(email, {
      accessToken: userToken,
      slackUserId,
      teamId: json.team?.id,
      teamName: json.team?.name,
      scope: json.authed_user?.scope,
      connectedAt: new Date().toISOString(),
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<html><body style="font-family:system-ui;padding:40px;background:#0f172a;color:#e2e8f0">
      <h1 style="color:#10b981">Slack conectado</h1>
      <p>Conta <strong>${email}</strong> ligada como &lt;@${slackUserId}&gt;.</p>
      <p><a href="/" style="color:#3b82f6">Voltar ao FlowDesk</a></p>
    </body></html>`);
  } catch (err) {
    res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<h1 style="color:#ef4444">Erro OAuth</h1><pre>${err.message}</pre>`);
  }
});

app.get('/auth/slack/status', (req, res) => {
  const token = getUserSlackToken(String(req.query.email || ''));
  res.json({
    connected: !!token,
    slackUserId: token?.slackUserId,
    teamName: token?.teamName,
    connectedAt: token?.connectedAt,
  });
});

app.post('/auth/slack/disconnect', (req, res) => {
  const all = readSlackTokens();
  delete all[String(req.body?.email || '').toLowerCase()];
  writeJson(SLACK_TOKENS_FILE, all);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 8090;
app.listen(PORT, () => console.log(`legacy-state on ${PORT}`));
