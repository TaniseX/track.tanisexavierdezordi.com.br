import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Rate limiting baseado em Postgres (função check_rate_limit, janela fixa
 * atômica via upsert — ver supabase/migrations/0007_rate_limits.sql).
 * Falha aberta (permite a request) se o check em si der erro de infra, pra
 * não derrubar a captura por causa do rate limiter.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("check_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("check_rate_limit falhou:", error.message);
    return true;
  }
  return data as boolean;
}
