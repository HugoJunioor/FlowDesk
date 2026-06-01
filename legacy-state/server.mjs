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
import nodemailer from 'nodemailer';

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

// ============ SMTP helper ============
// Cria transporter lazy se EMAIL_ENABLED + credenciais existirem.
// Senao, sendEmail vira no-op.
let _transporter = null;
function getMailer() {
  if (_transporter !== null) return _transporter;
  if (process.env.EMAIL_ENABLED !== 'true' || !process.env.SMTP_HOST) {
    _transporter = false;
    return false;
  }
  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return _transporter;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============ Telegram links (mapping email -> chat_id) ============
// Storage: /data/telegram-links.json
//   { "email@x.com": { chatId: "12345", linkedAt: "ISO", username?: "@x" } }
// Codes pendentes ficam in-memory (TTL 10min).

const LINKS_FILE = 'telegram-links.json';
const pendingCodes = new Map(); // code -> { email, expiresAt }
const CODE_TTL_MS = 10 * 60 * 1000;

function genTgCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}
function getTgLink(email) {
  const all = readJson(LINKS_FILE, {});
  return all[(email || '').toLowerCase()] || null;
}
function setTgLink(email, payload) {
  const all = readJson(LINKS_FILE, {});
  all[email.toLowerCase()] = payload;
  writeJson(LINKS_FILE, all);
}
function removeTgLink(email) {
  const all = readJson(LINKS_FILE, {});
  delete all[(email || '').toLowerCase()];
  writeJson(LINKS_FILE, all);
}

async function sendTelegramFor(notification, prefs) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  if (!prefs?.channels?.telegram) return;
  const chOverride = prefs?.eventsByChannel?.telegram?.[notification.event];
  const globalEv = prefs?.events?.[notification.event];
  const ok = chOverride !== undefined ? chOverride : (globalEv !== false);
  if (!ok) return;


  const tgLink = getTgLink(notification.userEmail);
  const chatId = tgLink?.chatId;
  if (!chatId) return;

  const base = process.env.APP_BASE_URL || `https://${process.env.DOMAIN || ''}`;
  const demandUrl = notification.demandId
    ? `${base}/demandas?openId=${encodeURIComponent(notification.demandId)}`
    : base;
  const text =
    `*${notification.title || 'FlowDesk'}*\n` +
    `${notification.message || ''}\n\n` +
    `[Abrir no FlowDesk](${demandUrl})`;

  try {
    const r = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      },
    );
    const j = await r.json();
    if (!j.ok) {
      console.warn('[telegram] api ok=false:', j.description);
    } else {
      console.log(`[telegram] enviado pra ${notification.userEmail} - ${notification.event}`);
    }
  } catch (err) {
    console.warn('[telegram] fetch falhou:', err.message);
  }
}

async function sendEmailFor(notification, prefs) {
  const m = getMailer();
  if (!m) return;
  if (!prefs?.channels?.email) return;
  const chOverride = prefs?.eventsByChannel?.email?.[notification.event];
  const globalEv = prefs?.events?.[notification.event];
  const ok = chOverride !== undefined ? chOverride : (globalEv !== false);
  if (!ok) return;

  const base = process.env.APP_BASE_URL || `https://${process.env.DOMAIN || ''}`;
  const link = notification.demandId
    ? `${base}/demandas?openId=${encodeURIComponent(notification.demandId)}`
    : base;
  const ator = notification.actor
    ? `<p style="margin:8px 0;color:#64748b;">Por: <strong>${escapeHtml(notification.actor)}</strong></p>`
    : '';
  const html = `<!doctype html>
<html><body style="font-family:system-ui,Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.08);">
    <div style="font-size:13px;color:#3b82f6;font-weight:600;text-transform:uppercase;">FlowDesk</div>
    <h2 style="margin:8px 0 12px;font-size:18px;">${escapeHtml(notification.title || '')}</h2>
    <p style="margin:0 0 12px;line-height:1.5;color:#334155;">${escapeHtml(notification.message || '')}</p>
    ${ator}
    <a href="${link}" style="display:inline-block;margin-top:16px;padding:10px 16px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Abrir no FlowDesk</a>
  </div>
</body></html>`;

  try {
    await m.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: notification.userEmail,
      subject: `[FlowDesk] ${notification.title || 'Notificação'}`,
      text: `${notification.title || ''}\n\n${notification.message || ''}\n\n${link}`,
      html,
    });
    console.log(`[email] enviado pra ${notification.userEmail} - ${notification.event}`);
  } catch (err) {
    console.warn('[email] falha:', err.message);
  }
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

  // Despacha email + telegram fire-and-forget se config + preferencia permitir
  const allPrefs = readJson('notificationPreferences.json', {});
  const userPrefs = allPrefs[notification.userEmail];
  void sendEmailFor(notification, userPrefs);
  void sendTelegramFor(notification, userPrefs);
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
    `https://${process.env.DOMAIN}/auth/slack/callback`;
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
      `https://${process.env.DOMAIN}/auth/slack/callback`;
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

