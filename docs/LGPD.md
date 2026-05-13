# LGPD — Tratamento de dados pessoais no FlowDesk

Documento de compliance com a Lei Geral de Proteção de Dados (LGPD).
Mantenha atualizado conforme o sistema evolui.

## 1. Controlador

**Just** é controladora dos dados pessoais tratados pelo FlowDesk.

## 2. Finalidade do tratamento

O FlowDesk centraliza demandas operacionais recebidas via Slack para
permitir:

- Atribuição de responsável e acompanhamento de SLA
- Métricas e BI sobre desempenho da equipe
- Histórico auditável de atendimentos
- Comunicação interna entre membros da equipe

## 3. Base legal

- **Execução de contrato** (art. 7º, V): dados de clientes contratantes
  cujas demandas chegam via Slack
- **Legítimo interesse** (art. 7º, IX): dados de funcionários internos
  para gestão de fluxo de trabalho

## 4. Inventário de dados pessoais

### 4.1. Usuários internos (funcionários Just)

| Campo | Tipo | Origem | Persistência |
|---|---|---|---|
| Nome | Identificação | Cadastro manual pelo master | `localStorage` |
| E-mail | Contato | Cadastro manual | `localStorage` |
| Login | Identificação | Gerado automaticamente | `localStorage` |
| Hash da senha | Credencial | Gerado pelo sistema (PBKDF2) | `localStorage` |
| Role (master/usuário) | Autorização | Cadastro manual | `localStorage` |
| Grupos | Autorização | Cadastro manual | `localStorage` |
| Avatar (URL) | Identificação | Sync com Slack | `localStorage` |

### 4.2. Solicitantes (clientes/contatos externos)

| Campo | Tipo | Origem | Persistência |
|---|---|---|---|
| Nome | Identificação | Mensagens do Slack | `data/realDemands.ts` (gitignored) |
| Avatar (URL) | Identificação | API Slack | idem |
| Mensagens da thread | Conteúdo | API Slack | idem + `data/historicalDemands.json` |
| Anexos (base64 inline) | Conteúdo | API Slack | `data/infraDemands.json` |

### 4.3. Dados derivados (gerados pelo sistema)

| Campo | Conteúdo | Sensibilidade |
|---|---|---|
| Classificação P1/P2/P3 | Inferida do texto | Baixa |
| SLA calculado | Horário comercial | Baixa |
| Audit log (quem mudou o quê) | userId + timestamp | Média |
| Notificações | userEmail + texto da ação | Média |

### 4.4. O que NÃO armazenamos

- ❌ Senhas em texto plano (sempre PBKDF2 com salt + 150k iterações)
- ❌ Dados de pagamento, cartões, contas bancárias
- ❌ CPF, RG, passaporte ou outros documentos oficiais
- ❌ Dados de saúde
- ❌ Localização geográfica

## 5. Retenção

- **Demandas concluídas**: mantidas indefinidamente para histórico/BI
- **Notificações**: cap de 500 mais recentes (FIFO automático)
- **Logs de aplicação**: rotação por logrotate, 30 dias
- **Backups**: 30 dias rotativos
- **Audit log**: vinculado à demanda; segue a demanda

Cliente pode solicitar exclusão completa (ver seção 7).

## 6. Compartilhamento

Os dados **não são compartilhados** com terceiros, exceto:

- **Slack** (origem dos dados; já é parte da operação)
- **Resend** (caso `RESEND_API_KEY` esteja configurado, e somente o
  conteúdo da notificação por e-mail para o destinatário interno)

Sem analytics de terceiros, sem rastreadores, sem ads.

## 7. Direitos do titular

### 7.1. Acesso aos dados

Funcionário interno: vê os próprios dados em **/perfil**.

Cliente externo: solicita à Just por canal oficial. Para extrair todas
as demandas vinculadas a um nome:

```bash
sudo -iu flowdesk
cd /opt/flowdesk/app
# Substitua "NOME" pelo nome exato do solicitante
node -e "
  const d = require('./data/infraDemands.json');
  console.log(JSON.stringify(d.filter(x =>
    x.requester?.name?.toLowerCase().includes('NOME'.toLowerCase())
  ), null, 2));
"
```

### 7.2. Correção de dados

Edição direta na UI (master) ou edição no JSON (operador) — sempre
deixar audit log.

### 7.3. Exclusão (right to be forgotten)

Cliente solicita formalmente. Operador executa:

```bash
sudo systemctl stop flowdesk
sudo -iu flowdesk
cd /opt/flowdesk/app

# 1. Faça backup antes de qualquer exclusão
tar czf /var/backups/flowdesk/pre-erase-$(date +%Y%m%d).tar.gz data/

# 2. Remova demandas do solicitante (exemplo com Node)
node scripts/erase-user-data.cjs --name "Nome Completo"
# OU edite manualmente data/infraDemands.json
# OU edite src/data/realDemands.ts e rode npm run build

exit
sudo systemctl start flowdesk
```

> **TODO**: criar `scripts/erase-user-data.cjs` quando a primeira
> solicitação chegar. Por enquanto, edição manual.

### 7.4. Portabilidade

Exportação JSON disponível via UI (relatórios BI exportam XLSX/JSON).

## 8. Segurança

| Controle | Implementação |
|---|---|
| Senhas | PBKDF2 SHA-256 com 150k iterações + salt aleatório |
| Sessão | Token em `localStorage`, expira em 8h |
| HTTPS obrigatório | nginx + cert TLS válido |
| HSTS | `max-age=31536000` |
| CSP, X-Frame-Options, X-Content-Type-Options | nginx |
| Rate limit | 10 req/min em `/auth/*` por IP |
| Lockout | 15min após 5 tentativas falhas |
| Backup | Diário, retenção 30 dias |
| Audit log | Middleware automático em todas mutations (POST/PUT/PATCH/DELETE) registra em `tb_auditoria`: usuário, recurso, ação, IP, user-agent, request_id, timestamp. Eventos críticos (login, logout, change_password) registrados explicitamente pelo controller. Payload sanitizado (senha/token sempre [REDACTED]) |
| Logs estruturados | JSON Lines com rotação |
| Acesso ao servidor | SSH com chave, usuário sem sudo |

## 9. Incidentes de segurança

Caso suspeite de incidente (acesso indevido, vazamento, ataque):

1. **Imediatamente**:
   - `sudo systemctl stop flowdesk` para conter
   - Snapshot dos logs: `cp -r /var/log/flowdesk /var/backups/flowdesk/incident-$(date +%s)`
   - Snapshot dos dados: `tar czf /var/backups/flowdesk/incident-data-$(date +%s).tar.gz data/`

2. **Em até 1h**:
   - Comunicar Hugo Cordeiro + supervisor
   - Identificar escopo (quais usuários/dados afetados)

3. **Em até 72h** (prazo legal ANPD):
   - Notificar ANPD se confirmado vazamento de dados pessoais
   - Notificar titulares afetados

4. **Pós-incidente**:
   - Pós-mortem documentado
   - Implementar mitigação (mudança de senhas, patch, etc.)
   - Atualizar este documento

## 10. Revisão periódica

Este documento deve ser revisado:

- A cada nova feature que toque dados pessoais
- A cada 6 meses, mesmo sem mudanças
- Após qualquer incidente

**Última revisão**: 2026-05-12 — versão inicial pré-produção.
