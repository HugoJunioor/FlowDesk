# Adapters de canal

Camada de abstração que isola o resto do sistema da plataforma de origem
das demandas. Hoje o FlowDesk lê do Slack, mas a arquitetura está pronta
para Microsoft Teams, Discord, WhatsApp Business, e-mail (IMAP) ou
qualquer outra fonte de mensagens.

## Como funciona

```
┌────────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Slack / Teams  │────▶│ DemandAdapter│────▶│ SlackDemand     │
│ Discord / Email│     │ (normaliza)  │     │ (modelo interno)│
└────────────────┘     └──────────────┘     └─────────────────┘
                                                     │
                                                     ▼
                                          ┌──────────────────┐
                                          │ SLA · Dashboard  │
                                          │ Relatórios · etc │
                                          └──────────────────┘
```

Toda lógica de negócio (SLA em horas úteis, classificação por prioridade,
overrides, dashboards, relatórios) trabalha em cima de `SlackDemand` —
o nome ficou histórico mas o tipo é genérico. Adicionar Teams é só
escrever um adapter de ~80 linhas.

## Adicionando um novo canal

1. Criar `src/adapters/<canal>Adapter.ts` implementando `DemandAdapter`
2. Implementar `fetchMessages()` → chama API da plataforma
3. Implementar `toDemand()` → converte payload da API em `SlackDemand`
4. (Opcional) `react()` e `reply()` se a plataforma suportar
5. Registrar no front quando o registry de canais estiver pronto

Exemplo prático em [`teamsAdapter.example.ts`](./teamsAdapter.example.ts).

## Status atual

| Canal              | Status     | Adapter                        |
|--------------------|------------|--------------------------------|
| Slack              | ✅ Produção | [`slackAdapter.ts`](./slackAdapter.ts) |
| Microsoft Teams    | 📋 Stub    | [`teamsAdapter.example.ts`](./teamsAdapter.example.ts) |
| Discord            | ⏳ Roadmap |                                |
| WhatsApp Business  | ⏳ Roadmap |                                |
| E-mail (IMAP)      | ⏳ Roadmap |                                |
| Telegram           | ⏳ Roadmap |                                |
