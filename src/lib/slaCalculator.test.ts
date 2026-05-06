import { describe, it, expect } from "vitest";
import {
  parseResponseSla,
  isResolutionSlaExcluded,
  SLA_TARGET_PERCENT,
  SLA_RESOLUTION_EXCLUSION_REASONS,
} from "./slaCalculator";
import type { SlackDemand } from "@/types/demand";

describe("SLA constants", () => {
  it("SLA_TARGET_PERCENT eh 80", () => {
    expect(SLA_TARGET_PERCENT).toBe(80);
  });

  it("lista de motivos de exclusao tem entradas conhecidas", () => {
    expect(SLA_RESOLUTION_EXCLUSION_REASONS).toContain("Falta de retorno do cliente");
    expect(SLA_RESOLUTION_EXCLUSION_REASONS).toContain("Demora no retorno do cliente");
  });
});

describe("parseResponseSla", () => {
  it("converte minutos", () => {
    expect(parseResponseSla("15 min")).toBe(15);
    expect(parseResponseSla("30 min")).toBe(30);
  });

  it("converte horas pra minutos", () => {
    expect(parseResponseSla("1 hora")).toBe(60);
    expect(parseResponseSla("4 horas")).toBe(240);
  });

  it("retorna fallback de 60 pra formato desconhecido", () => {
    expect(parseResponseSla("texto qualquer")).toBe(60);
    expect(parseResponseSla("")).toBe(60);
  });

  // Documenta comportamento atual: regex casa case-insensitive, mas
  // .startsWith("hora") eh case-sensitive — entao maiusculo cai no fallback
  // e a unidade vira minutos. Bug conhecido (TODO: corrigir no slaCalculator).
  it("trata maiusculas como minutos (bug conhecido)", () => {
    expect(parseResponseSla("4 HORAS")).toBe(4); // deveria ser 240
  });
});

describe("isResolutionSlaExcluded", () => {
  // Helper pra construir demanda minima
  const makeDemand = (overrides: Partial<SlackDemand>): SlackDemand =>
    ({
      id: "test",
      title: "test",
      description: "",
      priority: "p3",
      status: "expirada",
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

  it("NAO exclui demandas anteriores a abril/2026 (preserva historico)", () => {
    const d = makeDemand({
      createdAt: "2026-03-15T10:00:00Z",
      closure: { expirationReason: "Falta de retorno do cliente" },
    } as Partial<SlackDemand>);
    expect(isResolutionSlaExcluded(d)).toBe(false);
  });

  it("NAO exclui quando nao ha motivo de expiracao", () => {
    const d = makeDemand({});
    expect(isResolutionSlaExcluded(d)).toBe(false);
  });

  it("NAO exclui quando motivo nao esta na lista de exclusao", () => {
    const d = makeDemand({
      closure: { expirationReason: "Erro tecnico interno" },
    } as Partial<SlackDemand>);
    expect(isResolutionSlaExcluded(d)).toBe(false);
  });

  it("NAO exclui quando demanda foi atendida no prazo (slaResolutionStatus)", () => {
    const d = makeDemand({
      closure: { expirationReason: "Falta de retorno do cliente" },
      slaResolutionStatus: "atendido",
    } as Partial<SlackDemand>);
    expect(isResolutionSlaExcluded(d)).toBe(false);
  });

  it("EXCLUI quando criada em abril+ com motivo valido e nao atendida", () => {
    const d = makeDemand({
      createdAt: "2026-04-15T10:00:00Z",
      closure: { expirationReason: "Falta de retorno do cliente" },
      slaResolutionStatus: "expirado",
    } as Partial<SlackDemand>);
    expect(isResolutionSlaExcluded(d)).toBe(true);
  });

  it("EXCLUI tambem com 'Demora no retorno do cliente'", () => {
    const d = makeDemand({
      createdAt: "2026-04-20T10:00:00Z",
      closure: { expirationReason: "Demora no retorno do cliente" },
      slaResolutionStatus: "expirado",
    } as Partial<SlackDemand>);
    expect(isResolutionSlaExcluded(d)).toBe(true);
  });
});
