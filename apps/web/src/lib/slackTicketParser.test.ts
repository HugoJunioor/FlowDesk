/**
 * Cobre o parse das mensagens de abertura de demanda vindas do Slack.
 *
 * Os textos abaixo sao copias reais (com dados de cliente trocados) das duas
 * geracoes de formulario que convivem no canal. O formulario "Novo chamado"
 * chegou em 2026-08 e ficou semanas sem ser importado porque o filtro de
 * deteccao so conhecia os marcadores antigos — daí a cobertura aqui.
 */
import { describe, expect, it } from "vitest";
import {
  composeTicketTitle,
  isNewTicketForm,
  parseTicketMetaLine,
  parseWorkflowMessage,
  pickField,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
} from "../../scripts/lib/ticketParser.cjs";

// Formulario novo, versao completa: prioridade + tipo + bloqueio + ambiente.
const NOVO_CHAMADO_COMPLETO = `:ticket: Novo chamado · CLIENTE-A
:large_blue_circle: *Prioridade: P3-Média*  ·  *Problema*  ·  *Sem bloqueio*  ·  *Produção*  ·  *Sim*
*O que tentou fazer*
Tentativa de mudar a situação de um crédito de ativo para bloqueado.
*Resultado esperado*
Gostaria de solicitar que a opção volte a ficar disponível.
Atualmente precisamos cancelar a nota fiscal, o que torna o processo trabalhoso.
Seria possível reativar essa opção?
*Resultado obtido*
Situação disponível para alteração sem cancelar a NF.
*Cliente/Organização*
ORGANIZACAO EXEMPLO
*ID do usuário*
00
*CNPJ*
0
*Produto/Módulo*
Situação cadastro usuário
*Tipo de operação*
OUTROS
Aberto via formulário por *Fulana Exemplo*  ·  protocolo \`ABCDE-12345\`
c/c @Beltrano`;

// Formulario novo, versao antiga: SEM prioridade e com campos extras.
const NOVO_CHAMADO_SEM_PRIORIDADE = `:ticket: Novo chamado · CLIENTE-A
*Problema*  ·  *Sem bloqueio*  ·  *Produção*
*O que tentou fazer*
Estorno ocorreu no parceiro porém não comunicou com o sistema.
*Resultado esperado*
Precisamos realizar um estorno parcial de uma transação.
Poderiam realizar esse estorno?
*Resultado obtido*
A transação ocorreu em 06/07 e estornou em 10/07.
*Cliente/Organização*
ORGANIZACAO EXEMPLO
*Produto/Módulo*
Despesa Corporativo
*Tipo de operação*
OUTROS
*ID da organização*
2400
*Navegador/versão*
BKO
:paperclip: 1 anexo — nas respostas desta thread
Aberto via formulário por *Fulana Exemplo* · <mailto:fulana@example.com|fulana@example.com>  ·  protocolo \`VWXYZ-67890\``;

// Formulario antigo — comportamento tem que continuar identico.
const FORMATO_ANTIGO = `Nova demanda enviada por @Fulana Exemplo
*Título da demanda*
Ajuste no relatório de fechamento
*Descrição da demanda*
O relatório está trazendo valores duplicados.
*Prioridade*
P2
*Tipo de demanda*
Problema
*Produto*
Financeiro`;

describe("isNewTicketForm", () => {
  it("reconhece o formulario Novo chamado", () => {
    expect(isNewTicketForm(NOVO_CHAMADO_COMPLETO)).toBe(true);
    expect(isNewTicketForm(NOVO_CHAMADO_SEM_PRIORIDADE)).toBe(true);
  });

  it("nao confunde com os formularios antigos", () => {
    expect(isNewTicketForm(FORMATO_ANTIGO)).toBe(false);
  });
});

describe("parseTicketMetaLine", () => {
  it("classifica os tokens por semantica, nao por posicao", () => {
    const meta = parseTicketMetaLine(NOVO_CHAMADO_COMPLETO);
    expect(meta.priority).toBe("P3-Média");
    expect(meta.kind).toBe("Problema");
    expect(meta.blocking).toBe("Sem bloqueio");
    expect(meta.environment).toBe("Produção");
  });

  it("lida com a versao sem prioridade (3 tokens)", () => {
    const meta = parseTicketMetaLine(NOVO_CHAMADO_SEM_PRIORIDADE);
    expect(meta.priority).toBeNull();
    expect(meta.kind).toBe("Problema");
    expect(meta.environment).toBe("Produção");
  });

  it("devolve tudo nulo quando nao ha linha de meta", () => {
    const meta = parseTicketMetaLine(FORMATO_ANTIGO);
    expect(meta.priority).toBeNull();
    expect(meta.kind).toBeNull();
  });
});

describe("parseWorkflowMessage — formulario novo", () => {
  const fields = parseWorkflowMessage(NOVO_CHAMADO_COMPLETO);

  it("preserva blocos narrativos de varias linhas", () => {
    const esperado = fields["Resultado esperado"];
    expect(esperado.split("\n")).toHaveLength(3);
    expect(esperado).toContain("cancelar a nota fiscal");
  });

  it("nao deixa o rodape virar valor do ultimo campo", () => {
    for (const value of Object.values(fields) as string[]) {
      expect(value).not.toMatch(/Aberto via formul/i);
      expect(value).not.toMatch(/protocolo/i);
    }
  });

  it("le os campos simples", () => {
    expect(pickField(fields, "Produto/Módulo")).toBe("Situação cadastro usuário");
    expect(pickField(fields, "Cliente/Organização")).toBe("ORGANIZACAO EXEMPLO");
    expect(pickField(fields, "CNPJ")).toBe("0");
  });

  it("captura os campos extras da versao com mais perguntas", () => {
    const f = parseWorkflowMessage(NOVO_CHAMADO_SEM_PRIORIDADE);
    expect(pickField(f, "ID da organização")).toBe("2400");
    expect(pickField(f, "Navegador/versão")).toBe("BKO");
  });
});

describe("parseWorkflowMessage — formularios antigos", () => {
  it("mantem o comportamento de uma linha por campo", () => {
    const fields = parseWorkflowMessage(FORMATO_ANTIGO);
    expect(fields["Título da demanda"]).toBe("Ajuste no relatório de fechamento");
    expect(fields["Descrição da demanda"]).toBe("O relatório está trazendo valores duplicados.");
    expect(fields["Prioridade"]).toBe("P2");
    expect(fields["Tipo de demanda"]).toBe("Problema");
    expect(fields["Produto"]).toBe("Financeiro");
  });
});

describe("composeTicketTitle", () => {
  it("junta modulo e acao", () => {
    expect(composeTicketTitle("Despesa Corporativo", "Estorno não comunicado")).toBe(
      "Despesa Corporativo — Estorno não comunicado",
    );
  });

  it("nao repete quando modulo e acao dizem a mesma coisa", () => {
    // "RELATORIO" vs "Relatório" — mesma palavra, muda acento e caixa.
    expect(composeTicketTitle("RELATORIO", "Relatório")).toBe("RELATORIO");
  });

  it("usa so a primeira linha da acao", () => {
    expect(composeTicketTitle("Modulo", "Primeira linha\nSegunda linha")).toBe(
      "Modulo — Primeira linha",
    );
  });

  it("trunca titulos longos", () => {
    const title = composeTicketTitle("Modulo", "x".repeat(200));
    expect(title.length).toBeLessThanOrEqual(90);
    expect(title.endsWith("…")).toBe(true);
  });

  it("devolve null quando nao ha nada pra compor", () => {
    expect(composeTicketTitle("", "")).toBeNull();
  });
});
