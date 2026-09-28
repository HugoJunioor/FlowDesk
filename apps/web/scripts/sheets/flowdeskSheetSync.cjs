/**
 * FlowDesk → planilha "Demandas" (Suporte → Engenharia).
 *
 * Este arquivo e o Apps Script que roda DENTRO da planilha. Instalacao em
 * docs/SHEETS_SYNC.md — em resumo: Extensoes → Apps Script → novo arquivo de
 * script, cole este conteudo inteiro, crie a propriedade FLOWDESK_TOKEN e
 * publique como App da Web.
 *
 * O servidor (apps/web/scripts/syncSheets.ts) faz POST com {token, rows}. Aqui:
 *   - a coluna A (ID) identifica a linha;
 *   - so as colunas do FlowDesk sao escritas: B–J e N–O sempre que mudam;
 *     K (Time atual) so na transferencia/devolucao; M (Status), T (Data
 *     conclusao) e W (Ultima atualizacao) pelas regras de fdPlanSync;
 *   - L, P, U, V, X (Engenharia) e as formulas de Q, R, S nunca sao tocadas;
 *   - nenhuma linha e apagada.
 *
 * Nomes com prefixo FD_/fd pra nao colidir com outros arquivos do mesmo
 * projeto — o Apps Script compartilha o escopo global entre eles.
 *
 * O bloco final (module.exports) so existe fora do Apps Script: deixa os testes
 * do repositorio rodarem fdPlanSync no Node.
 */

/* global SpreadsheetApp, PropertiesService, LockService, ContentService */

const FD_SHEET_NAME = 'Demandas';
const FD_FIRST_ROW = 2;
const FD_NUM_COLS = 24; // A..X

// Cabecalho esperado. Se alguem mover, inserir ou renomear coluna, o sync
// recusa em vez de escrever dado na coluna errada.
const FD_HEADERS = [
  'ID', 'Abertura/data', 'Cliente', 'Solicitante Suporte', 'Canal', 'Tipo',
  'Criticidade', 'Problema / Demanda', 'Testes realizados pelo Suporte',
  'Evidências / Links', 'Time atual', 'Responsável Engenharia', 'Status',
  'SLA (h)', 'Prazo SLA', 'Previsão ao Cliente', 'Tempo em aberto (h)',
  'SLA restante (h)', 'Situação SLA', 'Data conclusão',
  'Retorno / Solução Engenharia', 'Próxima ação', 'Última atualização',
  'Observações',
];

// Indices 0-based das colunas que o sync le ou escreve.
const FD_COL = {
  ID: 0, ABERTURA: 1, CLIENTE: 2, PROBLEMA: 7, EVIDENCIAS: 9, TIME: 10,
  STATUS: 12, SLA_H: 13, PRAZO: 14, TEMPO_ABERTO: 16, CONCLUSAO: 19, ULTIMA: 22,
};

const FD_STATUS_NOVA = 'Nova';
const FD_STATUS_CONCLUIDA = 'Concluída';
// Status em que a Engenharia ja encerrou: o FlowDesk nao sobrescreve.
const FD_STATUS_FINAIS = ['Concluída', 'Cancelada'];

function doGet() {
  return fdJson_({ ok: true, service: 'flowdesk-sheet-sync' });
}

