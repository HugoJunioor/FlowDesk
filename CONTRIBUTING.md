# Contribuindo com o FlowDesk

Obrigado por considerar contribuir! Este projeto é portfolio aberto a sugestões,
fork e issues. Fluxo curto:

## Como reportar bug ou sugestão

Abre uma [issue](https://github.com/HugoJunioor/FlowDesk/issues/new) com:

- **O que aconteceu** (esperado vs real)
- **Como reproduzir** (passo a passo)
- **Versão / browser** se relevante
- Print, se ajudar

## Como abrir PR

1. Fork → branch a partir de `main` (`git checkout -b fix/algo-quebrado`)
2. Mantém o estilo: TypeScript strict, sem `any` desnecessário, comentários úteis
3. Roda `npm run lint` e `npm run build` antes do push
4. PR descrevendo o **problema** e a **solução**

## Convenções

- **Commits:** padrão simples — `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`
- **Naming:** componentes `PascalCase`, hooks `useThing`, libs `camelCase`

## Política de privacidade no historico

Este repositorio é **publico**. NUNCA comite:

- Nomes reais de operadores, clientes ou solicitantes (use `Operador`,
  `Solicitante`, `Membro do time` em fixtures/comentarios/PRs)
- Emails reais ou domínios proprietarios (use `empresa.com`, `exemplo.com`)
- Titulos reais de demandas em commit messages ou PR bodies
- Credenciais, tokens, IPs de produção (ja gitignored — confira `.env.example`)
- Referencias a "Claude" como autor/co-autor em commits ou docs

Dados reais ficam em arquivos gitignored (`.env.production`,
`apps/web/data/shared-state.json`, `apps/web/src/data/realDemands.ts`).
O branding customizado da empresa vai em `branding.local.ts` (tambem
gitignored).

Hook local recomendado (`.git/hooks/commit-msg`):

```bash
#!/bin/bash
if grep -qE "Hugo|Bichof|Tiago Silva|Bruna|Joyce|wearejust\\.it" "$1"; then
  echo "ERRO: commit message contem nome/email real. Generalize." >&2
  exit 1
fi
```
- **Strings:** em português no código de UI, em inglês em comentários técnicos
- **CI obrigatório:** build precisa passar, lint não bloqueia mas evite regredir

## Localmente

```bash
npm install
cp .env.example .env
npm run dev
```

Login default: `master` / `Admin@1` (forçará troca no primeiro acesso).

## Regra de ouro: dados privados ficam local

GitHub do FlowDesk é **estrutura/código apenas**. NUNCA commite:

- `realDemands.ts` (gerado pelo sync, contém dados de clientes reais)
- `.env`, `.env.bak`, qualquer arquivo com token Slack
- Planilhas, CSVs ou exports da operação real
- Screenshots com nomes de cliente, CPFs, valores

CI roda secrets scan (gitleaks) em todo PR. Se Push Protection bloquear:

```bash
# NUNCA faça git push --force pra contornar.
git reset --soft HEAD~1     # desfaz commit mantendo arquivos
# remova o arquivo problemático do staging, adicione ao .gitignore
git commit                  # recommit limpo
```

## Modo demo (sem dados reais)

```bash
VITE_DEMO_MODE=true npm run build
```

CI sempre roda nesse modo — garante que o repo builda sem `realDemands.ts`.

## Dúvidas

[LinkedIn](https://www.linkedin.com/in/hugo-cordeiro-junior) ou abre uma issue.
