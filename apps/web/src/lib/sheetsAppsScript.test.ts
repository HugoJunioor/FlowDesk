/**
 * Regras do Apps Script da planilha (scripts/sheets/flowdeskSheetSync.cjs).
 *
 * So a parte pura roda aqui: fdPlanSync decide o que escrever a partir dos
 * valores lidos. O contrato que estes testes fixam e o combinado com a
 * Engenharia: o FlowDesk cria e atualiza as colunas dele; as da Engenharia,
 * as formulas e o status que ela definiu nao sao tocados.
 */
import { describe, expect, it } from "vitest";
import {
  FD_HEADERS,
  fdCellValue,
  fdCheckHeaders,
  fdCoalesce,
  fdPlanSync,
  fdReviveRow,
  fdSafeEqual,
  } from "../../scripts/sheets/flowdeskSheetSync.cjs";

type Cell = string | number | Date;
type Write = { row: number; col: number; values: Cell[][] };

// Colunas (0-based) que so a Engenharia preenche, mais as formulas Q/R/S.
const ENGENHARIA = [10, 11, 15, 20, 21, 23];
const FORMULAS = [16, 17, 18];

function emptyRow(): Cell[] {
  return Array.from({ length: 24 }, () => "");
}

/** Linha como o FlowDesk manda (antes do revive). */
function incoming(over: Record<string, unknown> = {}) {
  return fdReviveRow({
    id: "P-0001",
    abertura: new Date(2026, 8, 25, 17, 0).toISOString(),
    cliente: "ORG EXEMPLO",
    solicitante: "Fulana Exemplo",
    canal: "Slack",
    tipo: "Bug",
    criticidade: "Alta",
    problema: "Problema X",
    testes: "Tentou Y",
    evidencias: "Slack: https://exemplo/p1",
    slaHoras: 8,
    prazoSla: new Date(2026, 8, 28, 15, 0).toISOString(),
    concluida: false,
    conclusao: null,
    ultimaAtualizacao: new Date(2026, 8, 25, 17, 0).toISOString(),
    ...over,
  });
}

/** Linha da planilha ja preenchida pelo sync com os valores de `incoming()`. */
function syncedRow(over: Record<number, Cell> = {}): Cell[] {
  const r = incoming();
  const row = emptyRow();
  [r.id, r.abertura, r.cliente, r.solicitante, r.canal, r.tipo, r.criticidade, r.problema, r.testes, r.evidencias]
    .forEach((v, i) => { row[i] = v; });
  row[12] = "Em desenvolvimento";
  row[13] = r.slaHoras;
  row[14] = r.prazoSla;
  row[22] = r.ultimaAtualizacao;
  Object.entries(over).forEach(([col, v]) => { row[Number(col)] = v; });
  return row;
}

function colsWritten(writes: Write[]): number[] {
  return writes.flatMap((w) => w.values[0].map((_, k) => w.col + k));
}

describe("fdPlanSync — linha nova", () => {
  it("usa a primeira linha livre, incluindo a do modelo com so Status e data", () => {
    const modelo = emptyRow();
    modelo[12] = "Em análise";
    modelo[22] = new Date(2026, 8, 25, 4, 9);

    const plan = fdPlanSync([modelo, emptyRow()], [incoming()]);

    expect(plan.createdRows).toEqual([0]);
    expect(plan.stats).toMatchObject({ criadas: 1, atualizadas: 0 });
    const status = plan.writes.find((w: Write) => w.col === 12);
    expect(status.values).toEqual([["Nova"]]);
  });

  it("cria ja como Concluída quando chega fechado, com a data de conclusao", () => {
    const fim = new Date(2026, 8, 28, 11, 0);
    const plan = fdPlanSync([emptyRow()], [incoming({ concluida: true, conclusao: fim.toISOString() })]);

    expect(plan.writes.find((w: Write) => w.col === 12).values).toEqual([["Concluída"]]);
    expect(plan.writes.find((w: Write) => w.col === 19).values[0][0].getTime()).toBe(fim.getTime());
  });

  it("anexa depois da ultima linha quando nao ha linha livre", () => {
    const manual = emptyRow();
    manual[2] = "Cliente via WhatsApp";
    manual[7] = "Linha criada a mao pela Engenharia";

    const plan = fdPlanSync([manual], [incoming()]);

    expect(plan.createdRows).toEqual([1]);
    expect(plan.rowsNeeded).toBe(2);
  });

  it("nunca escreve nas colunas da Engenharia nem nas formulas", () => {
    const plan = fdPlanSync([emptyRow()], [incoming({ concluida: true, conclusao: new Date().toISOString() })]);
    const cols = colsWritten(plan.writes);

    [...ENGENHARIA, ...FORMULAS].forEach((c) => expect(cols).not.toContain(c));
  });
});

