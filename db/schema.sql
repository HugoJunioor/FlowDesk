-- =============================================================================
-- FlowDesk / JustFlow — schema de producao (PostgreSQL 14+)
-- =============================================================================
-- Convencoes:
--  * snake_case nas colunas; tabelas no plural
--  * timestamps em TIMESTAMPTZ (sempre UTC)
--  * dados deeply-nested (overrides, closure, threadReplies) como JSONB
--  * todo INSERT/UPDATE atualiza updated_at via trigger
-- =============================================================================

BEGIN;

-- Extensoes
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- emails/logins case-insensitive

-- -----------------------------------------------------------------------------
-- Trigger helper: bump updated_at em UPDATE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- USUARIOS
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  login                     CITEXT UNIQUE NOT NULL,
  email                     CITEXT UNIQUE NOT NULL,
  name                      TEXT NOT NULL,
  cpf                       VARCHAR(14),
  phone                     VARCHAR(32),
  role                      VARCHAR(16) NOT NULL CHECK (role IN ('master','user')),
  status                    VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked')),
  -- Hash PBKDF2 no formato: pbkdf2$<iters>$<saltHex>$<hashHex>
  password_hash             TEXT NOT NULL,
  is_first_access           BOOLEAN NOT NULL DEFAULT TRUE,
  password_reset_requested  BOOLEAN NOT NULL DEFAULT FALSE,
  language                  VARCHAR(8) DEFAULT 'pt-BR',
  theme_preferences         JSONB,
  failed_login_count        INTEGER NOT NULL DEFAULT 0,
  locked_until              TIMESTAMPTZ,
  last_login_at             TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                TEXT NOT NULL,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role   ON users(role);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- =============================================================================
-- GRUPOS + PERMISSOES POR MODULO
-- =============================================================================
CREATE TABLE IF NOT EXISTS groups (
  name        CITEXT PRIMARY KEY,
  description TEXT NOT NULL DEFAULT '',
  -- Mapa moduleId -> string[] de permissions ('view','edit','create','delete','export')
  modules     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- Junction users <-> groups
CREATE TABLE IF NOT EXISTS user_groups (
  user_id    UUID   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_name CITEXT NOT NULL REFERENCES groups(name) ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY (user_id, group_name)
);

CREATE INDEX IF NOT EXISTS idx_user_groups_group ON user_groups(group_name);

-- =============================================================================
-- MEMBROS POR NIVEL DE SUPORTE (N1/N2/N3)
-- =============================================================================
CREATE TABLE IF NOT EXISTS support_members (
  slack_login  TEXT PRIMARY KEY,
  level        VARCHAR(4) NOT NULL CHECK (level IN ('N1','N2','N3')),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_support_members_updated_at
  BEFORE UPDATE ON support_members
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- =============================================================================
-- REGRAS DE AUTO-ATRIBUICAO
-- =============================================================================
CREATE TABLE IF NOT EXISTS auto_assign_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Rule completa em JSONB (keywords, channel, assignee, priority, etc)
  rule        JSONB NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  priority    INTEGER NOT NULL DEFAULT 100,  -- ordem de avaliacao
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_assign_enabled ON auto_assign_rules(enabled, priority);

CREATE TRIGGER trg_auto_assign_updated_at
  BEFORE UPDATE ON auto_assign_rules
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- =============================================================================
-- OVERRIDES DE DEMANDAS (Slack + SQL)
-- =============================================================================
-- Demandas em si vem do Slack/banco SQL externo em tempo real e nao sao
-- persistidas aqui. Mas o master pode "anotar" overrides (priority, status,
-- assignee, closure fields) que precisam sobreviver entre sessoes.
CREATE TABLE IF NOT EXISTS demand_overrides (
  channel       VARCHAR(8) NOT NULL CHECK (channel IN ('slack','sql')),
  demand_id     TEXT NOT NULL,
  -- Patch parcial sobre o SlackDemand: priority, status, closure, etc.
  override      JSONB NOT NULL,
  updated_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (channel, demand_id)
);

CREATE INDEX IF NOT EXISTS idx_overrides_channel ON demand_overrides(channel);
CREATE INDEX IF NOT EXISTS idx_overrides_updated ON demand_overrides(updated_at DESC);

CREATE TRIGGER trg_overrides_updated_at
  BEFORE UPDATE ON demand_overrides
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- =============================================================================
-- SESSOES (opcional — se o backend gerenciar sessoes server-side)
-- =============================================================================
CREATE TABLE IF NOT EXISTS sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Token opaco (32 bytes hex). Comparar com timing-safe.
  token_hash    TEXT NOT NULL UNIQUE,
  user_agent    TEXT,
  ip            INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- =============================================================================
-- TOKENS DE API (compartilhados entre dispositivos VPN — substitui auth-token)
-- =============================================================================
CREATE TABLE IF NOT EXISTS api_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,                -- ex: "VPN clients"
  -- Hash do token (nunca o token em si). Validacao: hash(input) == token_hash.
  token_hash   TEXT NOT NULL UNIQUE,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ
);

-- =============================================================================
-- AUDIT LOG (recomendado em prod — investigacoes pos-incidente)
-- =============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  ts          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_login TEXT,
  action      TEXT NOT NULL,                  -- ex: "user.create", "demand.override.update"
  target_type TEXT,                           -- ex: "user", "demand"
  target_id   TEXT,
  ip          INET,
  user_agent  TEXT,
  payload     JSONB                           -- diff/contexto da acao
);

CREATE INDEX IF NOT EXISTS idx_audit_ts          ON audit_log(ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor       ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action      ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_target      ON audit_log(target_type, target_id);

-- =============================================================================
-- SEED MINIMO — usuario master inicial
-- =============================================================================
-- IMPORTANTE: trocar a senha no primeiro login. Hash abaixo corresponde a
-- "Admin@1" e o sistema vai forcar a troca por estar bloqueada na lista negra.
-- Para gerar um novo hash localmente: import { hashPassword } from src/lib/crypto.ts
INSERT INTO users (id, login, email, name, role, status, password_hash,
                   is_first_access, password_reset_requested, created_by)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'master',
  'admin@company.com',
  'Administrador',
  'master',
  'active',
  -- Placeholder: SUBSTITUIR pelo hash gerado em produção antes de aplicar.
  'pbkdf2$150000$REPLACE_SALT_HEX$REPLACE_HASH_HEX',
  TRUE,
  FALSE,
  'system'
)
ON CONFLICT (login) DO NOTHING;

-- Grupos default (Suporte/Desenvolvimento/Gestao/Comercial) com view basica
INSERT INTO groups (name, description, modules) VALUES
  ('Suporte',        'Equipe de suporte ao cliente',  '{"dashboard":["view"],"demandas":["view","edit"]}'::jsonb),
  ('Desenvolvimento','Equipe de engenharia',          '{"dashboard":["view"],"demandas":["view"]}'::jsonb),
  ('Gestão',         'Liderança e gestores',          '{"dashboard":["view"],"demandas":["view"],"relatorios":["view","export"]}'::jsonb),
  ('Comercial',      'Equipe comercial',              '{"dashboard":["view"]}'::jsonb)
ON CONFLICT (name) DO NOTHING;

COMMIT;
