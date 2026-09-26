/**
 * supabase.ts — ELIMINADO
 * MIGRADO: Supabase → Neon PostgreSQL
 *
 * Este archivo existía como cliente Supabase.
 * Ya no se usa. El cliente de BD está en:
 *   src/server/db-client.ts  (Pool de pg)
 *   src/server/db-neon.ts    (funciones SQL)
 */

export function isSupabaseConfigured(): boolean {
  return false;
}

export function getSupabase(): never {
  throw new Error(
    '[supabase] Migrado a Neon. Usa src/server/db-client.ts.'
  );
}
