#!/usr/bin/env node
/**
 * classifyHistoricalDemands.js
 * Rules-based classifier for historicalDemands.json
 * Fills closure.category and closure.supportLevel where empty.
 */

const fs = require("fs");
const path = require("path");

const JSON_PATH = path.resolve(
  "C:/Users/hugoc/Documents/op-es-suaves/src/data/historicalDemands.json"
);
const TS_PATH = path.resolve(
  "C:/Users/hugoc/Documents/op-es-suaves/src/data/historicalDemands.ts"
);

// ---------------------------------------------------------------------------
// Category rules — ordered by specificity (most specific first)
// Each rule: { category, keywords[] }  — keyword matched against lowercased text
// ---------------------------------------------------------------------------
const CATEGORY_RULES = [
  // --- Nota Fiscal (must come before Faturas to avoid overlap) ---
  {
    category: "Nota Fiscal",
    keywords: [
      "nota fiscal",
      "nf-e",
      "nfe",
      "danfe",
      "emissão de nota",
      "emitir nota",
      "nota de serviço",
      "nfs-e",
      "nfse",
      "xml da nota",
      "cancelamento de nota",
      "nota cancelada",
    ],
  },
  // --- KYC ---
  {
    category: "KYC",
    keywords: [
      "kyc",
      "documento",
      "identidade",
      "aprovação de cadastro",
      "reprovado",
      "reprovou",
      "validação de documento",
      "biometria",
      "selfie",
      "rg ",
      " cnh",
      "cnh ",
      "comprovante de residência",
      "due diligence",
      "verificação de identidade",
      "análise de cadastro",
      "aprovado kyc",
      "reprovado kyc",
    ],
  },
  // --- Primeiro acesso ---
  {
    category: "Primeiro acesso",
    keywords: [
      "primeiro acesso",
      "primeiro login",
      "nunca acessou",
      "ainda não acessou",
      "não consegue acessar pela primeira",
      "criar senha inicial",
      "ativar conta",
      "ativação de conta",
      "conta ainda não ativada",
    ],
  },
  // --- Acesso RH ---
  {
    category: "Acesso RH",
    keywords: [
      "acesso rh",
      "portal rh",
      "sistema rh",
      "módulo rh",
      "gestão de rh",
      "recursos humanos",
      "holerite",
      "contracheque",
      "folha de pagamento",
      "benefício",
      "benefícios",
    ],
  },
  // --- Cadastro colaborador ---
  {
    category: "Cadastro colaborador",
    keywords: [
      "cadastrar colaborador",
      "cadastro de colaborador",
      "importar colaborador",
      "importar usuário",
      "importação de colaborador",
      "cadastrar funcionário",
      "novo colaborador",
      "colaborador novo",
      "adicionar colaborador",
      "cadastrar empregado",
      "inclusão de colaborador",
      "onboarding colaborador",
      "cadastro de funcionário",
      "cadastrar empregados",
    ],
  },
  // --- Carteiras/Produto ---
  {
    category: "Carteiras/Produto",
    keywords: [
      "carteira",
      "produto financeiro",
      "portfólio",
      "carteiras",
      "produto carteira",
      "gestão de carteira",
    ],
  },
  // --- Conta Tesouro ---
  {
    category: "Conta Tesouro",
    keywords: [
      "conta tesouro",
      "tesouro direto",
      "tesouro nacional",
      "título tesouro",
      "investimento tesouro",
    ],
  },
  // --- Cartão ---
  {
    category: "Cartão",
    keywords: [
      "cartão",
      "card",
      "vincular cartão",
      "bloquear cartão",
      "desbloqu",
      "senha do cartão",
      "senha cartão",
      "cartão bloqueado",
      "cartão físico",
      "cartão virtual",
      "solicitar cartão",
      "pedir cartão",
      "segunda via",
      "2ª via",
    ],
  },
  // --- Faturas ---
  {
    category: "Faturas",
    keywords: [
      "fatura",
      "boleto",
      "cobrança",
      "emissão de boleto",
      "faturamento",
      "nota de débito",
      "invoice",
      "iss",
      "alíquota",
      "regime tributário",
    ],
  },
  // --- Transação ---
  {
    category: "Transação",
    keywords: [
      "transação",
      "transações",
      "pix",
      "pagamento",
      "pagamentos",
      "saque",
      "retirada",
      "débito",
      "crédito",
      "transferência",
      "ted",
      "doc",
      "depósito",
      "recebimento",
      "cobrança pix",
      "estorno",
      "reversão",
      "chargeback",
    ],
  },
  // --- Saldo ---
  {
    category: "Saldo",
    keywords: [
      "saldo",
      "extrato",
      "disponível",
      "limite",
      "posição financeira",
      "consulta de saldo",
      "ver saldo",
    ],
  },
  // --- SMS ---
  {
    category: "SMS",
    keywords: [
      "sms",
      "mensagem de texto",
      "token sms",
      "código sms",
      "não recebi sms",
      "sms não chegou",
      "validação sms",
    ],
  },
  // --- App ---
  {
    category: "App",
    keywords: [
      "app",
      "aplicativo",
      "mobile",
      "celular",
      "android",
      "ios",
      "iphone",
      "smartphone",
      "instalar app",
      "atualizar app",
      "app travar",
      "app não abre",
      "app caindo",
    ],
  },
  // --- Relatório ---
  {
    category: "Relatório",
    keywords: [
      "relatório",
      "relatórios",
      "exportar",
      "exportação",
      "download",
      "arquivo",
      "planilha",
      "csv",
      "excel",
      "xlsx",
      "pdf relatório",
      "gerar arquivo",
    ],
  },
  // --- Integração ---
  {
    category: "Integração",
    keywords: [
      "integração",
      "integrar",
      "api",
      "webhook",
      "sincronização",
      "sincronizar",
      "endpoint",
      "erp",
      "totvs",
      "sap",
      "omie",
      "netsuite",
      "conexão sistema",
    ],
  },
  // --- Conciliação ---
  {
    category: "Conciliação",
    keywords: [
      "conciliação",
      "conciliar",
      "remessa",
      "fechamento",
      "reconciliação",
      "retorno bancário",
      "arquivo de retorno",
      "cnab",
      "liquidação",
    ],
  },
  // --- Backoffice (catch-all for portal/system issues) ---
  {
    category: "Backoffice",
    keywords: [
      "backoffice",
      "back office",
      "portal",
      "painel",
      "sistema",
      "tela ",
      "plataforma",
      "dashboard",
      "módulo",
      "configuração do sistema",
      "permissão",
      "perfil de acesso",
      "usuário no sistema",
    ],
  },
  // --- Cadastro (generic — must come after more specific cadastro rules) ---
  {
    category: "Cadastro",
    keywords: [
      "cadastro",
      "cadastrar",
      "atualizar dados",
      "alterar dados",
      "dados cadastrais",
      "registro",
      "conta nova",
      "abrir conta",
      "cnpj",
      "cpf",
    ],
  },
  // --- Acesso (generic access/login — after "Primeiro acesso" and "Acesso RH") ---
  {
    category: "Acesso",
    keywords: [
      "acesso",
      "login",
      "senha",
      "autenticação",
      "usuário",
      "redefinir senha",
      "resetar senha",
      "esqueci minha senha",
      "bloqueio de acesso",
      "não consigo entrar",
      "não consigo acessar",
      "token",
      "2fa",
      "autenticador",
    ],
  },
];

