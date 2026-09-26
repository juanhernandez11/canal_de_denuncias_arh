/**
 * db-neon.ts — Capa de datos para Neon PostgreSQL
 * MIGRADO: Supabase (PostgREST) → Neon (pg / SQL puro)
 *
 * Exporta exactamente las mismas funciones que el db.ts original
 * para que routes.ts no requiera cambios.
 */
import bcrypt from 'bcryptjs';
import { query } from './db-client.ts';
import type {
  ContentBlock,
  Denuncia,
  EstatusFolio,
} from '../types/admin.ts';

// ---------------------------------------------------------------------------
// Tipos públicos (re-exportados para compatibilidad con db.ts)
// ---------------------------------------------------------------------------
export interface InsertDenunciaInput {
  folio: string;
  tipo?: string | null;
  empresa?: string | null;
  centro?: string | null;
  modo?: string | null;
  denunciante_nombre?: string | null;
  denunciante_correo?: string | null;
  descripcion?: string | null;
  payload_json?: string | null;
  estatus?: EstatusFolio;
}

export interface ListDenunciasFilters {
  estatus?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface ListDenunciasResult {
  items: Denuncia[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UpdateDenunciaInput {
  estatus?: EstatusFolio;
  notas_admin?: string;
}

export interface AdminRow {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
const DEFAULT_BLOCKS = [
  { block_key: 'home.titulo',           label: 'Título principal',                      type: 'text',       value: 'Canal Ético de Denuncias' },
  { block_key: 'home.subtitulo',        label: 'Subtítulo',                              type: 'textarea',   value: 'Reporta de forma segura y confidencial cualquier conducta irregular.' },
  { block_key: 'home.descripcion',      label: 'Descripción de inicio',                 type: 'html',       value: '<p>Tu denuncia será tratada con total confidencialidad...</p>' },
  { block_key: 'home.aviso_privacidad', label: 'Texto de la casilla de privacidad',     type: 'html',       value: 'Acepto la <strong>Política de privacidad</strong> del Canal Ético y autorizo el tratamiento de mis datos conforme a la misma.' },
  { block_key: 'home.terminos',         label: 'Texto de la casilla de términos',       type: 'html',       value: 'Al pulsar <strong>Enviar</strong>, acepto los <strong>términos y condiciones</strong> de uso del Canal Ético.' },
  { block_key: 'footer.texto',          label: 'Texto del pie de página',               type: 'text',       value: 'ARH Consultores © 2026 — Todos los derechos reservados' },
  { block_key: 'footer.logos',          label: 'Logos del pie de página',               type: 'image_list', value: '[]' },
  { block_key: 'contacto.email',        label: 'Correo de contacto del comité',         type: 'text',       value: 'denunciasconsultoresarh@gmail.com' },
];

let seedPromise: Promise<void> | null = null;

export function ensureSeed(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      try {
        // Admin por defecto
        const { rows: admins } = await query('SELECT id FROM admins LIMIT 1');
        if (admins.length === 0) {
          const hash = bcrypt.hashSync('arhconsultores', 10);
          await query(
            'INSERT INTO admins (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING',
            ['adminrh', hash]
          );
          console.log('[db] Admin por defecto creado (usuario: adminrh). ¡Cambia la contraseña!');
        }

        // Content blocks por defecto
        for (const block of DEFAULT_BLOCKS) {
          await query(
            `INSERT INTO content_blocks (block_key, label, type, value)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (block_key) DO NOTHING`,
            [block.block_key, block.label, block.type, block.value]
          );
        }
      } catch (err) {
        console.error('[db] Error en ensureSeed:', (err as Error).message);
        // Reset para permitir reintento
        seedPromise = null;
      }
    })();
  }
  return seedPromise;
}

// ---------------------------------------------------------------------------
// Content helpers
// ---------------------------------------------------------------------------
export async function listContentBlocks(): Promise<ContentBlock[]> {
  await ensureSeed();
  const { rows } = await query<ContentBlock>(
    'SELECT * FROM content_blocks ORDER BY id ASC'
  );
  return rows;
}

export async function getContentMap(): Promise<Record<string, string>> {
  await ensureSeed();
  const { rows } = await query<{ block_key: string; value: string }>(
    'SELECT block_key, value FROM content_blocks'
  );
  const map: Record<string, string> = {};
  for (const row of rows) map[row.block_key] = row.value;
  return map;
}

export async function updateContentBlock(
  key: string,
  value: string
): Promise<ContentBlock | undefined> {
  const { rows } = await query<ContentBlock>(
    `UPDATE content_blocks
     SET value = $1, updated_at = NOW()
     WHERE block_key = $2
     RETURNING *`,
    [value, key]
  );
  return rows[0];
}

// ---------------------------------------------------------------------------
// Denuncia helpers
// ---------------------------------------------------------------------------
export async function insertDenuncia(
  data: InsertDenunciaInput
): Promise<Denuncia> {
  await ensureSeed();
  const { rows } = await query<Denuncia>(
    `INSERT INTO denuncias
       (folio, estatus, tipo, empresa, centro, modo,
        denunciante_nombre, denunciante_correo, descripcion, payload_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      data.folio,
      data.estatus ?? 'recibida',
      data.tipo ?? null,
      data.empresa ?? null,
      data.centro ?? null,
      data.modo ?? null,
      data.denunciante_nombre ?? null,
      data.denunciante_correo ?? null,
      data.descripcion ?? null,
      data.payload_json ?? null,
    ]
  );
  return rows[0];
}

export async function listDenuncias(
  filters: ListDenunciasFilters = {}
): Promise<ListDenunciasResult> {
  await ensureSeed();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const params: unknown[] = [];
  const conditions: string[] = [];

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

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(pageSize);
  const limitParam = params.length;
  params.push(offset);
  const offsetParam = params.length;

  const { rows } = await query<Denuncia & { total_count: string }>(
    `SELECT *, COUNT(*) OVER() AS total_count
     FROM denuncias
     ${where}
     ORDER BY created_at DESC
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    params
  );

  const total = rows.length > 0 ? parseInt(rows[0].total_count as unknown as string, 10) : 0;
  return {
    items: rows.map(({ total_count, ...rest }) => rest as Denuncia),
    total,
    page,
    pageSize,
  };
}

export async function getDenuncia(
  folio: string
): Promise<Denuncia | undefined> {
  const { rows } = await query<Denuncia>(
    'SELECT * FROM denuncias WHERE folio = $1',
    [folio]
  );
  return rows[0];
}

export async function updateDenuncia(
  folio: string,
  data: UpdateDenunciaInput
): Promise<Denuncia | undefined> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];

  if (data.estatus !== undefined) {
    params.push(data.estatus);
    setClauses.push(`estatus = $${params.length}`);
  }
  if (data.notas_admin !== undefined) {
    params.push(data.notas_admin);
    setClauses.push(`notas_admin = $${params.length}`);
  }

  params.push(folio);
  const { rows } = await query<Denuncia>(
    `UPDATE denuncias SET ${setClauses.join(', ')} WHERE folio = $${params.length} RETURNING *`,
    params
  );
  return rows[0];
}

export async function getFolioStatus(
  folio: string
): Promise<{ folio: string; estatus: string; updated_at: string } | undefined> {
  const { rows } = await query<{ folio: string; estatus: string; updated_at: string }>(
    'SELECT folio, estatus, updated_at FROM denuncias WHERE folio = $1',
    [folio]
  );
  return rows[0];
}

// ---------------------------------------------------------------------------
// Admin helpers
// ---------------------------------------------------------------------------
export async function getAdminByUsername(
  username: string
): Promise<AdminRow | undefined> {
  const { rows } = await query<AdminRow>(
    'SELECT * FROM admins WHERE username = $1',
    [username]
  );
  return rows[0];
}

export async function verifyAdmin(
  username: string,
  password: string
): Promise<AdminRow | null> {
  await ensureSeed();
  const admin = await getAdminByUsername(username);
  if (!admin) return null;
  const ok = bcrypt.compareSync(password, admin.password_hash);
  return ok ? admin : null;
}

export async function updateAdminPassword(
  username: string,
  newPassword: string
): Promise<void> {
  const hash = bcrypt.hashSync(newPassword, 10);
  await query(
    'UPDATE admins SET password_hash = $1 WHERE username = $2',
    [hash, username]
  );
}
