import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Tráfego interno (equipe testando o próprio funil) — checado no início de
 * /api/identify, /api/event e do webhook da Guru. Se o IP bater, a request
 * responde normalmente (o cliente não percebe nada) mas nada é gravado no
 * banco nem disparado pro Meta/GA4.
 */
export async function isInternalIp(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  const admin = createAdminClient();
  const { data } = await admin.from("internal_ips").select("ip").eq("ip", ip).maybeSingle();
  return data !== null;
}
