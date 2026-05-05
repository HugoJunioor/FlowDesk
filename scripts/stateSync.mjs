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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function handler(req, res, next) {
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
