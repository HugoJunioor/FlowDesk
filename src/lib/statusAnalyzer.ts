import { DemandStatus, SlackDemand, ThreadReply } from "@/types/demand";

/**
 * Analisador automatico de status por contexto da conversa.
 *
 * Logica (revisada):
 * 1. CONCLUIDA somente via reaction (✅ / 🟢) na thread — fonte unica de verdade.
 *    Texto NUNCA marca concluida (decisao do usuario para evitar falsos positivos).
 * 2. Equipe respondeu com padrao de "estou trabalhando" = EM ANDAMENTO.
 * 3. Sem resposta da equipe = nao altera (continua aberta).
 */

// NOTE: deteccao de CONCLUIDA por texto foi removida. Apenas reaction
// (✅ / 🟢) na thread marca uma demanda como concluida. Isso evita
// falsos positivos em frases como "processado", "executado", etc.

const IN_PROGRESS_PATTERNS = [
  "task criada", "abri no clickup", "vou criar a task", "criei a task",
  "abri uma task", "criada a task", "task aberta",
  "estamos analisando", "em andamento", "trabalhando nisso",
  "vou verificar", "ja estou olhando", "analisando",
  "estou verificando", "vamos analisar", "vamos verificar",
  "em analise", "em tratamento", "em atendimento",
  "ja peguei", "ja assumi", "estou cuidando",
  "vou tratar", "vou resolver", "inicio agora",
  "estamos atuando", "to levantando",
  "app.clickup.com",
];

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function matchPatterns(text: string, patterns: string[]): string[] {
  const norm = normalize(text);
  return patterns.filter((p) => norm.includes(normalize(p)));
}

interface StatusAnalysisResult {
  suggestedStatus: DemandStatus;
  reason: string;
  confidence: "alta" | "media" | "baixa";
  detectedAt: string;
}

export function analyzeThreadStatus(demand: SlackDemand): StatusAnalysisResult | null {
  const allReplies = [...demand.threadReplies].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const teamReplies = allReplies.filter((r) => r.isTeamMember);

  if (teamReplies.length === 0) return null;

  // Caso 0 (PRIORIDADE MAXIMA): Buscar o ULTIMO reaction de conclusao na thread inteira
  // Aceita check (historicas) e circulo verde (novas) como marcador de conclusao
  // Nao filtra por isTeamMember: reacoes sao adicionadas pela equipe em mensagens do cliente
  const checksInThread = allReplies.filter((r) => r.hasCheckReaction);
  if (checksInThread.length > 0) {
    const lastCheck = checksInThread[checksInThread.length - 1];
    return {
      suggestedStatus: "concluida",
      reason: `Concluida via reacao ✅ na mensagem de ${lastCheck.author}. Data: ${new Date(lastCheck.timestamp).toLocaleString("pt-BR")}.`,
      confidence: "alta",
      detectedAt: lastCheck.timestamp,
    };
  }

  // Sem reaction de conclusao na thread:
  // - Detectar apenas EM_ANDAMENTO por padrao de texto da equipe.
  // - NUNCA marcar como concluida por texto (decisao do usuario).
  for (let i = allReplies.length - 1; i >= 0; i--) {
    const reply = allReplies[i];

    if (reply.isTeamMember) {
      const progressMatches = matchPatterns(reply.text, IN_PROGRESS_PATTERNS);
      if (progressMatches.length > 0) {
        return {
          suggestedStatus: "em_andamento",
          reason: `${reply.author} esta trabalhando na demanda: ${progressMatches.slice(0, 3).map(m => `"${m}"`).join(", ")}.`,
          confidence: progressMatches.length >= 2 ? "alta" : "media",
          detectedAt: reply.timestamp,
        };
      }
      break;
    }

    if (!reply.isTeamMember) {
      // Cliente respondeu - buscar ultima resposta da equipe antes
      for (let j = i - 1; j >= 0; j--) {
        if (allReplies[j].isTeamMember) {
          const teamReply = allReplies[j];
          const progressMatches = matchPatterns(teamReply.text, IN_PROGRESS_PATTERNS);
          if (progressMatches.length > 0) {
            return {
              suggestedStatus: "em_andamento",
              reason: `${teamReply.author} esta trabalhando: ${progressMatches.slice(0, 3).map(m => `"${m}"`).join(", ")}.`,
              confidence: "media",
              detectedAt: teamReply.timestamp,
            };
          }

          return {
            suggestedStatus: "em_andamento",
            reason: `${teamReply.author} respondeu mas sem padrao claro de resolucao.`,
            confidence: "baixa",
            detectedAt: teamReply.timestamp,
          };
        }
      }
      break;
    }
  }

  return {
    suggestedStatus: "em_andamento",
    reason: `Equipe respondeu (${teamReplies[teamReplies.length - 1].author}) mas nao foi possivel determinar o status.`,
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
    // Override manual sempre tem prioridade — usuário editou depois
    if (d.manualStatusOverride) return d;

    // Check reaction conclui automaticamente (se não há override manual)
    const hasCheck = d.threadReplies.some((r) => r.hasCheckReaction && r.isTeamMember);
    if (hasCheck) {
      const lastCheck = [...d.threadReplies]
        .filter((r) => r.hasCheckReaction && r.isTeamMember)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

      const lastReply = getLastTeamReply(d);
      return {
        ...d,
        status: "concluida" as DemandStatus,
        completedAt: lastCheck.timestamp,
        lastTeamReply: lastReply,
        statusAnalysis: {
          suggestedStatus: "concluida" as DemandStatus,
          reason: `Concluida via reacao ✅ de ${lastCheck.author}.`,
          confidence: "alta" as const,
          detectedAt: lastCheck.timestamp,
        },
      };
    }
    if (d.status === "concluida" && d.completedAt) return d;

    const lastReply = getLastTeamReply(d);
    const analysis = analyzeThreadStatus(d);

    const result = { ...d, lastTeamReply: lastReply };

    if (analysis) {
      result.statusAnalysis = analysis;
      if (analysis.confidence !== "baixa" && analysis.suggestedStatus !== d.status) {
        result.status = analysis.suggestedStatus;
        if (analysis.suggestedStatus === "concluida") {
          result.completedAt = analysis.detectedAt;
        }
      }
    }

    return result;
  });
}
