/**
 * Pipeline sem browser: regras e overrides entram por parametro.
 *
 * O comportamento em si ja e coberto por demandsLoader.test.ts (que passa pelo
 * localStorage). Aqui fica fixado so o que importa pra quem roda fora do
 * navegador (ex: export da planilha): o resultado depende apenas dos
 * argumentos, sem ler nada do storage.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { SlackDemand } from "@/types/demand";
import { processCurrentDemands } from "./demandsPipeline";

beforeEach(() => {
  localStorage.clear();
});

function makeDemand(over: Partial<SlackDemand> = {}): SlackDemand {
  return {
    id: "slack_C1_1700000000.000100",
    title: "Ajuste no cadastro",
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
    slackChannel: "#cliente-exemplo",
    threadReplies: [],
    ...over,
  } as SlackDemand;
}

describe("processCurrentDemands", () => {
  it("aplica o override manual passado por parametro", () => {
    const [out] = processCurrentDemands([makeDemand()], {
      rules: [],
      overrides: { "slack_C1_1700000000.000100": { priority: "p1", status: "em_andamento" } },
    });

    expect(out.priority).toBe("p1");
    expect(out.status).toBe("em_andamento");
  });

  it("ignora o que estiver no localStorage", () => {
    localStorage.setItem("fd_demand_overrides", JSON.stringify({
      "slack_C1_1700000000.000100": { priority: "p1" },
    }));

    const [out] = processCurrentDemands([makeDemand()], { rules: [], overrides: {} });

    expect(out.priority).toBe("p3");
  });

  it("usa as regras de atribuicao passadas por parametro", () => {
    const [out] = processCurrentDemands([makeDemand()], {
      rules: [{ id: "r1", condition: "no_assignee", assignee: "Membro do time" }],
      overrides: {},
    });

    expect(out.assignee?.name).toBe("Membro do time");
  });

  it("mantem a conclusao por circulo verde acima de uma reabertura manual", () => {
    const concluida = makeDemand({
      status: "concluida",
      completedAt: "2026-09-11T12:00:00.000Z",
      closureSource: "green_circle",
    } as Partial<SlackDemand>);

    const [out] = processCurrentDemands([concluida], {
      rules: [],
      overrides: { "slack_C1_1700000000.000100": { status: "aberta", manualStatusOverride: true } },
    });

    expect(out.status).toBe("concluida");
  });
});
