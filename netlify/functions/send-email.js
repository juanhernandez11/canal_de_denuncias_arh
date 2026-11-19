const nodemailer = require('nodemailer');
const { insertDenuncia, extractDenunciaFields } = require('./_data');

// ---------------------------------------------------------------------------
// Rate limiting en memoria (por IP). No persiste entre instancias de Lambda,
// pero limita ráfagas cortas que son el caso de abuso más común.
// Para producción de alto volumen, reemplazar con @upstash/ratelimit + Redis.
// ---------------------------------------------------------------------------
const RATE_WINDOW_MS = 60_000; // ventana de 1 minuto
const MAX_PER_WINDOW = 5;      // máximo 5 envíos por IP por ventana
const ipCounts = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = ipCounts.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW_MS) {
    ipCounts.set(ip, { count: 1, start: now });
    return true;
  }
  if (entry.count >= MAX_PER_WINDOW) return false;
  ipCounts.set(ip, { count: entry.count + 1, start: entry.start });
  return true;
}

// MIGRADO: folio generado con crypto.randomBytes (criptográficamente seguro)
// I-01: usa 6 bytes (~2.2 billones de combinaciones) y reintenta hasta 3 veces en colisión.
function generarFolio() {
  const year  = new Date().getFullYear();
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = require('crypto').randomBytes(6);
  let random  = '';
  for (let i = 0; i < 6; i++) {
    random += chars[bytes[i] % chars.length];
  }
  return `ARH-${year}-${random}`;
}

