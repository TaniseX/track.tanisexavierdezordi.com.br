import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** UA dos crawlers da própria Meta — busca de preview de link (og:tags) que
 * roda sozinha quando um link é usado num anúncio/post, sem visitante real. */
const META_BOT_UA_RE = /facebookexternalhit|meta-externalads|facebookcatalog/i;

/**
 * Tráfego da própria Meta — bots de crawler (UA) ou requests originadas nas
 * faixas de IP da Meta (`meta_ip_ranges`, inclui a infra que proxeia cliques
 * do navegador embutido do Instagram/Facebook). Checado no início de
 * /api/identify, /api/event e do webhook da Guru, mesmo padrão de
 * `isInternalIp`: a resposta segue normal, mas nada é gravado nem disparado
 * pro Meta/GA4.
 */
export async function isMetaBotTraffic(ip: string | null, userAgent: string | null): Promise<boolean> {
  if (userAgent && META_BOT_UA_RE.test(userAgent)) return true;
  if (!ip) return false;
  const admin = createAdminClient();
  const { data } = await admin.rpc("is_meta_ip", { check_ip: ip });
  return data === true;
}
