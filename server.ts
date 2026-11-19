import express from "express";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import { registerAdminRoutes } from "./src/server/routes.ts";
import { insertDenuncia } from "./src/server/db.ts";

// Carga variables de entorno. Prioridad: .env.local sobre .env
dotenv.config({ path: ".env.local" });
dotenv.config();

function generateFolio(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const randomBytes = crypto.randomBytes(5);
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars[randomBytes[i] % chars.length];
  }
  return `ARH-2026-${code}`;
}

function buildDenuncianteConfirmationHtml(folio: string): string {
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
                  <td width="25%" style="text-align:center;padding:0 4px;">
                    <div style="width:32px;height:32px;border-radius:50%;background-color:#1a237e;margin:0 auto 8px;">
                      <span style="color:#ffffff;font-size:14px;font-weight:700;line-height:32px;display:block;">&#10003;</span>
                    </div>
                    <p style="margin:0;font-size:11px;font-weight:700;color:#1a237e;">Recibida</p>
                  </td>
                  <td width="25%" style="text-align:center;padding:0 4px;">
                    <div style="width:32px;height:32px;border-radius:50%;background-color:#e2e8f0;margin:0 auto 8px;">
                      <span style="color:#94a3b8;font-size:13px;font-weight:700;line-height:32px;display:block;">2</span>
                    </div>
                    <p style="margin:0;font-size:11px;color:#94a3b8;">En revisión</p>
                  </td>
                  <td width="25%" style="text-align:center;padding:0 4px;">
                    <div style="width:32px;height:32px;border-radius:50%;background-color:#e2e8f0;margin:0 auto 8px;">
                      <span style="color:#94a3b8;font-size:13px;font-weight:700;line-height:32px;display:block;">3</span>
                    </div>
                    <p style="margin:0;font-size:11px;color:#94a3b8;">En investigación</p>
                  </td>
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

              <!-- Aviso -->
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(cookieParser());

  registerAdminRoutes(app);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  app.post("/api/send-email", async (req, res) => {
    const { subject, text, html, attachments, denuncianteEmail } = req.body;

    // Destinatarios autorizados: solo cuentas @arhconsultores.com (auditoría)
    const toInterno = 'etica@arhconsultores.com, gcarrillo@arhconsultores.com';

    const folio = generateFolio();

    try {
      // 1. Enviar email original al comité
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: toInterno,
        subject: `[${folio}] ${subject}`,
        text,
        html,
        attachments: (attachments || []).map((a: { name: string; data: string }) => ({
          filename: a.name,
          path: a.data,
        })),
      });

      // 2. Si hay email del denunciante, enviar confirmación
      if (denuncianteEmail) {
        const confirmationHtml = buildDenuncianteConfirmationHtml(folio);
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: denuncianteEmail,
          subject: `Confirmación de denuncia recibida - Folio ${folio}`,
          html: confirmationHtml,
        });
      }

      // 3. Persistir la denuncia en la base de datos (no rompe el flujo)
      try {
        const denuncia = (req.body?.denuncia ?? {}) as Record<string, unknown>;
        const pick = (...keys: string[]): string | null => {
          for (const k of keys) {
            const v = denuncia[k];
            if (typeof v === "string" && v.trim()) return v;
            if (typeof v === "number") return String(v);
          }
          return null;
        };

        const hasDenuncia = Object.keys(denuncia).length > 0;

        // Estructuras anidadas reales del Wizard (formData.denunciante.*, formData.notificacion.*)
        const denunciante = (denuncia.denunciante ?? {}) as Record<string, unknown>;
        const notificacion = (denuncia.notificacion ?? {}) as Record<string, unknown>;
        const str = (v: unknown): string | null =>
          typeof v === "string" && v.trim() ? v : null;
        const nombreCompleto =
          [str(denunciante.nombre), str(denunciante.apellidos)]
            .filter(Boolean)
            .join(" ") || null;

        await insertDenuncia({
          folio,
          tipo: pick("tipo", "tipoDenuncia", "categoria"),
          empresa: pick("empresa", "compania", "company"),
          centro: pick("centro", "centroTrabajo", "sucursal"),
          modo:
            pick("modo", "modalidad") ??
            (denuncianteEmail ? "identificado" : "anonimo"),
          denunciante_nombre:
            nombreCompleto ?? pick("denuncianteNombre", "nombre", "denunciante"),
          denunciante_correo:
            str(denunciante.correo) ??
            pick("denuncianteCorreo", "correo", "email") ??
            (typeof denuncianteEmail === "string" ? denuncianteEmail : null),
          descripcion:
            str(notificacion.descripcion) ??
            pick("descripcion", "detalle", "hechos") ??
            text ??
            null,
          payload_json: JSON.stringify(
            hasDenuncia ? denuncia : { subject, text }
          ),
        });
      } catch (dbError) {
        console.error("Error persistiendo denuncia (folio enviado):", dbError);
      }

      res.status(200).json({ message: "Email sent successfully", folio });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
