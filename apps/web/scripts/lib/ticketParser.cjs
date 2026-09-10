/**
 * Parse das mensagens de abertura de demanda postadas pelos bots no Slack.
 *
 * Convivem dois formatos:
 *
 *  1. Formularios antigos ("Nova demanda", "Solicitação…"): campos em linhas
 *     separadas, no estilo "*Label*\nvalor".
 *
 *  2. Formulario de chamado (2026-08 em diante): o `msg.text` vem como UMA
 *     linha so, sem negrito, com pares "Label: valor" colados em sequencia:
 *
 *       ABERTURA — BKO  Cliente/Organização: ACME ID do usuário: 00 CNPJ: 0
 *       Produto/Módulo: Cadastro Tipo de operação: OUTROS Natureza: Problema
 *       Impacto: Sem bloqueio Ambiente: Produção O que tentou fazer: …
 *       _Aberto via formulário por Fulana · protocolo ABCDE-12345_
 *
 *     (quebras acima sao so pra leitura — no payload e tudo uma linha)
 *
 *     Como os valores sao texto livre, a unica forma confiavel de separar os
 *     campos e cortar nos rotulos conhecidos — dai a lista TICKET_LABELS.
 *
 * O comportamento do formato antigo e preservado: parseWorkflowMessage nao
 * mudou, e o parse novo so entra quando isNewTicketForm reconhece a mensagem.
 *
 * Modulo sem dependencias — carregado tanto pelo syncSlack.cjs (node puro,
 * dentro do container) quanto pelos testes.
 */

const TITLE_MAX = 90;

/**
 * Rotulos do formulario de chamado, com e sem acento.
 * Ordem nao importa (a mensagem pode trazer numa ordem qualquer), mas todos
 * precisam estar aqui: um rotulo faltando faz o valor anterior engolir o
 * campo seguinte, que foi exatamente o bug da primeira versao deste parser.
 */
const TICKET_LABELS = [
  'Cliente/Organização', 'Cliente/Organizacao',
  'ID do usuário', 'ID do usuario',
  'CNPJ',
  'Produto/Módulo', 'Produto/Modulo',
  'Tipo de operação', 'Tipo de operacao',
  'Natureza',
  'Impacto',
  'Existe contorno?', 'Existe contorno',
  'Ambiente',
  'Prioridade',
  'ID da organização', 'ID da organizacao',
  'Navegador/versão', 'Navegador/versao',
  'Usuário/perfil afetado', 'Usuario/perfil afetado',
  'O que tentou fazer',
  'Resultado esperado',
  'Resultado obtido',
];

/** Rodape em italico: _Aberto via formulário por Fulana · protocolo ABCDE-12345_ */
const FOOTER_RE = /_?\s*Aberto via formul[áa]rio por\s/i;
const REQUESTER_RE = /Aberto via formul[áa]rio por\s+([^·_\n]+?)\s*(?:·|_|$)/i;
const PROTOCOL_RE = /protocolo\s*`?\s*([A-Z0-9][A-Z0-9-]{3,})\s*`?/i;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

// Alternancia dos rotulos, dos mais longos pros mais curtos — evita que
// "Ambiente" case antes de um eventual rotulo que o contenha.
const LABEL_ALTERNATION = TICKET_LABELS
  .slice()
  .sort((a, b) => b.length - a.length)
  .map(escapeRegExp)
  .join('|');

/** Reconhece o formulario de chamado pelos marcadores que aparecem no payload. */
function isNewTicketForm(text) {
  const t = text || '';
  return /Aberto via formul[áa]rio/i.test(t) || /(?::ticket:|novo chamado)/i.test(t);
}

/**
 * Separa os pares "Label: valor" de uma mensagem do formulario de chamado.
 *
 * Retorna tambem o cabecalho (o que vem antes do primeiro rotulo, ex:
 * "ABERTURA — BKO"), o solicitante e o protocolo, que ficam no rodape.
 */
