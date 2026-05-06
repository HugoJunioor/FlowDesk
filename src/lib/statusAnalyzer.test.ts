import { describe, it, expect } from "vitest";
import { analyzeThreadStatus } from "./statusAnalyzer";
import type { SlackDemand } from "@/types/demand";

const makeDemand = (replies: SlackDemand["threadReplies"]): SlackDemand =>
  ({
    id: "test",
    title: "test",
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
    replies: replies.length,
    threadReplies: replies,
  } as SlackDemand);

describe("analyzeThreadStatus", () => {
  it("retorna null quando nao ha replies da equipe", () => {
    const d = makeDemand([
      { author: "cliente", text: "alguma coisa", timestamp: "2026-04-15T11:00:00Z", isTeamMember: false },
    ]);
    expect(analyzeThreadStatus(d)).toBe(null);
  });

  it("retorna null quando nao ha replies", () => {
    const d = makeDemand([]);
    expect(analyzeThreadStatus(d)).toBe(null);
  });

  it("detecta CONCLUIDA via reaction ✅ na thread", () => {
    const d = makeDemand([
      { author: "Hugo", text: "vou olhar", timestamp: "2026-04-15T11:00:00Z", isTeamMember: true },
      { author: "Cliente", text: "ok obrigado", timestamp: "2026-04-15T15:00:00Z", isTeamMember: false, hasCheckReaction: true },
    ]);
    const r = analyzeThreadStatus(d);
    expect(r?.suggestedStatus).toBe("concluida");
    expect(r?.confidence).toBe("alta");
    expect(r?.reason).toContain("Cliente");
  });

  it("usa o ULTIMO reaction quando ha multiplos", () => {
    const d = makeDemand([
      { author: "A", text: "1", timestamp: "2026-04-15T11:00:00Z", isTeamMember: true, hasCheckReaction: true },
      { author: "B", text: "2", timestamp: "2026-04-15T15:00:00Z", isTeamMember: true, hasCheckReaction: true },
    ]);
    const r = analyzeThreadStatus(d);
    expect(r?.suggestedStatus).toBe("concluida");
    expect(r?.reason).toContain("B");
  });

  it("detecta EM_ANDAMENTO via padrao de texto da equipe", () => {
    const d = makeDemand([
      { author: "Hugo", text: "estou analisando, vou verificar agora", timestamp: "2026-04-15T11:00:00Z", isTeamMember: true },
    ]);
    const r = analyzeThreadStatus(d);
    expect(r?.suggestedStatus).toBe("em_andamento");
    expect(["alta", "media"]).toContain(r?.confidence);
  });

  it("detecta EM_ANDAMENTO ao mencionar task no clickup", () => {
    const d = makeDemand([
      { author: "Hugo", text: "criei a task: app.clickup.com/t/abc123", timestamp: "2026-04-15T11:00:00Z", isTeamMember: true },
    ]);
    const r = analyzeThreadStatus(d);
    expect(r?.suggestedStatus).toBe("em_andamento");
  });

  it("NUNCA marca concluida por texto (apenas reaction)", () => {
    // Mesmo com palavras tipo "resolvido", "executado" — sem reaction = nao concluida
    const d = makeDemand([
      { author: "Hugo", text: "resolvido, processado e executado", timestamp: "2026-04-15T11:00:00Z", isTeamMember: true },
    ]);
    const r = analyzeThreadStatus(d);
    expect(r?.suggestedStatus).not.toBe("concluida");
  });

  it("normaliza acentos no matching", () => {
    const d = makeDemand([
      { author: "Hugo", text: "Já estou olhando, em análise", timestamp: "2026-04-15T11:00:00Z", isTeamMember: true },
    ]);
    const r = analyzeThreadStatus(d);
    expect(r?.suggestedStatus).toBe("em_andamento");
  });

  it("alta confianca quando tem 2+ patterns matchando", () => {
    const d = makeDemand([
      { author: "Hugo", text: "vou verificar, vou analisar e vou resolver", timestamp: "2026-04-15T11:00:00Z", isTeamMember: true },
    ]);
    const r = analyzeThreadStatus(d);
    expect(r?.confidence).toBe("alta");
  });

  it("retorno tem timestamp do detectedAt", () => {
    const d = makeDemand([
      { author: "Hugo", text: "estou analisando", timestamp: "2026-04-15T11:00:00Z", isTeamMember: true },
    ]);
    const r = analyzeThreadStatus(d);
    expect(r?.detectedAt).toBe("2026-04-15T11:00:00Z");
  });
});
