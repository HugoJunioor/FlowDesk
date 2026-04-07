import { DemandStatus, SlackDemand, ThreadReply } from "@/types/demand";

/**
 * Analisador automatico de status baseado nas respostas da thread.
 * Interpreta contexto das mensagens da equipe para detectar:
 * - Demanda concluida (resolvida)
 * - Demanda em andamento (task criada, analisando)
 * - Ultima resposta da equipe ao solicitante
 */

const RESOLVED_PATTERNS = [
  "resolvido", "concluido", "concluida", "finalizado", "finalizada",
  "feito", "pronto", "pronta", "ok feito",
  "ja foi ajustado", "ajustado", "corrigido", "corrigida",
  "normalizado", "restabelecido",
  "pode verificar", "pode conferir", "pode testar",
  "ja esta funcionando", "voltou a funcionar", "funcionando normalmente",
  "atualizado com sucesso", "realizado com sucesso", "executado com sucesso",
  "dados corrigidos", "alteracao realizada", "ajuste realizado",
  "executado", "aplicado", "processado",
  "segue ajustado", "segue corrigido", "segue atualizado",
  "problema resolvido", "situacao normalizada",
  "enviado", "encaminhado para o cliente",
  "concluimos", "finalizamos", "realizamos",
];

const IN_PROGRESS_PATTERNS = [
  "task criada", "abri no clickup", "vou criar a task", "criei a task",
  "abri uma task", "criada a task", "task aberta",
  "estamos analisando", "em andamento", "trabalhando nisso",
  "vou verificar", "ja estou olhando", "analisando",
  "estou verificando", "vamos analisar", "vamos verificar",
  "em analise", "em tratamento", "em atendimento",
  "ja peguei", "ja assumi", "estou cuidando",
  "vou tratar", "vou resolver", "inicio agora",
  "app.clickup.com", // link de task
];

const QUESTION_PATTERNS = [
  "?", "pode enviar", "preciso de", "falta informacao",
  "qual", "como", "quando", "poderia",
  "me envia", "consegue enviar", "pode detalhar",
];

interface StatusAnalysisResult {
  suggestedStatus: DemandStatus;
  reason: string;
  confidence: "alta" | "media" | "baixa";
  detectedAt: string;
}

function matchPatterns(text: string, patterns: string[]): string[] {
  const lower = text.toLowerCase();
  return patterns.filter((p) => lower.includes(p));
}

function analyzeReply(reply: ThreadReply): {
  resolvedMatches: string[];
  progressMatches: string[];
  questionMatches: string[];
} {
  return {
    resolvedMatches: matchPatterns(reply.text, RESOLVED_PATTERNS),
    progressMatches: matchPatterns(reply.text, IN_PROGRESS_PATTERNS),
    questionMatches: matchPatterns(reply.text, QUESTION_PATTERNS),
  };
}

export function analyzeThreadStatus(demand: SlackDemand): StatusAnalysisResult | null {
  const teamReplies = demand.threadReplies.filter((r) => r.isTeamMember);

  // No team replies = can't determine
  if (teamReplies.length === 0) return null;

  // Analyze from most recent to oldest (most recent has priority)
  const sorted = [...teamReplies].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const latestReply = sorted[0];
  const analysis = analyzeReply(latestReply);

  // Check for resolution in the latest reply
  if (analysis.resolvedMatches.length > 0) {
    return {
      suggestedStatus: "concluida",
      reason: `Detectado como concluida. Ultima resposta de ${latestReply.author}: identificados termos de resolucao (${analysis.resolvedMatches.slice(0, 3).map(m => `"${m}"`).join(", ")}). A equipe indicou que a demanda foi atendida.`,
      confidence: analysis.resolvedMatches.length >= 2 ? "alta" : "media",
      detectedAt: new Date().toISOString(),
    };
  }

  // Check for in-progress in the latest reply
  if (analysis.progressMatches.length > 0) {
    return {
      suggestedStatus: "em_andamento",
      reason: `Detectado como em andamento. Ultima resposta de ${latestReply.author}: identificados termos de progresso (${analysis.progressMatches.slice(0, 3).map(m => `"${m}"`).join(", ")}). A equipe esta trabalhando na demanda.`,
      confidence: analysis.progressMatches.length >= 2 ? "alta" : "media",
      detectedAt: new Date().toISOString(),
    };
  }

  // Check older replies if latest didn't match clearly
  for (const reply of sorted.slice(1)) {
    const olderAnalysis = analyzeReply(reply);
    if (olderAnalysis.resolvedMatches.length >= 2) {
      return {
        suggestedStatus: "concluida",
        reason: `Detectado como concluida. Resposta anterior de ${reply.author} indica resolucao (${olderAnalysis.resolvedMatches.slice(0, 2).map(m => `"${m}"`).join(", ")}). Nota: a resposta mais recente nao confirmou explicitamente.`,
        confidence: "baixa",
        detectedAt: new Date().toISOString(),
      };
    }
    if (olderAnalysis.progressMatches.length >= 2) {
      return {
        suggestedStatus: "em_andamento",
        reason: `Detectado como em andamento. Resposta anterior de ${reply.author} indica progresso (${olderAnalysis.progressMatches.slice(0, 2).map(m => `"${m}"`).join(", ")}).`,
        confidence: "baixa",
        detectedAt: new Date().toISOString(),
      };
    }
  }

  // Team replied but couldn't determine status
  return {
    suggestedStatus: "em_andamento",
    reason: `A equipe respondeu (${latestReply.author}) mas nao foi possivel determinar o status automaticamente. Ultima mensagem pode ser uma pergunta ou acompanhamento.`,
    confidence: "baixa",
    detectedAt: new Date().toISOString(),
  };
}

export function getLastTeamReply(demand: SlackDemand) {
  const teamReplies = demand.threadReplies.filter((r) => r.isTeamMember);
  if (teamReplies.length === 0) return undefined;

  const sorted = [...teamReplies].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return {
    author: sorted[0].author,
    text: sorted[0].text,
    timestamp: sorted[0].timestamp,
  };
}

export function processDemandsStatus(demands: SlackDemand[]): SlackDemand[] {
  return demands.map((d) => {
    // Skip if manually overridden
    if (d.manualStatusOverride) return d;
    // Skip if already concluida (manual)
    if (d.status === "concluida" && d.completedAt) return d;

    const lastReply = getLastTeamReply(d);
    const analysis = analyzeThreadStatus(d);

    const result = { ...d, lastTeamReply: lastReply };

    if (analysis) {
      result.statusAnalysis = analysis;
      // Apply suggested status if confidence is not baixa
      if (analysis.confidence !== "baixa" && analysis.suggestedStatus !== d.status) {
        result.status = analysis.suggestedStatus;
        if (analysis.suggestedStatus === "concluida" && lastReply) {
          result.completedAt = lastReply.timestamp;
        }
      }
    }

    return result;
  });
}
