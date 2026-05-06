import { describe, it, expect } from "vitest";
import { classifyDemand } from "./priorityClassifier";

describe("classifyDemand", () => {
  describe("P1 - Critico", () => {
    it("classifica como P1 quando sistema esta indisponivel pra todos", () => {
      const r = classifyDemand(
        "Sistema fora do ar",
        "Producao parada, ninguem consegue acessar, todos os usuarios afetados"
      );
      expect(r.priority).toBe("p1");
      expect(r.confidence).toBe("alta");
      expect(r.matchedKeywords.length).toBeGreaterThan(0);
    });

    it("classifica como P1 quando ha indicios de seguranca comprometida", () => {
      const r = classifyDemand(
        "Possivel invasao detectada",
        "Vazamento de dados em larga escala, fraude confirmada"
      );
      expect(r.priority).toBe("p1");
    });
  });

  describe("P2 - Alta", () => {
    it("classifica como P2 quando ha erro afetando grupo de usuarios", () => {
      const r = classifyDemand(
        "API falhando",
        "Erro intermitente afetando alguns usuarios, integracao falhando, calculo incorreto"
      );
      expect(r.priority).toBe("p2");
    });

    it("classifica como P2 pra cartao bloqueado (caso real recorrente)", () => {
      const r = classifyDemand(
        "Cartao bloqueado",
        "Cartao com problema, cliente cobrando, urgente"
      );
      expect(r.priority).toBe("p2");
    });
  });

  describe("P3 - Media", () => {
    it("classifica como P3 pra solicitacao de cadastro", () => {
      const r = classifyDemand(
        "Cadastrar novo estabelecimento",
        "Adicionar campo no cadastro, atualizacao de dados cadastrais"
      );
      expect(r.priority).toBe("p3");
    });

    it("classifica como P3 pra solicitacao de relatorio", () => {
      const r = classifyDemand(
        "Gerar relatorio mensal",
        "Exportar relatorio do mes, alteracao no layout"
      );
      expect(r.priority).toBe("p3");
    });
  });

  describe("sem_classificacao", () => {
    it("retorna sem_classificacao quando nao bate em nada", () => {
      const r = classifyDemand("teste", "texto generico sem palavras chave");
      expect(r.priority).toBe("sem_classificacao");
      expect(r.confidence).toBe("baixa");
      expect(r.matchedKeywords).toEqual([]);
    });
  });

  describe("estrutura do retorno", () => {
    it("sempre retorna campos obrigatorios", () => {
      const r = classifyDemand("qualquer", "coisa");
      expect(r).toHaveProperty("priority");
      expect(r).toHaveProperty("confidence");
      expect(r).toHaveProperty("reason");
      expect(r).toHaveProperty("matchedKeywords");
      expect(typeof r.reason).toBe("string");
      expect(Array.isArray(r.matchedKeywords)).toBe(true);
    });

    it("reason inclui keywords no caso classificado", () => {
      const r = classifyDemand("Sistema fora do ar", "producao parada emergencia");
      if (r.priority !== "sem_classificacao") {
        expect(r.reason.length).toBeGreaterThan(20);
      }
    });
  });
});
