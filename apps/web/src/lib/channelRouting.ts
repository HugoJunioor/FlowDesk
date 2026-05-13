/**
 * Roteamento de canais Slack por modulo (Demandas Geral vs SQL/Operacoes).
 *
 * Antes: regra hardcoded — 'cliente-*' ia pro geral, 'operacoes-sql' ia
 * pro SQL. Agora: master configura caso a caso via UI; persistido em
 * shared-state.json (sincronizado entre dispositivos).
 *
 * Fallback: se um canal nao esta cadastrado, aplica `defaultRoute`
 * (default: 'demandas' / geral). Pra ignorar, marca explicitamente.
 */
import { setSyncedItem } from "./stateSync";

export type ChannelRoute = "demandas" | "sql" | "ignore";

export interface ChannelRule {
  /** Nome do canal Slack sem # (ex: 'cliente-vspay') */
  name: string;
  routeTo: ChannelRoute;
  /** Notas internas (opcional) */
  note?: string;
  /** Quando foi cadastrado */
  addedAt: string;
  /** Detectado automaticamente do Slack vs adicionado manual */
  source?: "slack" | "manual";
}

export interface ChannelRoutingConfig {
  version: 1;
  defaultRoute: ChannelRoute;
  channels: ChannelRule[];
}

const KEY = "fd_channel_routing";
const DEFAULT_CONFIG: ChannelRoutingConfig = {
  version: 1,
  defaultRoute: "demandas",
  channels: [],
};

export function loadChannelRouting(): ChannelRoutingConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as ChannelRoutingConfig;
    if (parsed.version === 1 && Array.isArray(parsed.channels)) return parsed;
    return DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveChannelRouting(config: ChannelRoutingConfig): void {
  setSyncedItem(KEY, JSON.stringify(config));
}

/** Aplica regra a um canal. Retorna a rota efetiva. */
export function routeFor(channelName: string, config?: ChannelRoutingConfig): ChannelRoute {
  const cfg = config ?? loadChannelRouting();
  const cleaned = channelName.replace(/^#/, "");
  const explicit = cfg.channels.find(
    (c) => c.name.toLowerCase() === cleaned.toLowerCase()
  );
  if (explicit) return explicit.routeTo;
  // Compat: padrao antigo se nao cadastrado explicitamente
  if (/^cliente-/i.test(cleaned)) return "demandas";
  if (/^opera[çc][õo]es-sql$/i.test(cleaned)) return "sql";
  return cfg.defaultRoute;
}

/** Adiciona ou atualiza regra de canal. */
export function upsertChannelRule(
  name: string,
  routeTo: ChannelRoute,
  opts: { note?: string; source?: "slack" | "manual" } = {}
): ChannelRoutingConfig {
  const cfg = loadChannelRouting();
  const cleaned = name.replace(/^#/, "");
  const idx = cfg.channels.findIndex(
    (c) => c.name.toLowerCase() === cleaned.toLowerCase()
  );
  if (idx >= 0) {
    cfg.channels[idx] = {
      ...cfg.channels[idx],
      routeTo,
      note: opts.note ?? cfg.channels[idx].note,
    };
  } else {
    cfg.channels.push({
      name: cleaned,
      routeTo,
      note: opts.note,
      source: opts.source ?? "manual",
      addedAt: new Date().toISOString(),
    });
  }
  saveChannelRouting(cfg);
  return cfg;
}

export function removeChannelRule(name: string): ChannelRoutingConfig {
  const cfg = loadChannelRouting();
  const cleaned = name.replace(/^#/, "");
  cfg.channels = cfg.channels.filter(
    (c) => c.name.toLowerCase() !== cleaned.toLowerCase()
  );
  saveChannelRouting(cfg);
  return cfg;
}

export function setDefaultRoute(route: ChannelRoute): ChannelRoutingConfig {
  const cfg = loadChannelRouting();
  cfg.defaultRoute = route;
  saveChannelRouting(cfg);
  return cfg;
}

/**
 * Detecta canais novos a partir do realDemands/sqlDemands ja carregados.
 * Pra cadastro automatico (master ve canal novo na lista, decide rota).
 */
export function detectChannelsFromDemands(slackChannels: string[]): string[] {
  const cfg = loadChannelRouting();
  const known = new Set(cfg.channels.map((c) => c.name.toLowerCase()));
  const seen = new Set<string>();
  for (const ch of slackChannels) {
    const cleaned = ch.replace(/^#/, "").toLowerCase();
    if (!known.has(cleaned)) seen.add(ch.replace(/^#/, ""));
  }
  return Array.from(seen).sort();
}
