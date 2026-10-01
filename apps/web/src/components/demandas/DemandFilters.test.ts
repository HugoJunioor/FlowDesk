import { describe, it, expect } from "vitest";
import { EMPTY_FILTERS, withCurrentPeriod, type DemandFilterState } from "./DemandFilters";

// Datas em hora local: os presets sao calculados no fuso do navegador, entao
// montar as datas assim mantem o teste valido em qualquer TZ (CI roda em UTC).
const local = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h);

// Visualizacao "mensal" salva em setembro: e o que o localStorage guarda.
const savedInSeptember: DemandFilterState = {
  ...EMPTY_FILTERS,
  periodPreset: "mensal",
  dateFrom: new Date(2026, 8, 1).toISOString(),
  dateTo: new Date(2026, 8, 30, 23, 59, 59, 999).toISOString(),
};

describe("withCurrentPeriod", () => {
  it("recalcula o mes de uma visualizacao mensal salva no mes anterior", () => {
    const out = withCurrentPeriod(savedInSeptember, local(2026, 9, 1));
    const createdToday = local(2026, 9, 1, 11);
    expect(new Date(out.dateFrom) <= createdToday).toBe(true);
    expect(new Date(out.dateTo) >= createdToday).toBe(true);
    expect(new Date(out.dateFrom).getMonth()).toBe(9);
  });

  it("recalcula hoje e semanal para a data corrente", () => {
    const today = withCurrentPeriod({ ...savedInSeptember, periodPreset: "hoje" }, local(2026, 9, 1));
    expect(new Date(today.dateFrom).getDate()).toBe(1);
    expect(new Date(today.dateFrom).getMonth()).toBe(9);

    // 2026-10-01 e quinta; semana comeca na segunda 28/09.
    const week = withCurrentPeriod({ ...savedInSeptember, periodPreset: "semanal" }, local(2026, 9, 1));
    expect(new Date(week.dateFrom).getDate()).toBe(28);
    expect(new Date(week.dateTo).getDate()).toBe(4);
  });

  it("mantem datas absolutas de personalizado e anual", () => {
    for (const preset of ["personalizado", "anual", ""] as const) {
      const f = { ...savedInSeptember, periodPreset: preset };
      expect(withCurrentPeriod(f, local(2026, 9, 1))).toBe(f);
    }
  });

  it("devolve o mesmo objeto quando o periodo ja esta em dia", () => {
    const now = local(2026, 9, 15);
    const fresh = withCurrentPeriod(savedInSeptember, now);
    expect(withCurrentPeriod(fresh, now)).toBe(fresh);
  });
});
