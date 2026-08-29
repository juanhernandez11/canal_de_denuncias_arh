// Módulo compartido de datos para las funciones de Netlify.
// Usa Supabase con la service_role key (solo backend).
const { createClient } = require('@supabase/supabase-js');

let client = null;
function getSupabase() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      '[supabase] Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en las variables de entorno de Netlify.'
    );
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

const ESTATUS_LABELS = {
  recibida: 'Recibida',
  en_revision: 'En revisión',
  en_investigacion: 'En investigación',
  resuelta: 'Resuelta',
  desestimada: 'Desestimada',
};
const VALID_ESTATUS = Object.keys(ESTATUS_LABELS);

// --- Denuncias ---
async function insertDenuncia(data) {
  const row = {
    folio: data.folio,
    estatus: data.estatus || 'recibida',
    tipo: data.tipo ?? null,
    empresa: data.empresa ?? null,
    centro: data.centro ?? null,
    modo: data.modo ?? null,
    denunciante_nombre: data.denunciante_nombre ?? null,
    denunciante_correo: data.denunciante_correo ?? null,
    descripcion: data.descripcion ?? null,
    payload_json: data.payload_json ?? null,
  };
  const { data: inserted, error } = await getSupabase()
    .from('denuncias')
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return inserted;
}

async function listDenuncias(filters = {}) {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize || 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = getSupabase()
    .from('denuncias')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (filters.estatus) query = query.eq('estatus', filters.estatus);
  if (filters.q) {
    const term = `%${filters.q}%`;
    query = query.or(
      `folio.ilike.${term},tipo.ilike.${term},empresa.ilike.${term},descripcion.ilike.${term}`
    );
  }
  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { items: data || [], total: count || 0, page, pageSize };
}

async function getDenuncia(folio) {
  const { data, error } = await getSupabase()
    .from('denuncias')
    .select('*')
    .eq('folio', folio)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || undefined;
}

async function updateDenuncia(folio, patch) {
  const upd = { updated_at: new Date().toISOString() };
  if (patch.estatus !== undefined) upd.estatus = patch.estatus;
  if (patch.notas_admin !== undefined) upd.notas_admin = patch.notas_admin;
  const { data, error } = await getSupabase()
    .from('denuncias')
    .update(upd)
    .eq('folio', folio)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || undefined;
}

async function getFolioStatus(folio) {
  const { data, error } = await getSupabase()
    .from('denuncias')
    .select('folio, estatus, updated_at')
    .eq('folio', folio)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || undefined;
}

// --- Content blocks ---
async function listContentBlocks() {
  const { data, error } = await getSupabase()
    .from('content_blocks')
    .select('*')
    .order('id', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

async function getContentMap() {
  const { data, error } = await getSupabase()
    .from('content_blocks')
    .select('block_key, value');
  if (error) throw new Error(error.message);
  const map = {};
  for (const row of data || []) map[row.block_key] = row.value;
  return map;
}

async function updateContentBlock(key, value) {
  const { data, error } = await getSupabase()
    .from('content_blocks')
    .update({ value, updated_at: new Date().toISOString() })
    .eq('block_key', key)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || undefined;
}

// --- Admin ---
async function getAdminByUsername(username) {
  const { data, error } = await getSupabase()
    .from('admins')
    .select('*')
    .eq('username', username)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || undefined;
}

// Extrae campos de denuncia del formData del Wizard (estructura anidada).
function extractDenunciaFields(body) {
  const denuncia = (body && body.denuncia) || {};
  const denunciante = denuncia.denunciante || {};
  const notificacion = denuncia.notificacion || {};
  const str = (v) => (typeof v === 'string' && v.trim() ? v : null);
  const nombre =
    [str(denunciante.nombre), str(denunciante.apellidos)]
      .filter(Boolean)
      .join(' ') || null;
  const hasDenuncia = Object.keys(denuncia).length > 0;
  return {
    tipo: str(denuncia.tipo),
    empresa: str(denuncia.empresa),
    centro: str(denuncia.centro),
    modo: str(denuncia.modo) || (body.denuncianteEmail ? 'identificado' : 'anonimo'),
    denunciante_nombre: nombre,
    denunciante_correo:
      str(denunciante.correo) ||
      (typeof body.denuncianteEmail === 'string' ? body.denuncianteEmail : null),
    descripcion: str(notificacion.descripcion) || str(body.text),
    payload_json: JSON.stringify(
      hasDenuncia ? denuncia : { subject: body.subject, text: body.text }
    ),
  };
}

module.exports = {
  getSupabase,
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
  extractDenunciaFields,
};