// ============ /telegram/* — vinculacao por codigo ============

app.post('/telegram/link/start', (req, res) => {
  const email = String(req.body?.email || '').toLowerCase();
  if (!email) return res.status(400).json({ error: 'email obrigatorio' });
  // Limpa codigos expirados
  const now = Date.now();
  for (const [c, p] of pendingCodes) if (p.expiresAt < now) pendingCodes.delete(c);
  const code = genTgCode();
  pendingCodes.set(code, { email, expiresAt: now + CODE_TTL_MS });
  res.json({ code, botUsername: process.env.TELEGRAM_BOT_USERNAME || 'just_floow_bot' });
});

app.post('/telegram/link/cancel', (req, res) => {
  const code = String(req.body?.code || '');
  pendingCodes.delete(code);
  res.json({ ok: true });
});

app.get('/telegram/status', (req, res) => {
  const link = getTgLink(String(req.query.email || ''));
  res.json({
    connected: !!link,
    chatId: link?.chatId,
    username: link?.username,
    linkedAt: link?.linkedAt,
  });
});

app.post('/telegram/disconnect', (req, res) => {
  removeTgLink(String(req.body?.email || ''));
  res.json({ ok: true });
});

// Webhook recebido do Telegram (Bot API). Path inclui secret pra evitar abuso.
app.post('/telegram-events/:secret', async (req, res) => {
  if (req.params.secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const update = req.body || {};
  res.json({ ok: true }); // responde rapido pro Telegram nao timeoutar

  const msg = update.message;
  if (!msg || !msg.text) return;
  const chatId = String(msg.chat.id);
  const text = msg.text.trim();
  const username = msg.from?.username ? '@' + msg.from.username : (msg.from?.first_name || '');

  async function reply(replyText) {
    try {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: replyText }),
      });
    } catch (err) {
      console.warn('[telegram] reply falhou:', err.message);
    }
  }

  // /start <code> — vincula
  const startMatch = text.match(/^\/start\s+([A-Z0-9]{6,12})$/i);
  if (startMatch) {
    const code = startMatch[1].toUpperCase();
    const pending = pendingCodes.get(code);
    if (!pending || pending.expiresAt < Date.now()) {
      pendingCodes.delete(code);
      await reply('Código inválido ou expirado. Gere um novo no FlowDesk.');
      return;
    }
    pendingCodes.delete(code);
    setTgLink(pending.email, {
      chatId,
      username,
      linkedAt: new Date().toISOString(),
    });
    await reply(`✓ Conta FlowDesk vinculada (${pending.email}). Você receberá notificações aqui.`);
    return;
  }

  if (text === '/start') {
    await reply('Bem-vindo ao FlowDesk! Vá em Configurações → Telegram pra gerar um código de vinculação e enviá-lo aqui como: /start CODIGO');
    return;
  }

  if (text === '/help') {
    await reply('Comandos:\n/start CODIGO — vincular conta\n/status — ver vínculo\n/desconectar — remover vínculo');
    return;
  }

  if (text === '/status') {
    const all = readJson(LINKS_FILE, {});
    const found = Object.entries(all).find(([_, v]) => v.chatId === chatId);
    if (found) await reply(`Conta vinculada: ${found[0]} (desde ${new Date(found[1].linkedAt).toLocaleDateString('pt-BR')})`);
    else await reply('Nenhuma conta vinculada neste chat. Gere um código no FlowDesk e envie /start CODIGO');
    return;
  }

  if (text === '/desconectar' || text === '/disconnect') {
    const all = readJson(LINKS_FILE, {});
    let removed = null;
    for (const [email, v] of Object.entries(all)) {
      if (v.chatId === chatId) { removed = email; delete all[email]; }
    }
    writeJson(LINKS_FILE, all);
    await reply(removed ? `Desconectado de ${removed}.` : 'Nenhum vínculo pra remover.');
    return;
  }
});

// ============ Cron: lembrete diario por email ============
// Roda em dias uteis as 9h BRT. Pra cada user em fd_users_v2 do shared-state,
// monta resumo das demandas em aberto atribuidas a ele e manda email (canal
// email do user precisa estar ligado nas prefs).
//
// Source de demandas: arquivos realDemands.ts e historicalDemands.ts montados
// em /web-data:ro. Parse via regex pra evitar dependencia de TS runtime.

