/**
 * scripts/migrate-data.ts
 * Migra datos de Supabase → Neon PostgreSQL via REST API de Supabase (sin SDK).
 * Uso:           npm run migrate:data
 * Uso dry-run:   npm run migrate:data -- --dry-run
 *
 * Es IDEMPOTENTE: ON CONFLICT DO NOTHING / DO UPDATE, se puede ejecutar N veces.
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(__rootDir, '.env.local') });
dotenv.config({ path: join(__rootDir, '.env') });

const DRY_RUN = process.argv.includes('--dry-run');

// ---- Supabase REST (sin SDK) ----
async function fetchSupabase(table: string): Promise<unknown[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');

  const res = await fetch(`${url}/rest/v1/${table}?select=*&order=id.asc`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  if (!res.ok) throw new Error(`Error leyendo ${table}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<unknown[]>;
}

// ---- Neon Pool ----
function getNeonPool() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Falta DATABASE_URL_UNPOOLED en .env.local');
  return new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
}

// ---- Tipos ----
interface AdminRow       { username: string; password_hash: string; created_at: string; }
interface ContentRow     { block_key: string; label: string; type: string; value: string; updated_at: string; }
interface DenunciaRow    {
  folio: string; estatus: string; tipo: string | null; empresa: string | null;
  centro: string | null; modo: string | null; denunciante_nombre: string | null;
  denunciante_correo: string | null; descripcion: string | null;
  payload_json: string | null; notas_admin: string | null;
  created_at: string; updated_at: string;
}

// ---- Main ----
async function migrate() {
  console.log('\n' + (DRY_RUN ? '🔍 DRY-RUN — no se escribirá nada en Neon\n' : '🚀 Iniciando migración Supabase → Neon\n'));

  const pool = getNeonPool();

  try {
    // ----------------------------------------------------------------
    // 1. Leer datos de Supabase via REST
    // ----------------------------------------------------------------
    console.log('📥 Leyendo datos de Supabase...');
    const admins   = await fetchSupabase('admins')        as AdminRow[];
    const denuncias = await fetchSupabase('denuncias')    as DenunciaRow[];
    const content   = await fetchSupabase('content_blocks') as ContentRow[];

    console.log(`   admins:         ${admins.length}`);
    console.log(`   denuncias:      ${denuncias.length}`);
    console.log(`   content_blocks: ${content.length}`);

    if (DRY_RUN) {
      console.log('\n✅ Dry-run completado. Datos encontrados sin errores.');
      console.log('   Ejecuta sin --dry-run para migrar.\n');
      return;
    }

    // ----------------------------------------------------------------
    // 2. Migrar admins
    // ----------------------------------------------------------------
    console.log('\n📤 Migrando admins...');
    let adminsOk = 0, adminsSkip = 0;
    for (const row of admins) {
      const { rowCount } = await pool.query(
        `INSERT INTO admins (username, password_hash, created_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (username) DO NOTHING`,
        [row.username, row.password_hash, row.created_at]
      );
      if (rowCount && rowCount > 0) { adminsOk++; console.log(`   ✅ admin: ${row.username}`); }
      else { adminsSkip++; console.log(`   ⏭️  admin ya existe: ${row.username}`); }
    }

    // ----------------------------------------------------------------
    // 3. Migrar content_blocks (DO UPDATE para sincronizar cambios)
    // ----------------------------------------------------------------
    console.log('\n📤 Migrando content_blocks...');
    let contentOk = 0;
    for (const row of content) {
      await pool.query(
        `INSERT INTO content_blocks (block_key, label, type, value, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (block_key) DO UPDATE
           SET label      = EXCLUDED.label,
               type       = EXCLUDED.type,
               value      = EXCLUDED.value,
               updated_at = EXCLUDED.updated_at`,
        [row.block_key, row.label, row.type, row.value, row.updated_at]
      );
      contentOk++;
      console.log(`   ✅ block: ${row.block_key}`);
    }

    // ----------------------------------------------------------------
    // 4. Migrar denuncias
    // ----------------------------------------------------------------
    console.log('\n📤 Migrando denuncias...');
    let denunciasOk = 0, denunciasSkip = 0;
    for (const row of denuncias) {
      const { rowCount } = await pool.query(
        `INSERT INTO denuncias
           (folio, estatus, tipo, empresa, centro, modo,
            denunciante_nombre, denunciante_correo, descripcion,
            payload_json, notas_admin, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (folio) DO NOTHING`,
        [
          row.folio, row.estatus, row.tipo, row.empresa, row.centro, row.modo,
          row.denunciante_nombre, row.denunciante_correo, row.descripcion,
          row.payload_json, row.notas_admin ?? '', row.created_at, row.updated_at,
        ]
      );
      if (rowCount && rowCount > 0) { denunciasOk++; console.log(`   ✅ folio: ${row.folio} [${row.estatus}]`); }
      else { denunciasSkip++; console.log(`   ⏭️  folio ya existe: ${row.folio}`); }
    }

    // ----------------------------------------------------------------
    // 5. Verificación final en Neon
    // ----------------------------------------------------------------
    console.log('\n📊 Verificación final en Neon:');
    for (const t of ['admins', 'denuncias', 'content_blocks']) {
      const { rows } = await pool.query(`SELECT COUNT(*) AS n FROM ${t}`);
      console.log(`   ${t}: ${rows[0].n} registros`);
    }

    console.log('\n✅ MIGRACIÓN COMPLETADA');
    console.log(`   admins migrados:         ${adminsOk}  (omitidos: ${adminsSkip})`);
    console.log(`   content_blocks migrados: ${contentOk}`);
    console.log(`   denuncias migradas:      ${denunciasOk} (omitidos: ${denunciasSkip})\n`);

  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('\n❌ ERROR EN MIGRACIÓN:', err.message);
  process.exit(1);
});
