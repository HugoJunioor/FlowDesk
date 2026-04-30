#!/usr/bin/env node
/**
 * Exporta data/shared-state.json para um arquivo .sql com INSERTs para o
 * schema de producao (db/schema.sql). Uso:
 *
 *   node scripts/exportToSql.cjs > db/seed-from-local.sql
 *   psql $DATABASE_URL -f db/schema.sql
 *   psql $DATABASE_URL -f db/seed-from-local.sql
 *
 * O script NAO conecta no banco — apenas gera SQL plano. Cezar aplica em prod.
 */
const fs = require("node:fs");
const path = require("node:path");

const STATE_FILE = path.join(__dirname, "..", "data", "shared-state.json");

if (!fs.existsSync(STATE_FILE)) {
  console.error("data/shared-state.json nao encontrado.");
  process.exit(1);
}

const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));

const users = state.fd_users_v2 || [];
const groups = state.fd_group_permissions || [];
const legacyGroupNames = state.fd_groups || [];
const supportMembers = state.fd_support_members || {};
const autoAssignRules = state.fd_auto_assign_rules || [];
const slackOverrides = state.fd_demand_overrides || {};
const sqlOverrides = state.fd_sql_demand_overrides || {};

const out = [];
const sq = (v) => v == null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;
const ts = (v) => v ? `'${v}'::timestamptz` : "NOW()";
const jb = (v) => v == null ? "NULL" : `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
const bool = (v) => v ? "TRUE" : "FALSE";

out.push("-- Gerado por scripts/exportToSql.cjs");
out.push(`-- Origem: data/shared-state.json em ${new Date().toISOString()}`);
out.push("BEGIN;");
out.push("");

// Users
out.push("-- USERS");
for (const u of users) {
  out.push(
    `INSERT INTO users (id, login, email, name, cpf, phone, role, status, password_hash, is_first_access, password_reset_requested, language, theme_preferences, created_at, created_by, updated_at)`
  );
  out.push(
    `VALUES (${sq(u.id)}, ${sq(u.login)}, ${sq(u.email)}, ${sq(u.name)}, ${sq(u.cpf)}, ${sq(u.phone)}, ${sq(u.role)}, ${sq(u.status)}, ${sq(u.passwordHash)}, ${bool(u.isFirstAccess)}, ${bool(u.passwordResetRequested)}, ${sq(u.language || "pt-BR")}, ${jb(u.themePreferences)}, ${ts(u.createdAt)}, ${sq(u.createdBy)}, ${ts(u.updatedAt)})`
  );
  out.push(
    `ON CONFLICT (login) DO UPDATE SET email=EXCLUDED.email, name=EXCLUDED.name, password_hash=EXCLUDED.password_hash, status=EXCLUDED.status, updated_at=NOW();`
  );
}
out.push("");

// Groups
out.push("-- GROUPS");
const seenGroups = new Set();
for (const g of groups) {
  seenGroups.add(g.name.toLowerCase());
  out.push(
    `INSERT INTO groups (name, description, modules, created_at) VALUES (${sq(g.name)}, ${sq(g.description || "")}, ${jb(g.modules || {})}, ${ts(g.createdAt)}) ON CONFLICT (name) DO UPDATE SET description=EXCLUDED.description, modules=EXCLUDED.modules, updated_at=NOW();`
  );
}
// Grupos legados (string[]) — apenas o nome
for (const name of legacyGroupNames) {
  if (seenGroups.has(name.toLowerCase())) continue;
  out.push(
    `INSERT INTO groups (name, description, modules) VALUES (${sq(name)}, '', '{}'::jsonb) ON CONFLICT (name) DO NOTHING;`
  );
}
out.push("");

// User-group memberships
out.push("-- USER_GROUPS");
for (const u of users) {
  for (const g of u.groups || []) {
    out.push(
      `INSERT INTO user_groups (user_id, group_name) VALUES (${sq(u.id)}, ${sq(g)}) ON CONFLICT DO NOTHING;`
    );
  }
}
out.push("");

// Support members
out.push("-- SUPPORT_MEMBERS");
for (const [login, level] of Object.entries(supportMembers)) {
  out.push(
    `INSERT INTO support_members (slack_login, level) VALUES (${sq(login)}, ${sq(level)}) ON CONFLICT (slack_login) DO UPDATE SET level=EXCLUDED.level, updated_at=NOW();`
  );
}
out.push("");

// Auto-assign rules
out.push("-- AUTO_ASSIGN_RULES");
const rulesArr = Array.isArray(autoAssignRules) ? autoAssignRules : [];
rulesArr.forEach((rule, idx) => {
  const id = rule.id || `00000000-0000-0000-0000-${String(idx).padStart(12, "0")}`;
  out.push(
    `INSERT INTO auto_assign_rules (id, rule, enabled, priority) VALUES (${sq(id)}, ${jb(rule)}, ${bool(rule.enabled !== false)}, ${rule.priority || 100 + idx}) ON CONFLICT (id) DO UPDATE SET rule=EXCLUDED.rule, updated_at=NOW();`
  );
});
out.push("");

// Demand overrides
out.push("-- DEMAND_OVERRIDES (slack)");
for (const [demandId, override] of Object.entries(slackOverrides)) {
  out.push(
    `INSERT INTO demand_overrides (channel, demand_id, override) VALUES ('slack', ${sq(demandId)}, ${jb(override)}) ON CONFLICT (channel, demand_id) DO UPDATE SET override=EXCLUDED.override, updated_at=NOW();`
  );
}
out.push("");
out.push("-- DEMAND_OVERRIDES (sql)");
for (const [demandId, override] of Object.entries(sqlOverrides)) {
  out.push(
    `INSERT INTO demand_overrides (channel, demand_id, override) VALUES ('sql', ${sq(demandId)}, ${jb(override)}) ON CONFLICT (channel, demand_id) DO UPDATE SET override=EXCLUDED.override, updated_at=NOW();`
  );
}
out.push("");
out.push("COMMIT;");

process.stdout.write(out.join("\n") + "\n");
console.error(
  `[export] users=${users.length} groups=${groups.length + legacyGroupNames.length} support=${Object.keys(supportMembers).length} rules=${rulesArr.length} slack_overrides=${Object.keys(slackOverrides).length} sql_overrides=${Object.keys(sqlOverrides).length}`
);
