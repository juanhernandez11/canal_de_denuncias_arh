// netlify/functions/get-file.js
// Proxy seguro para descargar archivos desde Google Drive.
// REQUIERE autenticación admin (JWT cookie).
//
// IMPORTANTE:
// - Nunca se devuelve una URL directa de Drive al cliente (evita exposición de tokens).
// - El backend descarga el archivo y lo retransmite al admin como base64.
// - Valida que el archivo exista en Neon antes de consultar Drive.
// - No se puede acceder a un archivo solo con el fileId — se requiere el ID de Neon.
'use strict';

const { downloadFileAsBuffer, getFileMetadata } = require('./lib/googleDrive');
const { getArchivo } = require('./_data');
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
  } catch { return null; }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  // Verificar autenticación admin
  const user = getAuth(event);
  if (!user) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'No autenticado' }),
    };
  }

  try {
    const archivoId = event.queryStringParameters?.id;

    if (!archivoId || isNaN(Number(archivoId))) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'ID de archivo requerido' }),
      };
    }

    // 1. Obtener metadata desde Neon (contiene el google_drive_file_id)
    const archivo = await getArchivo(Number(archivoId));
    if (!archivo) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Archivo no encontrado' }),
      };
    }

    // 2. Verificar que el archivo tiene Drive file ID
    if (!archivo.google_drive_file_id) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Este archivo no tiene Google Drive file ID (puede ser un archivo R2 heredado)' }),
      };
    }

    // 3. Descargar el archivo desde Drive como Buffer
    // El fileId viene de Neon — el cliente nunca puede inyectar un fileId arbitrario
    const buffer = await downloadFileAsBuffer(archivo.google_drive_file_id);

    const contentDisposition = `attachment; filename="${encodeURIComponent(archivo.nombre_original)}"`;

    console.log(`[get-file] Descarga de archivo ${archivoId} (Drive: ${archivo.google_drive_file_id}) por ${user.username}`);

    // 4. Retransmitir el archivo al admin
    // Netlify Functions retorna body como string, usamos base64 isBase64Encoded
    return {
      statusCode: 200,
      headers: {
        'Content-Type': archivo.mime_type,
        'Content-Disposition': contentDisposition,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    };

  } catch (err) {
    console.error('[get-file] ERROR:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Error al descargar el archivo' }),
    };
  }
};
