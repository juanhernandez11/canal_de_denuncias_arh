// netlify/functions/lib/googleDrive.js
// Módulo central para todas las operaciones con Google Drive.
// Centraliza autenticación OAuth2 + refresh token + operaciones de archivo y carpeta.
// TODAS las operaciones son server-side. Nunca exponer credenciales al cliente.
'use strict';

const { google } = require('googleapis');
const { Readable } = require('stream');

// ============================================================
// AUTENTICACIÓN
// ============================================================

/**
 * Devuelve un cliente OAuth2 listo para usar con el refresh token guardado
 * en variables de entorno de Netlify.
 */
function getAuthClient() {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret) {
    throw new Error('[googleDrive] Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET');
  }
  if (!refreshToken) {
    throw new Error('[googleDrive] Falta GOOGLE_REFRESH_TOKEN. Ejecuta el flujo OAuth en /api/google-oauth');
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
}

/**
 * Devuelve una instancia del cliente de Drive autenticada.
 */
function getDriveClient() {
  return google.drive({ version: 'v3', auth: getAuthClient() });
}

// ============================================================
// GESTIÓN DE CARPETAS
// ============================================================

/**
 * Busca una carpeta por nombre dentro de un padre específico.
 * @returns {string|null} folderId si existe, null si no.
 */
async function findFolder(drive, name, parentId) {
  // Escapar comillas simples en el nombre para la query
  const safeName = name.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });
  const files = res.data.files || [];
  return files.length > 0 ? files[0].id : null;
}

/**
 * Crea una carpeta con el nombre dado dentro del padre indicado.
 * @returns {string} folderId de la carpeta creada.
 */
async function createFolder(drive, name, parentId) {
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  });
  return res.data.id;
}

/**
 * Obtiene o crea una carpeta de forma idempotente.
 * Nunca crea duplicados en reintentos.
 * @returns {string} folderId
 */
async function getOrCreateFolder(drive, name, parentId) {
  const existing = await findFolder(drive, name, parentId);
  if (existing) return existing;
  return createFolder(drive, name, parentId);
}

/**
 * Obtiene o crea la carpeta específica para un folio:
 *   Canal-Denuncias-ARH / YYYY / {folio}
 *
 * Operación idempotente — segurizda contra duplicados.
 * @param {string} folio  ej. "ARH-2026-RQA3Z"
 * @returns {string} folderId de la carpeta del folio
 */
async function getOrCreateComplaintFolder(folio) {
  // Validar formato de folio antes de crear cualquier carpeta
  if (!/^ARH-\d{4}-[A-Z0-9]{5}$/.test(folio)) {
    throw new Error(`[googleDrive] Folio con formato inválido: ${folio}`);
  }

  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!rootFolderId) {
    throw new Error('[googleDrive] Falta GOOGLE_DRIVE_ROOT_FOLDER_ID');
  }

  const year = folio.split('-')[1]; // "ARH-2026-XXXXX" → "2026"
  const drive = getDriveClient();

  // Canal-Denuncias-ARH / YYYY
  const yearFolderId = await getOrCreateFolder(drive, year, rootFolderId);

  // Canal-Denuncias-ARH / YYYY / ARH-YYYY-XXXXX
  const folioFolderId = await getOrCreateFolder(drive, folio, yearFolderId);

  return folioFolderId;
}

// ============================================================
// SUBIDA DE ARCHIVOS
// ============================================================

/**
 * Sube un Buffer a Google Drive dentro de la carpeta del folio.
 * Usa nombre controlado (uuid + nombre sanitizado) para evitar colisiones.
 *
 * @param {object} opts
 * @param {string}  opts.folio           Folio de la denuncia
 * @param {string}  opts.folderId        ID de la carpeta Drive donde subir
 * @param {Buffer}  opts.buffer          Contenido del archivo
 * @param {string}  opts.mimeType        MIME type del archivo
 * @param {string}  opts.storageFilename Nombre controlado (uuid-safeNombre)
 * @param {string}  opts.originalName    Nombre original para metadata
 * @returns {{ fileId: string, folderId: string }}
 */
async function uploadFile({ folio, folderId, buffer, mimeType, storageFilename, originalName }) {
  const drive = getDriveClient();

  // Convertir Buffer a Stream para la API de Drive
  const stream = Readable.from(buffer);

  const res = await drive.files.create({
    requestBody: {
      name: storageFilename,
      parents: [folderId],
      // Metadata interna como description (no se expone públicamente)
      description: `Folio: ${folio} | Original: ${originalName}`,
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id, name, size, mimeType',
  });

  const fileId = res.data.id;
  if (!fileId) throw new Error('[googleDrive] Upload no devolvió fileId');

  return { fileId, folderId };
}

// ============================================================
// DESCARGA / ACCESO A ARCHIVOS
// ============================================================

/**
 * Descarga el contenido de un archivo de Drive como Buffer.
 * Usado por get-file.js para hacer proxy seguro al administrador.
 * NUNCA se devuelve una URL directa al cliente.
 *
 * @param {string} fileId  ID del archivo en Google Drive
 * @returns {Buffer}
 */
async function downloadFileAsBuffer(fileId) {
  const drive = getDriveClient();

  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(res.data);
}

/**
 * Obtiene metadata de un archivo de Drive.
 * @param {string} fileId
 * @returns {{ name, mimeType, size }}
 */
async function getFileMetadata(fileId) {
  const drive = getDriveClient();
  const res = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size',
  });
  return res.data;
}

// ============================================================
// ELIMINACIÓN (solo uso en tests/scripts, nunca en flujo normal)
// ============================================================

/**
 * Mueve un archivo a la papelera de Drive (no elimina permanentemente).
 * Solo usar en scripts de limpieza o tests.
 * @param {string} fileId
 */
async function trashFile(fileId) {
  const drive = getDriveClient();
  await drive.files.update({
    fileId,
    requestBody: { trashed: true },
  });
}

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  getAuthClient,
  getDriveClient,
  getOrCreateComplaintFolder,
  uploadFile,
  downloadFileAsBuffer,
  getFileMetadata,
  trashFile,
};
