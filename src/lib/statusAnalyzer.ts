import { DemandStatus, SlackDemand, ThreadReply } from "@/types/demand";

/**
 * Analisador automatico de status por contexto da conversa.
 *
 * Logica:
 * 1. Equipe da retorno tecnico -> cliente agradece = CONCLUIDA (data do retorno da equipe)
 * 2. Equipe responde com padrao de resolucao direto = CONCLUIDA
 * 3. Equipe respondeu que esta analisando/trabalhando = EM ANDAMENTO
 * 4. Sem resposta da equipe = nao altera
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
  "concluimos", "finalizamos", "realizamos",
  "segue o retorno", "segue retorno",
  "efetuado", "ja foi feito",
  "procedimento executado", "procedimento realizado",
  "fiz testes", "testei", "teste realizado",
  "esta ok", "tudo certo", "tudo ok",
  "alteracao feita", "troca realizada", "troca feita",
  "cadastrado com sucesso", "cadastrado", "cadastro realizado",
  "bloqueado", "desbloqueado", "liberado",
  // Encaminhamento/redirecionamento = resolvido nesta thread
  "vou continuar", "continuar a tratativa", "tratativa em outro",
  "vamos tratar por", "tratar em outro canal", "tratar no privado",
  "encaminhei", "encaminhado", "direcionei", "direcionado",
  "abri uma demanda", "abri no canal", "vou tratar no",
  "segue no canal", "segue em outro", "vou direcionar",
  "transferi", "transferido", "movi para",
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
  "estamos atuando", "to levantando",
  "app.clickup.com",
];

const GRATITUDE_PATTERNS = [
  "obrigada", "obrigado", "obg", "vlw", "valeu",
  "certinho", "perfeito", "show", "top", "massa",
  "verificado", "deu certo", "funcionou", "ok",
  "confirmado", "certo", "beleza",
  "muito obrigada", "muito obrigado",
  "agradeco",
];

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function matchPatterns(text: string, patterns: string[]): string[] {
  const norm = normalize(text);
  return patterns.filter((p) => norm.includes(normalize(p)));
}

function isGratitude(text: string): boolean {
  return matchPatterns(text, GRATITUDE_PATTERNS).length > 0;
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

  // Percorre de tras pra frente
  for (let i = allReplies.length - 1; i >= 0; i--) {
    const reply = allReplies[i];

    // Caso 1: Ultima msg e da equipe com padrao de resolucao
    if (reply.isTeamMember) {
      const resolvedMatches = matchPatterns(reply.text, RESOLVED_PATTERNS);
      if (resolvedMatches.length > 0) {
        return {
          suggestedStatus: "concluida",
          reason: `Detectado como concluida. ${reply.author} resolveu a demanda: ${resolvedMatches.slice(0, 3).map(m => `"${m}"`).join(", ")}. Concluida em ${new Date(reply.timestamp).toLocaleString("pt-BR")}.`,
          confidence: resolvedMatches.length >= 2 ? "alta" : "media",
          detectedAt: reply.timestamp,
        };
      }

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

    // Caso 2: Ultima msg e do cliente
    if (!reply.isTeamMember) {
      const clientIsGrateful = isGratitude(reply.text);

      if (clientIsGrateful) {
        // Cliente agradeceu - buscar resposta da equipe ANTERIOR
        for (let j = i - 1; j >= 0; j--) {
          if (allReplies[j].isTeamMember) {
            const teamReply = allReplies[j];
            return {
              suggestedStatus: "concluida",
              reason: `Concluida via contexto: ${teamReply.author} deu o retorno e ${reply.author} confirmou/agradeceu ("${reply.text.slice(0, 40)}"). Data da conclusao: ${new Date(teamReply.timestamp).toLocaleString("pt-BR")} (resposta da equipe).`,
              confidence: "alta",
              detectedAt: teamReply.timestamp,
            };
          }
        }
      }

      // Cliente nao agradeceu - buscar ultima resposta da equipe antes
      for (let j = i - 1; j >= 0; j--) {
        if (allReplies[j].isTeamMember) {
          const teamReply = allReplies[j];
          const resolvedMatches = matchPatterns(teamReply.text, RESOLVED_PATTERNS);
          if (resolvedMatches.length > 0) {
            return {
              suggestedStatus: "concluida",
              reason: `${teamReply.author} resolveu: ${resolvedMatches.slice(0, 3).map(m => `"${m}"`).join(", ")}. Cliente respondeu depois sem confirmar explicitamente.`,
              confidence: "media",
              detectedAt: teamReply.timestamp,
            };
          }

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
    if (d.manualStatusOverride) return d;
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
