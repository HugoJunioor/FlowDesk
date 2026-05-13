#!/usr/bin/env node
/**
 * Preflight check antes de subir em producao.
 *
 * Roda uma serie de validacoes nao-destrutivas e falha (exit 1) se alguma
 * critica nao passar. Uso: `npm run preflight`.
 */
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const root = path.join(__dirname, "..");
let failed = 0;
let warnings = 0;

function ok(msg) { console.log(`  \x1b[32m✓\x1b[0m ${msg}`); }
function fail(msg) { console.log(`  \x1b[31m✗\x1b[0m ${msg}`); failed++; }
function warn(msg) { console.log(`  \x1b[33m!\x1b[0m ${msg}`); warnings++; }
function section(name) { console.log(`\n\x1b[1m${name}\x1b[0m`); }

function run(cmd) {
  try {
    return { ok: true, out: execSync(cmd, { cwd: root, stdio: "pipe" }).toString() };
  } catch (e) {
    return { ok: false, out: (e.stdout?.toString() || "") + (e.stderr?.toString() || "") };
  }
}

section("1. Auth token");
const tokenFile = path.join(root, "data", "auth-token");
if (fs.existsSync(tokenFile)) {
  const t = fs.readFileSync(tokenFile, "utf-8").trim();
  if (t.length >= 32) ok(`Token de ${t.length} chars presente`);
  else fail(`Token muito curto (${t.length} chars)`);
} else {
  warn("data/auth-token nao existe ainda — sera gerado no primeiro boot");
}

section("2. Senhas master");
const stateFile = path.join(root, "data", "shared-state.json");
if (fs.existsSync(stateFile)) {
  try {
    const state = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
    const users = state.fd_users_v2 || [];
    const master = users.find((u) => u.role === "master");
    if (master) {
      if (master.passwordHash?.startsWith("pbkdf2$")) ok("Master usa PBKDF2");
      else fail("Master ainda usa hash legado (SHA-256). Faca login para migrar.");
      if (master.isFirstAccess) warn("Master ainda tem isFirstAccess=true (senha provisoria)");
    } else warn("Nenhum master encontrado em shared-state");
  } catch (e) {
    warn(`shared-state.json ilegivel: ${e.message}`);
  }
} else {
  warn("data/shared-state.json ainda nao existe");
}

section("3. .gitignore");
const gi = fs.readFileSync(path.join(root, ".gitignore"), "utf-8");
if (gi.includes("/data/")) ok("/data/ ignorado");
else fail("/data/ NAO esta no .gitignore — token e dados sensiveis vao vazar!");
if (gi.includes(".env")) ok(".env ignorado");
else fail(".env NAO esta no .gitignore");
if (gi.includes("realDemands.ts")) ok("realDemands.ts ignorado");
else warn("realDemands.ts nao esta no .gitignore");

section("4. Variaveis de ambiente");
const envFile = path.join(root, ".env");
if (fs.existsSync(envFile)) {
  const env = fs.readFileSync(envFile, "utf-8");
  if (/SLACK_BOT_TOKEN=.+/.test(env)) ok("SLACK_BOT_TOKEN configurado");
  else warn("SLACK_BOT_TOKEN ausente (sync Slack vai falhar)");
} else {
  warn(".env nao encontrado");
}

section("5. Build");
const build = run("npm run build");
if (build.ok) ok("npm run build passou");
else fail("npm run build FALHOU\n" + build.out.split("\n").slice(-15).join("\n"));

section("6. npm audit");
const audit = run("npm audit --omit=dev --audit-level=high --json");
try {
  const data = JSON.parse(audit.out || "{}");
  const high = (data.metadata?.vulnerabilities?.high || 0) + (data.metadata?.vulnerabilities?.critical || 0);
  if (high === 0) ok("Sem vulnerabilidades high/critical em prod deps");
  else fail(`${high} vulnerabilidades high/critical em prod deps`);
} catch {
  warn("npm audit nao retornou JSON valido");
}

console.log();
if (failed > 0) {
  console.log(`\x1b[31m✗ Preflight FALHOU: ${failed} erro(s), ${warnings} aviso(s)\x1b[0m`);
  process.exit(1);
} else {
  console.log(`\x1b[32m✓ Preflight OK\x1b[0m (${warnings} aviso(s))`);
  process.exit(0);
}
