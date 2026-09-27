// netlify/functions/google-oauth.js
// Inicia el flujo OAuth 2.0 con Google.
// Redirige al administrador a la pantalla de autorización de Google.
//
// IMPORTANTE: Esta ruta debe protegerse con autenticación admin.
// Solo el administrador del sistema debe poder iniciar este flujo.
// El refresh token obtenido da acceso a Google Drive.
//
// URL: GET /api/google-oauth
'use strict';

const { google } = require('googleapis');
const jwt = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET || 'dev-secret-arh-change-me';
const COOKIE_NAME = 'admin_token';

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx > -1) {
      out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    }
  });
  return out;
}

function getAuth(event) {
  const cookies = parseCookies(event.headers.cookie || event.headers.Cookie || '');
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded && typeof decoded.username === 'string' ? decoded : null;
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  // Solo GET
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Requiere sesión admin activa
  const user = getAuth(event);
  if (!user) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'No autenticado. Inicia sesión en el panel admin primero.' }),
    };
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri  = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Faltan variables de entorno: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o GOOGLE_REDIRECT_URI',
      }),
    };
  }

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  // Generar URL de autorización
  // access_type=offline → fuerza a Google a devolver refresh_token
  // prompt=consent → fuerza pantalla de consentimiento para obtener refresh_token incluso si ya fue autorizado
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive.file'],
  });

  // Redirigir al admin a Google
  return {
    statusCode: 302,
    headers: { Location: authUrl },
    body: '',
  };
};
