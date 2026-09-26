/**
 * scripts/run-migration.ts
 * Ejecuta database/schema.sql + indexes.sql + seed.sql contra Neon.
 * Uso: npm run migrate:db
 *
 * Requiere DATABASE_URL_UNPOOLED (o DATABASE_URL) en .env.local
 */
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Carga .env.local primero (tiene precedencia), luego .env como fallback
const __filename = fileURLToPath(import.meta.url);
const __rootDir = join(dirname(__filename), '..');
dotenv.config({ path: join(__rootDir, '.env.local') });
dotenv.config({ path: join(__rootDir, '.env') });

const root = __rootDir;

async function runMigration() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    console.error('\n❌ ERROR: Define DATABASE_URL_UNPOOLED en .env.local\n');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

  try {
    console.log('\n🚀 Ejecutando migración en Neon PostgreSQL...\n');

    const schema  = readFileSync(join(root, 'database/schema.sql'),  'utf-8');
    const indexes = readFileSync(join(root, 'database/indexes.sql'), 'utf-8');
    const seed    = readFileSync(join(root, 'database/seed.sql'),    'utf-8');

    console.log('📋 Creando tablas...');
    await pool.query(schema);
    console.log('✅ Tablas creadas');

    console.log('📋 Creando índices...');
    await pool.query(indexes);
    console.log('✅ Índices creados');

    console.log('📋 Insertando datos iniciales...');
    await pool.query(seed);
    console.log('✅ Seed completado');

    // Verificación
    const tables = ['admins', 'denuncias', 'content_blocks'];
    console.log('\n📊 Verificación:');
    for (const t of tables) {
      const { rows } = await pool.query(`SELECT COUNT(*) AS n FROM ${t}`);
      console.log(`   ${t}: ${rows[0].n} registros`);
    }

    console.log('\n✅ Migración completada exitosamente\n');
  } catch (err) {
    console.error('\n❌ ERROR en migración:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
