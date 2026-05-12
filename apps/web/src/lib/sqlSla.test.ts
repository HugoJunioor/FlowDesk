import { describe, it, expect } from "vitest";
import {
  getApprovedAt,
  getHandlingMinutes,
  formatHandlingTime,
  getAverageHandlingMinutes,
  getAverageInProgressMinutes,
} from "./sqlSla";
import type { SlackDemand } from "@/types/demand";

const makeDemand = (overrides: Partial<SlackDemand> & { approvedAt?: string }): SlackDemand =>
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

describe("getApprovedAt", () => {
  it("retorna null quando sem approvedAt", () => {
    expect(getApprovedAt(makeDemand({}))).toBe(null);
  });

  it("retorna o timestamp quando definido", () => {
    const d = makeDemand({ approvedAt: "2026-04-15T11:00:00Z" });
    expect(getApprovedAt(d)).toBe("2026-04-15T11:00:00Z");
  });
});

describe("getHandlingMinutes", () => {
  it("retorna null quando sem aprovacao", () => {
    const d = makeDemand({ status: "concluida", completedAt: "2026-04-15T15:00:00Z" });
    expect(getHandlingMinutes(d)).toBe(null);
  });

  it("retorna null pra demanda aberta (nem concluida nem em andamento)", () => {
    const d = makeDemand({ status: "aberta", approvedAt: "2026-04-15T11:00:00Z" });
    expect(getHandlingMinutes(d)).toBe(null);
  });

  it("retorna null pra demanda expirada", () => {
    const d = makeDemand({ status: "expirada", approvedAt: "2026-04-15T11:00:00Z" });
    expect(getHandlingMinutes(d)).toBe(null);
  });

  it("calcula minutos uteis pra demanda concluida", () => {
    const d = makeDemand({
      status: "concluida",
      approvedAt: "2026-04-15T13:00:00Z", // 10h BRT (util)
      completedAt: "2026-04-15T15:00:00Z", // 12h BRT (util)
    });
    const mins = getHandlingMinutes(d);
    expect(mins).not.toBe(null);
    expect(mins).toBeGreaterThanOrEqual(0);
  });

  it("calcula minutos uteis pra demanda em_andamento (vs now)", () => {
    const d = makeDemand({
      status: "em_andamento",
      approvedAt: "2026-04-15T13:00:00Z",
    });
    const mins = getHandlingMinutes(d);
    expect(mins).not.toBe(null);
    expect(typeof mins).toBe("number");
  });
});

describe("formatHandlingTime", () => {
  it("retorna '—' pra null/undefined", () => {
    expect(formatHandlingTime(null)).toBe("—");
    expect(formatHandlingTime(undefined as unknown as number)).toBe("—");
  });

  it("formata < 1min", () => {
    expect(formatHandlingTime(0)).toBe("< 1min");
    expect(formatHandlingTime(0.5)).toBe("< 1min");
  });

  it("formata so minutos", () => {
    expect(formatHandlingTime(30)).toBe("30min");
    expect(formatHandlingTime(59)).toBe("59min");
  });

  it("formata horas + minutos (sem dias)", () => {
    expect(formatHandlingTime(90)).toBe("1h 30min");
    expect(formatHandlingTime(125)).toBe("2h 5min");
  });

  it("formata horas exatas", () => {
    expect(formatHandlingTime(120)).toBe("2h");
  });

  it("formata 1 dia util (600 min)", () => {
    expect(formatHandlingTime(600)).toBe("1d");
  });

  it("formata dias + horas (sem minutos)", () => {
    // 1 dia (600) + 2h (120) = 720
    expect(formatHandlingTime(720)).toBe("1d 2h");
  });

  it("nao mostra minutos quando ja tem dias (precisao reduzida)", () => {
    // 1d 2h 30min (750) → "1d 2h" (omite minutos)
    expect(formatHandlingTime(750)).toBe("1d 2h");
  });
});

describe("getAverageHandlingMinutes", () => {
  it("retorna null pra lista vazia", () => {
    expect(getAverageHandlingMinutes([])).toBe(null);
  });

  it("retorna null quando nenhuma esta concluida", () => {
    const demands = [
      makeDemand({ status: "aberta" }),
      makeDemand({ status: "em_andamento", approvedAt: "2026-04-15T13:00:00Z" }),
    ];
    expect(getAverageHandlingMinutes(demands)).toBe(null);
  });

  it("calcula media apenas de concluidas com aprovacao", () => {
    const demands = [
      makeDemand({
        status: "concluida",
        approvedAt: "2026-04-15T13:00:00Z",
        completedAt: "2026-04-15T15:00:00Z",
      }),
      makeDemand({ status: "aberta" }), // ignorada
      makeDemand({
        status: "concluida",
        approvedAt: "2026-04-16T13:00:00Z",
        completedAt: "2026-04-16T14:00:00Z",
      }),
    ];
    const avg = getAverageHandlingMinutes(demands);
    expect(avg).not.toBe(null);
    expect(typeof avg).toBe("number");
  });
});

describe("getAverageInProgressMinutes", () => {
  it("retorna null quando nenhuma em andamento", () => {
    const demands = [
      makeDemand({ status: "concluida", approvedAt: "2026-04-15T13:00:00Z", completedAt: "2026-04-15T14:00:00Z" }),
    ];
    expect(getAverageInProgressMinutes(demands)).toBe(null);
  });

  it("calcula media apenas de em_andamento", () => {
    const demands = [
      makeDemand({ status: "em_andamento", approvedAt: "2026-04-15T13:00:00Z" }),
      makeDemand({ status: "concluida", approvedAt: "2026-04-15T13:00:00Z", completedAt: "2026-04-15T14:00:00Z" }), // ignorada
    ];
    const avg = getAverageInProgressMinutes(demands);
    expect(avg).not.toBe(null);
  });
});
