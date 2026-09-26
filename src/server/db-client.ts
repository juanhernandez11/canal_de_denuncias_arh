/**
 * db-client.ts — Cliente PostgreSQL para Neon
 * MIGRADO: Supabase → Neon PostgreSQL
 *
 * Usa pg (node-postgres) con pool singleton.
 * En entornos serverless (Netlify Functions) el pool se configura
 * con max:1 para evitar connection leaks entre invocaciones.
 *
 * Variable requerida: DATABASE_URL
 */
import pg from 'pg';
const { Pool } = pg;
import type { QueryResult, QueryResultRow } from 'pg';

let pool: InstanceType<typeof Pool> | null = null;

/** Detecta si estamos en entorno serverless */
function isServerless(): boolean {
  return (
    process.env.NETLIFY === 'true' ||
    typeof process.env.AWS_LAMBDA_FUNCTION_NAME === 'string'
  );
}

export function isNeonConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool(): InstanceType<typeof Pool> {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      '[db-client] Falta DATABASE_URL. Defínela en .env.local o en las variables de entorno de Netlify.'
    );
  }

  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }, // requerido por Neon
    max: isServerless() ? 1 : 10,
    idleTimeoutMillis: isServerless() ? 0 : 30000,
    connectionTimeoutMillis: 10000,
  });

  pool.on('error', (err) => {
    console.error('[db-client] Pool error:', err.message);
  });

  return pool;
}

/** Helper para ejecutar queries con params tipados */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}
