import bcrypt from 'bcryptjs';
import { getSupabase } from './supabase.ts';
import type {
  ContentBlock,
  Denuncia,
  DenunciaType,
  EstatusFolio,
} from '../types/admin.ts';

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
interface SeedBlock {
  block_key: string;
  label: string;
  type: DenunciaType;
  value: string;
}

const DEFAULT_BLOCKS: SeedBlock[] = [
  {
    block_key: 'home.titulo',
    label: 'Título principal',
    type: 'text',
    value: 'Canal Ético de Denuncias',
  },
  {
    block_key: 'home.subtitulo',
    label: 'Subtítulo',
    type: 'textarea',
    value:
      'Reporta de forma segura y confidencial cualquier conducta irregular.',
  },
  {
    block_key: 'home.descripcion',
    label: 'Descripción de inicio',
    type: 'html',
    value: '<p>Tu denuncia será tratada con total confidencialidad...</p>',
  },
  {
    block_key: 'home.aviso_privacidad',
    label: 'Texto de la casilla de privacidad',
    type: 'html',
    value:
      'Acepto la <strong>Política de privacidad</strong> del Canal Ético y autorizo el tratamiento de mis datos conforme a la misma.',
  },
  {
    block_key: 'home.terminos',
    label: 'Texto de la casilla de términos y condiciones',
    type: 'html',
    value:
      'Al pulsar <strong>Enviar</strong>, acepto los <strong>términos y condiciones</strong> de uso del Canal Ético.',
  },
  {
    block_key: 'footer.texto',
    label: 'Texto del pie de página',
    type: 'text',
    value: 'ARH Consultores © 2026 — Todos los derechos reservados',
  },
  {
    block_key: 'footer.logos',
    label: 'Logos del pie de página',
    type: 'image_list',
    value: '[]',
  },
  {
    block_key: 'contacto.email',
    label: 'Correo de contacto del comité',
    type: 'text',
    value: 'denunciasconsultoresarh@gmail.com',
  },
];

let seedPromise: Promise<void> | null = null;

/**
 * Garantiza que exista un admin por defecto y los content_blocks base.
 * Idempotente y ejecutado una sola vez por proceso (memoizado).
 * Se invoca de forma perezosa en la primera operación de datos.
 */
export function ensureSeed(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      // Admin por defecto
      const { count, error: countErr } = await getSupabase()
        .from('admins')
        .select('*', { count: 'exact', head: true });

      if (countErr) {
        console.error('[db] Error verificando admins:', countErr.message);
      } else if ((count ?? 0) === 0) {
        const hash = bcrypt.hashSync('arhconsultores', 10);
        const { error: insErr } = await getSupabase()
          .from('admins')
          .insert({ username: 'adminrh', password_hash: hash });
        if (insErr) {
          console.error('[db] Error creando admin por defecto:', insErr.message);
        } else {
          console.log(
            '[db] Admin por defecto creado (usuario: adminrh / password: arhconsultores). ¡Cambia la contraseña!'
          );
        }
      }

      // Content blocks por defecto (idempotente)
      const { error: blocksErr } = await getSupabase()
        .from('content_blocks')
        .upsert(DEFAULT_BLOCKS, { onConflict: 'block_key', ignoreDuplicates: true });
      if (blocksErr) {
        console.error('[db] Error sembrando content_blocks:', blocksErr.message);
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
  const { data, error } = await getSupabase()
    .from('content_blocks')
    .select('*')
    .order('id', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ContentBlock[];
}

export async function getContentMap(): Promise<Record<string, string>> {
  await ensureSeed();
  const { data, error } = await getSupabase()
    .from('content_blocks')
    .select('block_key, value');
  if (error) throw new Error(error.message);
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as { block_key: string; value: string }[]) {
    map[row.block_key] = row.value;
  }
  return map;
}

export async function updateContentBlock(
  key: string,
  value: string
): Promise<ContentBlock | undefined> {
  const { data, error } = await getSupabase()
    .from('content_blocks')
    .update({ value, updated_at: new Date().toISOString() })
    .eq('block_key', key)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ContentBlock) ?? undefined;
}

// ---------------------------------------------------------------------------
// Denuncia helpers
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

export async function insertDenuncia(
  data: InsertDenunciaInput
): Promise<Denuncia> {
  await ensureSeed();
  const row = {
    folio: data.folio,
    estatus: data.estatus ?? 'recibida',
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
  return inserted as Denuncia;
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

export async function listDenuncias(
  filters: ListDenunciasFilters = {}
): Promise<ListDenunciasResult> {
  await ensureSeed();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = getSupabase()
    .from('denuncias')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters.estatus) {
    query = query.eq('estatus', filters.estatus);
  }
  if (filters.q) {
    const term = `%${filters.q}%`;
    query = query.or(
      `folio.ilike.${term},tipo.ilike.${term},empresa.ilike.${term},descripcion.ilike.${term}`
    );
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  return {
    items: (data ?? []) as Denuncia[],
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function getDenuncia(
  folio: string
): Promise<Denuncia | undefined> {
  const { data, error } = await getSupabase()
    .from('denuncias')
    .select('*')
    .eq('folio', folio)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Denuncia) ?? undefined;
}

export interface UpdateDenunciaInput {
  estatus?: EstatusFolio;
  notas_admin?: string;
}

export async function updateDenuncia(
  folio: string,
  data: UpdateDenunciaInput
): Promise<Denuncia | undefined> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (data.estatus !== undefined) patch.estatus = data.estatus;
  if (data.notas_admin !== undefined) patch.notas_admin = data.notas_admin;

  const { data: updated, error } = await getSupabase()
    .from('denuncias')
    .update(patch)
    .eq('folio', folio)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (updated as Denuncia) ?? undefined;
}

export async function getFolioStatus(
  folio: string
): Promise<{ folio: string; estatus: string; updated_at: string } | undefined> {
  const { data, error } = await getSupabase()
    .from('denuncias')
    .select('folio, estatus, updated_at')
    .eq('folio', folio)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (
    (data as { folio: string; estatus: string; updated_at: string }) ??
    undefined
  );
}

// ---------------------------------------------------------------------------
// Admin helpers
// ---------------------------------------------------------------------------
export interface AdminRow {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

export async function getAdminByUsername(
  username: string
): Promise<AdminRow | undefined> {
  const { data, error } = await getSupabase()
    .from('admins')
    .select('*')
    .eq('username', username)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AdminRow) ?? undefined;
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
