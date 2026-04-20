# Ticket Interno — Migração de Dados e Exclusão de Cadastros Duplicados (GDO)

**Prioridade:** Alta
**Banco:** VSPAY (PostgreSQL)
**Contexto:** Durante os ajustes da empresa GDO (retorno de cadastros para a matriz + novos cadastros), foram gerados cadastros duplicados na empresa PARCEIROS VIASOFT. O cliente confirmou que os dados devem retornar aos cadastros originais na GDO.

---

## Cadastros a tratar

| Duplicado (excluir) | Correto (manter) | Funcionário |
|---|---|---|
| **120383** — PARCEIROS VIASOFT | **39403** — GDO PARTICIPAÇÕES S/A | Marcelo Rodrigues de Oliveira (CPF 31990136869) |
| **120379** — PARCEIROS VIASOFT | *(cliente fará novo vínculo)* | Juliana Cristina da Silva Freitas Dias (CPF 45454208850) |
| **120339** — PARCEIROS VIASOFT | **116995** — GDO PARTICIPAÇÕES S/A | Paola da Silva Soares (CPF 43418345840) |

---

## Passo a passo de execução

### 1. Cadastro 120383 → 39403 (Marcelo)

**1.1 — Levantar dados vinculados ao cadastro 120383:**

```sql
-- Transações
SELECT * FROM baas_transacao WHERE usu_id = 120383;
SELECT * FROM baas_transacao_resumo WHERE usu_id = 120383;

-- Créditos
SELECT * FROM crd_usuario_credito WHERE usu_id = 120383;

-- Outros vínculos (verificar conforme modelo de dados)
-- Ex.: baas_cartao, baas_conta, etc.
```

**1.2 — Migrar transações para o cadastro correto (39403):**

```sql
BEGIN;

UPDATE baas_transacao SET usu_id = 39403 WHERE usu_id = 120383;
UPDATE baas_transacao_resumo SET usu_id = 39403 WHERE usu_id = 120383;
UPDATE crd_usuario_credito SET usu_id = 39403 WHERE usu_id = 120383;

-- Validar contagem antes de commitar
-- COMMIT; ou ROLLBACK;
```

**1.3 — Após confirmação, desativar/excluir cadastro 120383.**

---

### 2. Cadastro 120379 (Juliana)

**2.1 — Cancelar pedido de cartão ativo:**

```sql
-- Identificar pedido de cartão
SELECT * FROM baas_cartao WHERE usu_id = 120379;
-- Ou tabela equivalente de solicitação de cartão
```

**2.2 — Cancelar o pedido (atualizar status conforme regra de negócio).**

**2.3 — Verificar e limpar demais vínculos:**

```sql
SELECT * FROM crd_usuario_credito WHERE usu_id = 120379;
-- Desativar/excluir créditos órfãos
```

**2.4 — Após confirmação, desativar/excluir cadastro 120379.**

> **Nota:** O cliente informou que a Juliana fará a vinculação e nova solicitação de cartão pelo cadastro correto por conta própria.

---

### 3. Cadastro 120339 → 116995 (Paola)

**3.1 — Levantar dados vinculados ao cadastro 120339:**

```sql
SELECT * FROM baas_transacao WHERE usu_id = 120339;
SELECT * FROM baas_transacao_resumo WHERE usu_id = 120339;
SELECT * FROM crd_usuario_credito WHERE usu_id = 120339;
```

**3.2 — Migrar transações para o cadastro correto (116995):**

```sql
BEGIN;

UPDATE baas_transacao SET usu_id = 116995 WHERE usu_id = 120339;
UPDATE baas_transacao_resumo SET usu_id = 116995 WHERE usu_id = 120339;
UPDATE crd_usuario_credito SET usu_id = 116995 WHERE usu_id = 120339;

-- Validar contagem antes de commitar
-- COMMIT; ou ROLLBACK;
```

**3.3 — Após confirmação, desativar/excluir cadastro 120339.**

---

## Checklist de validação (para cada cadastro)

- [ ] Contar registros ANTES da migração (duplicado + correto)
- [ ] Executar migração dentro de transação (BEGIN/ROLLBACK/COMMIT)
- [ ] Contar registros DEPOIS da migração (confirmar que totais batem)
- [ ] Verificar que o cadastro duplicado não possui mais vínculos
- [ ] Desativar/excluir o cadastro duplicado
- [ ] Validar que o cadastro correto está funcional com os dados migrados

---

## Observações

- **IMPORTANTE:** As credenciais de banco que o cliente enviou no chamado foram expostas em texto aberto. Solicitar a **rotação imediata** da senha do usuário `dev.h.ribeiro`.
- Executar tudo dentro de transações e fazer backup/snapshot antes de iniciar.
- Adaptar os nomes das tabelas conforme o modelo real do banco (os nomes acima são baseados no que foi identificado na análise anterior).
