/**
 * Duas regressões de boot que juntas deixavam o login lento a ponto de falhar.
 *
 * 1) O interceptor de localStorage era instalado ANTES do initStateSync, então
 *    cada chave que o sync gravava localmente disparava um PUT de volta ao
 *    servidor — o app devolvia ~700 KB que tinha acabado de baixar, a cada
 *    carregamento. Com HTTP/1.1 (6 conexões por origem) e o legacy-state
 *    gravando com writeFileSync síncrono, essa rajada enfileirava as
 *    requisições seguintes, incluindo o POST de login.
 *
 * 2) O fetch inicial não tinha timeout, e main.tsx só renderiza no .finally()
 *    dele. Servidor pendurado = tela branca permanente, sem nem o formulário
 *    de login.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SERVER_STATE = {
  fd_users_v2: [{ id: "1", login: "alguem" }],
  fd_groups: [{ id: "g1" }],
  fd_demand_overrides: { "demanda-1": { priority: "P1" } },
};

let originalSetItem: typeof Storage.prototype.setItem;

beforeEach(() => {
  vi.resetModules();
  originalSetItem = Storage.prototype.setItem;
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  Storage.prototype.setItem = originalSetItem;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Requisições que não são a busca inicial de estado. */
function writesFrom(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === "PUT")
    .map(([url]) => String(url));
}

describe("initStateSync — não devolve ao servidor o que acabou de baixar", () => {
  it("aplica o estado do servidor sem disparar um único PUT", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url) === "/__state") {
        return new Response(JSON.stringify(SERVER_STATE), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { initStateSync, installLocalStorageInterceptor } = await import("./stateSync");
    installLocalStorageInterceptor();
    await initStateSync();

    // O estado chegou no localStorage...
    expect(localStorage.getItem("fd_users_v2")).toContain("alguem");
    // ...e nada foi reenviado.
    expect(writesFrom(fetchMock)).toEqual([]);
  });

  it("o interceptor volta a sincronizar escritas normais depois do boot", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(SERVER_STATE), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { initStateSync, installLocalStorageInterceptor } = await import("./stateSync");
    installLocalStorageInterceptor();
    await initStateSync();
    fetchMock.mockClear();

    // Uma edição de verdade, feita pelo usuário depois do boot.
    localStorage.setItem("fd_groups", JSON.stringify([{ id: "g2" }]));

    expect(writesFrom(fetchMock)).toEqual(["/__state/fd_groups"]);
  });

  it("a supressão é liberada mesmo quando o sync falha", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("servidor fora");
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { initStateSync, installLocalStorageInterceptor } = await import("./stateSync");
    installLocalStorageInterceptor();
    await initStateSync();
    fetchMock.mockClear();

    localStorage.setItem("fd_groups", JSON.stringify([{ id: "g3" }]));
    expect(writesFrom(fetchMock)).toEqual(["/__state/fd_groups"]);
  });
});

describe("initStateSync — não pode travar o boot", () => {
  it("toda requisição do boot leva AbortSignal", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(SERVER_STATE), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { initStateSync } = await import("./stateSync");
    await initStateSync();

    // São duas e ambas são aguardadas antes do primeiro render: /__token
    // (busca de credencial) e /__state. Qualquer uma pendurada = tela branca.
    const bootCalls = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method !== "PUT",
    );
    expect(bootCalls.length).toBeGreaterThanOrEqual(2);
    for (const [url, init] of bootCalls) {
      expect((init as RequestInit).signal, `sem timeout em ${String(url)}`)
        .toBeInstanceOf(AbortSignal);
    }
  });

  it("resolve (em vez de pendurar) quando o servidor aborta", async () => {
    const fetchMock = vi.fn(async () => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      throw err;
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { initStateSync } = await import("./stateSync");
    // Se isto pendurar, main.tsx nunca renderiza.
    await expect(initStateSync()).resolves.toBeUndefined();
  });

  it("mantém o localStorage existente quando o servidor não responde", async () => {
    localStorage.setItem("fd_groups", JSON.stringify([{ id: "local" }]));
    const fetchMock = vi.fn(async () => {
      throw new Error("sem rede");
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { initStateSync } = await import("./stateSync");
    await initStateSync();

    expect(localStorage.getItem("fd_groups")).toContain("local");
  });
});
