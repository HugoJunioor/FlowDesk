/**
 * Template HTML/text do lembrete diário.
 *
 * Recebe lista de demandas com SLA pré-calculado e monta o e-mail.
 */

export type SlaStatus = 'estourado' | 'proximo' | 'no_prazo' | 'sem_prazo';

export interface DemandaResumo {
  id: string;
  titulo: string;
  prioridade: string;
  slaStatus: SlaStatus;
  slaLabel: string; // ex: "estourado há 2h" | "4h restantes" | "Aguardando aprovação"
}

export interface LembreteTemplateInput {
  nomeUsuario: string;
  demandas: DemandaResumo[];
  baseUrl: string;
}

function prioridadeLabel(p: string): string {
  if (p === 'p1') return 'P1';
  if (p === 'p2') return 'P2';
  if (p === 'p3') return 'P3';
  return '—';
}

function slaColor(status: SlaStatus): string {
  if (status === 'estourado') return '#dc2626'; // vermelho
  if (status === 'proximo') return '#d97706';   // amarelo
  return '#16a34a';                              // verde
}

export function buildEmailHtml(input: LembreteTemplateInput): string {
  const { nomeUsuario, demandas, baseUrl } = input;
  const count = demandas.length;
  const nomeDisplay = nomeUsuario.split(' ')[0] ?? nomeUsuario;
  const listaUrl = `${baseUrl}/demandas?scope=mine`;

  const itens = demandas
    .map((d) => {
      const itemUrl = `${baseUrl}/demandas?openId=${d.id}`;
      const cor = slaColor(d.slaStatus);
      return `
      <tr>
        <td style="padding:8px 0; border-bottom:1px solid #f3f4f6; vertical-align:top;">
          <a href="${itemUrl}" style="text-decoration:none; color:#111827; font-size:14px; font-weight:500;">
            [${prioridadeLabel(d.prioridade)}] ${d.titulo}
          </a>
          <br/>
          <span style="font-size:12px; color:${cor}; margin-top:2px; display:inline-block;">
            SLA: ${d.slaLabel}
          </span>
        </td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Resumo diário — FlowDesk</title>
</head>
<body style="margin:0; padding:0; background:#f9fafb; font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb; padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#ffffff; border-radius:8px; border:1px solid #e5e7eb; overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:#1e3a5f; padding:20px 28px;">
              <span style="color:#ffffff; font-size:18px; font-weight:700; letter-spacing:-0.3px;">
                FlowDesk
              </span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 6px; font-size:16px; color:#111827;">
                Olá, <strong>${nomeDisplay}</strong>
              </p>
              <p style="margin:0 0 20px; font-size:14px; color:#6b7280;">
                Você tem <strong>${count} demanda${count !== 1 ? 's' : ''} em aberto</strong> hoje:
              </p>

              <table width="100%" cellpadding="0" cellspacing="0">
                ${itens}
              </table>

              <div style="margin-top:24px; text-align:center;">
                <a href="${listaUrl}"
                   style="display:inline-block; background:#1e3a5f; color:#ffffff;
                          font-size:14px; font-weight:600; text-decoration:none;
                          padding:10px 24px; border-radius:6px;">
                  Ver todas as minhas demandas
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 28px; background:#f9fafb; border-top:1px solid #e5e7eb;
                       font-size:11px; color:#9ca3af; text-align:center;">
              FlowDesk &mdash; Atenciosamente, equipe Just.<br/>
              Para não receber mais este e-mail, ajuste suas preferências em
              <a href="${baseUrl}/configuracoes" style="color:#6b7280;">Configurações</a>.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildEmailText(input: LembreteTemplateInput): string {
  const { nomeUsuario, demandas, baseUrl } = input;
  const nomeDisplay = nomeUsuario.split(' ')[0] ?? nomeUsuario;
  const count = demandas.length;

  const linhas = demandas
    .map((d) => `• [${prioridadeLabel(d.prioridade)}] ${d.titulo} — SLA: ${d.slaLabel}`)
    .join('\n');

  return `Olá ${nomeDisplay},

Você tem ${count} demanda${count !== 1 ? 's' : ''} em aberto:

${linhas}

Acesse: ${baseUrl}/demandas?scope=mine

Atenciosamente,
FlowDesk`;
}