// ---------------------------------------------------------------------------
// Support level rules
// ---------------------------------------------------------------------------
const SUPPORT_LEVEL_RULES = [
  {
    level: "N3",
    keywords: [
      "desenvolvimento",
      "deploy",
      "infraestrutura",
      "banco de dados",
      "servidor",
      "dependência de terceiros",
      "terceiro",
      "problema complexo",
      "bug crítico",
      "incident",
      "incidente crítico",
      "ambiente de produção",
      "rollback",
      "script sql",
      "migração de dados",
      "release",
      "hotfix",
      "publicação",
    ],
  },
  {
    level: "N2",
    keywords: [
      "bug",
      "erro técnico",
      "integração",
      "api",
      "webhook",
      "performance",
      "investigação",
      "investigar",
      "lentidão",
      "falha",
      "não está funcionando",
      "parou de funcionar",
      "intermitente",
      "log de erro",
      "stack trace",
      "timeout",
      "instabilidade",
      "inconsistência",
      "divergência",
      "conciliação",
      "remessa",
      "cnab",
      "retorno bancário",
      "sync",
      "sincronizar",
    ],
  },
  {
    level: "N1",
    keywords: [
      "dúvida",
      "como faço",
      "como fazer",
      "orientação",
      "orientar",
      "consulta",
      "informação",
      "senha",
      "redefinir senha",
      "resetar senha",
      "acesso",
      "cadastrar",
      "cadastro",
      "alterar dados",
      "atualizar dados",
      "configuração básica",
      "habilitar",
      "desabilitar",
      "ativar",
      "desativar",
      "permissão",
      "primeiro acesso",
      "instrução",
      "passo a passo",
      "tutorial",
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a single lowercased text blob from the demand fields we care about.
 */
function buildTextBlob(demand) {
  const parts = [
    demand.title || "",
    demand.description || "",
    demand.workflow || "",
  ];

  if (Array.isArray(demand.threadReplies)) {
    for (const reply of demand.threadReplies) {
      if (reply && reply.text) parts.push(reply.text);
    }
  }

  return parts.join(" ").toLowerCase();
}

/**
 * Match text against an array of keyword rules.
 * Returns the first matching value, or null.
 */
function matchRules(text, rules, valueKey) {
  for (const rule of rules) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) {
        return rule[valueKey];
      }
    }
  }
  return null;
}

