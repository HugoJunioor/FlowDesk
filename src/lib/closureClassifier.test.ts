import { describe, it, expect } from "vitest";
import { classifyCategory, classifyContactReason } from "./closureClassifier";
import type { SlackDemand } from "@/types/demand";

const makeDemand = (overrides: Partial<SlackDemand>): SlackDemand =>
  ({
    id: "test",
    title: "",
    description: "",
    priority: "p3",
    status: "aberta",
    demandType: "Outro",
    workflow: "",
    product: "",
    requester: { name: "x", avatar: "" },
    assignee: null,
    cc: [],
    createdAt: "2026-04-15T10:00:00Z",
    dueDate: null,
    completedAt: null,
    hasTask: false,
    taskLink: "",
    tags: [],
    slackChannel: "#test",
    slackPermalink: "",
    replies: 0,
    threadReplies: [],
    ...overrides,
  } as SlackDemand);

describe("classifyCategory", () => {
  it("classifica Cartao por keyword no titulo", () => {
    const r = classifyCategory(
      makeDemand({ title: "Cartao bloqueado", description: "cliente nao consegue usar" })
    );
    expect(r.value).toBe("Cartao");
    expect(r.confidence).toMatch(/alta|media|baixa/);
  });

  it("classifica Transacao por keyword (pix, compra negada)", () => {
    const r = classifyCategory(
      makeDemand({ title: "Compra negada", description: "pix nao caiu, autorizacao falhou" })
    );
    expect(r.value).toBe("Transacao");
  });

  it("classifica Cadastro pra alteracao de CPF", () => {
    const r = classifyCategory(
      makeDemand({ title: "Alteracao de dados", description: "atualizar CPF do cadastro" })
    );
    expect(r.value).toBe("Cadastro");
  });

  it("classifica Boleto", () => {
    const r = classifyCategory(
      makeDemand({ title: "Boleto bancario com erro", description: "codigo de barras invalido" })
    );
    expect(r.value).toBe("Boleto");
  });

  it("classifica Relatorio", () => {
    const r = classifyCategory(
      makeDemand({ title: "Exportar relatorio mensal", description: "dashboard BI desatualizado" })
    );
    expect(r.value).toBe("Relatorio");
  });

  it("normaliza acentos antes de matching", () => {
    const r = classifyCategory(
      makeDemand({ title: "Cartão bloqueado", description: "" })
    );
    expect(r.value).toBe("Cartao");
  });

  it("retorna vazio quando texto nao bate em nada", () => {
    const r = classifyCategory(
      makeDemand({ title: "xyz abc", description: "lorem ipsum" })
    );
    expect(r.value).toBe("");
    expect(r.confidence).toBe("baixa");
  });

  it("alta confianca quando tem 3+ keywords matchando", () => {
    const r = classifyCategory(
      makeDemand({
        title: "Portal do cliente com erro de login portal",
        description: "Acesso portal bloqueado, portal web fora",
      })
    );
    expect(r.value).toBe("Portal do cliente");
    expect(r.confidence).toBe("alta");
  });

  it("escolhe categoria com mais matches quando ha multipla", () => {
    // "cartao" 1 match, "cadastro/cpf" 2 matches → ganha Cadastro
    const r = classifyCategory(
      makeDemand({
        title: "Cadastro novo",
        description: "incluir CPF e dados cadastrais — vincular cartao depois",
      })
    );
    expect(r.value).toBe("Cadastro");
  });
});

