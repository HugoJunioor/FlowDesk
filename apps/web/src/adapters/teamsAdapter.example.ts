/**
 * STUB de exemplo: adapter para Microsoft Teams.
 *
 * Este arquivo NAO esta em uso — serve como template para mostrar como
 * integrar uma nova plataforma. Implementacao real exigiria:
 *
 *   1. Registrar app no Azure AD com permissoes ChannelMessage.Read.All
 *   2. Trocar o stub abaixo por chamadas reais a Microsoft Graph:
 *      GET /teams/{team-id}/channels/{channel-id}/messages
 *   3. Mapear a estrutura de Teams (chatMessage) para ChannelMessage
 *   4. Registrar este adapter num "channel registry" (ainda nao existe)
 *
 * Quando ativado, o front consome demandas exatamente da mesma forma —
 * todo o resto do sistema (SLA, dashboard, relatorios) funciona sem
 * mudanca.
 */
import type { ChannelMessage, DemandAdapter } from "./types";
import { slackAdapter } from "./slackAdapter";

export const teamsAdapter: DemandAdapter = {
  channelType: "teams",
  displayName: "Microsoft Teams",

  async fetchMessages(_opts) {
    // TODO: chamar Microsoft Graph API
    //
    // const token = await getGraphToken();
    // const res = await fetch(
    //   `https://graph.microsoft.com/v1.0/teams/${TEAM_ID}/channels/${CHANNEL_ID}/messages`,
    //   { headers: { Authorization: `Bearer ${token}` } }
    // );
    // const data = await res.json();
    // return data.value.map(mapTeamsMessageToChannelMessage);
    return [];
  },

  toDemand(msg: ChannelMessage) {
    // Reuso da logica do Slack adapter — a normalizacao via ChannelMessage
    // ja torna a conversao trivial. So ajustar metadados especificos
    // (channel, permalink format).
    const base = slackAdapter.toDemand(msg);
    return { ...base, slackChannel: "teams" };
  },

  async react(_externalId, _emoji) {
    // Teams nao suporta reactions arbitrarias. Implementar como "thumbsup"
    // ou postar resposta com :white_check_mark: emoji unicode.
    throw new Error("teamsAdapter.react: nao implementado");
  },
};
