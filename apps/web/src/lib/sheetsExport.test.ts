/**
 * Conversao demanda → linha da planilha Suporte → Engenharia.
 *
 * Identificadores sinteticos (protocolo, cliente, pessoas). Datas montadas a
 * partir da meia-noite LOCAL — o CI roda em UTC e horario comercial e regra de
 * fuso local; teste com instante cravado mediria o fuso, nao a regra.
 */
import { describe, expect, it } from "vitest";
import type { SlackDemand } from "@/types/demand";
import { addBusinessHours } from "@/lib/businessHours";
import { buildSheetRows, isNovoChamado, toSheetRow } from "./sheetsExport";
import { composeTicketDescription } from "../../scripts/lib/ticketParser.cjs";

/** Sexta-feira, 25/09/2026, 17:00 no fuso local. */
const SEXTA_17H = new Date(2026, 8, 25, 17, 0);

function chamado(over: Partial<SlackDemand> = {}): SlackDemand {
  return {
    id: "slack_C1_1790000000.000100",
    title: "Cadastro — Mudar situação de crédito",
    description: composeTicketDescription({
      tentouFazer: "Mudar a situação de um crédito de ativo para bloqueado.",
      resultadoEsperado: "Opção disponível sem cancelar a NF.",
      resultadoObtido: "Opção indisponível.",
      cliente: "ORGANIZACAO EXEMPLO",
    }),
    priority: "p2",
    status: "aberta",
    demandType: "Problema/Bug",
    workflow: "Chamados",
    product: "Cadastro",
    requester: { name: "Fulana Exemplo", avatar: "" },
    assignee: null,
    cc: [],
    createdAt: SEXTA_17H.toISOString(),
    dueDate: null,
    completedAt: null,
    hasTask: false,
    taskLink: "",
    tags: [],
    slackChannel: "#cliente-exemplo",
    slackPermalink: "https://workspace.slack.com/archives/C1/p1790000000000100",
    threadReplies: [],
    formFields: {
      "Cliente/Organização": "ORGANIZACAO EXEMPLO",
      "Impacto": "Sem bloqueio",
      "Existe contorno?": "Sim",
      "Ambiente": "Produção",
      "ID da organização": "1010",
      "CNPJ": "00000000000000",
      "Origem": "ABERTURA — BKO",
      "Protocolo": "ABCDE-12345",
    },
    ...over,
  } as SlackDemand;
}

describe("isNovoChamado", () => {
  it("reconhece o chamado pelos campos do formulario", () => {
    expect(isNovoChamado(chamado())).toBe(true);
  });

  it("ignora demandas dos formularios antigos", () => {
    expect(isNovoChamado(chamado({ formFields: undefined }))).toBe(false);
    expect(isNovoChamado(chamado({ formFields: {} }))).toBe(false);
  });
});

