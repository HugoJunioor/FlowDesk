import {
  SlackDemand, DemandCategory, ExpirationReason, SupportLevel,
  ClosureFields, SUPPORT_LEVEL_MEMBERS, PRIORITY_CONFIG,
} from "@/types/demand";
import { addBusinessHours, getBusinessMinutesBetween } from "./businessHours";

/**
 * Classificador automatico de campos de fechamento.
 *
 * Categoria: analisa titulo + descricao para identificar area
 * Nivel de suporte: analisa quem resolveu (N1=Bruna/Schai, N2=Daniel/Hugo, N3=Rafa/Cezar/Erick/Gabriel)
 * Motivo de expiracao: analisa contexto da thread quando SLA estourou
 */

// === CATEGORY CLASSIFIER ===
const CATEGORY_KEYWORDS: Record<DemandCategory, string[]> = {
  "Portal do cliente": ["portal", "login portal", "acesso portal", "portal do cliente", "portal web"],
  "Aplicativo": ["app", "aplicativo", "mobile", "celular", "android", "ios", "tela do app"],
  "Backoffice": ["backoffice", "bko", "back office", "painel admin", "admin"],
  "Cadastro": ["cadastro", "cpf", "cnpj", "dados cadastrais", "alteracao de dados", "registro", "duplicado", "exclusao de cadastro"],
  "Cartao": ["cartao", "cartão", "vincular cartao", "bloqueio cartao", "desbloqueio", "cartao virtual"],
  "Carteiras/Produto": ["carteira", "wallet", "produto", "saldo carteira", "negativada"],
  "Faturas": ["fatura", "cobranca", "mensalidade"],
  "KYC": ["kyc", "know your customer", "verificacao identidade", "documentos", "selfie"],
  "Transacao": ["transacao", "compra", "compra negada", "autorizacao", "pix", "transferencia", "ted", "pagamento recusado"],
  "Relatorio": ["relatorio", "report", "exportar", "exportacao", "dashboard", "bi", "dados consolidados"],
  "SMS": ["sms", "mensagem texto", "torpedo", "notificacao sms"],
  "Conta Tesouro": ["tesouro", "conta tesouro", "treasury", "conta principal"],
  "Boleto": ["boleto", "boleto bancario", "codigo de barras"],
  "NF": ["nota fiscal", "nf", "nfe", "nfs", "emitir nota", "nota de servico"],
  "Saldo": ["saldo", "retirada de saldo", "recarrega", "recarga", "credito", "reembolso"],
  "Pagamento": ["pagamento", "pagar", "gateway", "meio de pagamento", "checkout"],
  "": [],
};

export function classifyCategory(demand: SlackDemand): { value: DemandCategory; confidence: "alta" | "media" | "baixa" } {
  const text = `${demand.title} ${demand.description}`.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  let bestCategory: DemandCategory = "";
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (!keywords.length) continue;
    const matches = keywords.filter(kw =>
      text.includes(kw.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    );
    const score = matches.length;
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category as DemandCategory;
    }
  }

  return {
    value: bestCategory,
    confidence: bestScore >= 3 ? "alta" : bestScore >= 2 ? "media" : bestScore >= 1 ? "baixa" : "baixa",
  };
}

// === SUPPORT LEVEL CLASSIFIER ===
export function classifySupportLevel(demand: SlackDemand): { value: SupportLevel; confidence: "alta" | "media" | "baixa" } {
  const allReplies = [...demand.threadReplies].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Check for explicit N3 escalation in thread
  const fullText = allReplies.map(r => r.text).join(" ").toLowerCase();
  if (fullText.includes("escalar para n3") || fullText.includes("escalar n3") ||
      fullText.includes("mais complexa") || fullText.includes("demanda complexa") ||
      fullText.includes("precisaremos escalar")) {
    return { value: "N3", confidence: "alta" };
  }

  // Check who resolved based on team replies (most recent first)
  const teamReplies = allReplies.filter(r => r.isTeamMember);

  for (const reply of teamReplies) {
    // Check author name against known members
    for (const [name, level] of Object.entries(SUPPORT_LEVEL_MEMBERS)) {
      if (reply.author.toLowerCase().includes(name.toLowerCase())) {
        return { value: level, confidence: "alta" };
      }
    }
  }

  // Check assignee
  if (demand.assignee) {
    for (const [name, level] of Object.entries(SUPPORT_LEVEL_MEMBERS)) {
      if (demand.assignee.name.toLowerCase().includes(name.toLowerCase())) {
        return { value: level, confidence: "media" };
      }
    }
  }

  return { value: "", confidence: "baixa" };
}

