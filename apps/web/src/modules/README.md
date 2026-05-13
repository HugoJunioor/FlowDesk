# Frontend modules — padrão Just

Cada feature do FlowDesk é um módulo co-localizado em `apps/web/src/modules/<nome>/`. Replica a estrutura adotada nos outros projetos da Just.

## Estrutura

```
modules/<nome>/
├── api.ts          # Funções HTTP que chamam o backend (apiClient + unwrap)
├── hooks.ts        # React Query hooks (useQuery / useMutation)
├── schemas.ts      # Zod schemas dos formulários (react-hook-form + zodResolver)
├── types.ts        # TypeScript types (espelham os DTOs da api)
├── pages/          # (opcional) Páginas do módulo (lazy-loaded em App.tsx)
├── components/     # (opcional) Componentes específicos do módulo
└── index.ts        # Barrel exports — fora do módulo só importa daqui
```

## Convenções

- **Componentes genéricos** (Button, Card, Dialog...) → `apps/web/src/components/ui/`
- **Componentes do módulo** → `modules/<nome>/components/`
- **Query keys** começam com o módulo: `['auth', 'me']`, `['notas', 'list']`
- **Hooks consomem `api.ts`** (nunca chamam apiClient direto)
- **Schemas Zod** são fonte de verdade — types derivam via `z.infer<>`

## Como adicionar novo módulo

1. Copie `auth/` como template
2. Renomeie tipos, schemas, query keys
3. Implemente `api.ts` chamando os endpoints reais
4. Implemente `hooks.ts` com React Query
5. Adicione `index.ts` barrel exports
6. Use de fora: `import { useMe } from '@/modules/auth'`

## Módulos atuais

| Módulo | Status | API correspondente |
|---|---|---|
| `auth` | ✅ Fase 8 | `apps/api/src/modules/auth` |
| `notificacao` | ⏳ Fase 9 | `apps/api/src/modules/notificacao` |
| `nota` | ⏳ Fase 9 | `apps/api/src/modules/nota` |
| `demanda` | ⏳ Fase 9 | `apps/api/src/modules/demanda` |
