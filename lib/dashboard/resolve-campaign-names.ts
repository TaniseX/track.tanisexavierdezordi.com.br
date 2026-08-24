import "server-only";
import { createClient } from "@/lib/supabase/server";

export type CampaignNameLookup = {
  campaignName(id: string | null | undefined): string | null;
  adsetName(adId: string | null | undefined): string | null;
  adName(adId: string | null | undefined): string | null;
};

/**
 * Resolve nome de campanha/conjunto/anúncio a partir de utm_campaign
 * (campaign.id) / utm_content (ad.id) contra o ads_insights_cache já
 * existente (Fase 6) — sem chamada nova à Meta. Busca em lote (no máximo 3
 * queries pra página inteira, não uma por linha). Conjunto não tem UTM
 * próprio, por isso sobe via parent_id do anúncio. Cache desatualizado/vazio
 * (só populado pelo "Sincronizar agora" manual) → devolve null, quem chama
 * cai pro ID cru.
 */
export async function resolveCampaignNames(
  campaignIds: (string | null | undefined)[],
  adIds: (string | null | undefined)[],
): Promise<CampaignNameLookup> {
  const supabase = await createClient();
  const uniqueCampaignIds = [...new Set(campaignIds.filter((id): id is string => Boolean(id)))];
  const uniqueAdIds = [...new Set(adIds.filter((id): id is string => Boolean(id)))];

  const [campaignRes, adRes] = await Promise.all([
    uniqueCampaignIds.length
      ? supabase
          .from("ads_insights_cache")
          .select("entity_id, entity_name")
          .eq("level", "campaign")
          .in("entity_id", uniqueCampaignIds)
      : Promise.resolve({ data: [] as { entity_id: string; entity_name: string | null }[] }),
    uniqueAdIds.length
      ? supabase
          .from("ads_insights_cache")
          .select("entity_id, entity_name, parent_id")
          .eq("level", "ad")
          .in("entity_id", uniqueAdIds)
      : Promise.resolve({
          data: [] as { entity_id: string; entity_name: string | null; parent_id: string | null }[],
        }),
  ]);

  const adRows = adRes.data ?? [];
  const adsetIds = [...new Set(adRows.map((r) => r.parent_id).filter((id): id is string => Boolean(id)))];

  const adsetRes = adsetIds.length
    ? await supabase.from("ads_insights_cache").select("entity_id, entity_name").eq("level", "adset").in("entity_id", adsetIds)
    : { data: [] as { entity_id: string; entity_name: string | null }[] };

  const campaignMap = new Map((campaignRes.data ?? []).map((r) => [r.entity_id, r.entity_name]));
  const adMap = new Map(adRows.map((r) => [r.entity_id, { name: r.entity_name, adsetId: r.parent_id }]));
  const adsetMap = new Map((adsetRes.data ?? []).map((r) => [r.entity_id, r.entity_name]));

  return {
    campaignName: (id) => (id ? (campaignMap.get(id) ?? null) : null),
    adName: (id) => (id ? (adMap.get(id)?.name ?? null) : null),
    adsetName: (id) => {
      if (!id) return null;
      const adsetId = adMap.get(id)?.adsetId;
      return adsetId ? (adsetMap.get(adsetId) ?? null) : null;
    },
  };
}