const DAILY_TARGET_HOUR_BRT = 9;
const DAILY_CHECK_INTERVAL_MS = 60_000;
let lastDailyRun = null; // 'YYYY-MM-DD'

function nowInBrt() {
  // Retorna { date: 'YYYY-MM-DD', hour: number, weekday: string }
  const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const hour = Number(
    new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }),
  );
  const weekday = new Date().toLocaleDateString('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'long' });
  return { date, hour, weekday };
}

function parseDemandsFile(filepath, exportName) {
  try {
    const c = fs.readFileSync(filepath, 'utf8');
    const re = new RegExp(`${exportName}[^=]*=\\s*(\\[[\\s\\S]*?\\]);`);
    const m = c.match(re);
    if (!m) return [];
    return JSON.parse(m[1]);
  } catch (err) {
    console.warn(`[daily] falha lendo ${filepath}:`, err.message);
    return [];
  }
}

function loadAllDemands() {
  const base = process.env.WEB_DATA_DIR || '/web-data';
  const current = parseDemandsFile(path.join(base, 'realDemands.ts'), 'mockDemands');
  const historic = parseDemandsFile(path.join(base, 'historicalDemands.ts'), 'historicalDemands');
  return [...current, ...historic];
}

/**
 * Aplica overrides salvos no shared-state.json a cada demanda.
 *
 * Demandas fechadas/reclassificadas via UI nao alteram realDemands.ts (que so
 * eh reescrito pelo sync do Slack quando detecta 🟢 na thread). Em vez disso
 * o frontend salva mudancas em `fd_demand_overrides[demand.id]`. Pra o daily
 * reminder bater com o que o usuario ve na tela, precisamos aplicar essas
 * mesmas mudancas em runtime aqui.
 *
 * Campos sobrescritos seguem o padrao do frontend (ver applyDemandOverrides
 * em apps/web/src/data/demandsLoader.ts):
 *   - status, priority, assignee, completedAt, closure, slaResolutionStatus
 */
function applyOverrides(demands, overrides) {
  if (!overrides || typeof overrides !== 'object') return demands;
  return demands.map((d) => {
    const ov = overrides[d.id];
    if (!ov) return d;
    return {
      ...d,
      ...(ov.status !== undefined ? { status: ov.status } : {}),
      ...(ov.priority !== undefined ? { priority: ov.priority } : {}),
      ...(ov.assignee !== undefined ? { assignee: ov.assignee } : {}),
      ...(ov.completedAt !== undefined ? { completedAt: ov.completedAt } : {}),
      ...(ov.closure !== undefined ? { closure: ov.closure } : {}),
      ...(ov.slaResolutionStatus !== undefined ? { slaResolutionStatus: ov.slaResolutionStatus } : {}),
    };
  });
}

function emailFromUserName(users, name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  const u = users.find((x) =>
    String(x.name || '').toLowerCase() === lower ||
    String(x.login || '').toLowerCase() === lower,
  );
  return u?.email || null;
}

// --- SLA helpers (horas uteis Mon-Fri 8h-18h, sem feriados pra simplificar) ---
// Espelha a logica de apps/web/src/lib/businessHours.ts mas mais simples
// (nao trata feriados — diferenca pequena pra resumo diario).
const BUSINESS_START_HOUR = 8;
const BUSINESS_END_HOUR = 18;
const BUSINESS_MIN_PER_DAY = (BUSINESS_END_HOUR - BUSINESS_START_HOUR) * 60;

function businessMinutesBetween(from, to) {
  // Retorna minutos uteis. Negativo se `to` ja passou.
  if (to <= from) return -businessMinutesBetween(to, from);
  let cur = new Date(from);
  let total = 0;
  while (cur < to) {
    const day = cur.getDay();
    const isWeekday = day >= 1 && day <= 5;
    const dayStart = new Date(cur); dayStart.setHours(BUSINESS_START_HOUR, 0, 0, 0);
    const dayEnd = new Date(cur); dayEnd.setHours(BUSINESS_END_HOUR, 0, 0, 0);
    if (isWeekday) {
      const slotStart = cur < dayStart ? dayStart : cur;
      const slotEnd = to < dayEnd ? to : dayEnd;
      if (slotEnd > slotStart) total += (slotEnd - slotStart) / 60000;
    }
    // Avanca pro proximo dia 0h
    cur = new Date(cur); cur.setDate(cur.getDate() + 1); cur.setHours(0, 0, 0, 0);
  }
  return Math.round(total);
}

