# Runbook — operação do FlowDesk em produção

Procedimentos do dia-a-dia. Para deploy inicial, veja [DEPLOY.md](./DEPLOY.md).

## Estrutura do servidor

```
/opt/flowdesk/app          # Código (clone do repo + build)
/opt/flowdesk/app/data     # Dados (JSON files — NÃO COMITAR)
/opt/flowdesk/app/.env     # Variáveis de ambiente (permissão 600)
/var/log/flowdesk          # Logs (app.log, app.error.log)
/var/backups/flowdesk      # Backups automáticos
```

## Comandos rápidos

| Operação | Comando |
|---|---|
| Status do serviço | `sudo systemctl status flowdesk` |
| Reiniciar | `sudo systemctl restart flowdesk` |
| Parar | `sudo systemctl stop flowdesk` |
| Iniciar | `sudo systemctl start flowdesk` |
| Ver logs ao vivo | `sudo tail -f /var/log/flowdesk/app.log` |
| Erros recentes | `sudo tail -100 /var/log/flowdesk/app.error.log` |
| Logs estruturados (filtrar) | `cat /var/log/flowdesk/app.log \| jq 'select(.level=="error")'` |
| Health check | `curl -s https://flowdesk.just.com.br/health \| jq` |

## Atualizando o sistema (deploy de nova versão)

```bash
sudo -iu flowdesk
cd /opt/flowdesk/app
git pull
npm ci
npm run build
exit
sudo systemctl restart flowdesk
sudo systemctl status flowdesk           # confirmar que subiu
curl https://flowdesk.just.com.br/health # confirmar resposta 200
```

## Backup manual

```bash
sudo -iu flowdesk
BACKUP="/var/backups/flowdesk/manual-$(date +%Y%m%d-%H%M%S).tar.gz"
tar czf "$BACKUP" -C /opt/flowdesk/app data/
echo "Backup salvo em $BACKUP"
ls -lh "$BACKUP"
```

## Backup automático (cron)

Adicione ao crontab do usuário `flowdesk`:

```bash
sudo -iu flowdesk
crontab -e
```

Inclua:

```cron
# Backup diário às 2h, retenção 30 dias
0 2 * * * tar czf /var/backups/flowdesk/auto-$(date +\%Y\%m\%d).tar.gz -C /opt/flowdesk/app data/ 2>/dev/null
0 3 * * * find /var/backups/flowdesk -name "auto-*.tar.gz" -mtime +30 -delete
```

## Restaurar de backup

```bash
sudo systemctl stop flowdesk
sudo -iu flowdesk

cd /opt/flowdesk/app
mv data data.broken.$(date +%s)              # preserva o que estava lá
tar xzf /var/backups/flowdesk/auto-YYYYMMDD.tar.gz
ls data/                                      # confirme arquivos restaurados

exit
sudo systemctl start flowdesk
```

## Adicionar/remover usuário

Hoje é feito pela UI:

1. Login como `master`
2. **Usuários** no menu lateral
3. **Novo usuário** → preenche nome, email, role, grupos
4. Sistema gera senha temporária — envie pro usuário
5. Ele troca senha no primeiro login

Para **bloquear** um usuário (LGPD, saída da empresa, etc):

1. Edite o usuário na UI
2. Mude status para `blocked`
3. Sessões ativas dele continuam até expirar (8h) — para revogar imediatamente, peça pra ele dar logout ou aguarde

## Reset de senha de um usuário

Master pode forçar reset:

1. UI **Usuários** → editar usuário
2. **Resetar senha** → gera nova temporária
3. Comunica nova senha pelo canal apropriado (NÃO email não criptografado)
4. Usuário troca no próximo login

## Troubleshooting comum

### Serviço não sobe

```bash
sudo journalctl -u flowdesk -n 50 --no-pager
```

Causas comuns:
- `.env` ausente ou com syntax error → veja erro do dotenv no log
- Porta 4173 em uso → `sudo lsof -i :4173`
- Build não rodou → `cd /opt/flowdesk/app && npm run build`

### Health check retorna erro

```bash
curl -v https://flowdesk.just.com.br/health
```

- 502 Bad Gateway → flowdesk caiu, ver `systemctl status flowdesk`
- 404 → nginx não está roteando, ver `nginx -t` e logs
- Timeout → servidor sobrecarregado, ver `top`/`htop`

### Logs cheios de rate_limit_exceeded

Alguém (ou um script) está martelando os endpoints. Verifique:

```bash
sudo tail -200 /var/log/flowdesk/app.log \
  | jq -r 'select(.msg=="rate_limit_exceeded") | .ip' \
  | sort | uniq -c | sort -rn
```

IPs com muitas tentativas podem ser bloqueados no firewall do servidor.

### "Sem interação" não aparece em demanda esperada

Veja [LGPD.md](./LGPD.md) — a lógica considera só interações da equipe (`isTeamMember=true`). Se o cliente cobrou mas ninguém respondeu, é normal o badge aparecer.

### Notificações duplicadas no navegador

Limpe o cache de IDs no localStorage:

```js
// Console do navegador
localStorage.removeItem('fd_last_push_ids');
localStorage.removeItem('fd_sla_reminders_sent');
```

## Monitoramento recomendado

Integre com a infra de monitoring da Just:

- **Uptime**: monitorar `GET /health` a cada 1min, alerta se >2 falhas seguidas
- **Latência**: alertar se p95 > 1s
- **Espaço em disco**: `data/` cresce ~1MB/mês com 20 usuários, mas vigia
- **Logs de erro**: alertar quando aparecer `"level":"error"` no `app.log`

## Contato e escalada

- Dúvidas operacionais → Operador Cordeiro
- Erros críticos em produção → criar issue no GitHub + acionar Operador
- Suspeita de segurança → veja [LGPD.md](./LGPD.md) seção "Incidentes"
