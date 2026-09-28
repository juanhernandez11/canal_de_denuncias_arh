// scripts/get-refresh-token.mjs
// Script ONE-TIME para obtener el GOOGLE_REFRESH_TOKEN.
// Corre un servidor HTTP local que actúa como redirect URI temporal.
//
// Uso:
//   node scripts/get-refresh-token.mjs
//
// IMPORTANTE: Necesitas agregar temporalmente http://localhost:3333/callback
// como Redirect URI en Google Cloud Console antes de correr este script.
// Después puedes eliminarlo.

import http from 'http';
import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Cargar .env.local manualmente
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx > -1) {
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    env[key] = val;
  }
}

const CLIENT_ID     = env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;
const LOCAL_REDIRECT = 'http://localhost:3333/callback';
const PORT = 3333;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('ERROR: Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET en .env.local');
  process.exit(1);
}

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, LOCAL_REDIRECT);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive.file'],
});

// Servidor temporal que captura el callback
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname !== '/callback') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const code  = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h2>❌ Error: ${error}</h2>`);
    server.close();
    return;
  }

  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h2>❌ No se recibió el código de autorización</h2>');
    server.close();
    return;
  }

  try {
    const { tokens } = await oAuth2Client.getToken(code);

    if (!tokens.refresh_token) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <h2>⚠️ No se obtuvo refresh_token</h2>
        <p>Google no emite el refresh_token si la app ya fue autorizada antes.</p>
        <p>Ve a <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>,
        revoca el acceso a <strong>canal-denuncias-arh</strong> y vuelve a correr este script.</p>
      `);
      server.close();
      return;
    }

    // Mostrar en consola (no en archivo)
    console.log('\n✅ ¡Refresh Token obtenido!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nCopia ese valor y:');
    console.log('  1. Pégalo en .env.local como GOOGLE_REFRESH_TOKEN=...');
    console.log('  2. Guárdalo en Netlify → Environment Variables → GOOGLE_REFRESH_TOKEN');
    console.log('  3. Elimina http://localhost:3333/callback de Google Cloud Console\n');

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="utf-8"><title>Token obtenido</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 40px 20px; }
        .card { background: #fff; border-radius: 8px; max-width: 700px; margin: 0 auto; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
        h1 { color: #2e7d32; }
        .token { background: #f1f8e9; border: 2px solid #8bc34a; border-radius: 6px; padding: 16px; word-break: break-all; font-family: monospace; font-size: 13px; margin: 20px 0; }
        .warn { background: #fff8e1; border-left: 4px solid #ffc107; padding: 12px 16px; border-radius: 4px; margin: 16px 0; font-size: 14px; }
      </style>
      </head>
      <body>
        <div class="card">
          <h1>✅ Refresh Token obtenido</h1>
          <p>Copia este valor y guárdalo en <strong>.env.local</strong> y en <strong>Netlify</strong>:</p>
          <div class="token">${tokens.refresh_token}</div>
          <div class="warn">
            ⚠️ <strong>Este token es secreto.</strong> Cierra esta pestaña después de copiarlo.
            El token también aparece en la consola donde corriste el script.
          </div>
          <p>También recuerda eliminar <code>http://localhost:3333/callback</code>
          de los Redirect URIs en Google Cloud Console.</p>
        </div>
      </body>
      </html>
    `);

    server.close();

  } catch (err) {
    console.error('ERROR intercambiando code por token:', err.message);
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h2>❌ Error: ${err.message}</h2>`);
    server.close();
  }
});

server.listen(PORT, () => {
  console.log('\n🔑 Script para obtener GOOGLE_REFRESH_TOKEN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('PASO PREVIO OBLIGATORIO:');
  console.log('Agrega este Redirect URI en Google Cloud Console:');
  console.log('  http://localhost:3333/callback\n');
  console.log('  → console.cloud.google.com → APIs & Services → Credentials');
  console.log('  → tu cliente OAuth → Edit → Authorized redirect URIs → Add URI\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Cuando lo hayas agregado, abre este enlace en tu navegador:\n');
  console.log(authUrl);
  console.log('\nEsperando callback en http://localhost:3333/callback ...\n');
});