// SLA padrao por prioridade (em horas uteis). Espelha PRIORITY_CONFIG do web.
const SLA_RESOLUTION_HOURS = { p1: 8, p2: 24, p3: 72 };

function computeDueDate(d) {
  // Se demanda ja tem dueDate explicito, usa. Caso contrario, deriva de
  // createdAt + SLA da prioridade (horas uteis).
  if (d.dueDate) return new Date(d.dueDate);
  if (!d.createdAt || d.priority === 'sem_classificacao') return null;
  const hours = SLA_RESOLUTION_HOURS[d.priority];
  if (!hours) return null;
  // Aproxima: adiciona N dias uteis equivalentes. 8h = 1 dia util.
  const days = hours / 10; // 10h por dia util
  const due = new Date(d.createdAt);
  let added = 0;
  while (added < days) {
    due.setDate(due.getDate() + 1);
    if (due.getDay() >= 1 && due.getDay() <= 5) added++;
  }
  return due;
}

function computeSla(due, now) {
  if (!due) return { status: 'sem_prazo', label: '—', minutes: null };
  const mins = businessMinutesBetween(now, due);
  if (mins < 0) {
    const e = Math.abs(mins);
    const lbl = e < 60 ? `estourado ha ${e}min` : `estourado ha ${Math.round(e / 60)}h`;
    return { status: 'estourado', label: lbl, minutes: mins };
  }
  const lbl = mins < 60 ? `${mins}min restantes` : `${Math.round(mins / 60)}h restantes`;
  return { status: mins <= 240 ? 'proximo' : 'no_prazo', label: lbl, minutes: mins };
}

function buildDailySummary(userName, demands) {
  const base = process.env.APP_BASE_URL || `https://${process.env.DOMAIN || ''}`;
  const now = new Date();
  const nomeDisplay = (userName || '').split(' ')[0] || userName || 'time';

  // Enrich + sort: estourados primeiro (mais negativos), depois por
  // minutos restantes ASC. Sem-prazo no fim.
  const enriched = demands.map((d) => ({ d, sla: computeSla(computeDueDate(d), now) }));
  enriched.sort((a, b) => {
    const am = a.sla.minutes, bm = b.sla.minutes;
    if (am === null && bm === null) return 0;
    if (am === null) return 1;
    if (bm === null) return -1;
    return am - bm;
  });

  const rows = enriched.map(({ d, sla }) => {
    const link = `${base}/demandas?openId=${encodeURIComponent(d.id)}`;
    const prio = (d.priority || 'p3').toUpperCase();
    const titulo = escapeHtml((d.title || '').slice(0, 80));
    const prazoCor = sla.status === 'estourado' ? '#dc2626' : '#111827';
    const slackCell = d.slackPermalink
      ? `<a href="${escapeHtml(d.slackPermalink)}" target="_blank" rel="noopener" style="display:inline-block;background:#4a154b;color:#fff;font-size:11px;text-decoration:none;padding:4px 10px;border-radius:4px;">Slack ↗</a>`
      : `<span style="color:#9ca3af;font-size:12px;">—</span>`;
    return `<tr>
      <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;font-weight:600;vertical-align:top;width:48px;">${prio}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;vertical-align:top;"><a href="${link}" style="color:#1d4ed8;text-decoration:none;font-size:13px;">${titulo}</a></td>
      <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;font-size:12px;color:${prazoCor};font-weight:500;white-space:nowrap;vertical-align:top;">${sla.label}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;text-align:center;vertical-align:top;white-space:nowrap;">${slackCell}</td>
    </tr>`;
  }).join('');

  return `<!doctype html>
<html><body style="font-family:system-ui,Arial,sans-serif;background:#f9fafb;margin:0;padding:24px;color:#111827;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#1e3a5f;padding:20px 28px;">
      <span style="color:#fff;font-size:11px;font-weight:600;letter-spacing:1px;opacity:.8;">JUST FLOW · RESUMO DIÁRIO</span>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 6px;font-size:16px;color:#111827;">Bom dia, <strong>${escapeHtml(nomeDisplay)}</strong>!</p>
      <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">Você tem <strong>${demands.length} demanda${demands.length !== 1 ? 's' : ''} em aberto</strong>:</p>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="text-align:left;padding:8px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;width:48px;">Prio</th>
            <th style="text-align:left;padding:8px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Demanda</th>
            <th style="text-align:left;padding:8px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Prazo</th>
            <th style="text-align:center;padding:8px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Slack</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:24px;text-align:center;">
        <a href="${base}/demandas" style="display:inline-block;background:#1e3a5f;color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:10px 24px;border-radius:6px;">Abrir Just Flow</a>
      </div>
    </div>
    <div style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;">
      Just Flow &mdash; Atenciosamente, equipe Just.<br/>
      Desative em Configurações → Notificações → "Resumo diário".
    </div>
  </div>
</body></html>`;
}