function buildConfirmacionHtml(folio) {
  const trackingUrl = `https://denunciasarhconsultores.netlify.app/tracking/${folio}`;
  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmación de Denuncia - ${folio}</title>
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

          <!-- Badge estatus -->
          <tr>
            <td style="background-color:#eff6ff;border-bottom:3px solid #3b82f6;padding:16px 40px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:10px;vertical-align:middle;">
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background-color:#3b82f6;"></span>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1d4ed8;">Estatus actual</span>
                    &nbsp;&nbsp;
                    <span style="display:inline-block;padding:4px 14px;border-radius:20px;background-color:#dbeafe;border:1px solid #93c5fd;font-size:12px;font-weight:700;color:#1e40af;">Recibida</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cuerpo -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <h2 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#0f172a;">Tu denuncia fue recibida</h2>
              <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7;">
                Hemos registrado tu comunicación correctamente. El comité de ética la revisará con total confidencialidad y dará seguimiento en los próximos días.
              </p>

              <!-- Folio box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:linear-gradient(135deg,#f57c00,#ffc107);border-radius:10px;padding:24px 32px;text-align:center;">
                    <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.85);">Tu folio de seguimiento</p>
                    <p style="margin:0;font-size:30px;font-weight:800;color:#ffffff;letter-spacing:4px;">${folio}</p>
                    <p style="margin:8px 0 0;font-size:12px;color:rgba(255,255,255,0.8);">Guárdalo — lo necesitarás para consultar el avance de tu caso</p>
                  </td>
                </tr>
              </table>

              <!-- Línea de tiempo -->
              <p style="margin:0 0 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;">Proceso de atención</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                <tr>
                  <!-- Recibida: activo -->
                  <td width="25%" style="text-align:center;padding:0 4px;">
                    <div style="width:32px;height:32px;border-radius:50%;background-color:#1a237e;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;">
                      <span style="color:#ffffff;font-size:14px;font-weight:700;line-height:32px;display:block;">&#10003;</span>
                    </div>
                    <p style="margin:0;font-size:11px;font-weight:700;color:#1a237e;">Recibida</p>
                  </td>
                  <!-- En revisión: pendiente -->
                  <td width="25%" style="text-align:center;padding:0 4px;">
                    <div style="width:32px;height:32px;border-radius:50%;background-color:#e2e8f0;margin:0 auto 8px;">
                      <span style="color:#94a3b8;font-size:13px;font-weight:700;line-height:32px;display:block;">2</span>
                    </div>
                    <p style="margin:0;font-size:11px;color:#94a3b8;">En revisión</p>
                  </td>
                  <!-- En investigación: pendiente -->
                  <td width="25%" style="text-align:center;padding:0 4px;">
                    <div style="width:32px;height:32px;border-radius:50%;background-color:#e2e8f0;margin:0 auto 8px;">
                      <span style="color:#94a3b8;font-size:13px;font-weight:700;line-height:32px;display:block;">3</span>
                    </div>
                    <p style="margin:0;font-size:11px;color:#94a3b8;">En investigación</p>
                  </td>
                  <!-- Resuelta: pendiente -->
                  <td width="25%" style="text-align:center;padding:0 4px;">
                    <div style="width:32px;height:32px;border-radius:50%;background-color:#e2e8f0;margin:0 auto 8px;">
                      <span style="color:#94a3b8;font-size:13px;font-weight:700;line-height:32px;display:block;">4</span>
                    </div>
                    <p style="margin:0;font-size:11px;color:#94a3b8;">Resuelta</p>
                  </td>
                </tr>
              </table>

              <!-- Botón CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${trackingUrl}"
                       style="display:inline-block;padding:14px 36px;background-color:#1a237e;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:0.3px;">
                      Consultar estatus de mi denuncia →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Aviso spam -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fefce8;border:1px solid #fde68a;border-radius:8px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0;font-size:12px;color:#92400e;line-height:1.6;">
                      &#x1F4A1; Si no recuerdas haber enviado esta denuncia, ignora este correo. Si necesitas ayuda, contacta a tu área de Recursos Humanos.
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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Rate limiting por IP
  const clientIp =
    event.headers?.['x-forwarded-for']?.split(',')[0].trim() ||
    event.headers?.['client-ip'] ||
    'unknown';
  if (!checkRateLimit(clientIp)) {
    return {
      statusCode: 429,
      body: JSON.stringify({ error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' }),
    };
  }

  try {
    const { subject, text, html, attachments, denuncianteEmail } = JSON.parse(event.body);

    const folio = generarFolio();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Validación de adjuntos: tipo MIME y tamaño (M-03)
    const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024; // 2 MB
    const ALLOWED_MIME = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain',
    ];
    for (const a of (attachments || [])) {
      const mimeMatch = (a.data || '').match(/^data:([^;]+);base64,/);
      if (!mimeMatch || !ALLOWED_MIME.includes(mimeMatch[1])) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Tipo de archivo no permitido: ${mimeMatch?.[1] ?? 'desconocido'}` }),
        };
      }
      // Tamaño aproximado decodificado
      const base64Data = a.data.split(',')[1] || '';
      const sizeBytes = Math.ceil((base64Data.length * 3) / 4);
      if (sizeBytes > MAX_ATTACHMENT_BYTES) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Archivo demasiado grande (máximo 2 MB): ${a.name}` }),
        };
      }
    }

    // Destinatarios autorizados: solo cuentas @arhconsultores.com (auditoría)
    const allRecipients = ['etica@arhconsultores.com', 'gcarrillo@arhconsultores.com'].join(', ');

    // Enviar email principal (notificación interna)
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: allRecipients,
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

    // Persistir la denuncia en Neon con reintento en colisión de folio (I-01)
    let folioFinal = folio;
    try {
      const parsedBody = JSON.parse(event.body);
      let inserted = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await insertDenuncia({ folio: folioFinal, ...extractDenunciaFields(parsedBody) });
          inserted = true;
          break;
        } catch (conflictErr) {
          // ON CONFLICT en Neon lanza error con code 23505 (unique_violation)
          if (conflictErr?.code === '23505' && attempt < 2) {
            folioFinal = generarFolio();
            console.warn(`[send-email] Colisión de folio, reintentando con ${folioFinal}`);
          } else {
            throw conflictErr;
          }
        }
      }
      if (inserted) console.log(`[send-email] Denuncia persistida en Neon: ${folioFinal}`);
    } catch (dbError) {
      // I-02: solo se loguea el mensaje, nunca el stack completo en producción
      const msg = dbError instanceof Error ? dbError.message : String(dbError);
      console.error(`[send-email] ERROR persistiendo ${folioFinal} en Neon: ${msg}`);
      console.error('[send-email] DATABASE_URL definida:', !!process.env.DATABASE_URL);
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
