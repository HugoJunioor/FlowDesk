/**
 * Vite plugin: endpoints de estado compartilhado.
 *
 * GET  /__state       → retorna todo o estado sincronizado
 * PUT  /__state/:key  → atualiza uma chave especifica
 *
 * O estado fica em data/shared-state.json (gitignored, local only).
 * Funciona tanto em dev (vite) quanto em preview (vite preview).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega .env do root do projeto pra dentro de process.env.
// Vite so expoe VITE_* pro client; plugin Node precisa de dotenv explicito.
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const STATE_FILE = path.join(__dirname, "..", "data", "shared-state.json");
const TOKEN_FILE = path.join(__dirname, "..", "data", "auth-token");

// Gera/le token de autenticacao dos endpoints. Persiste em data/auth-token
// (gitignored). Se nao existir, gera um novo de 32 bytes (256 bits).
function getOrCreateAuthToken() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const t = fs.readFileSync(TOKEN_FILE, "utf-8").trim();
      if (t.length >= 32) return t;
    }
  } catch {
    /* fall through */
  }
  const dir = path.dirname(TOKEN_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const newToken = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(TOKEN_FILE, newToken, { mode: 0o600 });
  return newToken;
}

const AUTH_TOKEN = getOrCreateAuthToken();

/** Compara strings em tempo constante para evitar timing attacks. */
function timingSafeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function isAuthenticated(req) {
  const header = req.headers["x-flowdesk-token"];
  // Permite cookie como fallback (usado por F5 do navegador apos login)
  const cookie = (req.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("fd_state_token="));
  const cookieToken = cookie?.split("=")[1];
  return timingSafeEqualStr(header, AUTH_TOKEN) || timingSafeEqualStr(cookieToken, AUTH_TOKEN);
}

// Chaves de localStorage que DEVEM ser compartilhadas entre origens
export const SYNCED_KEYS = [
  "fd_users_v2",
  "fd_demand_overrides",
  "fd_sql_demand_overrides",  // overrides do modulo SQL (isolado)
  "fd_groups",
  "fd_group_permissions",      // permissoes por grupo (modulos x acoes)
  "fd_auto_assign_rules",
  "fd_support_members",
  "fd_channel_routing",        // roteamento de canais Slack -> modulos
];

function ensureDir() {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readState() {
  ensureDir();
  if (!fs.existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return {};
  }
}

// Backups rotativos: mantemos as ultimas N copias em data/backups/
const BACKUP_DIR = path.join(__dirname, "..", "data", "backups");
const MAX_BACKUPS = 20;

function rotateBackup() {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dest = path.join(BACKUP_DIR, `shared-state-${stamp}.json`);
    fs.copyFileSync(STATE_FILE, dest);
    // Poda backups antigos
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("shared-state-") && f.endsWith(".json"))
      .sort();
    while (files.length > MAX_BACKUPS) {
      const old = files.shift();
      try { fs.unlinkSync(path.join(BACKUP_DIR, old)); } catch { /* ignore */ }
    }
  } catch {
    /* backup falhou — nao interrompe a operacao */
  }
}

function writeState(state) {
  ensureDir();
  rotateBackup();
  // Escrita atomica: tmp + rename evita corromper se processo morrer no meio
  const tmp = STATE_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STATE_FILE);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}

// Controle para nao rodar 2 syncs SQL em paralelo
let sqlSyncInProgress = false;

/** Roda um script node e resolve com { ok, code, stdout, stderr } */
function runScript(cmd, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, stdio: "pipe", shell: true });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("exit", (code) => resolve({ ok: code === 0, code, stdout, stderr }));
    child.on("error", (err) => resolve({ ok: false, error: err.message }));
  });
}

/**
 * Executa sync do canal SQL e, em seguida, rebuild do bundle para que
 * a proxima requisicao do navegador ja receba os dados atualizados.
 * Assim o botao "Atualizar" pode dar location.reload() direto.
 */
