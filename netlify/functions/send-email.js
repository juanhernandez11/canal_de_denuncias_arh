const nodemailer = require('nodemailer');

function generarFolio() {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let random = '';
  for (let i = 0; i < 5; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ARH-${year}-${random}`;
}

function buildConfirmacionHtml(folio) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="margin:0; padding:0; background-color:#f5f5f5; font-family: Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5; padding: 40px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background-color:#1a237e; padding: 30px; text-align:center;">
                  <h1 style="color:#ffffff; margin:0; font-size:24px;">ARH Consultores</h1>
                  <p style="color:#ffc107; margin:8px 0 0 0; font-size:14px;">Canal de Denuncias</p>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="color:#1a237e; margin:0 0 20px 0; font-size:20px;">Confirmación de Recepción</h2>
                  <p style="color:#333333; font-size:15px; line-height:1.6; margin:0 0 25px 0;">
                    Hemos recibido su denuncia correctamente. A continuación le proporcionamos su número de folio para seguimiento:
                  </p>
                  <!-- Folio Box -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <table cellpadding="0" cellspacing="0" style="background-color:#fff8e1; border: 2px solid #ffc107; border-radius:8px; padding: 20px 40px;">
                          <tr>
                            <td align="center">
                              <p style="margin:0 0 8px 0; font-size:13px; color:#666666; text-transform:uppercase; letter-spacing:1px;">Número de Folio</p>
                              <p style="margin:0; font-size:28px; font-weight:bold; color:#f57c00; letter-spacing:2px;">${folio}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  <p style="color:#333333; font-size:15px; line-height:1.6; margin:25px 0 0 0;">
                    Guarde este folio para cualquier consulta o seguimiento de su caso. Su denuncia será tratada con total confidencialidad.
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background-color:#1a237e; padding: 20px 30px; text-align:center;">
                  <p style="color:#ffffff; margin:0; font-size:12px;">Este es un correo automático del Canal de Denuncias de ARH Consultores.</p>
                  <p style="color:#ffc107; margin:8px 0 0 0; font-size:12px;">Confidencial — No responder a este correo.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { to, subject, text, html, attachments, denuncianteEmail } = JSON.parse(event.body);

    const folio = generarFolio();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Enviar email principal (notificación interna)
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: `[${folio}] ${subject}`,
      text,
      html,
      attachments: (attachments || []).map((a) => ({
        filename: a.name,
        path: a.data,
      })),
    });

    // Si se proporcionó email del denunciante, enviar confirmación
    if (denuncianteEmail) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: denuncianteEmail,
        subject: `Confirmación de Denuncia - Folio ${folio}`,
        text: `Su denuncia ha sido recibida exitosamente.\n\nNúmero de folio: ${folio}\n\nGuarde este folio para seguimiento de su caso.\n\nARH Consultores - Canal de Denuncias`,
        html: buildConfirmacionHtml(folio),
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Email sent successfully',
        folio,
      }),
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send email' }) };
  }
};
