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
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATE_FILE = path.join(__dirname, "..", "data", "shared-state.json");

// Chaves de localStorage que DEVEM ser compartilhadas entre origens
export const SYNCED_KEYS = [
  "fd_users_v2",
  "fd_demand_overrides",
  "fd_sql_demand_overrides",  // overrides do modulo SQL (isolado)
  "fd_groups",
  "fd_group_permissions",      // permissoes por grupo (modulos x acoes)
  "fd_auto_assign_rules",
  "fd_support_members",
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

function writeState(state) {
  ensureDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
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

function runSqlSync() {
  return new Promise((resolve) => {
    if (sqlSyncInProgress) {
      resolve({ ok: false, error: "Sync ja em andamento" });
      return;
    }
    sqlSyncInProgress = true;
    const script = path.join(__dirname, "syncSqlChannel.cjs");
    const root = path.join(__dirname, "..");
    const child = spawn("node", [script], { cwd: root, stdio: "pipe" });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("exit", (code) => {
      sqlSyncInProgress = false;
      resolve({ ok: code === 0, code, stdout, stderr });
    });
    child.on("error", (err) => {
      sqlSyncInProgress = false;
      resolve({ ok: false, error: err.message });
    });
  });
}

function handler(req, res, next) {
  // Endpoint de sync sob demanda do canal SQL
  if (req.url === "/__sync-sql") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      return res.end();
    }
    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end(JSON.stringify({ error: "Use POST" }));
    }
    return runSqlSync().then((result) => {
      res.setHeader("Content-Type", "application/json");
      res.statusCode = result.ok ? 200 : 500;
      res.end(JSON.stringify(result));
    });
  }

  if (!req.url?.startsWith("/__state")) return next();

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

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
