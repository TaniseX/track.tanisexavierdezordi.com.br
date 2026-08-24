import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSecret } from "@/lib/vault/secrets";
import { fetchAdInsights, aggregateInsights, type InsightEntity } from "@/lib/meta/ads-insights";

// Rate limit conservador: sync manual, nunca automático na navegação. Bem
// abaixo do que a Meta documenta pra nunca abusar da cota.
const MIN_SYNC_INTERVAL_MINUTES = 60;
const WINDOW_DAYS = 30;

// Rota autenticada, mas NÃO pública — proxy.ts exclui /api/* da checagem
// (precisa ficar aberto pra /api/identify, /api/event, /api/webhook/*), então
// o check de sessão tem que ser feito aqui dentro.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const adAccountId = body?.ad_account_id;
  if (!adAccountId) {
    return NextResponse.json({ error: "ad_account_id obrigatório." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: account } = await admin
    .from("meta_ad_accounts")
    .select("*")
    .eq("id", adAccountId)
    .eq("is_active", true)
    .single();
  if (!account) {
    return NextResponse.json({ error: "Conta não encontrada ou inativa." }, { status: 404 });
  }

  if (account.last_synced_at) {
    const minutesSince = (Date.now() - new Date(account.last_synced_at).getTime()) / 60000;
    if (minutesSince < MIN_SYNC_INTERVAL_MINUTES) {
      const wait = Math.ceil(MIN_SYNC_INTERVAL_MINUTES - minutesSince);
      return NextResponse.json(
        { error: `Aguarde ${wait} min pra sincronizar essa conta de novo.` },
        { status: 429 },
      );
    }
  }

  const dateStop = new Date().toISOString().slice(0, 10);
  const dateStart = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString().slice(0, 10);

  try {
    const token = await readSecret(account.access_token_id);
    const rawRows = await fetchAdInsights(account.ad_account_id, token, dateStart, dateStop);
    const { campaigns, adsets, ads } = aggregateInsights(rawRows);

    const toCacheRow = (level: "campaign" | "adset" | "ad") => (entity: InsightEntity) => ({
      meta_ad_account_id: account.id,
      level,
      entity_id: entity.entity_id,
      entity_name: entity.entity_name,
      parent_id: entity.parent_id,
      date_start: dateStart,
      date_stop: dateStop,
      spend: entity.spend,
      impressions: entity.impressions,
      clicks: entity.clicks,
      fetched_at: new Date().toISOString(),
    });

    const upsertRows = [
      ...campaigns.map(toCacheRow("campaign")),
      ...adsets.map(toCacheRow("adset")),
      ...ads.map(toCacheRow("ad")),
    ];

    if (upsertRows.length > 0) {
      const { error } = await admin
        .from("ads_insights_cache")
        .upsert(upsertRows, { onConflict: "meta_ad_account_id,level,entity_id" });
      if (error) throw new Error(error.message);
    }

    await admin
      .from("meta_ad_accounts")
      .update({
        last_synced_at: new Date().toISOString(),
        last_test_status: "ok",
        last_test_message: `Sincronizado: ${campaigns.length} campanhas, ${ads.length} anúncios.`,
      })
      .eq("id", account.id);

    return NextResponse.json({ ok: true, campaigns: campaigns.length, ads: ads.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from("meta_ad_accounts")
      .update({ last_test_status: "error", last_test_message: message })
      .eq("id", account.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