async function runDailyReminder({ onlyEmail = null } = {}) {
  const mailer = getMailer();
  if (!mailer) { console.log('[daily] EMAIL_ENABLED off — pulando'); return { enviados: 0, pulados: 0 }; }

  const state = readJson('shared-state.json', {});
  let users = (state.fd_users_v2 || []).filter((u) => u.status !== 'inactive');
  if (onlyEmail) {
    users = users.filter((u) => String(u.email || '').toLowerCase() === onlyEmail);
    console.log(`[daily] modo teste: filtrando para ${onlyEmail} (${users.length} usuario(s))`);
  }
  const prefsAll = readJson('notificationPreferences.json', {});
  const rawDemands = loadAllDemands();
  // CRITICO: aplicar overrides — sem isso, demandas fechadas via UI ainda
  // aparecem como em_andamento porque o sync do Slack so atualiza
  // realDemands.ts quando detecta 🟢 na thread.
  const allDemands = applyOverrides(rawDemands, state.fd_demand_overrides);

  let enviados = 0;
  let pulados = 0;

  for (const user of users) {
    const email = user.email;
    if (!email) { pulados++; continue; }
    const prefs = prefsAll[email];
    // Em modo teste (onlyEmail setado), ignora prefs — sempre envia
    if (!onlyEmail) {
      if (prefs?.dailyReminder === false) { pulados++; continue; }
      if (prefs?.channels && prefs.channels.email === false) { pulados++; continue; }
    }

    // Demandas atribuidas a este user e ativas (aberta ou em_andamento).
    // Filtra explicitamente expirada/concluida/reprovada — expirada nao
    // deve aparecer como "em aberto" pra atuacao.
    const minhas = allDemands.filter((d) => {
      if (d.status !== 'aberta' && d.status !== 'em_andamento') return false;
      const assigneeName = d.assignee?.name;
      if (!assigneeName) return false;
      const assigneeEmail = emailFromUserName(users, assigneeName);
      return assigneeEmail && assigneeEmail.toLowerCase() === email.toLowerCase();
    });
    if (minhas.length === 0) {
      console.log(`[daily] ${email}: 0 demandas — pulado`);
      pulados++; continue;
    }
    console.log(`[daily] ${email}: ${minhas.length} demanda(s) — ${minhas.map((d) => d.title.slice(0, 30)).join(' | ')}`);

    try {
      await mailer.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: `Just Flow — ${minhas.length} demanda${minhas.length !== 1 ? 's' : ''} em aberto`,
        html: buildDailySummary(user.name || email, minhas),
        text: `Você tem ${minhas.length} demanda${minhas.length !== 1 ? 's' : ''} em aberto. Abra ${process.env.APP_BASE_URL || ''}/demandas`,
      });
      enviados++;
      console.log(`[daily] enviado pra ${email} (${minhas.length} demandas)`);
    } catch (err) {
      console.warn(`[daily] falha pra ${email}:`, err.message);
    }
  }
  console.log(`[daily] ciclo concluido: ${enviados} enviados, ${pulados} pulados`);
  return { enviados, pulados };
}

function dailyTick() {
  const { date, hour, weekday } = nowInBrt();
  if (weekday === 'Saturday' || weekday === 'Sunday') return;
  if (hour !== DAILY_TARGET_HOUR_BRT) return;
  if (lastDailyRun === date) return;
  lastDailyRun = date;
  console.log(`[daily] disparando ciclo ${date}`);
  void runDailyReminder();
}

if (process.env.DAILY_REMINDER_ENABLED === 'true') {
  setInterval(dailyTick, DAILY_CHECK_INTERVAL_MS);
  console.log('[daily] cron ativo — alvo 9h BRT dias uteis');
}

// Endpoint manual pra disparar agora (debug).
// Aceita ?email=foo@bar.com pra mandar so pra um usuario (teste).
app.post('/daily-reminder/run-now', async (req, res) => {
  const onlyEmail = String(req.query.email || '').trim().toLowerCase();
  try {
    const result = await runDailyReminder({ onlyEmail: onlyEmail || null });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 8090;
app.listen(PORT, () => console.log(`legacy-state on ${PORT}`));
