import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { corsHeaders, handleCorsPreflight } from "@/lib/cors";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, getUserAgent } from "@/lib/tracking/request-meta";
import { getGeo } from "@/lib/tracking/geo";
import { generateTrckUserId } from "@/lib/tracking/trck-user-id";
import { isInternalIp } from "@/lib/tracking/internal-ips";
import { isMetaBotTraffic } from "@/lib/tracking/meta-bot-traffic";
import { identifySchema } from "@/lib/validation/tracking-schemas";
import { hashEmail, hashPhone } from "@/lib/meta/hashing";

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

// Upsert em visitors: gera trck_user_id se o client ainda não tiver um
// (persistência fica a cargo do tracker.js, first-party no domínio do site —
// nosso Set-Cookie não serviria, essa API é cross-origin).
export async function POST(request: NextRequest) {
  const headers = corsHeaders(request.headers.get("origin"));

  const ip = getClientIp(request);
  const userAgent = getUserAgent(request);

  // Tráfego interno (equipe testando o próprio funil): responde normalmente
  // (o cliente não percebe nada), mas não grava nada nem conta pra rate
  // limit — não gera visitor, não polui o painel nem a otimização de anúncio.
  if (await isInternalIp(ip)) {
    return NextResponse.json({ trck_user_id: generateTrckUserId() }, { headers });
  }

  // Bot da própria Meta (crawler de preview de link) ou request originada na
  // infra de IP da Meta (inclui o proxy do navegador embutido do Instagram/
  // Facebook) — mesmo tratamento: responde normal, não grava nada.
  if (await isMetaBotTraffic(ip, userAgent)) {
    return NextResponse.json({ trck_user_id: generateTrckUserId() }, { headers });
  }

  const allowed = await checkRateLimit(`identify:${ip ?? "unknown"}`, 30, 60);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit excedido." }, { status: 429, headers });
  }

  const json = await request.json().catch(() => null);
  if (!json) {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400, headers });
  }

  const parsed = identifySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400, headers });
  }
  const input = parsed.data;

  const geo = getGeo(request);
  const admin = createAdminClient();
  const now = new Date().toISOString();

  let existing: { trck_user_id: string } | null = null;
  if (input.trck_user_id) {
    const { data } = await admin
      .from("visitors")
      .select("trck_user_id")
      .eq("trck_user_id", input.trck_user_id)
      .maybeSingle();
    existing = data;
  }

  const trckUserId = existing?.trck_user_id ?? input.trck_user_id ?? generateTrckUserId();

  const incoming: Record<string, unknown> = {
    fbp: input.fbp,
    fbc: input.fbc,
    ga_client_id: input.ga_client_id,
    ga_session_id: input.ga_session_id,
    utm_source: input.utm_source,
    utm_medium: input.utm_medium,
    utm_campaign: input.utm_campaign,
    utm_term: input.utm_term,
    utm_content: input.utm_content,
    referrer: input.referrer,
    landing_url: input.landing_url,
    email: input.email,
    phone: input.phone,
    ip,
    user_agent: userAgent,
    geo_country: geo.country,
    geo_region: geo.region,
    geo_city: geo.city,
    geo_postal_code: geo.postalCode,
  };

  // só sobrescreve com valores presentes — preserva o que já tinha
  const patch: Record<string, unknown> = { last_seen_at: now, updated_at: now };
  for (const [key, value] of Object.entries(incoming)) {
    if (value !== undefined && value !== null && value !== "") patch[key] = value;
  }
  if (input.email) patch.email_hash = hashEmail(input.email);
  if (input.phone) patch.phone_hash = hashPhone(input.phone);

  if (existing) {
    await admin.from("visitors").update(patch).eq("trck_user_id", trckUserId);
  } else {
    await admin.from("visitors").insert({ trck_user_id: trckUserId, first_seen_at: now, ...patch });
  }

  return NextResponse.json({ trck_user_id: trckUserId }, { headers });
}
