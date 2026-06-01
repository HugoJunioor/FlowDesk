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
  slaLabel: string; // ex: "estourado há 2h" | "4h restantes" | "—"
  permalinkSlack: string | null;
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

/** Cor da coluna PRAZO: vermelho se estourado, preto caso contrário. */
function prazoColor(status: SlaStatus): string {
  return status === 'estourado' ? '#dc2626' : '#111827';
}

export function buildEmailHtml(input: LembreteTemplateInput): string {
  const { nomeUsuario, demandas, baseUrl } = input;
  const count = demandas.length;
  const nomeDisplay = nomeUsuario.split(' ')[0] ?? nomeUsuario;
  const listaUrl = `${baseUrl}/demandas?scope=mine`;

  const linhas = demandas
    .map((d) => {
      const itemUrl = `${baseUrl}/demandas?openId=${d.id}`;
      const prazoCor = prazoColor(d.slaStatus);
      const slackCell = d.permalinkSlack
        ? `<a href="${d.permalinkSlack}" target="_blank" rel="noopener"
              style="display:inline-block; background:#4a154b; color:#ffffff;
                     font-size:11px; text-decoration:none; padding:4px 10px;
                     border-radius:4px;">Slack ↗</a>`
        : `<span style="color:#9ca3af; font-size:12px;">—</span>`;
      return `
      <tr>
        <td style="padding:10px 8px; border-bottom:1px solid #f3f4f6; font-size:13px;
                   color:#111827; font-weight:600; vertical-align:top; width:48px;">
          ${prioridadeLabel(d.prioridade)}
        </td>
        <td style="padding:10px 8px; border-bottom:1px solid #f3f4f6; vertical-align:top;">
          <a href="${itemUrl}" style="text-decoration:none; color:#1d4ed8; font-size:13px;">
            ${d.titulo}
          </a>
        </td>
        <td style="padding:10px 8px; border-bottom:1px solid #f3f4f6; vertical-align:top;
                   font-size:12px; color:${prazoCor}; font-weight:500; white-space:nowrap;">
          ${d.slaLabel}
        </td>
        <td style="padding:10px 8px; border-bottom:1px solid #f3f4f6; vertical-align:top;
                   text-align:center; white-space:nowrap;">
          ${slackCell}
        </td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Resumo diário — Just Flow</title>
</head>
<body style="margin:0; padding:0; background:#f9fafb; font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb; padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0"
               style="background:#ffffff; border-radius:8px; border:1px solid #e5e7eb; overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:#1e3a5f; padding:20px 28px;">
              <span style="color:#ffffff; font-size:11px; font-weight:600; letter-spacing:1px; opacity:.8;">
                JUST FLOW &middot; RESUMO DIÁRIO
              </span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 6px; font-size:16px; color:#111827;">
                Bom dia, <strong>${nomeDisplay}</strong>!
              </p>
              <p style="margin:0 0 20px; font-size:14px; color:#6b7280;">
                Você tem <strong>${count} demanda${count !== 1 ? 's' : ''} em aberto</strong>:
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <thead>
                  <tr style="background:#f9fafb;">
                    <th style="padding:8px; text-align:left; font-size:11px; color:#6b7280;
                               text-transform:uppercase; letter-spacing:0.5px; width:48px;">PRIO</th>
                    <th style="padding:8px; text-align:left; font-size:11px; color:#6b7280;
                               text-transform:uppercase; letter-spacing:0.5px;">DEMANDA</th>
                    <th style="padding:8px; text-align:left; font-size:11px; color:#6b7280;
                               text-transform:uppercase; letter-spacing:0.5px;">PRAZO</th>
                    <th style="padding:8px; text-align:center; font-size:11px; color:#6b7280;
                               text-transform:uppercase; letter-spacing:0.5px;">SLACK</th>
                  </tr>
                </thead>
                <tbody>
                  ${linhas}
                </tbody>
              </table>

              <div style="margin-top:24px; text-align:center;">
                <a href="${listaUrl}"
                   style="display:inline-block; background:#1e3a5f; color:#ffffff;
                          font-size:14px; font-weight:600; text-decoration:none;
                          padding:10px 24px; border-radius:6px;">
                  Abrir Just Flow
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 28px; background:#f9fafb; border-top:1px solid #e5e7eb;
                       font-size:11px; color:#9ca3af; text-align:center;">
              Just Flow &mdash; Atenciosamente, equipe Just.<br/>
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
    .map((d) => {
      const slack = d.permalinkSlack ? ` | Slack: ${d.permalinkSlack}` : '';
      return `• [${prioridadeLabel(d.prioridade)}] ${d.titulo} — ${d.slaLabel}${slack}`;
    })
    .join('\n');

  return `Bom dia ${nomeDisplay},

Você tem ${count} demanda${count !== 1 ? 's' : ''} em aberto:

${linhas}

Abrir Just Flow: ${baseUrl}/demandas?scope=mine

Atenciosamente,
Just Flow`;
}
