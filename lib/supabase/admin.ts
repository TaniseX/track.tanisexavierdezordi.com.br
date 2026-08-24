import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseSecretKey, getSupabaseUrl } from "./env";

/**
 * Cliente Supabase com a secret key (equivalente ao service_role): ignora
 * RLS. Usar SOMENTE em código server-only (route handlers, cron) — nunca
 * importar em Client Components nem em módulos compartilhados com o client.
 */
export function createAdminClient() {
  return createSupabaseClient(getSupabaseUrl(), getSupabaseSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