describe("classifyContactReason", () => {
  // Casos baseados em titulos REAIS da planilha Analise_Motivos_Contato_Abril2026.xlsx
  // (uma amostra de cada motivo pra validar keywords)

  it("classifica Saldo Nao Creditado por palavras-chave do dominio", () => {
    const cases = [
      "CARTEIRA NÃO ENCONTRADA.",
      "QR CODE INDISPONÍVEL",
      "SALDO NÃO CREDITOU",
      "Conta Tesouro",
    ];
    for (const title of cases) {
      const r = classifyContactReason(makeDemand({ title }));
      expect(r.value).toBe("Saldo Nao Creditado / Pagamento Nao Compensado");
    }
  });

  it("classifica Falha na Vinculacao", () => {
    const cases = [
      "FALHA AO VINCULAR CARTÃO",
      "Erro ao vincular cartão",
      "Vinculação de cartão Mastercard",
      "TAH NÃO ENCONTRADO",
    ];
    for (const title of cases) {
      const r = classifyContactReason(makeDemand({ title }));
      expect(r.value).toBe("Falha na Vinculacao / Uso de Cartao");
    }
  });

  it("classifica Problema com PIX", () => {
    const cases = [
      "PIX CONCLUIDO PORÉM NÃO CAIU EM CONTA",
      "ERRO AO REALIZAR O PIX",
      "ERRO AO CADASTRA CHAVE PIX",
    ];
    for (const title of cases) {
      const r = classifyContactReason(makeDemand({ title }));
      expect(r.value).toBe("Problema com PIX");
    }
  });

  it("classifica Estorno / Reembolso / Cancelamento", () => {
    const cases = [
      "REEMBOLSO",
      "Cancelamento de venda duplicada Aranjo fechado",
      "Estorno de valor",
      "Transação duplicada",
    ];
    for (const title of cases) {
      const r = classifyContactReason(makeDemand({ title }));
      expect(r.value).toBe("Estorno / Reembolso / Cancelamento de Transacao");
    }
  });

  it("classifica Ajuste de Dados Cadastrais", () => {
    const cases = [
      "Ajuste de CPF",
      "Alteração de CPF",
      "CPF errado.",
    ];
    for (const title of cases) {
      const r = classifyContactReason(makeDemand({ title }));
      expect(r.value).toBe("Ajuste de Dados Cadastrais (CPF / Nome)");
    }
  });

  it("classifica Erro Fiscal", () => {
    const cases = [
      "ERRO AO EMITIR NOTA FISCAL",
      "Erro na Geração de Boletos",
      "Erro 244 – UF do Tomador inválida no fechamento contábil rede (arquivo RPS rejeitado)",
    ];
    for (const title of cases) {
      const r = classifyContactReason(makeDemand({ title }));
      expect(r.value).toBe("Erro Fiscal (NF, Boleto, RPS, DANFE)");
    }
  });

  it("classifica Conciliacao", () => {
    const cases = [
      "Layout arquivos conciliações Boa Vista",
      "Erro de conciliação",
      "Habilitação Arquivos de conciliação KPI Benefícios",
    ];
    for (const title of cases) {
      const r = classifyContactReason(makeDemand({ title }));
      expect(r.value).toBe("Problema de Conciliacao / Layout de Arquivo");
    }
  });

  it("classifica Retirada de Saldo", () => {
    const r = classifyContactReason(makeDemand({ title: "RETIRADA DE SALDO" }));
    expect(r.value).toBe("Retirada / Transferencia de Saldo");
  });

  it("classifica KYC", () => {
    const r = classifyContactReason(makeDemand({ title: "KYC REPROVADO" }));
    expect(r.value).toBe("KYC Reprovado / Falha de Identidade");
  });

  it("classifica Saque", () => {
    const r = classifyContactReason(makeDemand({ title: "Saque no 24H" }));
    expect(r.value).toBe("Falha no Saque (24h / ATM)");
  });

  it("classifica Lentidao", () => {
    const r = classifyContactReason(makeDemand({ title: "Lentidão DX Academy" }));
    expect(r.value).toBe("Lentidao / Instabilidade de Sistema");
  });

  it("retorna vazio quando texto nao bate em nenhum motivo", () => {
    const r = classifyContactReason(makeDemand({ title: "abcxyz qwerty" }));
    expect(r.value).toBe("");
    expect(r.confidence).toBe("baixa");
  });

  it("normaliza acentos no matching", () => {
    // KYC sem acento, sem caps
    const r = classifyContactReason(makeDemand({ title: "kyc reprovado" }));
    expect(r.value).toBe("KYC Reprovado / Falha de Identidade");
  });

  it("alta confianca quando 2+ keywords matcham", () => {
    // "vincular cartao" + "falha ao vincular" = 2 matches
    const r = classifyContactReason(makeDemand({
      title: "FALHA AO VINCULAR CARTÃO",
      description: "Vinculação de cartao despesa",
    }));
    expect(r.value).toBe("Falha na Vinculacao / Uso de Cartao");
    expect(r.confidence).toBe("alta");
    expect(r.matchedKeywords.length).toBeGreaterThanOrEqual(2);
  });
});
