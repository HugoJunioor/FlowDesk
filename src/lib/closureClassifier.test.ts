import { describe, it, expect } from "vitest";
import { classifyCategory } from "./closureClassifier";
import type { SlackDemand } from "@/types/demand";

const makeDemand = (overrides: Partial<SlackDemand>): SlackDemand =>
  ({
    id: "test",
    title: "",
    description: "",
    priority: "p3",
    status: "aberta",
    demandType: "Outro",
    workflow: "",
    product: "",
    requester: { name: "x", avatar: "" },
    assignee: null,
    cc: [],
    createdAt: "2026-04-15T10:00:00Z",
    dueDate: null,
    completedAt: null,
    hasTask: false,
    taskLink: "",
    tags: [],
    slackChannel: "#test",
    slackPermalink: "",
    replies: 0,
    threadReplies: [],
    ...overrides,
  } as SlackDemand);

describe("classifyCategory", () => {
  it("classifica Cartao por keyword no titulo", () => {
    const r = classifyCategory(
      makeDemand({ title: "Cartao bloqueado", description: "cliente nao consegue usar" })
    );
    expect(r.value).toBe("Cartao");
    expect(r.confidence).toMatch(/alta|media|baixa/);
  });

  it("classifica Transacao por keyword (pix, compra negada)", () => {
    const r = classifyCategory(
      makeDemand({ title: "Compra negada", description: "pix nao caiu, autorizacao falhou" })
    );
    expect(r.value).toBe("Transacao");
  });

  it("classifica Cadastro pra alteracao de CPF", () => {
    const r = classifyCategory(
      makeDemand({ title: "Alteracao de dados", description: "atualizar CPF do cadastro" })
    );
    expect(r.value).toBe("Cadastro");
  });

  it("classifica Boleto", () => {
    const r = classifyCategory(
      makeDemand({ title: "Boleto bancario com erro", description: "codigo de barras invalido" })
    );
    expect(r.value).toBe("Boleto");
  });

  it("classifica Relatorio", () => {
    const r = classifyCategory(
      makeDemand({ title: "Exportar relatorio mensal", description: "dashboard BI desatualizado" })
    );
    expect(r.value).toBe("Relatorio");
  });

  it("normaliza acentos antes de matching", () => {
    const r = classifyCategory(
      makeDemand({ title: "Cartão bloqueado", description: "" })
    );
    expect(r.value).toBe("Cartao");
  });

  it("retorna vazio quando texto nao bate em nada", () => {
    const r = classifyCategory(
      makeDemand({ title: "xyz abc", description: "lorem ipsum" })
    );
    expect(r.value).toBe("");
    expect(r.confidence).toBe("baixa");
  });

  it("alta confianca quando tem 3+ keywords matchando", () => {
    const r = classifyCategory(
      makeDemand({
        title: "Portal do cliente com erro de login portal",
        description: "Acesso portal bloqueado, portal web fora",
      })
    );
    expect(r.value).toBe("Portal do cliente");
    expect(r.confidence).toBe("alta");
  });

  it("escolhe categoria com mais matches quando ha multipla", () => {
    // "cartao" 1 match, "cadastro/cpf" 2 matches → ganha Cadastro
    const r = classifyCategory(
      makeDemand({
        title: "Cadastro novo",
        description: "incluir CPF e dados cadastrais — vincular cartao depois",
      })
    );
    expect(r.value).toBe("Cadastro");
  });
});
