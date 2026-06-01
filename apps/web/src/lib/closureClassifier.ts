import {
  SlackDemand, DemandCategory, ContactReason, ExpirationReason, SupportLevel,
  ClosureFields, SUPPORT_LEVEL_MEMBERS, PRIORITY_CONFIG,
} from "@/types/demand";
import { addBusinessHours, getBusinessMinutesBetween } from "./businessHours";

/**
 * Classificador automatico de campos de fechamento.
 *
 * Categoria: analisa titulo + descricao para identificar area
 * Nivel de suporte: analisa quem resolveu (mapeamento N1/N2/N3 em SUPPORT_LEVEL_MEMBERS, branding.local.ts)
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

    // Team replied last = analisar o que disse
    if (lastReply.isTeamMember) {
      const lastText = lastReply.text.toLowerCase();

      // Equipe pediu para o CLIENTE verificar/testar = aguardando feedback do cliente
      if (
        lastText.includes("pode verificar") ||
        lastText.includes("pode testar") ||
        lastText.includes("pode conferir") ||
        lastText.includes("pode validar") ||
        lastText.includes("tenta novamente") ||
        lastText.includes("tente novamente")
      ) {
        return { value: "Demora para validar a correcao", confidence: "alta" };
      }

      // Equipe prometeu verificar/retornar e nao voltou = falta de retorno DA EQUIPE
      const teamPromisedReturn =
        /\bvou\s+(verificar|conferir|analisar|olhar|checar|avaliar|investigar|ver)\b/i.test(lastReply.text) ||
        /\bvamos\s+(verificar|conferir|analisar|olhar|checar|avaliar|investigar)\b/i.test(lastReply.text) ||
        /\bretorno\s+(em breve|assim que|logo|em seguida|mais tarde)\b/i.test(lastReply.text) ||
        /\bja\s+te\s+retorno\b/i.test(lastReply.text) ||
        /\bja\s+retorno\b/i.test(lastReply.text) ||
        /\bvou\s+dar\s+uma\s+olhada\b/i.test(lastReply.text) ||
        /\bem\s+analise\b/i.test(lastReply.text) ||
        /\bestou\s+(verificando|analisando|olhando|checando)\b/i.test(lastReply.text) ||
        /\bencaminhe?i?\s+(para|ao|internamente)\b/i.test(lastReply.text) ||
        /\bescale?i?\s+(para|internamente|com a equipe)\b/i.test(lastReply.text);

      if (teamPromisedReturn) {
        return { value: "Falta de retorno da equipe", confidence: "alta" };
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
  const contactReason = classifyContactReason(demand);

  return {
    category: category.value,
    contactReason: contactReason.value || undefined,
    expirationReason: expirationReason.value,
    supportLevel: supportLevel.value,
    internalComment: "",
    autoFilled: {
      category: !!category.value,
      contactReason: !!contactReason.value,
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

// === CONTACT REASON CLASSIFIER ===
// Mapeamento de motivo -> keywords derivado dos 158 titulos rotulados na
// planilha "Analise_Motivos_Contato_Abril2026.xlsx". Keywords sao
// normalizadas (lowercase, sem acentos) — texto da demanda passa pelo
// mesmo normalize antes de comparar.

const CONTACT_REASON_KEYWORDS: Record<Exclude<ContactReason, "">, string[]> = {
  "Saldo Nao Creditado / Pagamento Nao Compensado": [
    "saldo nao", "saldo indispon", "nao creditou", "compensou", "compensaç",
    "compensac", "conta tesouro", "carteira nao encontrada", "carteira negativada",
    "qr code", "saldo dispon", "credito nao", "extrato conta tesouro",
    "saldos dashboard", "saldo em cadastro", "consultar saldo",
    "pagamento nao confirmado",
  ],
  "Falha na Vinculacao / Uso de Cartao": [
    "vincular", "vinculaç", "vinculac", "falha ao vincular", "falha cartao",
    "falha cartão", "cartao nao passa", "cartão nao passa", "cartoes rejeitad",
    "tah nao encontrad", "bag nao encontrad", "cartao despesa", "cartão despesa",
    "combo voucher", "combovoucher", "vincular cartao", "vincular cartão",
    "erro ao vincular",
  ],
  "Duvida / Solicitacao Interna / Outros": [
    "compra negada", "duvida", "dúvida", "ajuda", "valid", "ajuste valor",
    "ajuste - app", "dx academy", "medida correta", "artes graficas",
    "inclusao de cidade", "destaxa", "ajuste app interno",
  ],
  "Estorno / Reembolso / Cancelamento de Transacao": [
    "estorno", "reembolso", "cancelamento", "cancelar", "duplicada", "duplicado",
    "transacao duplicada", "transação duplicada", "venda duplicada",
    "vendas duplicadas", "cancelar lote", "estorno mastercard", "estorno saque",
    "remessa cancelamento", "remessas de contas",
  ],
  "Problema com PIX": [
    "pix",
  ],
  "Ajuste de Dados Cadastrais (CPF / Nome)": [
    "cpf", "alteracao de dados", "alteração de dados", "alterar cadastro",
    "dados errado", "ajuste de cadastro", "correcao de cadastro",
    "correção de cadastro", "ajustes de cpf", "transferencia de cartao",
    "transferência de cartão", "transferencia de creditos",
  ],
  "Bug em Importacao / Relatorio de Abastecimento": [
    "importacao", "importação", "log abastecimento", "listar abastecimento",
    "duplicidade de id", "duplicidade autorizacao", "duplicidade autorização",
    "verificacao abastecimentos", "verificação abastecimentos",
    "plano de manutencao", "plano de manutenção", "importacao de usuarios",
    "importação de usuários", "log - import",
  ],
  "Erro Fiscal (NF, Boleto, RPS, DANFE)": [
    "nota fiscal", "nf ", "danfe", "boleto", "rps", "sefaz",
    "uf do tomador", "comprovante", "divergencia de cnpj",
    "divergência de cnpj", "geracao de boletos", "geração de boletos",
    "emitir nota", "emissao de nota", "emissão de nota", "fechamento contabil",
    "fechamento contábil",
  ],
  "Solicitacao de Relatorio / Extrato": [
    "relatorio", "relatório", "extrato", "exportar relatorio",
    "exportar relatório", "composicao custo", "composição custo",
    "composicao de custo", "venda_id", "tra_id",
  ],
  "Retirada / Transferencia de Saldo": [
    "retirada", "retirar saldo", "retirada de saldo", "retirada de valor",
  ],
  "Problema de Conciliacao / Layout de Arquivo": [
    "conciliac", "conciliaç", "layout arquivo", "layout xcard", "netunna",
    "habilitacao arquivos", "habilitação arquivos", "alinhamento", "boa vista",
  ],
  "Cadastro Duplicado / Exclusao": [
    "cadastro duplicado", "exclusao de cadastro", "exclusão de cadastro",
    "duplicar account", "cadastros duplicad",
  ],
  "Erro de Acesso (App, Portal, Senha)": [
    "access denied", "senha", "erro ao logar", "erro logar", "erro internet",
    "concluir cadastro da senha",
  ],
  "Lentidao / Instabilidade de Sistema": [
    "lentidao", "lentidão", "lento", "instabilidade", "conexao inoperante",
    "conexão inoperante", "backoffice com lentidao",
  ],
  "Solicitacao / Gestao de Acesso e Permissoes": [
    "liberacao para edicao", "liberação para edição", "acesso master",
    "acesso segregado", "perfil caixa", "servidor sitef", "solicitacao de acesso",
    "solicitação de acesso", "gestao de acesso", "gestão de acesso",
  ],
  "Falha no Envio de Token / E-mail": [
    "token", "push notifications", "e-mail com falha", "notificacao de consulta",
    "notificação de consulta",
  ],
  "Erro em Abastecimento / Autorizacao": [
    "autorizar abastecimento", "bombas internas", "rodofrota", "app externo",
    "inconsistencia notada", "inconsistência notada",
  ],
  "Bug / Erro de Sistema (Outros)": [
    "portal de despesa", "encerrar atendimento", "anexar comprovante",
    "anexar despesa", "erro portal",
  ],
  "Falha no Saque (24h / ATM)": [
    "saque", "sacar", "24h", "atm",
  ],
  "KYC Reprovado / Falha de Identidade": [
    "kyc",
  ],
  "Erro em Fechamento de Periodo / Faturamento": [
    "fechamento periodo", "fechamento período", "fechar somente recolhidas",
    "faturamento",
  ],
};

/**
 * Normaliza texto pra matching: lowercase + remove acentos.
 * Mantem espacos e caracteres soltos pra preservar fronteiras de palavras.
 */
