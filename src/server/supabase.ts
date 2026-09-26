/**
 * supabase.ts — OBSOLETO
 * MIGRADO: Supabase → Neon PostgreSQL
 *
 * Este archivo ya no se usa. El cliente de base de datos está en:
 *   src/server/db-client.ts  (Pool de pg)
 *   src/server/db-neon.ts    (funciones SQL)
 *
 * Mantenido temporalmente para no romper posibles importaciones residuales.
 * Puede eliminarse de forma segura una vez confirmado que nada lo importa.
 */

export function isSupabaseConfigured(): boolean {
  return false; // Migrado a Neon
}

export function getSupabase(): never {
  throw new Error(
    '[supabase] Este cliente fue migrado a Neon PostgreSQL. ' +
    'Usa src/server/db-client.ts en su lugar.'
  );
}
