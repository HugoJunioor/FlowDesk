/**
 * Parse das mensagens de abertura de demanda postadas pelos bots no Slack.
 *
 * Convivem dois formatos:
 *
 *  1. Formularios antigos ("Nova demanda", "Solicitação…"), com campos
 *     "*Label*\nvalor" de uma linha so.
 *  2. Formulario "Novo chamado" (2026-08 em diante), com cabecalho
 *     ":ticket: Novo chamado · CLIENTE", uma linha de meta com tokens em
 *     negrito separados por "·", blocos narrativos de varios paragrafos e
 *     rodape "Aberto via formulário por *Fulano* · protocolo `X`".
 *
 * O comportamento do formato antigo e preservado byte a byte: a leitura
 * multi-linha e as regras novas so entram quando a mensagem e reconhecida
 * como do formulario novo.
 *
 * Modulo sem dependencias — carregado tanto pelo syncSlack.cjs (node puro,
 * dentro do container) quanto pelos testes.
 */

// Linha de meta: emoji opcional + tokens em negrito separados por "·". Ex:
//   :large_blue_circle: *Prioridade: P3-Média*  ·  *Problema*  ·  *Produção*
// A quantidade de tokens varia entre versoes do formulario (chamados de 25/08
// tem 3 e nenhuma prioridade; os de 27/08 em diante tem 5), entao a leitura
// nao pode ser posicional.
const TICKET_META_LINE_RE = /^(?::[a-z0-9_+-]+:\s*)?\*[^*]+\*(?:\s*·\s*\*[^*]+\*)+\s*$/;

// Rodape do formulario — nunca faz parte do valor do campo anterior.
const FIELD_STOP_RE = /^(?::[a-z0-9_+-]+:\s*)?(?:Aberto via formul[áa]rio|c\/c\b|:paperclip:)/i;

const TITLE_MAX = 90;

/** Reconhece o formulario "Novo chamado" pelos seus marcadores. */
function isNewTicketForm(text) {
  const t = text || '';
  return /(?::ticket:|novo chamado)/i.test(t) || /aberto via formul[áa]rio/i.test(t);
}

/**
 * Classifica os tokens da linha de meta por semantica, nao por posicao.
 * Retorna campos nulos quando a mensagem nao tem linha de meta.
 */
function parseTicketMetaLine(text) {
  const meta = { priority: null, kind: null, blocking: null, environment: null, flags: [] };
  const line = (text || '').split('\n').map((l) => l.trim()).find((l) => TICKET_META_LINE_RE.test(l));
  if (!line) return meta;

  for (const m of line.matchAll(/\*([^*]+)\*/g)) {
    const token = m[1].trim();
    const low = token.toLowerCase();
    const prio = token.match(/^prioridade\s*:\s*(.+)$/i);
    if (prio) { meta.priority = prio[1].trim(); continue; }
    if (/bloque/.test(low)) { meta.blocking = token; continue; }
    if (/produ[cç][aã]o|homolog|sandbox|staging|teste/.test(low)) { meta.environment = token; continue; }
    if (/^(problema|bug|ajuda|d[uú]vida|melhoria|incidente|tarefa|solicita)/.test(low)) { meta.kind = token; continue; }
    meta.flags.push(token);
  }
  return meta;
}

/**
 * Le os campos "*Label*\nvalor" da mensagem.
 *
 * Formulario novo: acumula multi-linha ate o proximo label, porque os blocos
 * narrativos (Resultado esperado etc) tem varios paragrafos.
 * Formularios antigos: mantem o comportamento historico de pegar so a
 * primeira linha depois do label.
 */
function parseWorkflowMessage(text) {
  const multiline = isNewTicketForm(text);
  const lines = (text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const fields = {};
  let currentKey = null;
  let buffer = [];

  const flush = () => {
    if (currentKey && buffer.length) {
      const joined = buffer.join('\n').trim();
      if (joined && !fields[currentKey]) fields[currentKey] = joined;
    }
    currentKey = null;
    buffer = [];
  };

  for (const line of lines) {
    if (multiline) {
      // Rodape encerra o campo corrente sem virar valor dele.
      if (FIELD_STOP_RE.test(line)) { flush(); continue; }
      // A linha de meta tambem comeca com *...*; quem le ela e parseTicketMetaLine.
      if (TICKET_META_LINE_RE.test(line)) { flush(); continue; }
    }

    const boldMatch = line.match(/^\*(.+?)\*:?\s*(.*)/);
    if (boldMatch) {
      if (multiline) flush();
      currentKey = boldMatch[1].replace(/\*/g, '').trim();
      const value = boldMatch[2].trim();
      if (value) {
        if (!fields[currentKey]) fields[currentKey] = value;
        if (multiline) currentKey = null;
      }
      continue;
    }

    if (multiline) {
      if (currentKey) buffer.push(line);
    } else if (currentKey && !fields[currentKey]) {
      // Comportamento historico: so a primeira linha apos o label.
      fields[currentKey] = line;
      currentKey = null;
    }
  }
  if (multiline) flush();

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
 * O formulario "Novo chamado" nao tem campo de titulo — o cabecalho
 * (":ticket: Novo chamado · VSPAY") e identico em todos os chamados do canal.
 * Compoe "Produto/Módulo — O que tentou fazer" (1a linha), que e o par que
 * distingue um chamado do outro na listagem.
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
  isNewTicketForm,
  parseTicketMetaLine,
  parseWorkflowMessage,
  pickField,
  composeTicketTitle,
};
