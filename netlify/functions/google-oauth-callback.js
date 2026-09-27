// netlify/functions/google-oauth-callback.js
// Maneja el callback de Google OAuth 2.0.
// Intercambia el authorization code por access_token + refresh_token.
//
// IMPORTANTE: El refresh_token es un secreto crítico.
// Nunca se devuelve en la respuesta JSON al cliente.
// Se muestra SOLO en esta respuesta para que el admin lo copie
// y lo guarde en Netlify Environment Variables como GOOGLE_REFRESH_TOKEN.
//
// URL: GET /.netlify/functions/google-oauth-callback?code=...
// (Netlify ejecuta esta función directamente en su ruta nativa)
'use strict';

const { google } = require('googleapis');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { code, error } = event.queryStringParameters || {};

  // Google rechazó la autorización o el usuario canceló
  if (error) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: buildErrorHtml(`Google denegó el acceso: ${error}`),
    };
  }

  if (!code) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: buildErrorHtml('No se recibió el código de autorización de Google.'),
    };
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri  = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: buildErrorHtml('Faltan variables de entorno del servidor (CLIENT_ID / CLIENT_SECRET / REDIRECT_URI).'),
    };
  }

  try {
    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // Intercambiar authorization code → tokens
    const { tokens } = await oAuth2Client.getToken(code);

    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      // Ocurre cuando el usuario ya autorizó antes y Google no re-emite el refresh token
      // Solución: revocar y volver a autorizar con prompt=consent
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: buildNoRefreshTokenHtml(),
      };
    }

    // Mostrar el refresh token al admin para que lo guarde en Netlify
    // NOTA: Esta es la ÚNICA vez que se muestra. No se guarda en BD ni en logs.
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: buildSuccessHtml(refreshToken),
    };

  } catch (err) {
    console.error('[google-oauth-callback] Error intercambiando code por token:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: buildErrorHtml(`Error al obtener tokens de Google: ${err.message}`),
    };
  }
};

// ============================================================
// HTML helpers — respuestas visuales para el admin
// ============================================================

function buildSuccessHtml(refreshToken) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Google Drive Autorizado</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 40px 20px; }
    .card { background: #fff; border-radius: 8px; max-width: 700px; margin: 0 auto; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
    h1 { color: #1a237e; margin-top: 0; }
    .token-box { background: #fff8e1; border: 2px solid #ffc107; border-radius: 6px; padding: 16px; word-break: break-all; font-family: monospace; font-size: 13px; margin: 20px 0; }
    .steps { background: #e8f5e9; border-left: 4px solid #4caf50; padding: 16px; border-radius: 4px; margin: 20px 0; }
    .steps ol { margin: 8px 0; padding-left: 20px; }
    .steps li { margin: 6px 0; }
    .warning { background: #fff3e0; border-left: 4px solid #ff9800; padding: 12px 16px; border-radius: 4px; margin: 20px 0; font-size: 14px; }
    code { background: #eee; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
  </style>
</head>
<body>
  <div class="card">
    <h1>✅ Google Drive Autorizado</h1>
    <p>El flujo OAuth fue exitoso. Copia el <strong>Refresh Token</strong> que aparece abajo y guárdalo en Netlify.</p>

    <div class="warning">
      ⚠️ <strong>Este token es un secreto crítico.</strong> Cierra esta pestaña después de copiarlo.
      No lo compartas, no lo envíes por correo, no lo subas a Git.
    </div>

    <p><strong>GOOGLE_REFRESH_TOKEN:</strong></p>
    <div class="token-box" id="token">${escapeHtml(refreshToken)}</div>

    <div class="steps">
      <strong>Pasos para guardar el token:</strong>
      <ol>
        <li>Copia el token de arriba.</li>
        <li>Ve a <strong>Netlify → Site Configuration → Environment Variables</strong>.</li>
        <li>Agrega (o actualiza) la variable <code>GOOGLE_REFRESH_TOKEN</code> con ese valor.</li>
        <li>Haz <strong>Deploy</strong> para que tome efecto.</li>
        <li>Cierra esta pestaña.</li>
      </ol>
    </div>

    <p style="color:#888; font-size:13px;">Este mensaje solo se muestra una vez. Si necesitas un nuevo token, repite el flujo en <code>/api/google-oauth</code>.</p>
  </div>
</body>
</html>`;
}

function buildNoRefreshTokenHtml() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Token no recibido</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 40px 20px; }
    .card { background: #fff; border-radius: 8px; max-width: 600px; margin: 0 auto; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
    h1 { color: #e65100; }
    .steps { background: #fff3e0; border-left: 4px solid #ff9800; padding: 16px; border-radius: 4px; }
    .steps ol { margin: 8px 0; padding-left: 20px; }
    code { background: #eee; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
  </style>
</head>
<body>
  <div class="card">
    <h1>⚠️ Refresh Token no recibido</h1>
    <p>Google solo emite el <code>refresh_token</code> la primera vez que autorizas la aplicación,
    o cuando se usa <code>prompt=consent</code> con una cuenta que ya revocó el acceso.</p>

    <div class="steps">
      <strong>Para obtener un refresh token nuevo:</strong>
      <ol>
        <li>Ve a <a href="https://myaccount.google.com/permissions" target="_blank">myaccount.google.com/permissions</a></li>
        <li>Busca <strong>canal-denuncias-arh</strong> y revoca el acceso.</li>
        <li>Regresa a <code>/api/google-oauth</code> e inicia el flujo nuevamente.</li>
      </ol>
    </div>
  </div>
</body>
</html>`;
}

function buildErrorHtml(message) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Error OAuth</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 40px 20px; }
    .card { background: #fff; border-radius: 8px; max-width: 600px; margin: 0 auto; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
    h1 { color: #c62828; }
    .msg { background: #ffebee; border-left: 4px solid #c62828; padding: 12px 16px; border-radius: 4px; font-family: monospace; }
  </style>
</head>
<body>
  <div class="card">
    <h1>❌ Error en OAuth</h1>
    <div class="msg">${escapeHtml(message)}</div>
  </div>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
