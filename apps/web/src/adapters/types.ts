/**
 * Contrato comum para qualquer canal de chat fonte de demandas.
 *
 * Cada plataforma (Slack, Teams, Discord, WhatsApp, e-mail) implementa
 * este contrato. O resto do sistema (SLA, classificacao, dashboard,
 * relatorios) consome demandas no formato normalizado SlackDemand sem
 * conhecer a origem.
 */
import type { SlackDemand } from "@/types/demand";

export interface ChannelMessage {
  /** ID unico no canal de origem */
  externalId: string;
  /** Texto da mensagem */
  text: string;
  /** Quem enviou */
  authorName: string;
  authorEmail?: string;
  /** Timestamp ISO 8601 */
  timestamp: string;
  /** True se eh membro da equipe interna (vs cliente externo) */
  isTeamMember: boolean;
  /** Reacoes/emojis (Slack reactions, Teams "likes", etc) */
  reactions?: string[];
  /** Thread/respostas aninhadas */
  replies?: ChannelMessage[];
  /** Link permanente para a mensagem na plataforma de origem */
  permalink?: string;
}

export interface DemandAdapter {
  /** Identificador unico do canal: "slack" | "teams" | "discord" | etc */
  readonly channelType: string;
  /** Nome amigavel exibido na UI */
  readonly displayName: string;

  /**
   * Conecta na fonte e busca mensagens recentes.
   * Implementacao tipica: chama API REST ou WebSocket da plataforma.
   */
  fetchMessages(opts: { since?: Date; limit?: number }): Promise<ChannelMessage[]>;

  /**
   * Converte ChannelMessage normalizado em SlackDemand (modelo interno).
   * Aqui aplicam-se regras de negocio: detectar prioridade do prefixo
   * `[P1]`, marcar como "Tarefa/Ajuda" vs "Bug", extrair workflow, etc.
   */
  toDemand(message: ChannelMessage): SlackDemand;

  /**
   * Reage a uma mensagem (ex: marcar com check verde para concluir demanda).
   * Opcional: nem toda plataforma suporta reacoes (e-mail, por exemplo).
   */
  react?(externalId: string, emoji: string): Promise<void>;

  /**
   * Posta resposta em thread.
   * Opcional: alguns canais sao read-only para o sistema.
   */
  reply?(externalId: string, text: string): Promise<void>;
}

/** Helper: converte lista de mensagens em demandas usando o adapter informado. */
export function messagesToDemands(
  adapter: DemandAdapter,
  messages: ChannelMessage[]
): SlackDemand[] {
  return messages.map((m) => adapter.toDemand(m));
}
