import "server-only";
import { META_GRAPH_API_BASE_URL } from "./constants";

export type AdInsightRow = {
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  ad_id: string;
  ad_name: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
};

/**
 * Um único fetch em level=ad já traz campaign_id/adset_id/ad_id juntos —
 * evita 3 chamadas separadas (campaign/adset/ad) por sync, mais conservador
 * com o rate limit da Meta. As agregações de campanha/conjunto vêm depois,
 * em aggregateInsights, a partir dessas linhas.
 */
export async function fetchAdInsights(
  adAccountId: string,
  accessToken: string,
  dateStart: string,
  dateStop: string,
): Promise<AdInsightRow[]> {
  const rows: AdInsightRow[] = [];
  let url: string | undefined = buildUrl(adAccountId, accessToken, dateStart, dateStop);

  while (url) {
    const currentUrl: string = url;
    const res = await fetch(currentUrl);
    const json = await res.json();
    if (json.error) {
      throw new Error(json.error.message ?? "Erro ao buscar insights do Meta Ads.");
    }
    rows.push(...(json.data ?? []));
    url = json.paging?.next ?? undefined;
  }

  return rows;
}

function buildUrl(adAccountId: string, accessToken: string, dateStart: string, dateStop: string): string {
  const url = new URL(`${META_GRAPH_API_BASE_URL}/${adAccountId}/insights`);
  url.searchParams.set("level", "ad");
  url.searchParams.set(
    "fields",
    "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks",
  );
  url.searchParams.set("time_range", JSON.stringify({ since: dateStart, until: dateStop }));
  url.searchParams.set("limit", "500");
  url.searchParams.set("access_token", accessToken);
  return url.toString();
}

export type DailySpendRow = { date: string; spend: number };

/**
 * Gasto por dia (level=account, time_increment=1) pro gráfico "Receita e
 * investimento por dia" da Visão Geral — ao vivo, mesma filosofia do gasto
 * agregado (sem cache histórico nosso, a Meta já devolve granularidade
 * diária nativamente).
 */
export async function fetchDailySpend(
  adAccountId: string,
  accessToken: string,
  dateStart: string,
  dateStop: string,
): Promise<DailySpendRow[]> {
  const url = new URL(`${META_GRAPH_API_BASE_URL}/${adAccountId}/insights`);
  url.searchParams.set("level", "account");
  url.searchParams.set("fields", "spend");
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("time_range", JSON.stringify({ since: dateStart, until: dateStop }));
  url.searchParams.set("limit", "500");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  const json = await res.json();
  if (json.error) {
    throw new Error(json.error.message ?? "Erro ao buscar insights diários do Meta Ads.");
  }

  return ((json.data ?? []) as { date_start: string; spend?: string }[]).map((row) => ({
    date: row.date_start,
    spend: Number(row.spend) || 0,
  }));
}

export type InsightEntity = {
  entity_id: string;
  entity_name: string;
  parent_id: string | null;
  spend: number;
  impressions: number;
  clicks: number;
};

export type AggregatedInsights = {
  campaigns: InsightEntity[];
  adsets: InsightEntity[];
  ads: InsightEntity[];
};

export function aggregateInsights(rows: AdInsightRow[]): AggregatedInsights {
  const campaigns = new Map<string, InsightEntity>();
  const adsets = new Map<string, InsightEntity>();
  const ads = new Map<string, InsightEntity>();

  function accumulate(map: Map<string, InsightEntity>, id: string, name: string, parentId: string | null, spend: number, impressions: number, clicks: number) {
    const existing = map.get(id);
    if (existing) {
      existing.spend += spend;
      existing.impressions += impressions;
      existing.clicks += clicks;
    } else {
      map.set(id, { entity_id: id, entity_name: name, parent_id: parentId, spend, impressions, clicks });
    }
  }

  for (const row of rows) {
    const spend = Number(row.spend) || 0;
    const impressions = Number(row.impressions) || 0;
    const clicks = Number(row.clicks) || 0;

    accumulate(campaigns, row.campaign_id, row.campaign_name, null, spend, impressions, clicks);
    accumulate(adsets, row.adset_id, row.adset_name, row.campaign_id, spend, impressions, clicks);
    accumulate(ads, row.ad_id, row.ad_name, row.adset_id, spend, impressions, clicks);
  }

  return {
    campaigns: [...campaigns.values()],
    adsets: [...adsets.values()],
    ads: [...ads.values()],
  };
}
