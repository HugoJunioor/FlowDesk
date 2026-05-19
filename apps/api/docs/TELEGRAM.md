# Integração Telegram

FlowDesk pode enviar notificações via Telegram pra usuários que conectarem suas contas.

## 1. Criar o bot no BotFather

1. No Telegram, fale com `@BotFather`
2. Envie `/newbot`
3. Escolha um nome (ex: "FlowDesk Just")
4. Escolha um username terminado em `Bot` (ex: `FlowDeskJustBot`)
5. Copie o TOKEN devolvido (formato `<numero>:<chars>`)

## 2. Configurar `.env` da API

```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=<SEU-TOKEN-AQUI>
TELEGRAM_BOT_USERNAME=FlowDeskJustBot
TELEGRAM_WEBHOOK_SECRET=<32-chars-aleatorios>
```

Gere o secret com: `openssl rand -hex 16`

## 3. Configurar webhook no Telegram

Aponte o webhook do bot pro endpoint público da API:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://flowdesk.empresa.com/api/v1/telegram/webhook/<SECRET>"
```

## 4. Testar localmente com ngrok

```bash
ngrok http 4000
# pegue a URL https://xxxx.ngrok.io e use no setWebhook
```

## 5. Fluxo de conexão (user)

1. Usuário entra em `/configuracoes` → painel "Telegram"
2. Clica "Conectar"
3. UI mostra: "envie `/start ABC12345` para @FlowDeskJustBot"
4. Quando user envia, bot responde "✅ FlowDesk conectado"
5. A partir daí, notificações vão pro Telegram dele

## Desligar

Defina `TELEGRAM_ENABLED=false` ou remova as vars. Todos os endpoints retornam 503.
