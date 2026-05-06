import { describe, it, expect, beforeEach, vi } from "vitest";
import { routeFor, type ChannelRoutingConfig } from "./channelRouting";

// Mock localStorage pro nodejs (setSyncedItem usa internamente)
beforeEach(() => {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => Object.keys(store).forEach((k) => delete store[k]),
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  });
  // setSyncedItem dispara CustomEvent — mock window
  vi.stubGlobal("window", {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
});

const makeConfig = (overrides: Partial<ChannelRoutingConfig> = {}): ChannelRoutingConfig => ({
  version: 1,
  defaultRoute: "demandas",
  channels: [],
  ...overrides,
});

describe("routeFor", () => {
  it("retorna 'demandas' por padrao quando canal nao cadastrado", () => {
    const cfg = makeConfig();
    expect(routeFor("canal-qualquer", cfg)).toBe("demandas");
  });

  it("respeita defaultRoute customizado", () => {
    const cfg = makeConfig({ defaultRoute: "ignore" });
    expect(routeFor("canal-qualquer", cfg)).toBe("ignore");
  });

  it("usa regra explicita quando cadastrada", () => {
    const cfg = makeConfig({
      channels: [
        { name: "vendas", routeTo: "sql", addedAt: "2026-01-01" },
      ],
    });
    expect(routeFor("vendas", cfg)).toBe("sql");
  });

  it("aplica padrao legacy: cliente-* vai pra demandas", () => {
    const cfg = makeConfig({ defaultRoute: "ignore" }); // mesmo com default ignore
    expect(routeFor("cliente-vspay", cfg)).toBe("demandas");
    expect(routeFor("cliente-acme", cfg)).toBe("demandas");
  });

  it("aplica padrao legacy: operacoes-sql vai pra sql", () => {
    const cfg = makeConfig();
    expect(routeFor("operacoes-sql", cfg)).toBe("sql");
    expect(routeFor("operações-sql", cfg)).toBe("sql"); // com acento
  });

  it("regra explicita sobrescreve legacy", () => {
    const cfg = makeConfig({
      channels: [
        { name: "cliente-vspay", routeTo: "ignore", addedAt: "2026-01-01" },
      ],
    });
    expect(routeFor("cliente-vspay", cfg)).toBe("ignore");
  });

  it("ignora prefixo # no nome do canal", () => {
    const cfg = makeConfig({
      channels: [
        { name: "vendas", routeTo: "sql", addedAt: "2026-01-01" },
      ],
    });
    expect(routeFor("#vendas", cfg)).toBe("sql");
  });

  it("matching de nome eh case-insensitive", () => {
    const cfg = makeConfig({
      channels: [
        { name: "Vendas", routeTo: "sql", addedAt: "2026-01-01" },
      ],
    });
    expect(routeFor("VENDAS", cfg)).toBe("sql");
    expect(routeFor("vendas", cfg)).toBe("sql");
  });
});
