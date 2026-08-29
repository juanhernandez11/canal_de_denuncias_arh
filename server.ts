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
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmación de Denuncia</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f5f5;padding:20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);max-width:600px;width:100%;">
          
          <!-- Header -->
          <tr>
            <td style="background-color:#1a237e;padding:30px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:1px;">ARH Consultores</h1>
              <p style="margin:8px 0 0;color:#ffc107;font-size:14px;font-weight:500;">Canal de Denuncias</p>
            </td>
          </tr>

          <!-- Accent bar -->
          <tr>
            <td style="background: linear-gradient(90deg, #f57c00, #ffc107);height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 20px;color:#1a237e;font-size:20px;font-weight:600;">Su denuncia ha sido recibida correctamente</h2>
              
              <p style="margin:0 0 16px;color:#333333;font-size:15px;line-height:1.6;">
                Agradecemos su confianza al utilizar nuestro Canal de Denuncias. Su reporte ha sido registrado exitosamente en nuestro sistema y será revisado por el comité correspondiente.
              </p>

              <!-- Folio Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
                <tr>
                  <td style="background-color:#f5f5f5;border:2px solid #1a237e;border-radius:8px;padding:24px;text-align:center;">
                    <p style="margin:0 0 8px;color:#666666;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Folio de seguimiento</p>
                    <p style="margin:0;color:#1a237e;font-size:28px;font-weight:700;letter-spacing:2px;">${folio}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px;color:#333333;font-size:15px;line-height:1.6;">
                <strong style="color:#f57c00;">Importante:</strong> Conserve este número de folio. Es su identificador único para dar seguimiento al estatus de su denuncia.
              </p>

              <!-- Instructions -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;background-color:#fff8e1;border-left:4px solid #ffc107;border-radius:4px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 8px;color:#1a237e;font-size:14px;font-weight:600;">Instrucciones de seguimiento:</p>
                    <ul style="margin:0;padding:0 0 0 20px;color:#555555;font-size:14px;line-height:1.8;">
                      <li>Guarde este correo como comprobante de su denuncia.</li>
                      <li>Utilice su folio <strong>${folio}</strong> para consultar el estatus de su caso.</li>
                      <li>El comité evaluará su denuncia y tomará las acciones correspondientes.</li>
                      <li>La confidencialidad de su información está garantizada.</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;color:#333333;font-size:15px;line-height:1.6;">
                Si tiene alguna duda adicional, no dude en comunicarse con nosotros a través del canal de denuncias.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#1a237e;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 8px;color:#ffffff;font-size:13px;">Este es un correo automático del Canal de Denuncias</p>
              <p style="margin:0;color:#ffc107;font-size:12px;">ARH Consultores &copy; 2026 — Todos los derechos reservados</p>
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
    const { to, subject, text, html, attachments, denuncianteEmail } = req.body;

    const folio = generateFolio();

    try {
      // 1. Enviar email original al comité
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to,
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
