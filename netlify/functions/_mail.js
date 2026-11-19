// Helper de correo para notificar al denunciante el cambio de estatus de su folio.
const nodemailer = require('nodemailer');

const ESTATUS_LABELS = {
  recibida:         'Recibida',
  en_revision:      'En revisión',
  en_investigacion: 'En investigación',
  resuelta:         'Resuelta',
  desestimada:      'Desestimada',
};

// Color del badge y barra superior según estatus
const ESTATUS_STYLES = {
  recibida:         { bar: '#3b82f6', bg: '#eff6ff', border: '#93c5fd', text: '#1e40af', dot: '#3b82f6' },
  en_revision:      { bar: '#f59e0b', bg: '#fffbeb', border: '#fcd34d', text: '#92400e', dot: '#f59e0b' },
  en_investigacion: { bar: '#f97316', bg: '#fff7ed', border: '#fdba74', text: '#9a3412', dot: '#f97316' },
  resuelta:         { bar: '#22c55e', bg: '#f0fdf4', border: '#86efac', text: '#166534', dot: '#22c55e' },
  desestimada:      { bar: '#94a3b8', bg: '#f8fafc', border: '#cbd5e1', text: '#475569', dot: '#94a3b8' },
};

// Índice en la línea de tiempo (desestimada no aplica)
const TIMELINE = ['recibida', 'en_revision', 'en_investigacion', 'resuelta'];

function buildEstatusHtml(folio, estatus) {
  const label   = ESTATUS_LABELS[estatus] || estatus;
  const styles  = ESTATUS_STYLES[estatus] || ESTATUS_STYLES.recibida;
  const trackingUrl = `https://denunciasarhconsultores.netlify.app/tracking/${folio}`;
  const indice  = TIMELINE.indexOf(estatus);

  // Genera los 4 pasos de la línea de tiempo
  const pasos = TIMELINE.map((e, i) => {
    const completado = indice >= 0 && i <= indice;
    const activo     = i === indice;
    const bgCircle   = completado ? '#1a237e' : '#e2e8f0';
    const colorText  = activo ? '#1a237e' : completado ? '#334155' : '#94a3b8';
    const fontWeight = activo ? '700' : '400';
    const contenido  = completado
      ? '&#10003;'
      : String(i + 1);
    const colorCircleText = completado ? '#ffffff' : '#94a3b8';
    return `
      <td width="25%" style="text-align:center;padding:0 4px;">
        <div style="width:32px;height:32px;border-radius:50%;background-color:${bgCircle};margin:0 auto 8px;">
          <span style="color:${colorCircleText};font-size:13px;font-weight:700;line-height:32px;display:block;">${contenido}</span>
        </div>
        <p style="margin:0;font-size:11px;font-weight:${fontWeight};color:${colorText};">${ESTATUS_LABELS[e]}</p>
      </td>`;
  }).join('');

  // Bloque especial si fue desestimada
  const bloqueDesestimada = estatus === 'desestimada' ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
      <tr><td style="padding:20px 24px;text-align:center;">
        <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#475569;">Denuncia desestimada</p>
        <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">Tras la revisión del comité, la denuncia fue desestimada. Si tienes dudas, contacta a tu área de Recursos Humanos.</p>
      </td></tr>
    </table>` : '';

  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Actualización de denuncia - ${folio}</title>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a237e 0%,#283593 100%);padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">&#x1F6E1;&#xFE0F; Canal Ético de Denuncias</h1>
              <p style="margin:6px 0 0;color:#c5cae9;font-size:13px;">ARH Consultores</p>
            </td>
          </tr>

          <!-- Badge estatus dinámico -->
          <tr>
            <td style="background-color:${styles.bg};border-bottom:3px solid ${styles.bar};padding:16px 40px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:10px;vertical-align:middle;">
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background-color:${styles.dot};"></span>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${styles.text};">Nuevo estatus</span>
                    &nbsp;&nbsp;
                    <span style="display:inline-block;padding:4px 14px;border-radius:20px;background-color:${styles.bg};border:1px solid ${styles.border};font-size:12px;font-weight:700;color:${styles.text};">${label}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cuerpo -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <h2 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#0f172a;">Tu denuncia fue actualizada</h2>
              <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7;">
                El estatus de tu denuncia con folio <strong style="color:#0f172a;">${folio}</strong> ha cambiado. El comité de ética continúa atendiendo tu caso con total confidencialidad.
              </p>

              <!-- Folio box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:linear-gradient(135deg,#f57c00,#ffc107);border-radius:10px;padding:20px 32px;text-align:center;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.85);">Folio de seguimiento</p>
                    <p style="margin:0;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:4px;">${folio}</p>
                  </td>
                </tr>
              </table>

              ${bloqueDesestimada}

              <!-- Línea de tiempo -->
              ${estatus !== 'desestimada' ? `
              <p style="margin:0 0 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;">Progreso de tu caso</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                <tr>${pasos}</tr>
              </table>` : ''}

              <!-- Botón CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${trackingUrl}"
                       style="display:inline-block;padding:14px 36px;background-color:#1a237e;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:0.3px;">
                      Ver detalle de mi denuncia →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Aviso -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fefce8;border:1px solid #fde68a;border-radius:8px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0;font-size:12px;color:#92400e;line-height:1.6;">
                      &#x1F4A1; Si no reconoces esta denuncia o tienes dudas, contacta a tu área de Recursos Humanos.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#1e293b;padding:22px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">ARH Consultores — Canal Ético de Denuncias</p>
              <p style="margin:6px 0 0;font-size:11px;color:#64748b;">Correo generado automáticamente. Por favor no respondas a este mensaje.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Envía el correo de cambio de estatus. No lanza si falla (best-effort).
 * @returns {Promise<boolean>} true si se envió, false si no.
 */
async function sendEstatusEmail(correo, folio, estatus) {
  if (!correo) return false;
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return false;
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: correo,
      subject: `Actualización de tu denuncia - Folio ${folio}`,
      html: buildEstatusHtml(folio, estatus),
    });
    return true;
  } catch (err) {
    console.error('[mail:estatus] Error enviando correo:', err);
    return false;
  }
}

module.exports = { sendEstatusEmail };
