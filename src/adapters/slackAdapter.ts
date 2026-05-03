/**
 * Adapter Slack — implementacao atual de producao.
 *
 * O sync real acontece em scripts/syncSlack.cjs (Node), que consulta a
 * API Slack via @slack/web-api e gera src/data/realDemands.ts. Este
 * adapter expoe a interface comum DemandAdapter para uso futuro pelo
 * front (ex: chamada via API quando migrar do arquivo gitignored para
 * backend Node).
 */
import type { ChannelMessage, DemandAdapter } from "./types";
import type { SlackDemand } from "@/types/demand";

export const slackAdapter: DemandAdapter = {
  channelType: "slack",
  displayName: "Slack",

  async fetchMessages(_opts) {
    // Implementacao futura: chamada HTTP para o backend que roda
    // scripts/syncSlack.cjs em background. Hoje os dados ja chegam pelo
    // arquivo realDemands.ts via demandsLoader.ts (Vite glob).
    throw new Error("slackAdapter.fetchMessages: ainda nao migrado para API");
  },

  toDemand(msg: ChannelMessage): SlackDemand {
    // Esta logica hoje vive em scripts/syncSlack.cjs. Quando o sync
    // virar API, a conversao migra para ca.
    return {
      id: msg.externalId,
      title: msg.text.split("\n")[0].slice(0, 200),
      description: msg.text,
      priority: "sem_classificacao",
      status: "aberta",
      demandType: "Tarefa/Ajuda",
      workflow: "",
      product: "",
      requester: { name: msg.authorName, avatar: "" },
      assignee: null,
      cc: [],
      createdAt: msg.timestamp,
      dueDate: null,
      completedAt: null,
      hasTask: false,
      taskLink: "",
      tags: [],
      slackChannel: "",
      slackPermalink: msg.permalink || "",
      replies: msg.replies?.length || 0,
      threadReplies: (msg.replies || []).map((r) => ({
        author: r.authorName,
        text: r.text,
        timestamp: r.timestamp,
        isTeamMember: r.isTeamMember,
        hasCheckReaction: r.reactions?.includes("white_check_mark") || false,
      })),
    };
  },
};
