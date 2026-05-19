# Security Policy

## Supported Versions

Apenas a `main` recebe correcoes de seguranca. Releases antigas (tags `vX.Y.Z`)
nao sao patcheadas — atualize pra ultima versao se encontrar problema.

## Reporting a Vulnerability

**Nao abra issue publica** se voce encontrou:

- Token / credencial vazada em commit ou logs
- Endpoint expondo dados de cliente
- Bypass de autenticacao ou autorizacao
- Injection (SQL, comando, XSS)
- Qualquer coisa que comprometa dados de operacao real

### Como reportar

Mande email pra **suporte@wearejust.it** com:

- Descricao do problema
- Passos pra reproduzir
- Impacto estimado (quem/quantos usuarios afetados)
- (Opcional) Sugestao de correcao

Resposta em ate **48h uteis** com:
- Confirmacao do recebimento
- Avaliacao da severidade
- Plano de mitigacao

Apos correcao, abro disclosure publico no CHANGELOG mencionando voce
(se autorizar) e a CVE (se aplicavel).

## Out of scope

- Dependencias com CVE conhecido — Dependabot ja monitora, abre PR auto
- Vulnerabilidades em servicos third-party (Slack, Vercel, Railway)
- Falta de rate limiting em ambiente dev local
- Tokens em `.env.example` (sao placeholders)

## Hardening ja em vigor

### Processo e repositorio

- Branch protection na `main` (5 checks required + sem bypass)
- Secrets scan (gitleaks) em todo PR + push protection do GitHub
- Dependabot alerts + auto-updates de seguranca
- Pre-commit hook (lint-staged)
- CI roda em modo demo (sem dados reais)

### API (Express)

- **Helmet** com Content Security Policy restritiva:
  - `default-src 'self'` / `script-src 'self'` (dev permite `unsafe-inline`)
  - `style-src 'self' 'unsafe-inline'` / `img-src 'self' data: https://*.slack-edge.com`
  - `connect-src 'self'` / `object-src 'none'` / `frame-ancestors 'none'`
- **HSTS** habilitado em producao — `max-age=31536000; includeSubDomains`
- **X-Frame-Options: DENY** — previne clickjacking
- **X-Content-Type-Options: nosniff** — previne MIME sniffing
- **Referrer-Policy: strict-origin-when-cross-origin**
- **Permissions-Policy** — camera, microfone e geolocalizacao desabilitados
- **CORS estrito em producao** — apenas origens em `ALLOWED_ORIGINS` (CSV via env); requests sem Origin bloqueados em prod
- **Rate limit global** — 100 req/min por IP em `/api/v1`
- **Rate limit especifico** em `/api/v1/auth/login` (configuravel via `RATE_LIMIT_AUTH`)
- **HPP** — previne HTTP Parameter Pollution em query strings
- **Cookie `fd_refresh`** — `HttpOnly`, `Secure` (via `COOKIE_SECURE` env), `SameSite=Strict`, restrito ao path `/api/v1/auth`
- **Pino redact** — `password`, `passwordHash`, `token`, `secret`, `apiKey`, `refreshToken`, `accessToken`, `authorization` e `cookie` censurados em todos os logs estruturados
- **Validacao Zod** em todos os inputs de endpoints (fail-fast na borda)

### Infraestrutura (nginx — container web)

- **X-Frame-Options: DENY**
- **X-Content-Type-Options: nosniff**
- **Referrer-Policy: strict-origin-when-cross-origin**
- **Permissions-Policy** — camera, microfone e geolocalizacao desabilitados
- **HSTS** — `max-age=31536000; includeSubDomains`

### Dados e autenticacao

- Senhas armazenadas com **bcrypt** (custo 12+)
- Refresh tokens em banco com rotacao e revogacao por sessao
- Auditoria de todas as mutacoes (quem, quando, o que, payload sanitizado)
- Variaveis de ambiente validadas em boot via Zod (processo encerra com erro claro se invalidas)