// === EXPIRATION REASON CLASSIFIER ===
export function classifyExpirationReason(demand: SlackDemand): { value: ExpirationReason; confidence: "alta" | "media" | "baixa" } {
  // Only classify if SLA is expired
  if (demand.priority === "sem_classificacao") return { value: "", confidence: "baixa" };

  const config = PRIORITY_CONFIG[demand.priority];
  if (!config.sla) return { value: "", confidence: "baixa" };

  const due = addBusinessHours(new Date(demand.createdAt), config.sla.resolutionHours);
  const isExpired = getBusinessMinutesBetween(new Date(), due) <= 0;

  if (!isExpired && demand.status !== "expirada") return { value: "", confidence: "baixa" };

  const allReplies = [...demand.threadReplies].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const teamReplies = allReplies.filter(r => r.isTeamMember);
  const clientReplies = allReplies.filter(r => !r.isTeamMember);
  const fullText = allReplies.map(r => r.text).join(" ").toLowerCase();

  // Explicit mentions in thread
  if (fullText.includes("demanda complexa") || fullText.includes("mais complexa") || fullText.includes("escalar")) {
    return { value: "Demanda complexa", confidence: "alta" };
  }
  if (fullText.includes("fora do escopo") || fullText.includes("nao e nossa responsabilidade")) {
    return { value: "Demanda fora do escopo", confidence: "alta" };
  }
  if (fullText.includes("dependencia") || fullText.includes("terceiro") || fullText.includes("fornecedor")) {
    return { value: "Dependencia de terceiros", confidence: "media" };
  }
  if (fullText.includes("muitas demandas") || fullText.includes("fila") || fullText.includes("volume alto")) {
    return { value: "Muitas demandas juntas", confidence: "media" };
  }

  // Analyze conversation flow
  if (teamReplies.length === 0) {
    return { value: "Demora no primeiro atendimento", confidence: "alta" };
  }

  // Check if last message is from team waiting for client
  if (allReplies.length > 0) {
    const lastReply = allReplies[allReplies.length - 1];
    const secondLast = allReplies.length > 1 ? allReplies[allReplies.length - 2] : null;

    // Team replied last = waiting for client
    if (lastReply.isTeamMember) {
      const lastText = lastReply.text.toLowerCase();
      if (lastText.includes("pode verificar") || lastText.includes("pode testar") || lastText.includes("pode conferir")) {
        return { value: "Demora para validar a correcao", confidence: "alta" };
      }
      return { value: "Falta de retorno do cliente", confidence: "media" };
    }

    // Client replied last = check if team was slow
    if (!lastReply.isTeamMember && secondLast && !secondLast.isTeamMember) {
      // Multiple client messages without team response
      return { value: "Demora no retorno da equipe", confidence: "media" };
    }

    // Client asked, team took too long
    if (!lastReply.isTeamMember && teamReplies.length > 0) {
      const lastTeam = teamReplies[teamReplies.length - 1];
      const timeBetween = new Date(lastReply.timestamp).getTime() - new Date(lastTeam.timestamp).getTime();
      if (timeBetween > 24 * 3600000) {
        return { value: "Falta de retorno do cliente", confidence: "baixa" };
      }
      return { value: "Demora no retorno da equipe", confidence: "baixa" };
    }
  }

  return { value: "Falta de retorno da equipe", confidence: "baixa" };
}

// === MAIN: Classify all closure fields ===
export function classifyClosureFields(demand: SlackDemand): ClosureFields {
  const category = classifyCategory(demand);
  const supportLevel = classifySupportLevel(demand);
  const expirationReason = classifyExpirationReason(demand);

  return {
    category: category.value,
    expirationReason: expirationReason.value,
    supportLevel: supportLevel.value,
    internalComment: "",
    autoFilled: {
      category: !!category.value,
      expirationReason: !!expirationReason.value,
      supportLevel: !!supportLevel.value,
    },
  };
}

// === REPORT: Fields that need human review ===
export interface BlankFieldReport {
  demandId: string;
  title: string;
  channel: string;
  missingFields: string[];
}

export function generateBlankFieldsReport(demands: SlackDemand[]): BlankFieldReport[] {
  const report: BlankFieldReport[] = [];

  for (const d of demands) {
    if (d.status !== "concluida" && d.status !== "expirada") continue;

    const closure = d.closure || classifyClosureFields(d);
    const missing: string[] = [];

    if (!closure.category) missing.push("Categoria");
    if (!closure.supportLevel) missing.push("Nivel de suporte");
    // expirationReason only required when expired
    if (d.status === "expirada" && !closure.expirationReason) missing.push("Motivo de expiracao");

    if (missing.length > 0) {
      report.push({
        demandId: d.id,
        title: d.title.slice(0, 60),
        channel: d.slackChannel,
        missingFields: missing,
      });
    }
  }

  return report;
}
