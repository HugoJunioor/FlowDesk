# Módulo Template

> Use este módulo como base para criar novos. Copie a pasta, renomeie para
> o nome do domínio (ex: `notificacao`, `usuario`, `demanda`) e ajuste.

## Estrutura

```
_template/
├── _template.controller.ts   # Adaptação HTTP ↔ service. try/catch + next(err).
├── _template.dto.ts          # Zod schemas + types derivados (fonte da verdade).
├── _template.repository.ts   # Acesso ao banco. Queries parametrizadas.
├── _template.service.ts      # Regra de negócio pura. Sem HTTP, sem SQL direto.
├── _template.routes.ts       # Express Router + middlewares + controller.
├── README.md                 # Você está aqui.
└── __tests__/
    ├── _template.service.spec.ts
    ├── _template.controller.spec.ts
    └── fixtures.ts
```

## Dependências entre camadas

```
controller → service → repository
```

**Proibido:** controller chamar repository diretamente.

## Como criar um novo módulo

```bash
cp -r src/modules/_template src/modules/<nome>
cd src/modules/<nome>
# Renomeie arquivos: _template.* → <nome>.*
# Ajuste imports, schemas, entidades
```

Depois registre o router em `src/routes/index.ts`:

```ts
import { <nome>Routes } from '@modules/<nome>/<nome>.routes';
router.use('/<nome>s', <nome>Routes);
```

## Resposta padronizada

Todas as rotas retornam um destes envelopes:

```jsonc
// Sucesso simples
{ "sucesso": true, "dados": { ... } }

// Lista paginada
{ "sucesso": true, "dados": [...], "total": 100, "pagina": 1, "limite": 20, "totalPaginas": 5 }

// Erro (vem do error-handler global)
{ "erro": true, "mensagem": "...", "codigo": "CODIGO_MAQUINA", "detalhes": ..., "requestId": "uuid" }
```

## Validação

`validate({ body, query, params })` no router antes do controller. NUNCA
no service ou repository.

## Erros

Use a hierarquia de `@shared/domain/errors`:

- `NotFoundError` → 404
- `ValidationError` → 400
- `UnauthorizedError` → 401
- `ForbiddenError` → 403
- `ConflictError` → 409
- `DomainError` (base) → use quando criar um erro custom

Tudo que escapar do error-handler vira 500 genérico (sem vazar stack).
