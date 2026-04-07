import { DemandPriority } from "@/types/demand";

/**
 * Classificador automatico de prioridade baseado no documento:
 * "Definicoes de Prioridades de Atendimento - SLA"
 *
 * P1 - Incidentes Criticos:
 *   Interrupcao total dos servicos essenciais, impactando maioria dos usuarios ou sistemas criticos.
 *   Exemplos: sistema de producao indisponivel, falha generalizada de rede, corrupcao de dados em larga escala.
 *
 * P2 - Incidentes de Alta Prioridade:
 *   Interrupcao parcial ou afeta grupo significativo de usuarios. Urgente mas nao impede totalmente a operacao.
 *   Exemplos: degradacao significativa de desempenho, funcionalidade importante com problema, erros em grupos especificos.
 *
 * P3 - Incidentes de Media Prioridade:
 *   Impactos menores, nao criticos, nao impedem uso do sistema. Processos normais de suporte.
 *   Exemplos: solicitacoes de alteracao, problemas menores, questoes esteticas/usabilidade.
 */

// Keywords and patterns for each priority level
const P1_KEYWORDS = [
  "indisponivel", "fora do ar", "caiu", "parou", "down", "offline",
  "corrupcao", "corrompido", "perda de dados", "dados perdidos",
  "falha generalizada", "falha total", "falha critica",
  "todos os usuarios", "ninguem consegue", "nenhum usuario",
  "sistema parado", "producao parada", "emergencia",
  "fraude", "seguranca comprometida", "invasao", "vazamento",
  "bloqueio total", "inacessivel", "timeout geral",
  "processamento parou", "lote nao processado",
  "rede caiu", "servidor caiu",
];

const P2_KEYWORDS = [
  "lento", "lentidao", "degradacao", "performance",
  "erro", "bug", "falha", "falhando", "nao funciona",
  "parcialmente", "intermitente", "instavel",
  "grupo de usuarios", "alguns usuarios", "clientes afetados",
  "calculo incorreto", "valor errado", "divergencia",
  "integracao falhando", "api falhando", "timeout",
  "email nao envia", "notificacao parou",
  "relatorio desatualizado", "dados desatualizados",
  "funcionalidade importante", "modulo com problema",
  "pagamento", "faturamento", "cobranca",
  "cliente cobrando", "desgaste", "urgente",
  "qr code", "cartao bloqueado", "cartao com problema",
];

const P3_KEYWORDS = [
  "alteracao", "ajuste", "modificacao", "atualizacao",
  "cadastro", "cadastrar", "adicionar campo",
  "relatorio", "exportar", "gerar relatorio",
  "layout", "visual", "estetico", "desalinhado", "aparencia",
  "documentacao", "template", "modelo",
  "configurar", "configuracao", "ambiente",
  "permissao", "acesso", "perfil",
  "melhoria", "sugestao", "solicitacao",
  "treinamento", "onboarding",
  "novo estabelecimento", "rede credenciada",
  "tarifa", "tabela de precos", "contrato",
  "cpf", "cnpj", "dados cadastrais",
];

interface ClassificationResult {
  priority: DemandPriority;
  confidence: "alta" | "media" | "baixa";
  reason: string;
  matchedKeywords: string[];
}

function countMatches(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw));
}

export function classifyDemand(title: string, description: string): ClassificationResult {
  const fullText = `${title} ${description}`.toLowerCase();

  const p1Matches = countMatches(fullText, P1_KEYWORDS);
  const p2Matches = countMatches(fullText, P2_KEYWORDS);
  const p3Matches = countMatches(fullText, P3_KEYWORDS);

  const p1Score = p1Matches.length * 3; // Peso maior para P1
  const p2Score = p2Matches.length * 2;
  const p3Score = p3Matches.length * 1;

  // P1: interrupcao total, sistemas criticos
  if (p1Score >= 3) {
    return {
      priority: "p1",
      confidence: p1Score >= 6 ? "alta" : "media",
      reason: generateReason("p1", p1Matches, title),
      matchedKeywords: p1Matches,
    };
  }

  // P2: interrupcao parcial, erros, performance
  if (p2Score >= 4 || (p2Score >= 2 && p1Score >= 1)) {
    return {
      priority: "p2",
      confidence: p2Score >= 6 ? "alta" : "media",
      reason: generateReason("p2", p2Matches, title),
      matchedKeywords: p2Matches,
    };
  }

  // P3: alteracoes, ajustes, solicitacoes
  if (p3Score >= 1) {
    return {
      priority: "p3",
      confidence: p3Score >= 3 ? "alta" : p3Score >= 2 ? "media" : "baixa",
      reason: generateReason("p3", p3Matches, title),
      matchedKeywords: p3Matches,
    };
  }

  // Se P2 teve algum match
  if (p2Score >= 2) {
    return {
      priority: "p2",
      confidence: "baixa",
      reason: generateReason("p2", p2Matches, title),
      matchedKeywords: p2Matches,
    };
  }

  // Sem classificacao clara
  return {
    priority: "sem_classificacao",
    confidence: "baixa",
    reason: "Nao foi possivel classificar automaticamente. Nenhum padrao identificado no titulo ou descricao.",
    matchedKeywords: [],
  };
}

function generateReason(priority: DemandPriority, matches: string[], title: string): string {
  const keywordsText = matches.slice(0, 3).map((k) => `"${k}"`).join(", ");

  switch (priority) {
    case "p1":
      return `Classificado como P1 (Critico) — Identificados indicadores de interrupcao total ou impacto critico: ${keywordsText}. Conforme SLA: incidentes que causam interrupcao total dos servicos essenciais, impactando a maioria dos usuarios. Resposta: 15min, Resolucao: 4h.`;

    case "p2":
      return `Classificado como P2 (Alta) — Identificados indicadores de interrupcao parcial ou impacto significativo: ${keywordsText}. Conforme SLA: incidentes que causam interrupcao parcial dos servicos ou afetam um grupo significativo de usuarios. Resposta: 1h, Resolucao: 8h.`;

    case "p3":
      return `Classificado como P3 (Media) — Identificados indicadores de solicitacao ou impacto menor: ${keywordsText}. Conforme SLA: incidentes com impactos menores, nao criticos, que nao impedem o uso do sistema. Resposta: 4h, Resolucao: 24h.`;

    default:
      return "Sem classificacao automatica.";
  }
}
