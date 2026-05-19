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

- Branch protection na `main` (5 checks required + sem bypass)
- Secrets scan (gitleaks) em todo PR + push protection do GitHub
- Dependabot alerts + auto-updates de seguranca
- Pre-commit hook (lint-staged)
- CI roda em modo demo (sem dados reais)
