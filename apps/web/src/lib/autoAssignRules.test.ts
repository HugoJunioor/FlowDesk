/**
 * Recorte de data do fallback `no_assignee`.
 *
 * O ponto sensivel e o padrao: uma regra de fallback nova precisa nascer
 * valendo so de hoje em diante. Sem isso, liga-la transfere de uma vez todo o
 * historico sem responsavel — em producao eram 133 demandas desde abril, 126
 * delas ja concluidas, o que desloca as metricas por responsavel sem que
 * ninguem tenha pedido isso.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { fallbackReaches, newRule, todayIso, type AutoAssignRule } from "./autoAssignRules";

beforeEach(() => {
  localStorage.clear();
});

function fallback(appliesFrom?: string): AutoAssignRule {
  return { id: "r1", condition: "no_assignee", assignee: "Fulano", appliesFrom };
}

describe("newRule", () => {
  it("cria fallback valendo a partir de hoje", () => {
    const r = newRule("no_assignee");
    expect(r.appliesFrom).toBe(todayIso());
  });

  it("nao poe appliesFrom em regra por texto", () => {
    const r = newRule("text_match");
    expect(r.appliesFrom).toBeUndefined();
  });
});

describe("fallbackReaches", () => {
  it("alcanca tudo quando appliesFrom esta ausente", () => {
    expect(fallbackReaches(fallback(), "2026-04-01T10:00:00.000Z")).toBe(true);
  });

  it("nao alcanca o que foi criado antes do corte", () => {
    expect(fallbackReaches(fallback("2026-09-18"), "2026-09-17T23:00:00-03:00")).toBe(false);
  });

  it("alcanca o que foi criado a partir do corte", () => {
    expect(fallbackReaches(fallback("2026-09-18"), "2026-09-18T00:05:00-03:00")).toBe(true);
  });

  it("corta exatamente na meia-noite LOCAL, nao na UTC", () => {
    // Testa a fronteira em vez de um horario fixo: assim vale em qualquer fuso
    // (o CI roda em UTC, a equipe em -03) e ainda prova que o limite e a
    // meia-noite local — um horario fixo passaria por acidente num fuso e
    // falharia no outro.
    const meiaNoiteLocal = new Date("2026-09-18T00:00:00");
    const umMsAntes = new Date(meiaNoiteLocal.getTime() - 1);

    expect(fallbackReaches(fallback("2026-09-18"), meiaNoiteLocal.toISOString())).toBe(true);
    expect(fallbackReaches(fallback("2026-09-18"), umMsAntes.toISOString())).toBe(false);
  });

  it("nao desliga a regra quando a data esta corrompida", () => {
    // Preferimos o comportamento antigo (alcancar tudo) a silenciosamente
    // parar de atribuir por causa de um valor invalido no storage.
    expect(fallbackReaches(fallback("nao-e-data"), "2026-09-18T10:00:00.000Z")).toBe(true);
  });

  it("nao alcanca demanda com createdAt invalido", () => {
    expect(fallbackReaches(fallback("2026-09-18"), "xxx")).toBe(false);
  });
});
