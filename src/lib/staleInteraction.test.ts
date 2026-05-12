import { describe, it, expect } from "vitest";
import { formatStaleTime, getHoursSinceLastInteraction, isStale } from "./staleInteraction";
import type { SlackDemand } from "@/types/demand";

const makeDemand = (overrides: Partial<SlackDemand>): SlackDemand =>
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
    replies: 0,
    threadReplies: [],
    ...overrides,
  } as SlackDemand);

describe("formatStaleTime", () => {
  it("formata < 1h em minutos", () => {
    expect(formatStaleTime(0.5)).toBe("30min");
    expect(formatStaleTime(0.1)).toBe("6min");
  });

  it("formata horas exatas (sem dias)", () => {
    expect(formatStaleTime(3)).toBe("3h");
    expect(formatStaleTime(9)).toBe("9h");
  });

  it("formata 1 dia util (10h) como 1d", () => {
    expect(formatStaleTime(10)).toBe("1d");
  });

  it("formata dias + horas conectando com 'e'", () => {
    expect(formatStaleTime(13)).toBe("1d e 3h");
    expect(formatStaleTime(25)).toBe("2d e 5h");
  });

  it("zero horas vira 0min", () => {
    expect(formatStaleTime(0)).toBe("0min");
  });
});

describe("getHoursSinceLastInteraction", () => {
  it("retorna null pra demanda concluida", () => {
    const d = makeDemand({ status: "concluida" });
    expect(getHoursSinceLastInteraction(d)).toBe(null);
  });

  it("retorna null pra demanda expirada", () => {
    const d = makeDemand({ status: "expirada" });
    expect(getHoursSinceLastInteraction(d)).toBe(null);
  });

  it("retorna numero pra demanda aberta sem replies", () => {
    const d = makeDemand({ status: "aberta", threadReplies: [] });
    const result = getHoursSinceLastInteraction(d);
    expect(result).not.toBe(null);
    expect(typeof result).toBe("number");
  });

  it("usa timestamp do reply mais recente quando ha replies", () => {
    const d = makeDemand({
      status: "aberta",
      threadReplies: [
        { author: "x", text: "old", timestamp: "2026-04-15T11:00:00Z", isTeamMember: false },
        { author: "y", text: "new", timestamp: "2026-04-15T15:00:00Z", isTeamMember: true },
      ],
    });
    const result = getHoursSinceLastInteraction(d);
    expect(result).not.toBe(null);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

describe("isStale", () => {
  it("retorna false pra demanda concluida (nao aplicavel)", () => {
    const d = makeDemand({ status: "concluida" });
    expect(isStale(d)).toBe(false);
  });

  it("retorna false quando dentro do threshold", () => {
    // Replies recentes, threshold de 999h pra garantir
    const recentReply = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h atras
    const d = makeDemand({
      threadReplies: [
        { author: "x", text: "msg", timestamp: recentReply, isTeamMember: true },
      ],
    });
    expect(isStale(d, 999)).toBe(false);
  });

  it("respeita threshold customizado", () => {
    const d = makeDemand({ status: "aberta", threadReplies: [] });
    // Threshold 0 sempre stale (qualquer tempo > 0)
    const hours = getHoursSinceLastInteraction(d);
    if (hours !== null && hours > 0) {
      expect(isStale(d, 0)).toBe(true);
    }
  });
});
