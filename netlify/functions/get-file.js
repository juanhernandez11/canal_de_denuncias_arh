// netlify/functions/get-file.js
// Genera una URL firmada temporal para descargar un archivo de R2.
// REQUIERE autenticación admin (JWT cookie).
'use strict';

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { getArchivo } = require('./_data');
const jwt = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET || 'dev-secret-arh-change-me';
const COOKIE_NAME = 'admin_token';
const URL_TTL_SECONDS = 300; // 5 minutos

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx > -1) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
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

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKey || !secretKey) throw new Error('Faltan variables R2');
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  // Verificar auth admin
  const user = getAuth(event);
  if (!user) {
    return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'No autenticado' }) };
  }

  try {
    const archivoId = event.queryStringParameters?.id;
    if (!archivoId || isNaN(Number(archivoId))) {
      return { statusCode: 400, body: JSON.stringify({ error: 'ID de archivo requerido' }) };
    }

    // Obtener metadata desde Neon
    const archivo = await getArchivo(Number(archivoId));
    if (!archivo) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Archivo no encontrado' }) };
    }

    // Generar signed URL (expira en 5 minutos)
    const client = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME;
    if (!bucket) throw new Error('Falta R2_BUCKET_NAME');

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: archivo.r2_key,
      ResponseContentDisposition: `attachment; filename="${archivo.nombre_original}"`,
    });

    const url = await getSignedUrl(client, command, { expiresIn: URL_TTL_SECONDS });

    console.log(`[get-file] Signed URL generada para archivo ${archivoId} por ${user.username}`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        nombre_original: archivo.nombre_original,
        mime_type: archivo.mime_type,
        size_bytes: archivo.size_bytes,
        expires_in: URL_TTL_SECONDS,
      }),
    };

  } catch (err) {
    console.error('[get-file] ERROR:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Error al generar URL de descarga' }),
    };
  }
};
