/**
 * Cobre o parse das mensagens de abertura de demanda vindas do Slack.
 *
 * Os textos abaixo sao copias do `msg.text` REAL da API (com dados de cliente
 * trocados) — nao da renderizacao de nenhum leitor de Slack. A diferenca
 * importa: a API entrega tudo numa linha so, sem negrito e sem quebra, e uma
 * primeira versao deste parser foi escrita contra a versao renderizada e nao
 * casou com nada em producao.
 */
import { describe, expect, it } from "vitest";
import {
  composeTicketTitle,
  flattenBlockText,
  isNewTicketForm,
  parseTicketForm,
  parseWorkflowMessage,
  pickField,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
} from "../../scripts/lib/ticketParser.cjs";

// msg.text real de um chamado (uma unica linha).
const CHAMADO =
  "ABERTURA — BKO  Cliente/Organização: ORGANIZACAO EXEMPLO ID do usuário: 00 CNPJ: 0 " +
  "Produto/Módulo: Situação cadastro usuário Tipo de operação: OUTROS Natureza: Problema " +
  "Impacto: Sem bloqueio Existe contorno?: Sim Ambiente: Produção " +
  "O que tentou fazer: Tentativa de mudar a situação de um crédito de ativo para bloqueado. " +
  "Resultado esperado: Gostaria de solicitar que a opção volte a ficar disponível. " +
  "Atualmente precisamos cancelar a nota fiscal, o que torna o processo trabalhoso. " +
  "Resultado obtido: Situação disponível para alteração sem cancelar a NF.  " +
  "_Aberto via formulário por Fulana Exemplo · protocolo ABCDE-12345_";

// Variante com os campos extras que so aparecem em alguns chamados.
const CHAMADO_CAMPOS_EXTRA =
  "ABERTURA — APP  Cliente/Organização: OUTRA ORG ID do usuário: 93823 CNPJ: 35710362000150 " +
  "Produto/Módulo: Despesa Corporativo Tipo de operação: OUTROS ID da organização: 2400 " +
  "Navegador/versão: BKO Usuário/perfil afetado: 93823-FULANO / 0 / 000 Natureza: Problema " +
  "Impacto: Sem bloqueio Ambiente: Produção O que tentou fazer: Estorno não comunicado. " +
  "Resultado esperado: Precisamos realizar um estorno parcial. " +
  "Resultado obtido: A transação ocorreu em 06/07.  " +
  "_Aberto via formulário por Fulana Exemplo · protocolo VWXYZ-67890_";

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
  it("reconhece pelo rodape do formulario", () => {
    expect(isNewTicketForm(CHAMADO)).toBe(true);
    expect(isNewTicketForm(CHAMADO_CAMPOS_EXTRA)).toBe(true);
  });

  it("nao confunde com os formularios antigos", () => {
    expect(isNewTicketForm(FORMATO_ANTIGO)).toBe(false);
  });
});

describe("parseTicketForm", () => {
  const parsed = parseTicketForm(CHAMADO);

  it("separa os campos mesmo estando tudo numa linha", () => {
    expect(parsed.fields["Produto/Módulo"]).toBe("Situação cadastro usuário");
    expect(parsed.fields["Cliente/Organização"]).toBe("ORGANIZACAO EXEMPLO");
    expect(parsed.fields["CNPJ"]).toBe("0");
    expect(parsed.fields["Natureza"]).toBe("Problema");
    expect(parsed.fields["Impacto"]).toBe("Sem bloqueio");
    expect(parsed.fields["Ambiente"]).toBe("Produção");
    expect(parsed.fields["Existe contorno?"]).toBe("Sim");
  });

  it("nao deixa um campo engolir o proximo", () => {
    // Este era o bug: "O que tentou fazer" levava junto todos os campos
    // seguintes porque o corte nao acontecia nos rotulos.
    expect(parsed.fields["O que tentou fazer"]).toBe(
      "Tentativa de mudar a situação de um crédito de ativo para bloqueado.",
    );
    for (const value of Object.values(parsed.fields) as string[]) {
      expect(value).not.toMatch(/Resultado esperado:/);
      expect(value).not.toMatch(/Aberto via formul/i);
      expect(value).not.toMatch(/protocolo/i);
    }
  });

  it("mantem valores longos inteiros", () => {
    expect(parsed.fields["Resultado esperado"]).toContain("cancelar a nota fiscal");
    expect(parsed.fields["Resultado esperado"]).toContain("volte a ficar disponível");
  });

  it("extrai cabecalho, solicitante e protocolo", () => {
    expect(parsed.header).toBe("ABERTURA — BKO");
    expect(parsed.requester).toBe("Fulana Exemplo");
    expect(parsed.protocol).toBe("ABCDE-12345");
  });

  it("le os campos extras quando presentes", () => {
    const p = parseTicketForm(CHAMADO_CAMPOS_EXTRA);
    expect(p.fields["ID da organização"]).toBe("2400");
    expect(p.fields["Navegador/versão"]).toBe("BKO");
    expect(p.fields["Usuário/perfil afetado"]).toBe("93823-FULANO / 0 / 000");
    expect(p.fields["Produto/Módulo"]).toBe("Despesa Corporativo");
  });

  it("nao quebra com texto vazio", () => {
    const p = parseTicketForm("");
    expect(p.fields).toEqual({});
    expect(p.requester).toBeNull();
  });
});

describe("flattenBlockText", () => {
  it("recolhe o texto de blocos aninhados", () => {
    const blocks = [
      { type: "section", text: { type: "mrkdwn", text: "*Prioridade: P3-Média*" } },
      { type: "context", elements: [{ type: "mrkdwn", text: "c/c @Beltrano" }] },
    ];
    const out = flattenBlockText(blocks);
    expect(out).toContain("Prioridade: P3-Média");
    expect(out).toContain("c/c @Beltrano");
  });

  it("devolve string vazia quando nao ha blocos", () => {
    expect(flattenBlockText(undefined)).toBe("");
  });
});

describe("parseWorkflowMessage — formularios antigos", () => {
  it("mantem o comportamento de uma linha por campo", () => {
    const fields = parseWorkflowMessage(FORMATO_ANTIGO);
    expect(fields["Título da demanda"]).toBe("Ajuste no relatório de fechamento");
    expect(fields["Descrição da demanda"]).toBe("O relatório está trazendo valores duplicados.");
    expect(fields["Prioridade"]).toBe("P2");
    expect(fields["Tipo de demanda"]).toBe("Problema");
    expect(pickField(fields, "Produto")).toBe("Financeiro");
  });
});

describe("composeTicketTitle", () => {
  it("junta modulo e acao", () => {
    const p = parseTicketForm(CHAMADO);
    expect(composeTicketTitle(p.fields["Produto/Módulo"], p.fields["O que tentou fazer"])).toBe(
      "Situação cadastro usuário — Tentativa de mudar a situação de um crédito de ativo para blo…",
    );
  });

  it("nao repete quando modulo e acao dizem a mesma coisa", () => {
    // "RELATORIO" vs "Relatório" — mesma palavra, muda acento e caixa.
    expect(composeTicketTitle("RELATORIO", "Relatório")).toBe("RELATORIO");
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
