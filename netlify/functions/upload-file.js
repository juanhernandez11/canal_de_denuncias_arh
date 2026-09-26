// netlify/functions/upload-file.js
// Recibe un archivo en base64 desde el frontend y lo sube a Cloudflare R2.
// Solo acepta llamadas durante el flujo de envío de denuncia (no requiere auth admin).
// El folio se genera en send-email.js y se pasa junto con el archivo.
'use strict';

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { insertArchivoMeta } = require('./_data');
const crypto = require('crypto');

// Tipos MIME permitidos
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function getR2Client() {
  const accountId  = process.env.R2_ACCOUNT_ID;
  const accessKey  = process.env.R2_ACCESS_KEY_ID;
  const secretKey  = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKey || !secretKey) {
    throw new Error('[upload-file] Faltan variables R2_ACCOUNT_ID, R2_ACCESS_KEY_ID o R2_SECRET_ACCESS_KEY');
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });
}

function sanitizeFilename(name) {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/[^a-zA-Z0-9._-]/g, '_')                // solo chars seguros
    .replace(/_{2,}/g, '_')                           // no doble guión bajo
    .slice(0, 100);                                   // max 100 chars
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { folio, nombre, mime_type, data } = JSON.parse(event.body || '{}');

    // Validaciones
    if (!folio || typeof folio !== 'string' || !/^ARH-\d{4}-[A-Z0-9]{5}$/.test(folio)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Folio inválido' }) };
    }
    if (!nombre || typeof nombre !== 'string') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Nombre de archivo requerido' }) };
    }
    if (!ALLOWED_MIME.has(mime_type)) {
      return { statusCode: 400, body: JSON.stringify({ error: `Tipo de archivo no permitido: ${mime_type}` }) };
    }
    if (!data || typeof data !== 'string') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Datos del archivo requeridos' }) };
    }

    // Decodificar base64 (puede venir como data URL o base64 puro)
    const base64Data = data.includes(',') ? data.split(',')[1] : data;
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > MAX_SIZE_BYTES) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Archivo demasiado grande (máx 10MB)' }) };
    }

    // Generar key única y segura — NUNCA usa el nombre del usuario directamente como path
    const uuid = crypto.randomUUID();
    const safeNombre = sanitizeFilename(nombre);
    const r2Key = `denuncias/${folio}/${uuid}-${safeNombre}`;

    // Subir a R2
    const client = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME;
    if (!bucket) throw new Error('[upload-file] Falta R2_BUCKET_NAME');

    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: r2Key,
      Body: buffer,
      ContentType: mime_type,
      Metadata: { folio, nombre_original: nombre },
    }));

    // Guardar metadata en Neon
    const registro = await insertArchivoMeta({
      denuncia_folio:  folio,
      nombre_original: nombre,
      nombre_storage:  safeNombre,
      mime_type,
      size_bytes:      buffer.length,
      r2_key:          r2Key,
    });

    console.log(`[upload-file] Archivo subido: ${r2Key} (${buffer.length} bytes)`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, id: registro.id, r2_key: r2Key }),
    };

  } catch (err) {
    console.error('[upload-file] ERROR:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Error al subir el archivo' }),
    };
  }
};