describe("toSheetRow", () => {
  it("usa o protocolo como ID e cai no id do FlowDesk sem ele", () => {
    expect(toSheetRow(chamado()).id).toBe("ABCDE-12345");
    const semProtocolo = chamado({ formFields: { "Cliente/Organização": "X" } });
    expect(toSheetRow(semProtocolo).id).toBe("slack_C1_1790000000.000100");
  });

  it("mapeia criticidade e horas de SLA pela prioridade", () => {
    expect(toSheetRow(chamado({ priority: "p1" }))).toMatchObject({ criticidade: "Crítica", slaHoras: 4 });
    expect(toSheetRow(chamado({ priority: "p2" }))).toMatchObject({ criticidade: "Alta", slaHoras: 8 });
    expect(toSheetRow(chamado({ priority: "p3" }))).toMatchObject({ criticidade: "Média", slaHoras: 24 });
    expect(toSheetRow(chamado({ priority: "sem_classificacao" }))).toMatchObject({
      criticidade: "",
      slaHoras: null,
      prazoSla: null,
    });
  });

  it("calcula o prazo em horas uteis, como o dashboard", () => {
    const row = toSheetRow(chamado({ priority: "p2" }));
    // Sexta 17h + 8h uteis: 1h na sexta + 7h na segunda → segunda 15h.
    expect(row.prazoSla).toBe(new Date(2026, 8, 28, 15, 0).toISOString());
    expect(row.prazoSla).toBe(addBusinessHours(SEXTA_17H, 8).toISOString());
  });

  it("separa o que o suporte tentou fazer do problema relatado", () => {
    const row = toSheetRow(chamado());
    expect(row.testes).toBe("Mudar a situação de um crédito de ativo para bloqueado.");
    expect(row.problema).toContain("Cadastro — Mudar situação de crédito");
    expect(row.problema).toContain("Resultado obtido: Opção indisponível.");
    expect(row.problema).toContain("Resultado esperado: Opção disponível sem cancelar a NF.");
    expect(row.problema).toContain("Impacto: Sem bloqueio · Existe contorno?: Sim · Ambiente: Produção");
    expect(row.problema).toContain("ID da organização: 1010");
  });

  it("nao leva o CNPJ pra planilha", () => {
    expect(JSON.stringify(toSheetRow(chamado()))).not.toContain("00000000000000");
  });

  it("preenche cliente, solicitante, canal, tipo e links", () => {
    const row = toSheetRow(chamado({ taskLink: "https://app.clickup.com/t/abc" }));
    expect(row).toMatchObject({
      cliente: "ORGANIZACAO EXEMPLO",
      solicitante: "Fulana Exemplo",
      canal: "Slack",
      tipo: "Bug",
    });
    expect(row.evidencias).toBe(
      "Slack: https://workspace.slack.com/archives/C1/p1790000000000100\nClickUp: https://app.clickup.com/t/abc",
    );
  });

  it("mapeia 'Ajuda' pra duvida tecnica e o resto pra Outro", () => {
    expect(toSheetRow(chamado({ demandType: "Tarefa/Ajuda" })).tipo).toBe("Dúvida técnica");
    expect(toSheetRow(chamado({ demandType: "Outro" })).tipo).toBe("Outro");
  });

  it("so informa conclusao quando a demanda fechou", () => {
    const aberta = toSheetRow(chamado({ completedAt: new Date(2026, 8, 28, 10, 0).toISOString() }));
    expect(aberta).toMatchObject({ concluida: false, conclusao: null });

    const fim = new Date(2026, 8, 28, 10, 0).toISOString();
    expect(toSheetRow(chamado({ status: "concluida", completedAt: fim }))).toMatchObject({
      concluida: true,
      conclusao: fim,
    });
  });

  it("ultima atualizacao e a atividade mais recente da thread", () => {
    const resposta = new Date(2026, 8, 28, 9, 30).toISOString();
    const row = toSheetRow(chamado({
      threadReplies: [
        { author: "Membro do time", text: "olhando", timestamp: new Date(2026, 8, 25, 17, 30).toISOString(), isTeamMember: true },
        { author: "Solicitante", text: "ok", timestamp: resposta, isTeamMember: false },
      ] as SlackDemand["threadReplies"],
    }));
    expect(row.ultimaAtualizacao).toBe(resposta);
  });
});

describe("buildSheetRows", () => {
  it("filtra os chamados e ordena por abertura", () => {
    const antigo = chamado({ id: "a", createdAt: new Date(2026, 8, 1, 9).toISOString(), formFields: { Protocolo: "P-0001" } });
    const novo = chamado({ id: "b", createdAt: new Date(2026, 8, 20, 9).toISOString(), formFields: { Protocolo: "P-0002" } });
    const legado = chamado({ id: "c", formFields: undefined });

    const { rows } = buildSheetRows([novo, legado, antigo]);
    expect(rows.map((r) => r.id)).toEqual(["P-0001", "P-0002"]);
  });

  it("descarta protocolo repetido, mantendo o chamado mais antigo", () => {
    const primeiro = chamado({ id: "a", createdAt: new Date(2026, 8, 1, 9).toISOString() });
    const repetido = chamado({ id: "b", createdAt: new Date(2026, 8, 2, 9).toISOString() });

    const { rows, duplicates } = buildSheetRows([repetido, primeiro]);
    expect(rows).toHaveLength(1);
    expect(rows[0].flowdeskId).toBe("a");
    expect(duplicates).toEqual(["ABCDE-12345 (b)"]);
  });
});