async function runSqlSyncAndRebuild() {
  if (sqlSyncInProgress) {
    return { ok: false, error: "Sync ja em andamento" };
  }
  sqlSyncInProgress = true;
  try {
    const root = path.join(__dirname, "..");

    // 1) Sync do canal
    const syncScript = path.join(__dirname, "syncSqlChannel.cjs");
    const syncResult = await runScript("node", [syncScript], root);
    if (!syncResult.ok) {
      return { ok: false, stage: "sync", ...syncResult };
    }

    // 2) Rebuild do bundle (para preview mode)
    // Em dev mode o Vite HMR atualiza sozinho; build extra nao atrapalha.
    const buildResult = await runScript("npm", ["run", "build"], root);
    return {
      ok: buildResult.ok,
      stage: buildResult.ok ? "done" : "build",
      syncStdout: syncResult.stdout,
      buildStderr: buildResult.stderr,
    };
  } finally {
    sqlSyncInProgress = false;
  }
}

/** CORS: ECHO da Origin do request (so se for permitida) — evita expor "*" */
function setCors(req, res) {
  const origin = req.headers.origin;
  // Aceita apenas origens locais/internas; rejeita qualquer site externo
  const isLocalish =
    !origin ||
    /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.|172\.[1-3][0-9]\.|100\.[6-9][0-9]\.|100\.[1-9][0-9]{2}\.|\[::1\])/.test(origin);
  if (origin && isLocalish) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-FlowDesk-Token");
}

function reject401(res, msg = "Unauthorized") {
  res.statusCode = 401;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("WWW-Authenticate", 'Bearer realm="flowdesk-state"');
  res.end(JSON.stringify({ error: msg }));
}

// ===================================================================
// Slack endpoints — versao LOCAL.
// Antes ficavam em flowdesk-api/Railway, mas Railway eh infra publica
// e nao pode ter token Slack. Aqui tudo roda no Vite dev server da
// maquina do master, lendo SLACK_BOT_TOKEN do .env local (gitignored).
// ===================================================================

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

async function slackApi(method, body, asForm = false) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN nao configurado no .env");
  const url = `https://slack.com/api/${method}`;
  const headers = { Authorization: `Bearer ${token}` };
  let payload;
  if (asForm) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(body).toString();
  } else {
    headers["Content-Type"] = "application/json; charset=utf-8";
    payload = JSON.stringify(body);
  }
  const res = await fetch(url, { method: "POST", headers, body: payload });
  const json = await res.json();
  if (!json.ok) throw new Error(`Slack API: ${json.error || "unknown"}`);
  return json;
}

function parseSlackPermalink(permalink) {
  const m = String(permalink || "").match(/\/archives\/([A-Z0-9]+)\/p(\d+)/);
  if (!m) return null;
  const channel = m[1];
  const pTs = m[2];
  const ts = `${pTs.slice(0, -6)}.${pTs.slice(-6)}`;
  return { channel, thread_ts: ts };
}

function isoToSlackTs(iso) {
  return (new Date(iso).getTime() / 1000).toFixed(6);
}

