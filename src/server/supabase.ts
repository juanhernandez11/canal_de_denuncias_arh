import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase para uso EXCLUSIVO en el servidor.
 *
 * Usa la SERVICE_ROLE key, que ignora las políticas RLS. NUNCA debe
 * exponerse al navegador ni incluirse en el bundle del cliente.
 *
 * Variables de entorno requeridas (en .env.local o en el entorno de despliegue):
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * El cliente se crea de forma perezosa (lazy): así el servidor de desarrollo
 * puede arrancar aunque falten las variables, y solo fallará —con un mensaje
 * claro— cuando se ejecute una operación de datos.
 */

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      '[supabase] Faltan variables de entorno. Define SUPABASE_URL y ' +
        'SUPABASE_SERVICE_ROLE_KEY en tu .env.local (ver .env.example).'
    );
  }

  client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return client;
}
