# i18n Migration Playbook

Plan to migrate the entire UI to support PT-BR / EN-US / ES-ES via the existing
`LanguageContext` + `i18n.ts` dictionary.

## Current state

- Infrastructure ready: `apps/web/src/lib/i18n.ts` (PT-BR / EN-US / ES-ES dicts)
- Hook `useLanguage()` provides `{ language, setLanguage, t(key, params?) }`
- Switcher already wired at `Settings` page
- Default language: `pt-BR`
- Coverage: ~5 out of ~196 TSX/TS files already use `t(...)`. Remaining ~191
  files have hardcoded PT strings to migrate.

## Migration order (per PR)

Each PR migrates one module. Independent — does not break others.

1. **Settings + Profile** (5 files) — DONE (pilot)
2. **Demands list + filters** (`/demandas`)
3. **Demand sheet (detail)** + reply composer
4. **Dashboard / Index** (cards, charts)
5. **Notifications** (bell, preferences card, page)
6. **Authentication** (Login, password reset, change password)
7. **Admin** (User management, Groups, Channel routing)
8. **Infra + DemandasInternas + DemandasSql** (specialty modules)
9. **App shell** (Sidebar, top bar, AppLayout)
10. **Modals + dialogs** (across the app)
11. **Email templates** (lembrete diario, notifications) — requires backend
    work: user.language from DB, render template per language

## Per-file workflow

1. Run `grep -nE '"[A-ZÀ-Úa-zçãáàéíóúâêôü][^"]{3,80}"|>[A-ZÀ-Úa-zçãáàéíóúâêôü][^<{]{2,60}<' <file>`
   to extract candidate hardcoded strings.
2. For each string:
   - Pick a key namespaced by module (e.g. `demands.filter.client`)
   - Add the key to all 3 language blocks in `i18n.ts` (pt-BR, en-US, es-ES)
   - Replace the hardcoded string with `t("module.key")` in the TSX
3. For strings with inline elements (e.g. `<strong>X</strong> in the middle`),
   split into 2 keys: `prefix` and `suffix`, render between the inline.
4. For strings with dynamic values, use `t("key", { var: value })` and
   include `{var}` in the dictionary string.
5. Validate: `npx tsc --noEmit` (the web workspace).

## Conventions

- Keys: lowercase, dot-separated, namespaced by module
  (`settings.approvers.title`, `demands.empty_state`)
- Avoid generic keys like `title` or `description` at the root.
- When translation differs by gender/plural in the target language, encode
  the variant in the key (`demands.count_one`, `demands.count_other`) and
  branch in the component. Currently rare — most strings are neutral.
- Reuse existing `common.*` keys where applicable (save, cancel, delete, etc.)
  before creating new ones.

## Email templates (Phase 2)

The daily reminder template at `legacy-state/server.mjs:buildDailySummary()` is
hardcoded PT. Migration plan:

1. Add `language` column to `tb_usuario` or read from `fd_users_v2.language`.
2. Build a server-side translation map mirroring keys used in email subjects
   and body.
3. Render `buildDailySummary(userName, demands, language)` and
   `subject = subject(language, count)`.
4. Same for any other automated email (password reset, notification digest).

## Definition of done (per PR)

- All visible strings in the migrated files come from `t(...)`
- 3 language blocks have entries for every new key
- `npx tsc --noEmit` clean
- Manual smoke: switch language in `/configuracoes`, navigate to the migrated
  screens, verify text changes
