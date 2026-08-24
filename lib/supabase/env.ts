/**
 * Supabase migrou para as chaves `sb_publishable_xxx` / `sb_secret_xxx`.
 * Aceitamos as novas com fallback para as legadas (anon/service_role) caso
 * o projeto ainda não tenha migrado — ver CLAUDE.md.
 */

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL não configurada");
  return url;
}

export function getSupabasePublishableKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ou NEXT_PUBLIC_SUPABASE_ANON_KEY legada) não configurada",
    );
  }
  return key;
}

export function getSupabaseSecretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY legada) não configurada — nunca exponha esta chave ao client",
    );
  }
  return key;
}