async function handleSlack(req, res) {
  const url = req.url || "";

  try {
    // GET /slack/status — auth.test
    if (req.method === "GET" && url === "/slack/status") {
      if (!process.env.SLACK_BOT_TOKEN) {
        return res.end(JSON.stringify({ enabled: false }));
      }
      const r = await slackApi("auth.test", {});
      return res.end(JSON.stringify({
        enabled: true, team: r.team, user: r.user, botId: r.bot_id,
      }));
    }

    // POST /slack/reply { permalink, text, senderEmail? }
    // Se senderEmail vier, busca user no Slack por email e posta com
    // username + icon_url da pessoa real (chat:write.customize scope).
    if (req.method === "POST" && url === "/slack/reply") {
      const body = await readJsonBody(req);
      if (!body.text || (!body.permalink && (!body.channel || !body.thread_ts))) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "permalink+text OU channel+thread_ts+text" }));
      }
      let { channel, thread_ts } = body;
      if (body.permalink) {
        const parsed = parseSlackPermalink(body.permalink);
        if (!parsed) { res.statusCode = 400; return res.end(JSON.stringify({ error: "Permalink invalido" })); }
        channel = parsed.channel; thread_ts = parsed.thread_ts;
      }

      // Busca user no Slack pelo email pra postar com identidade real
      let postAs = {};
      if (body.senderEmail) {
        try {
          const lookup = await slackApi("users.lookupByEmail", { email: body.senderEmail }, true);
          if (lookup.user) {
            postAs = {
              username: lookup.user.real_name || lookup.user.profile?.display_name || lookup.user.name,
              icon_url: lookup.user.profile?.image_72 || lookup.user.profile?.image_48,
            };
          }
        } catch { /* fallback: posta como bot mesmo */ }
      }

      const r = await slackApi("chat.postMessage", {
        channel, thread_ts, text: body.text, ...postAs,
      });
      let permalink;
      try {
        const link = await slackApi("chat.getPermalink", { channel, message_ts: r.ts }, true);
        permalink = link.permalink;
      } catch { /* ignore */ }
      return res.end(JSON.stringify({ ok: true, ts: r.ts, channel, permalink, postedAs: postAs.username }));
    }

    // GET /slack/channel-members?channel=C123 — lista membros pra mention autocomplete
    if (req.method === "GET" && url.startsWith("/slack/channel-members")) {
      const u = new URL(url, "http://localhost");
      const channel = u.searchParams.get("channel");
      if (!channel) { res.statusCode = 400; return res.end(JSON.stringify({ error: "channel obrigatorio" })); }
      const cleanCh = channel.replace(/^#/, "");

      // 1) Resolve channel name -> ID se necessario
      let channelId = cleanCh;
      if (!cleanCh.match(/^[A-Z0-9]{8,}$/)) {
        // Nao parece ID, busca pelo nome
        const list = await slackApi("conversations.list", { types: "public_channel,private_channel", limit: 1000 }, true);
        const found = list.channels?.find((c) => c.name === cleanCh);
        if (!found) { res.statusCode = 404; return res.end(JSON.stringify({ error: `Canal #${cleanCh} nao encontrado` })); }
        channelId = found.id;
      }

      // 2) Busca membros (paginado)
      const memberIds = [];
      let cursor;
      do {
        const r = await slackApi("conversations.members",
          { channel: channelId, limit: 200, ...(cursor ? { cursor } : {}) },
          true);
        memberIds.push(...(r.members || []));
        cursor = r.response_metadata?.next_cursor;
      } while (cursor);

      // 3) Busca info de cada user (paralelo, mas batch limitado pra nao 429)
      const users = [];
      const batchSize = 10;
      for (let i = 0; i < memberIds.length; i += batchSize) {
        const batch = memberIds.slice(i, i + batchSize);
        const infos = await Promise.all(batch.map((id) =>
          slackApi("users.info", { user: id }, true).catch(() => null)
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
      users.sort((a, b) => a.name.localeCompare(b.name));
      return res.end(JSON.stringify({ channel: channelId, members: users }));
    }

    // POST /slack/edit { permalink, replyTimestamp, newText }
    if (req.method === "POST" && url === "/slack/edit") {
      const body = await readJsonBody(req);
      const parsed = parseSlackPermalink(body.permalink);
      if (!parsed) { res.statusCode = 400; return res.end(JSON.stringify({ error: "Permalink invalido" })); }
      const ts = isoToSlackTs(body.replyTimestamp);
      await slackApi("chat.update", { channel: parsed.channel, ts, text: body.newText });
      return res.end(JSON.stringify({ ok: true }));
    }

    // POST /slack/delete { permalink, replyTimestamp }
    if (req.method === "POST" && url === "/slack/delete") {
      const body = await readJsonBody(req);
      const parsed = parseSlackPermalink(body.permalink);
      if (!parsed) { res.statusCode = 400; return res.end(JSON.stringify({ error: "Permalink invalido" })); }
      const ts = isoToSlackTs(body.replyTimestamp);
      await slackApi("chat.delete", { channel: parsed.channel, ts }, true);
      return res.end(JSON.stringify({ ok: true }));
    }

    // GET /slack/file/:fileId — proxy de download
    const fileMatch = url.match(/^\/slack\/file\/([^/?]+)/);
    if (req.method === "GET" && fileMatch) {
      const fileId = decodeURIComponent(fileMatch[1]);
      const info = await slackApi("files.info", { file: fileId }, true);
      const file = info.file;
      if (!file?.url_private) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: "Arquivo nao encontrado" }));
      }
      const r = await fetch(file.url_private, {
        headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
      });
      if (!r.ok) {
        res.statusCode = 502;
        return res.end(JSON.stringify({ error: "Download falhou" }));
      }
      res.setHeader("Content-Type", file.mimetype || "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.name)}"`);
      const buf = Buffer.from(await r.arrayBuffer());
      return res.end(buf);
    }

    res.statusCode = 404;
    return res.end(JSON.stringify({ error: "Endpoint Slack nao encontrado" }));
  } catch (err) {
    res.statusCode = 502;
    return res.end(JSON.stringify({ error: err.message }));
  }
}

function handler(req, res, next) {
  // Slack endpoints (locais, leem SLACK_BOT_TOKEN do .env)
  if (req.url?.startsWith("/slack/")) {
    setCors(req, res);
    if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
    res.setHeader("Content-Type", "application/json");
    return handleSlack(req, res);
  }

  // Endpoint que devolve o token de auth.
  //
  // Permite que dispositivos da rede privada (LAN, VPN, mesh) peguem o
  // token automaticamente no boot. Externos (qualquer IP publico) sao
  // rejeitados — token NUNCA viaja pra fora da rede confiavel.
  //
  // Ranges aceitos:
  //   - Loopback (127.0.0.1, ::1)
  //   - LAN privada (RFC1918): 10.x, 172.16-31.x, 192.168.x
  //   - Tailscale (CGNAT): 100.64.0.0/10
  //   - link-local IPv6: fe80::
  if (req.url === "/__token") {
    setCors(req, res);
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      return res.end();
    }
    const ip = (req.socket?.remoteAddress || "").replace(/^::ffff:/, "");
    const isPrivate =
      ip === "127.0.0.1" ||
      ip === "::1" ||
      ip.startsWith("fe80::") ||
      /^10\./.test(ip) ||
      /^192\.168\./.test(ip) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
      // Tailscale CGNAT: 100.64.0.0 - 100.127.255.255
      /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip);
    if (!isPrivate) {
      // IP publico — token NUNCA e exposto.
      return reject401(res, "Token endpoint restricted to private networks");
    }
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Set-Cookie",
      `fd_state_token=${AUTH_TOKEN}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
    );
    return res.end(JSON.stringify({ token: AUTH_TOKEN }));
  }

  // Healthcheck (publico — apenas confirma servidor de pe, sem dados)
  if (req.url === "/__health") {
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: true, ts: Date.now() }));
  }

  // Endpoint de sync sob demanda do canal SQL
  if (req.url === "/__sync-sql") {
    setCors(req, res);
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      return res.end();
    }
    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end(JSON.stringify({ error: "Use POST" }));
    }
    if (!isAuthenticated(req)) return reject401(res);
    return runSqlSyncAndRebuild().then((result) => {
      res.setHeader("Content-Type", "application/json");
      res.statusCode = result.ok ? 200 : 500;
      res.end(JSON.stringify(result));
    });
  }

  if (!req.url?.startsWith("/__state")) return next();

  setCors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  // Auth obrigatorio para qualquer acesso a /__state
  if (!isAuthenticated(req)) return reject401(res);

  // GET /__state → retorna todo estado
  if (req.method === "GET" && req.url === "/__state") {
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(readState()));
  }

  // PUT /__state/<key> → atualiza uma chave
  const putMatch = req.url.match(/^\/__state\/(.+)$/);
  if ((req.method === "PUT" || req.method === "POST") && putMatch) {
    const key = decodeURIComponent(putMatch[1]);
    if (!SYNCED_KEYS.includes(key)) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ error: `Key "${key}" nao e sincronizavel` }));
    }
    return readBody(req).then((body) => {
      try {
        const value = JSON.parse(body);
        const state = readState();
        state[key] = value;
        writeState(state);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  }

  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: "not found" }));
}

export default function stateSyncPlugin() {
  return {
    name: "flowdesk-state-sync",
    configureServer(server) {
      server.middlewares.use(handler);
      console.log("[stateSync] Plugin ativo em dev server (GET/PUT /__state)");
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
      console.log("[stateSync] Plugin ativo em preview server (GET/PUT /__state)");
    },
  };
}