/**
 * Determine category for a demand.
 */
function classifyCategory(demand) {
  const text = buildTextBlob(demand);
  return matchRules(text, CATEGORY_RULES, "category") || "Backoffice";
}

/**
 * Determine support level for a demand.
 * Strategy: check N3 first, then N2, then N1.
 * Fallback: look at category to infer level.
 */
function classifySupportLevel(demand, resolvedCategory) {
  const text = buildTextBlob(demand);

  // Explicit keyword match (N3 > N2 > N1)
  const matched = matchRules(text, SUPPORT_LEVEL_RULES, "level");
  if (matched) return matched;

  // Category-based fallback
  const N2_CATEGORIES = [
    "Integração",
    "Conciliação",
    "Transação",
    "Faturas",
    "Nota Fiscal",
    "Saldo",
    "Relatório",
  ];
  const N1_CATEGORIES = [
    "Acesso",
    "Primeiro acesso",
    "Acesso RH",
    "Cadastro colaborador",
    "Cadastro",
    "KYC",
    "SMS",
    "App",
    "Cartão",
    "Backoffice",
    "Carteiras/Produto",
    "Conta Tesouro",
  ];

  if (N2_CATEGORIES.includes(resolvedCategory)) return "N2";
  if (N1_CATEGORIES.includes(resolvedCategory)) return "N1";

  return "N1"; // safe default
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const raw = fs.readFileSync(JSON_PATH, "utf8");
const demands = JSON.parse(raw);

let classifiedCategory = 0;
let classifiedSupportLevel = 0;
const categoryCount = {};
const levelCount = {};

for (const demand of demands) {
  if (!demand.closure) continue;

  const needsCat = demand.closure.category === "";
  const needsLevel = demand.closure.supportLevel === "";

  if (!needsCat && !needsLevel) continue;

  // Always resolve category first (even if already set) so level classifier can use it
  let resolvedCategory = demand.closure.category || classifyCategory(demand);

  if (needsCat) {
    resolvedCategory = classifyCategory(demand);
    demand.closure.category = resolvedCategory;
    demand.closure.autoFilled = demand.closure.autoFilled || {};
    demand.closure.autoFilled.category = true;
    classifiedCategory++;
    categoryCount[resolvedCategory] = (categoryCount[resolvedCategory] || 0) + 1;
  }

  if (needsLevel) {
    const level = classifySupportLevel(demand, resolvedCategory);
    demand.closure.supportLevel = level;
    demand.closure.autoFilled = demand.closure.autoFilled || {};
    demand.closure.autoFilled.supportLevel = true;
    classifiedSupportLevel++;
    levelCount[level] = (levelCount[level] || 0) + 1;
  }
}

// Write updated JSON (pretty-printed to match original style)
fs.writeFileSync(JSON_PATH, JSON.stringify(demands, null, 2), "utf8");
console.log("JSON written:", JSON_PATH);

// Regenerate .ts file
const tsContent = `import { SlackDemand } from "@/types/demand";

export const historicalDemands: SlackDemand[] = ${JSON.stringify(demands, null, 2)};
`;
fs.writeFileSync(TS_PATH, tsContent, "utf8");
console.log("TS written:", TS_PATH);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log("\n========== CLASSIFICATION SUMMARY ==========");
console.log(`Demands classified for CATEGORY:      ${classifiedCategory}`);
console.log(`Demands classified for SUPPORT LEVEL: ${classifiedSupportLevel}`);

console.log("\n--- Category breakdown ---");
const sortedCats = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]);
for (const [cat, count] of sortedCats) {
  console.log(`  ${cat.padEnd(25)} ${count}`);
}

console.log("\n--- Support Level breakdown ---");
const sortedLevels = Object.entries(levelCount).sort((a, b) => b[1] - a[1]);
for (const [lvl, count] of sortedLevels) {
  console.log(`  ${lvl.padEnd(25)} ${count}`);
}
console.log("============================================\n");