function doPost(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return fdJson_({ ok: false, error: 'json_invalido' });
  }

  const expected = PropertiesService.getScriptProperties().getProperty('FLOWDESK_TOKEN');
  if (!expected || !fdSafeEqual_(String(payload.token || ''), expected)) {
    return fdJson_({ ok: false, error: 'token_invalido' });
  }
  if (!Array.isArray(payload.rows)) {
    return fdJson_({ ok: false, error: 'rows_ausente' });
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return fdJson_({ ok: false, error: 'ocupado' });
  try {
    const stats = fdApplySync_(payload.rows);
    return fdJson_(Object.assign({ ok: true }, stats));
  } catch (err) {
    return fdJson_({ ok: false, error: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

function fdApplySync_(rawRows) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FD_SHEET_NAME);
  if (!sheet) throw new Error('aba "' + FD_SHEET_NAME + '" nao encontrada');

  const problem = fdCheckHeaders(sheet.getRange(1, 1, 1, FD_NUM_COLS).getDisplayValues()[0]);
  if (problem) throw new Error(problem);

  const maxRows = sheet.getMaxRows();
  const dataRows = Math.max(0, maxRows - FD_FIRST_ROW + 1);
  const existing = dataRows ? sheet.getRange(FD_FIRST_ROW, 1, dataRows, FD_NUM_COLS).getValues() : [];
  // Lidas antes de qualquer escrita: intercalar leitura e escrita forca flush a cada chamada.
  const formulas = dataRows ? sheet.getRange(FD_FIRST_ROW, FD_COL.TEMPO_ABERTO + 1, dataRows, 3).getFormulasR1C1() : [];

  const incoming = rawRows.map(fdReviveRow).filter(function (r) { return r; });
  const plan = fdPlanSync(existing, incoming);

  if (plan.rowsNeeded > dataRows) {
    sheet.insertRowsAfter(maxRows, plan.rowsNeeded - dataRows);
  }

  fdCoalesce(plan.writes).forEach(function (w) {
    sheet.getRange(FD_FIRST_ROW + w.row, w.col + 1, w.values.length, w.values[0].length)
      .setValues(w.values.map(function (line) { return line.map(fdCellValue_); }));
  });

  // Linhas novas precisam das formulas de Tempo em aberto / SLA restante /
  // Situacao SLA. A planilha ja vem com elas pre-preenchidas; so completa onde
  // faltarem (ex: linha criada alem do fim da aba), copiando da primeira que tem.
  const template = formulas.find(function (f) { return f.some(Boolean); });
  if (template) {
    plan.createdRows.forEach(function (row) {
      const current = formulas[row];
      if (!current || !current.some(Boolean)) {
        sheet.getRange(FD_FIRST_ROW + row, FD_COL.TEMPO_ABERTO + 1, 1, 3).setFormulasR1C1([template]);
      }
    });
  }

  SpreadsheetApp.flush();
  return plan.stats;
}

/**
 * Decide o que escrever, sem tocar na planilha.
 *
 * existing: valores de A..X a partir da linha 2 (como getValues devolve).
 * incoming: linhas do FlowDesk ja revividas (datas como Date).
 * Retorna escritas com `row` relativo a primeira linha de dados e `col` 0-based.
 */
function fdPlanSync(existing, incoming) {
  const index = {};
  const free = [];
  existing.forEach(function (row, i) {
    const id = fdText(row[FD_COL.ID]);
    if (id) {
      if (!(id in index)) index[id] = i;
    } else if (!fdText(row[FD_COL.CLIENTE]) && !fdText(row[FD_COL.PROBLEMA])) {
      // Sem ID, cliente nem problema: linha livre (a do modelo tem so Status e
      // Ultima atualizacao preenchidos).
      free.push(i);
    }
  });

  const writes = [];
  const createdRows = [];
  const stats = { recebidas: incoming.length, criadas: 0, atualizadas: 0, inalteradas: 0 };
  let next = existing.length;

  incoming.forEach(function (r) {
    const main = [r.abertura, r.cliente, r.solicitante, r.canal, r.tipo, r.criticidade, r.problema, r.testes, r.evidencias];
    const sla = r.slaHoras === null ? null : [r.slaHoras, r.prazoSla || ''];

    if (r.id in index) {
      const i = index[r.id];
      const cur = existing[i];
      const before = writes.length;
      if (!fdSameList(cur.slice(FD_COL.ABERTURA, FD_COL.EVIDENCIAS + 1), main)) {
        writes.push({ row: i, col: FD_COL.ABERTURA, values: [main] });
      }
      if (sla && !fdSameList(cur.slice(FD_COL.SLA_H, FD_COL.PRAZO + 1), sla)) {
        writes.push({ row: i, col: FD_COL.SLA_H, values: [sla] });
      }
      // Time atual acompanha a transferencia/devolucao feita no FlowDesk. Fora
      // desses momentos a Engenharia pode trocar (Cliente, Terceiro) sem o sync
      // desfazer.
      if (r.timeAtualMudou && r.timeAtual && fdText(cur[FD_COL.TIME]) !== r.timeAtual) {
        writes.push({ row: i, col: FD_COL.TIME, values: [[r.timeAtual]] });
      }
      // Status e da Engenharia; o FlowDesk so avisa que fechou. Nunca rebaixa
      // um status final nem reabre o que a Engenharia ja concluiu.
      if (r.concluida && FD_STATUS_FINAIS.indexOf(fdText(cur[FD_COL.STATUS])) === -1) {
        writes.push({ row: i, col: FD_COL.STATUS, values: [[FD_STATUS_CONCLUIDA]] });
      }
      // Data de conclusao so e escrita quando o FlowDesk tem uma — nunca apaga
      // a que a Engenharia tenha preenchido.
      if (r.conclusao && !fdSame(cur[FD_COL.CONCLUSAO], r.conclusao)) {
        writes.push({ row: i, col: FD_COL.CONCLUSAO, values: [[r.conclusao]] });
      }
      // Ultima atualizacao so avanca: uma edicao mais recente na planilha vence.
      if (fdIsNewer(r.ultimaAtualizacao, cur[FD_COL.ULTIMA])) {
        writes.push({ row: i, col: FD_COL.ULTIMA, values: [[r.ultimaAtualizacao]] });
      }
      if (writes.length > before) stats.atualizadas++;
      else stats.inalteradas++;
      return;
    }

    const row = free.length ? free.shift() : next++;
    index[r.id] = row;
    createdRows.push(row);
    stats.criadas++;
    writes.push({ row: row, col: FD_COL.ID, values: [[r.id].concat(main)] });
    writes.push({ row: row, col: FD_COL.STATUS, values: [[r.concluida ? FD_STATUS_CONCLUIDA : FD_STATUS_NOVA]] });
    if (r.timeAtual) writes.push({ row: row, col: FD_COL.TIME, values: [[r.timeAtual]] });
    if (sla) writes.push({ row: row, col: FD_COL.SLA_H, values: [sla] });
    if (r.conclusao) writes.push({ row: row, col: FD_COL.CONCLUSAO, values: [[r.conclusao]] });
    writes.push({ row: row, col: FD_COL.ULTIMA, values: [[r.ultimaAtualizacao]] });
  });

  return { writes: writes, createdRows: createdRows, rowsNeeded: next, stats: stats };
}

/** Junta escritas da mesma coluna/largura em linhas consecutivas num unico setValues. */
function fdCoalesce(writes) {
  const sorted = writes.slice().sort(function (a, b) {
    return a.col - b.col || a.values[0].length - b.values[0].length || a.row - b.row;
  });
  const out = [];
  sorted.forEach(function (w) {
    const last = out[out.length - 1];
    if (last && last.col === w.col && last.values[0].length === w.values[0].length &&
        last.row + last.values.length === w.row) {
      last.values = last.values.concat(w.values);
    } else {
      out.push({ row: w.row, col: w.col, values: w.values.slice() });
    }
  });
  return out;
}

function fdCheckHeaders(header) {
  for (let i = 0; i < FD_HEADERS.length; i++) {
    const found = fdText(header[i]);
    if (found !== FD_HEADERS[i]) {
      return 'cabecalho mudou na coluna ' + String.fromCharCode(65 + i) +
        ': esperava "' + FD_HEADERS[i] + '", encontrou "' + found + '"';
    }
  }
  return null;
}

/** Converte o JSON do servidor (datas em ISO) pro formato do planejador. */
function fdReviveRow(raw) {
  if (!raw || !fdText(raw.id)) return null;
  const abertura = fdDate(raw.abertura);
  if (!abertura) return null;
  return {
    id: fdText(raw.id),
    abertura: abertura,
    cliente: fdText(raw.cliente),
    solicitante: fdText(raw.solicitante),
    canal: fdText(raw.canal),
    tipo: fdText(raw.tipo),
    criticidade: fdText(raw.criticidade),
    problema: fdText(raw.problema),
    testes: fdText(raw.testes),
    evidencias: fdText(raw.evidencias),
    slaHoras: typeof raw.slaHoras === 'number' ? raw.slaHoras : null,
    prazoSla: fdDate(raw.prazoSla),
    concluida: raw.concluida === true,
    conclusao: fdDate(raw.conclusao),
    ultimaAtualizacao: fdDate(raw.ultimaAtualizacao) || abertura,
    timeAtual: fdText(raw.timeAtual),
    timeAtualMudou: raw.timeAtualMudou === true,
  };
}

/**
 * Valor pronto pro setValues. Texto vai com apostrofo na frente: sem isso o
 * Sheets interpreta o conteudo — "=..." vira formula (e formula vinda de texto
 * de cliente e porta pra IMPORTXML/IMAGE vazarem dado), "06/07" vira data.
 */
function fdCellValue_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v ? "'" + v : '';
  return v;
}

function fdText(v) {
  if (v === null || v === undefined) return '';
  // Defensivo: se a leitura devolver o apostrofo de texto, ele nao conta.
  return String(v).replace(/^'/, '').trim();
}

function fdDate(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function fdSame(cell, value) {
  if (value instanceof Date) {
    return cell instanceof Date && Math.abs(cell.getTime() - value.getTime()) < 1000;
  }
  if (typeof value === 'number') {
    return cell !== '' && cell !== null && Number(cell) === value;
  }
  return fdText(cell) === fdText(value);
}

function fdSameList(cells, values) {
  for (let i = 0; i < values.length; i++) {
    if (!fdSame(cells[i], values[i])) return false;
  }
  return true;
}

function fdIsNewer(value, cell) {
  if (!(value instanceof Date)) return false;
  if (!(cell instanceof Date)) return true;
  return value.getTime() - cell.getTime() >= 1000;
}

function fdSafeEqual_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function fdJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FD_HEADERS,
    fdPlanSync,
    fdCoalesce,
    fdCheckHeaders,
    fdReviveRow,
    fdCellValue: fdCellValue_,
    fdSafeEqual: fdSafeEqual_,
  };
}
