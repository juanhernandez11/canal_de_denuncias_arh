/**
 * db.ts — Capa de datos
 * MIGRADO: Supabase → Neon PostgreSQL
 *
 * Este archivo re-exporta todo desde db-neon.ts.
 * routes.ts sigue importando de './db.ts' sin cambios.
 */
export * from './db-neon.ts';
