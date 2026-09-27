// netlify/functions/upload-file.js
// Recibe un archivo en base64 desde el frontend y lo sube a Google Drive.
// Mantiene la misma interfaz que la versión R2 anterior.
// Solo acepta llamadas durante el flujo de envío de denuncia (no requiere auth admin).
//
// IMPORTANTE:
// - Todas las operaciones con Drive son server-side.
// - Los archivos se suben a carpetas privadas del Drive del admin.
// - Se guarda metadata en Neon (google_drive_file_id, google_drive_folder_id).
// - Nunca se exponen IDs de Drive directamente en la respuesta al usuario.
'use strict';

const { getOrCreateComplaintFolder, uploadFile } = require('./lib/googleDrive');
const { insertArchivoMeta } = require('./_data');
const crypto = require('crypto');

// Tipos MIME permitidos (allowlist — no expandir sin revisión de seguridad)
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);

// NOTA: Netlify Functions tiene límite de 6MB de body (base64 de un archivo de 4.5MB ~ 6MB).
// Si se necesitan archivos más grandes, usar un flujo de upload directo diferente.
const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4MB para dejar margen con el encoding base64

/**
 * Sanitiza el nombre del archivo eliminando caracteres peligrosos.
 * Previene path traversal y nombres maliciosos.
 */
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

    // --- Validaciones server-side ---

    // Folio: formato estricto ARH-YYYY-XXXXX
    if (!folio || typeof folio !== 'string' || !/^ARH-\d{4}-[A-Z0-9]{5}$/.test(folio)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Folio inválido' }) };
    }

    // Nombre de archivo requerido
    if (!nombre || typeof nombre !== 'string' || nombre.trim().length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Nombre de archivo requerido' }) };
    }

    // MIME type: allowlist estricta
    if (!ALLOWED_MIME.has(mime_type)) {
      return { statusCode: 400, body: JSON.stringify({ error: `Tipo de archivo no permitido: ${mime_type}` }) };
    }

    // Datos del archivo requeridos
    if (!data || typeof data !== 'string') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Datos del archivo requeridos' }) };
    }

    // Decodificar base64 (acepta data URL o base64 puro)
    const base64Data = data.includes(',') ? data.split(',')[1] : data;

    // Validar que sea base64 válido
    if (!/^[A-Za-z0-9+/=]+$/.test(base64Data.replace(/\s/g, ''))) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Datos del archivo con formato inválido' }) };
    }

    const buffer = Buffer.from(base64Data, 'base64');

    // Archivo vacío
    if (buffer.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'El archivo está vacío' }) };
    }

    // Tamaño máximo
    if (buffer.length > MAX_SIZE_BYTES) {
      return { statusCode: 400, body: JSON.stringify({ error: `Archivo demasiado grande (máx ${MAX_SIZE_BYTES / 1024 / 1024}MB)` }) };
    }

    // Nombre de archivo seguro + uuid para evitar colisiones e idempotencia
    const uuid = crypto.randomUUID();
    const safeNombre = sanitizeFilename(nombre);
    const storageFilename = `${uuid}-${safeNombre}`;

    // 1. Obtener o crear carpeta del folio en Drive (idempotente)
    const folderId = await getOrCreateComplaintFolder(folio);

    // 2. Subir archivo a Drive
    const { fileId } = await uploadFile({
      folio,
      folderId,
      buffer,
      mimeType: mime_type,
      storageFilename,
      originalName: nombre,
    });

    // 3. Guardar metadata en Neon
    const registro = await insertArchivoMeta({
      denuncia_folio:           folio,
      nombre_original:          nombre,
      nombre_storage:           storageFilename,
      mime_type,
      size_bytes:               buffer.length,
      r2_key:                   null,                  // No aplica — storage es Drive
      google_drive_file_id:     fileId,
      google_drive_folder_id:   folderId,
      storage_provider:         'google_drive',
    });

    console.log(`[upload-file] Archivo subido a Drive: ${fileId} para folio ${folio} (${buffer.length} bytes)`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, id: registro.id }),
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
