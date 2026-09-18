/**
 * Atribuicao automatica de responsavel — com foco no caso que estava quebrado.
 *
 * O bloco de "workflow forcado P3" (conciliacao) saia com `return` antes das
 * etapas de atribuicao. Resultado: demanda de "Nova conciliacao" nunca recebia
 * responsavel, nem por regra de texto nem pelo fallback `no_assignee`. Em
 * producao isso deixou 58 demandas sem dono e o time atribuia na mao, sem
 * entender por que a regra nao pegava — o sintoma era silencioso porque a
 * prioridade P3 era aplicada corretamente, entao "parecia" que a regra rodou.
 *
 * O contrato que estes testes fixam: forcar P3 decide PRIORIDADE, nao decide
 * responsavel. Quem chega sem dono cai no fallback; quem ja tem dono fica como
 * esta.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { SlackDemand } from "@/types/demand";
import { getProcessedDemands, updateRuntimeDemands } from "./demandsLoader";

const RULES_KEY = "fd_auto_assign_rules";

// Sem vi.resetModules() de proposito: reimportar o modulo a cada teste puxa o
// grafo inteiro (mockDemands, classificadores, analyzers) e estourava o timeout
// de 5s quando a suite roda completa. Nao e preciso — loadAutoAssignRules() le
// o localStorage a cada chamada e updateRuntimeDemands() sobrescreve o estado,
// entao limpar o storage entre os testes basta pra isolar.
beforeEach(() => {
  localStorage.clear();
});

/** Demanda minima valida — sobrescreva so o que o teste precisa. */
function makeDemand(over: Partial<SlackDemand> = {}): SlackDemand {
  return {
    id: "slack_C1_1700000000.000100",
    title: "@Alguem",
    description: "texto qualquer da demanda",
    priority: "p3",
    status: "aberta",
    demandType: "Outro",
    workflow: "Fluxo de Trabalho",
    product: "",
    requester: { name: "Solicitante", avatar: "" },
    assignee: null,
    cc: [],
    createdAt: "2026-09-10T12:00:00.000Z",
    dueDate: null,
    completedAt: null,
    hasTask: false,
    taskLink: "",
    tags: [],
    slackChannel: "#cliente-kpi",
    // statusAnalyzer percorre threadReplies sem guarda — omitir quebra o
    // pipeline antes de chegar na atribuicao.
    threadReplies: [],
    ...over,
  } as SlackDemand;
}

function setFallback(assignee: string) {
  localStorage.setItem(
    RULES_KEY,
    JSON.stringify([{ id: "r1", condition: "no_assignee", assignee }]),
  );
}

/** Roda o pipeline real e devolve a demanda processada pelo id. */
function processOne(demand: SlackDemand): SlackDemand {
  updateRuntimeDemands([demand]);
  const out = getProcessedDemands().find((d) => d.id === demand.id);
  if (!out) throw new Error("demanda sumiu do pipeline");
  return out;
}

describe("fallback no_assignee em workflow forcado P3 (conciliacao)", () => {
  it("atribui o responsavel padrao quando a demanda chega sem dono", () => {
    setFallback("Hugo Cordeiro Junior");

    const out = processOne(
      makeDemand({ workflow: "Nova conciliação", assignee: null }),
    );

    expect(out.assignee?.name).toBe("Hugo Cordeiro Junior");
  });

  it("mantem a prioridade P3 do workflow ao aplicar o fallback", () => {
    setFallback("Hugo Cordeiro Junior");

    const out = processOne(
      makeDemand({ workflow: "Nova conciliação", priority: "p1", assignee: null }),
    );

    // O P3 do workflow vence a prioridade original — esse comportamento ja
    // existia e nao pode regredir por causa da correcao de atribuicao.
    expect(out.priority).toBe("p3");
    expect(out.assignee?.name).toBe("Hugo Cordeiro Junior");
  });

  it("nao rouba demanda que ja tem responsavel", () => {
    setFallback("Hugo Cordeiro Junior");

    const out = processOne(
      makeDemand({
        workflow: "Nova conciliação",
        assignee: { name: "Bruna Queiroz", avatar: "" },
      }),
    );

    expect(out.assignee?.name).toBe("Bruna Queiroz");
  });

  it("deixa sem dono quando nao ha regra de fallback configurada", () => {
    // Sem regra, o comportamento correto e nao inventar responsavel.
    const out = processOne(
      makeDemand({ workflow: "Nova conciliação", assignee: null }),
    );

    expect(out.assignee?.name ?? null).toBeNull();
  });

  it("aceita a forma sem acento do workflow", () => {
    setFallback("Hugo Cordeiro Junior");

    const out = processOne(
      makeDemand({ workflow: "Nova conciliacao", assignee: null }),
    );

    expect(out.assignee?.name).toBe("Hugo Cordeiro Junior");
  });
});

describe("fallback no_assignee nos demais workflows (guarda de regressao)", () => {
  it("continua atribuindo o responsavel padrao em workflow comum", () => {
    setFallback("Hugo Cordeiro Junior");

    const out = processOne(
      makeDemand({ workflow: "Fluxo de Trabalho", assignee: null }),
    );

    expect(out.assignee?.name).toBe("Hugo Cordeiro Junior");
  });

  it("nao sobrepoe responsavel existente em workflow comum", () => {
    setFallback("Hugo Cordeiro Junior");

    const out = processOne(
      makeDemand({
        workflow: "Fluxo de Trabalho",
        assignee: { name: "Bruna Queiroz", avatar: "" },
      }),
    );

    expect(out.assignee?.name).toBe("Bruna Queiroz");
  });
});
