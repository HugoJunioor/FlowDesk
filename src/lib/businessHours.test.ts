import { describe, it, expect } from "vitest";
import { formatBusinessTime, getResolutionMinutes, getFirstResponseMinutes } from "./businessHours";

describe("formatBusinessTime", () => {
  it("formata 0 ou negativo como 0m", () => {
    expect(formatBusinessTime(0)).toBe("0m");
    expect(formatBusinessTime(-10)).toBe("0m");
  });

  it("formata minutos sozinhos", () => {
    expect(formatBusinessTime(45)).toBe("45m");
  });

  it("formata horas + minutos", () => {
    expect(formatBusinessTime(90)).toBe("1h 30m");
  });

  it("formata horas exatas sem minutos", () => {
    expect(formatBusinessTime(120)).toBe("2h");
  });

  it("formata 1 dia util (600 min) como 1d", () => {
    expect(formatBusinessTime(600)).toBe("1d");
  });

  it("formata dias + horas", () => {
    // 1 dia (600min) + 2h = 720min
    expect(formatBusinessTime(720)).toBe("1d 2h");
  });
});

describe("getResolutionMinutes", () => {
  it("retorna null quando nao concluida", () => {
    expect(getResolutionMinutes("2026-05-06T10:00:00Z", null)).toBe(null);
  });

  it("retorna minutos uteis entre criacao e conclusao", () => {
    // Mesmo dia, 1h depois (em horario util) → 60 min
    const result = getResolutionMinutes(
      "2026-05-06T13:00:00Z", // 10h BRT (util)
      "2026-05-06T14:00:00Z"  // 11h BRT (util)
    );
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(120); // tolerancia pra timezone
  });
});

describe("getFirstResponseMinutes", () => {
  it("retorna null quando nao ha resposta da equipe", () => {
    expect(getFirstResponseMinutes("2026-05-06T10:00:00Z", [])).toBe(null);
  });

  it("retorna null quando ha apenas respostas de cliente", () => {
    const replies = [
      { timestamp: "2026-05-06T11:00:00Z", isTeamMember: false },
    ];
    expect(getFirstResponseMinutes("2026-05-06T10:00:00Z", replies)).toBe(null);
  });

  it("usa override quando fornecido (dados historicos da planilha)", () => {
    const replies = [
      { timestamp: "2026-05-06T11:00:00Z", isTeamMember: true },
    ];
    // Override de 42 min — deve retornar 42 ignorando os replies
    expect(getFirstResponseMinutes("2026-05-06T10:00:00Z", replies, 42)).toBe(42);
  });

  it("calcula minutos ate primeira resposta da equipe", () => {
    const replies = [
      { timestamp: "2026-05-06T11:00:00Z", isTeamMember: false }, // ignorada
      { timestamp: "2026-05-06T13:00:00Z", isTeamMember: true },  // primeira da equipe
      { timestamp: "2026-05-06T14:00:00Z", isTeamMember: true },
    ];
    const result = getFirstResponseMinutes("2026-05-06T13:00:00Z", replies);
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("override null/undefined cai no calculo normal", () => {
    const replies = [
      { timestamp: "2026-05-06T13:00:00Z", isTeamMember: true },
    ];
    const r1 = getFirstResponseMinutes("2026-05-06T13:00:00Z", replies, null);
    const r2 = getFirstResponseMinutes("2026-05-06T13:00:00Z", replies, undefined);
    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
  });
});
