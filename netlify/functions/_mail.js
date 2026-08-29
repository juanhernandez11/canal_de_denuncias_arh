// Helper de correo para notificar al denunciante el cambio de estatus de su folio.
const nodemailer = require('nodemailer');

const ESTATUS_LABELS = {
  recibida: 'Recibida',
  en_revision: 'En revisión',
  en_investigacion: 'En investigación',
  resuelta: 'Resuelta',
  desestimada: 'Desestimada',
};

function buildEstatusHtml(folio, estatus) {
  const label = ESTATUS_LABELS[estatus] || estatus;
  return `
  <!DOCTYPE html>
  <html lang="es">
  <head><meta charset="utf-8"></head>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
      <tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
          <tr><td style="background:#1a237e;padding:30px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:24px;">ARH Consultores</h1>
            <p style="color:#ffc107;margin:8px 0 0;font-size:14px;">Canal de Denuncias</p>
          </td></tr>
          <tr><td style="padding:40px 30px;">
            <h2 style="color:#1a237e;margin:0 0 20px;font-size:20px;">Actualización de tu denuncia</h2>
            <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 25px;">
              El estatus de tu denuncia con folio <strong>${folio}</strong> ha sido actualizado a:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
              <table cellpadding="0" cellspacing="0" style="background:#fff8e1;border:2px solid #ffc107;border-radius:8px;padding:20px 40px;">
                <tr><td align="center">
                  <p style="margin:0 0 8px;font-size:13px;color:#666;text-transform:uppercase;letter-spacing:1px;">Nuevo estatus</p>
                  <p style="margin:0;font-size:24px;font-weight:bold;color:#f57c00;">${label}</p>
                </td></tr>
              </table>
            </td></tr></table>
            <p style="color:#333;font-size:15px;line-height:1.6;margin:25px 0 0;">
              Puedes consultar el detalle en cualquier momento usando tu folio. Tu información se
              trata con total confidencialidad.
            </p>
          </td></tr>
          <tr><td style="background:#1a237e;padding:20px 30px;text-align:center;">
            <p style="color:#fff;margin:0;font-size:12px;">Correo automático del Canal de Denuncias de ARH Consultores.</p>
            <p style="color:#ffc107;margin:8px 0 0;font-size:12px;">Confidencial — No responder a este correo.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
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