describe("fdPlanSync — linha existente", () => {
  it("nao escreve nada quando nada mudou", () => {
    const plan = fdPlanSync([syncedRow()], [incoming()]);

    expect(plan.writes).toEqual([]);
    expect(plan.stats).toMatchObject({ inalteradas: 1, atualizadas: 0, criadas: 0 });
  });

  it("reescreve so o bloco B–J quando a criticidade muda", () => {
    const plan = fdPlanSync([syncedRow()], [incoming({ criticidade: "Crítica" })]);

    expect(plan.writes).toHaveLength(1);
    expect(plan.writes[0]).toMatchObject({ row: 0, col: 1 });
    expect(plan.writes[0].values[0][5]).toBe("Crítica");
  });

  it("preserva o que a Engenharia preencheu", () => {
    const row = syncedRow({ 10: "Engenharia", 11: "Pessoa Eng", 20: "Corrigido no deploy", 21: "Validar", 23: "obs" });
    const plan = fdPlanSync([row], [incoming({ criticidade: "Crítica", concluida: true, conclusao: new Date().toISOString() })]);

    [...ENGENHARIA, ...FORMULAS].forEach((c) => expect(colsWritten(plan.writes)).not.toContain(c));
  });

  it("marca Concluída quando o FlowDesk fecha", () => {
    const plan = fdPlanSync([syncedRow()], [incoming({ concluida: true, conclusao: new Date(2026, 8, 29, 9).toISOString() })]);

    expect(plan.writes.find((w: Write) => w.col === 12).values).toEqual([["Concluída"]]);
  });

  it("nao mexe no status enquanto o FlowDesk nao fecha", () => {
    const plan = fdPlanSync([syncedRow({ 12: "Em teste" })], [incoming({ criticidade: "Crítica" })]);

    expect(colsWritten(plan.writes)).not.toContain(12);
  });

  it("nao sobrescreve Cancelada nem Concluída definidas pela Engenharia", () => {
    const fechado = incoming({ concluida: true, conclusao: new Date(2026, 8, 29, 9).toISOString() });

    expect(colsWritten(fdPlanSync([syncedRow({ 12: "Cancelada" })], [fechado]).writes)).not.toContain(12);
    expect(colsWritten(fdPlanSync([syncedRow({ 12: "Concluída" })], [fechado]).writes)).not.toContain(12);
  });

  it("nao apaga a data de conclusao que a Engenharia preencheu", () => {
    const plan = fdPlanSync([syncedRow({ 19: new Date(2026, 8, 26, 10) })], [incoming()]);

    expect(colsWritten(plan.writes)).not.toContain(19);
  });

  it("ultima atualizacao so avanca", () => {
    const maisRecenteNaPlanilha = syncedRow({ 22: new Date(2026, 8, 30, 12) });
    expect(colsWritten(fdPlanSync([maisRecenteNaPlanilha], [incoming()]).writes)).not.toContain(22);

    const novaResposta = incoming({ ultimaAtualizacao: new Date(2026, 8, 28, 9).toISOString() });
    expect(colsWritten(fdPlanSync([syncedRow()], [novaResposta]).writes)).toContain(22);
  });

  it("substitui o prazo de horas corridas pelo de horas uteis", () => {
    const horasCorridas = syncedRow({ 14: new Date(2026, 8, 26, 1, 0) });
    const plan = fdPlanSync([horasCorridas], [incoming()]);

    const prazo = plan.writes.find((w: Write) => w.col === 13);
    expect(prazo.values[0][1].getTime()).toBe(new Date(2026, 8, 28, 15, 0).getTime());
  });

  it("casa pelo ID mesmo quando a planilha guardou o protocolo como numero", () => {
    const plan = fdPlanSync([syncedRow({ 0: 12345 })], [incoming({ id: "12345" })]);

    expect(plan.stats.criadas).toBe(0);
  });
});

describe("fdCoalesce", () => {
  it("junta linhas consecutivas da mesma coluna num unico bloco", () => {
    const out = fdCoalesce([
      { row: 5, col: 12, values: [["Nova"]] },
      { row: 3, col: 12, values: [["Nova"]] },
      { row: 4, col: 12, values: [["Nova"]] },
      { row: 4, col: 13, values: [[8, "x"]] },
    ]);

    expect(out).toEqual([
      { row: 3, col: 12, values: [["Nova"], ["Nova"], ["Nova"]] },
      { row: 4, col: 13, values: [[8, "x"]] },
    ]);
  });
});

describe("fdCheckHeaders", () => {
  it("aceita o cabecalho da planilha", () => {
    expect(fdCheckHeaders(FD_HEADERS)).toBeNull();
  });

  it("recusa quando uma coluna foi movida ou renomeada", () => {
    const movido = [...FD_HEADERS];
    movido[6] = "Prioridade";
    expect(fdCheckHeaders(movido)).toContain("coluna G");
  });
});

describe("fdCellValue", () => {
  it("forca texto com apostrofo — evita formula e conversao automatica", () => {
    expect(fdCellValue("=IMPORTXML(\"https://x\")")).toBe("'=IMPORTXML(\"https://x\")");
    expect(fdCellValue("06/07")).toBe("'06/07");
  });

  it("mantem numero, data e vazio", () => {
    const d = new Date();
    expect(fdCellValue(8)).toBe(8);
    expect(fdCellValue(d)).toBe(d);
    expect(fdCellValue("")).toBe("");
    expect(fdCellValue(null)).toBe("");
  });
});

describe("fdReviveRow e fdSafeEqual", () => {
  it("descarta linha sem ID ou sem data de abertura", () => {
    expect(fdReviveRow({ id: "", abertura: new Date().toISOString() })).toBeNull();
    expect(fdReviveRow({ id: "P-1", abertura: "nao-e-data" })).toBeNull();
  });

  it("compara token por conteudo", () => {
    expect(fdSafeEqual("abc123", "abc123")).toBe(true);
    expect(fdSafeEqual("abc123", "abc124")).toBe(false);
    expect(fdSafeEqual("abc", "abc123")).toBe(false);
  });
});