function normalizeText(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Classifica o motivo de contato baseado no titulo + descricao da demanda.
 * Algoritmo: keyword matching com score = numero de matches. Ganha o motivo
 * com maior score. Empate: ordem da lista (mais especifico primeiro).
 *
 * Confianca:
 * - alta: 2+ keywords matchando
 * - media: 1 keyword match (mas > 0 score)
 * - baixa: 0 matches → retorna "" (sem classificacao)
 */
export function classifyContactReason(demand: SlackDemand): {
  value: ContactReason;
  confidence: "alta" | "media" | "baixa";
  matchedKeywords: string[];
} {
  const text = normalizeText(`${demand.title} ${demand.description}`);

  let bestReason: ContactReason = "";
  let bestScore = 0;
  let bestMatches: string[] = [];

  for (const [reason, keywords] of Object.entries(CONTACT_REASON_KEYWORDS)) {
    const matches = keywords.filter((kw) => text.includes(normalizeText(kw)));
    if (matches.length > bestScore) {
      bestScore = matches.length;
      bestReason = reason as ContactReason;
      bestMatches = matches;
    }
  }

  return {
    value: bestReason,
    confidence: bestScore >= 2 ? "alta" : bestScore === 1 ? "media" : "baixa",
    matchedKeywords: bestMatches,
  };
}
