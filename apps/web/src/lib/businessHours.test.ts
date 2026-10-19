import { describe, it, expect } from "vitest";
import {
  addBusinessHours,
  formatBusinessTime,
  getBusinessMinutesBetween,
  getFirstResponseMinutes,
  getResolutionMinutes,
  getSlaDueDate,
} from "./businessHours";

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

  it("retorna null quando reply sintetico (reaction direto na main, sem reply real)", () => {
    // Demanda criada e fechada via ✅ em ~1 segundo (sintetico do sync).
    // Sem reply real da equipe = tempo desconhecido = null.
    const createdAt = "2026-05-06T13:00:00Z";
    const completedAt = "2026-05-06T13:00:01Z"; // +1 segundo
    const replies = [
      { isTeamMember: true, text: "[✅ Reacao de conclusao na mensagem principal]" },
    ];
    expect(getResolutionMinutes(createdAt, completedAt, replies)).toBe(null);
  });

  it("calcula tempo normal quando ha reply real da equipe (nao sintetico)", () => {
    const replies = [
      { isTeamMember: true, text: "Vou olhar agora" }, // reply real
    ];
    const result = getResolutionMinutes(
      "2026-05-06T13:00:00Z",
      "2026-05-06T15:00:00Z",
      replies,
    );
    expect(result).not.toBe(null);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("backward compat: sem threadReplies, calcula direto", () => {
    const result = getResolutionMinutes("2026-05-06T13:00:00Z", "2026-05-06T13:00:01Z");
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

describe("getFirstResponseMinutes — replies sinteticos", () => {
  it("ignora reply sintetico de reaction (texto comeca com [✅)", () => {
    const replies = [
      { timestamp: "2026-05-06T13:00:01Z", isTeamMember: true, text: "[✅ Reacao de conclusao na mensagem principal]" },
    ];
    expect(getFirstResponseMinutes("2026-05-06T13:00:00Z", replies)).toBe(null);
  });

  it("usa primeira reply real ignorando sinteticos no comeco", () => {
    const replies = [
      { timestamp: "2026-05-06T13:00:01Z", isTeamMember: true, text: "[✅ Reacao]" }, // sintetico
      { timestamp: "2026-05-06T14:00:00Z", isTeamMember: true, text: "Olhando agora" }, // real
    ];
    const result = getFirstResponseMinutes("2026-05-06T13:00:00Z", replies);
    expect(result).not.toBe(null);
    expect(result).toBeGreaterThan(0);
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

  describe("serviceStartedAt (Sitef/Conciliacao)", () => {
    it("usa serviceStartedAt quando vier ANTES da primeira reply", () => {
      const replies = [
        { timestamp: "2026-05-06T15:00:00Z", isTeamMember: true, text: "respondendo" },
      ];
      // serviceStartedAt as 14h, reply real as 15h — usa as 14h (mais cedo)
      const r = getFirstResponseMinutes(
        "2026-05-06T13:00:00Z",
        replies,
        null,
        "2026-05-06T14:00:00Z",
      );
      const rWithoutService = getFirstResponseMinutes("2026-05-06T13:00:00Z", replies, null);
      expect(r).not.toBeNull();
      expect(rWithoutService).not.toBeNull();
      // r deve ser MENOR (tempo entre 13h e 14h) que rWithoutService (13h-15h)
      expect(r!).toBeLessThan(rWithoutService!);
    });

    it("usa reply real quando vier ANTES do serviceStartedAt", () => {
      const replies = [
        { timestamp: "2026-05-06T14:00:00Z", isTeamMember: true, text: "respondendo" },
      ];
      // serviceStartedAt as 15h, reply real as 14h — usa as 14h (mais cedo)
      const r = getFirstResponseMinutes(
        "2026-05-06T13:00:00Z",
        replies,
        null,
        "2026-05-06T15:00:00Z",
      );
      expect(r).not.toBeNull();
      // Deve ser mais ou menos 60 min (13h → 14h)
      expect(r!).toBeGreaterThanOrEqual(0);
    });

    it("retorna serviceStartedAt sozinho quando nao ha reply real da equipe", () => {
      const r = getFirstResponseMinutes(
        "2026-05-06T13:00:00Z",
        [],
        null,
        "2026-05-06T14:00:00Z",
      );
      expect(r).not.toBeNull();
      expect(r!).toBeGreaterThanOrEqual(0);
    });

    it("retorna null quando nao ha nem reply nem serviceStartedAt", () => {
      const r = getFirstResponseMinutes("2026-05-06T13:00:00Z", [], null, null);
      expect(r).toBeNull();
    });
  });
});

describe("prazo P3 de uma remessa aberta na segunda de manha", () => {
  // Datas em hora LOCAL: businessHours le getHours(), entao construir com o
  // construtor local mantem o teste igual em qualquer fuso (CI roda em UTC).
  const criada = new Date(2026, 9, 19, 9, 16); // seg 19/10 09:16
  const agora = new Date(2026, 9, 19, 9, 53); // seg 19/10 09:53

  it("24h uteis a partir de segunda 09:16 vencem na quarta 13:16", () => {
    // seg 09:16-18:00 = 8h44; ter = 10h; faltam 5h16 -> qua 08:00 + 5h16
    const prazo = addBusinessHours(criada, 24);
    expect(prazo.getDay()).toBe(3); // quarta
    expect(prazo.getHours()).toBe(13);
    expect(prazo.getMinutes()).toBe(16);
  });

  it("restam 2d 3h as 09:53 — o que uma P3 normal mostra", () => {
    const prazo = addBusinessHours(criada, 24);
    expect(formatBusinessTime(getBusinessMinutesBetween(agora, prazo))).toBe("2d 3h");
  });

  it("uma data de formulario no fim de terca encurta o prazo pra 1d 8h", () => {
    // Caso real: "Data limite: 21/10" era lida como meia-noite UTC, que em
    // Brasilia e terca 21:00. Contando so horas uteis isso termina as 18:00
    // de terca — cerca de 5h antes do prazo P3 de verdade.
    const dataDoFormulario = new Date(2026, 9, 20, 21, 0);
    expect(formatBusinessTime(getBusinessMinutesBetween(agora, dataDoFormulario))).toBe("1d 8h");
  });

  it("a data do formulario fica antes do prazo P3 calculado", () => {
    const dataDoFormulario = new Date(2026, 9, 20, 21, 0);
    expect(dataDoFormulario.getTime()).toBeLessThan(addBusinessHours(criada, 24).getTime());
  });
});

describe("getSlaDueDate", () => {
  it("usa o SLA da prioridade quando nao ha dueDate", () => {
    const createdAt = "2026-09-10T12:00:00.000Z";
    const due = getSlaDueDate({ dueDate: null, createdAt, priority: "p3" });
    expect(due?.getTime()).toBe(addBusinessHours(new Date(createdAt), 24).getTime());
  });

  it("respeita dueDate explicito (demandas internas)", () => {
    const due = getSlaDueDate({ dueDate: "2026-09-12T15:00:00.000Z", createdAt: "2026-09-10T12:00:00.000Z", priority: "p3" });
    expect(due?.toISOString()).toBe("2026-09-12T15:00:00.000Z");
  });

  it("devolve null para prioridade sem SLA", () => {
    expect(getSlaDueDate({ dueDate: null, createdAt: "2026-09-10T12:00:00.000Z", priority: "sem_classificacao" })).toBeNull();
  });
});