function parseTicketForm(text) {
  const raw = (text || '').replace(/\s+/g, ' ').trim();
  const result = { header: '', fields: {}, requester: null, protocol: null };
  if (!raw) return result;

  // O rodape nao entra no scan de campos — senao o ultimo valor o engole.
  const footerAt = raw.search(FOOTER_RE);
  const body = footerAt >= 0 ? raw.slice(0, footerAt) : raw;
  const footer = footerAt >= 0 ? raw.slice(footerAt) : '';

  result.requester = footer.match(REQUESTER_RE)?.[1]?.trim() || null;
  result.protocol = (footer.match(PROTOCOL_RE) || raw.match(PROTOCOL_RE))?.[1]?.trim() || null;

  const re = new RegExp(`(?:^|\\s)(${LABEL_ALTERNATION})\\s*:\\s*`, 'gi');
  const marks = [];
  for (const m of body.matchAll(re)) {
    marks.push({ label: m[1].trim(), start: m.index, valueAt: m.index + m[0].length });
  }

  result.header = (marks.length ? body.slice(0, marks[0].start) : body).trim();

  marks.forEach((mark, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].start : body.length;
    const value = body.slice(mark.valueAt, end).trim();
    // Primeira ocorrencia vence — se o texto livre de um campo repetir um
    // rotulo, a repeticao nao sobrescreve o valor original.
    if (value && !result.fields[mark.label]) result.fields[mark.label] = value;
  });

  return result;
}

/**
 * Junta o texto de todos os blocos do Block Kit.
 *
 * O `msg.text` e um achatamento com perdas: prioridade e "c/c" nao aparecem
 * nele, so nos blocos. Percorre a arvore recolhendo qualquer `.text` string.
 */
function flattenBlockText(blocks) {
  const out = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (typeof node.text === 'string') out.push(node.text);
    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') walk(value);
    }
  };
  walk(blocks);
  return out.join('\n');
}

/** Le os campos "*Label*\nvalor" dos formularios antigos. Comportamento historico. */
function parseWorkflowMessage(text) {
  const lines = (text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const fields = {};
  let currentKey = null;

  for (const line of lines) {
    const boldMatch = line.match(/^\*(.+?)\*:?\s*(.*)/);
    if (boldMatch) {
      currentKey = boldMatch[1].replace(/\*/g, '').trim();
      const value = boldMatch[2].trim();
      if (value) fields[currentKey] = value;
      continue;
    }
    if (currentKey && !fields[currentKey]) {
      fields[currentKey] = line;
      currentKey = null;
    }
  }

  return fields;
}

/** Primeiro valor nao-vazio entre variantes com/sem acento do mesmo label. */
function pickField(fields, ...labels) {
  for (const label of labels) {
    const v = fields[label];
    if (v && v.trim()) return v.trim();
  }
  return '';
}

/** Compara ignorando acento e caixa. */
function normalizeLoose(s) {
  return (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

function truncateTitle(s) {
  return s.length > TITLE_MAX ? `${s.slice(0, TITLE_MAX - 1).trimEnd()}…` : s;
}

/**
 * O formulario de chamado nao tem campo de titulo — o cabecalho ("ABERTURA —
 * BKO") repete em todos os chamados. Compoe "Produto/Módulo — O que tentou
 * fazer", que e o par que distingue um chamado do outro na listagem.
 *
 * Quando os dois dizem a mesma coisa (ex: modulo "RELATORIO" + acao
 * "Relatório"), mantem so o mais descritivo em vez de repetir.
 */
function composeTicketTitle(modulo, tentouFazer) {
  const attempted = (tentouFazer || '').split('\n')[0].trim();
  const parts = [(modulo || '').trim(), attempted].filter(Boolean);
  if (!parts.length) return null;
  if (parts.length === 2) {
    const [a, b] = parts.map(normalizeLoose);
    if (a.includes(b) || b.includes(a)) {
      return truncateTitle(parts[0].length >= parts[1].length ? parts[0] : parts[1]);
    }
  }
  return truncateTitle(parts.join(' — '));
}

module.exports = {
  TICKET_LABELS,
  isNewTicketForm,
  parseTicketForm,
  flattenBlockText,
  parseWorkflowMessage,
  pickField,
  composeTicketTitle,
};
