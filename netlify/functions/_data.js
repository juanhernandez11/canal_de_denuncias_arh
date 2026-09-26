// netlify/functions/_data.js
// MIGRADO: Supabase → Neon PostgreSQL (pg / node-postgres)
// Todas las funciones mantienen exactamente la misma firma que antes.

'use strict';
const { Pool } = require('pg');

// Pool singleton — max:1 en serverless para evitar connection leaks
let pool = null;
function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      '[_data] Falta DATABASE_URL en las variables de entorno de Netlify.'
    );
  }
  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 1,
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 10000,
  });
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

// Valores válidos de estatus
const ESTATUS_LABELS = {
  recibida:        'Recibida',
  en_revision:     'En revisión',
  en_investigacion:'En investigación',
  resuelta:        'Resuelta',
  desestimada:     'Desestimada',
};
const VALID_ESTATUS = Object.keys(ESTATUS_LABELS);

// --- Denuncias ---
async function insertDenuncia(data) {
  const { rows } = await query(
    `INSERT INTO denuncias
       (folio, estatus, tipo, empresa, centro, modo,
        denunciante_nombre, denunciante_correo, descripcion, payload_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      data.folio,
      data.estatus || 'recibida',
      data.tipo    ?? null,
      data.empresa ?? null,
      data.centro  ?? null,
      data.modo    ?? null,
      data.denunciante_nombre  ?? null,
      data.denunciante_correo  ?? null,
      data.descripcion         ?? null,
      data.payload_json        ?? null,
    ]
  );
  return rows[0];
}

async function listDenuncias(filters = {}) {
  const page     = Math.max(1, filters.page || 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize || 20));
  const offset   = (page - 1) * pageSize;

  const params     = [];
  const conditions = [];

  if (filters.estatus) {
    params.push(filters.estatus);
    conditions.push(`estatus = $${params.length}`);
  }
  if (filters.q) {
    const term = `%${filters.q}%`;
    params.push(term);
    const i = params.length;
    conditions.push(`(folio ILIKE $${i} OR tipo ILIKE $${i} OR empresa ILIKE $${i} OR descripcion ILIKE $${i})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(pageSize);
  const limitParam = params.length;
  params.push(offset);
  const offsetParam = params.length;

  const { rows } = await query(
    `SELECT *, COUNT(*) OVER() AS total_count
     FROM denuncias
     ${where}
     ORDER BY created_at DESC
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    params
  );

  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;
  return {
    items:    rows.map(({ total_count, ...rest }) => rest),
    total,
    page,
    pageSize,
  };
}

async function getDenuncia(folio) {
  const { rows } = await query(
    'SELECT * FROM denuncias WHERE folio = $1',
    [folio]
  );
  return rows[0] || undefined;
}

async function updateDenuncia(folio, patch) {
  const setClauses = ['updated_at = NOW()'];
  const params     = [];

  if (patch.estatus !== undefined) {
    params.push(patch.estatus);
    setClauses.push(`estatus = $${params.length}`);
  }
  if (patch.notas_admin !== undefined) {
    params.push(patch.notas_admin);
    setClauses.push(`notas_admin = $${params.length}`);
  }

  params.push(folio);
  const { rows } = await query(
    `UPDATE denuncias SET ${setClauses.join(', ')} WHERE folio = $${params.length} RETURNING *`,
    params
  );
  return rows[0] || undefined;
}

async function getFolioStatus(folio) {
  const { rows } = await query(
    'SELECT folio, estatus, updated_at FROM denuncias WHERE folio = $1',
    [folio]
  );
  return rows[0] || undefined;
}

// --- Content blocks ---
async function listContentBlocks() {
  const { rows } = await query(
    'SELECT * FROM content_blocks ORDER BY id ASC'
  );
  return rows;
}

async function getContentMap() {
  const { rows } = await query(
    'SELECT block_key, value FROM content_blocks'
  );
  const map = {};
  for (const row of rows) map[row.block_key] = row.value;
  return map;
}

async function updateContentBlock(key, value) {
  const { rows } = await query(
    `UPDATE content_blocks
     SET value = $1, updated_at = NOW()
     WHERE block_key = $2
     RETURNING *`,
    [value, key]
  );
  return rows[0] || undefined;
}

// --- Admin ---
async function getAdminByUsername(username) {
  const { rows } = await query(
    'SELECT * FROM admins WHERE username = $1',
    [username]
  );
  return rows[0] || undefined;
}

async function updateAdminPassword(username, newPassword) {
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync(newPassword, 10);
  await query(
    'UPDATE admins SET password_hash = $1 WHERE username = $2',
    [hash, username]
  );
}

// Extrae campos de denuncia del formData del Wizard
function extractDenunciaFields(body) {
  const denuncia    = (body && body.denuncia) || {};
  const denunciante = denuncia.denunciante || {};
  const notificacion = denuncia.notificacion || {};
  const str = (v) => (typeof v === 'string' && v.trim() ? v : null);
  const nombre =
    [str(denunciante.nombre), str(denunciante.apellidos)]
      .filter(Boolean)
      .join(' ') || null;
  const hasDenuncia = Object.keys(denuncia).length > 0;
  return {
    tipo:    str(denuncia.tipo),
    empresa: str(denuncia.empresa),
    centro:  str(denuncia.centro),
    modo:    str(denuncia.modo) || (body.denuncianteEmail ? 'identificado' : 'anonimo'),
    denunciante_nombre:  nombre,
    denunciante_correo:  str(denunciante.correo) || (typeof body.denuncianteEmail === 'string' ? body.denuncianteEmail : null),
    descripcion:  str(notificacion.descripcion) || str(body.text),
    payload_json: JSON.stringify(
      hasDenuncia ? denuncia : { subject: body.subject, text: body.text }
    ),
  };
}

// --- Archivos ---
async function insertArchivoMeta(data) {
  const { rows } = await query(
    `INSERT INTO archivos_denuncia
       (denuncia_folio, nombre_original, nombre_storage, mime_type, size_bytes, r2_key)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.denuncia_folio, data.nombre_original, data.nombre_storage,
     data.mime_type, data.size_bytes, data.r2_key]
  );
  return rows[0];
}

async function getArchivosByFolio(folio) {
  const { rows } = await query(
    'SELECT * FROM archivos_denuncia WHERE denuncia_folio = $1 ORDER BY created_at ASC',
    [folio]
  );
  return rows;
}

async function getArchivo(id) {
  const { rows } = await query(
    'SELECT * FROM archivos_denuncia WHERE id = $1',
    [id]
  );
  return rows[0] || undefined;
}

module.exports = {
  ESTATUS_LABELS,
  VALID_ESTATUS,
  insertDenuncia,
  listDenuncias,
  getDenuncia,
  updateDenuncia,
  getFolioStatus,
  listContentBlocks,
  getContentMap,
  updateContentBlock,
  getAdminByUsername,
  updateAdminPassword,
  extractDenunciaFields,
  insertArchivoMeta,
  getArchivosByFolio,
  getArchivo,
};
