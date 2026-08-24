export type TreeNode = {
  id: string;
  name: string;
  spend: number;
  revenue: number;
  conversions: number;
  views: number;
  roas: number | null;
  cpa: number | null;
  conversionRate: number | null;
  children?: TreeNode[];
};

type CacheRow = {
  level: string;
  entity_id: string;
  entity_name: string | null;
  parent_id: string | null;
  spend: number;
};

type RevenueRow = { revenue: number | string; conversions: number | string };
type ViewsRow = { views: number | string };

function metrics(spend: number, revenue: number, conversions: number, views: number) {
  return {
    roas: spend > 0 ? revenue / spend : null,
    cpa: conversions > 0 ? spend / conversions : null,
    conversionRate: views > 0 ? conversions / views : null,
  };
}

/**
 * Monta a árvore campanha → conjunto → anúncio. Receita de campanha vem
 * direto de revenue_by_campaign (autoritativa — todo purchase tem
 * utm_campaign). Receita de conjunto é a soma dos anúncios filhos (não temos
 * UTM no nível de conjunto, só campanha+anúncio — decisão registrada no
 * CLAUDE.md), então pode não bater 100% com a campanha se algum purchase não
 * tiver utm_content. Visualizações (PageView) seguem a mesma lógica: nível
 * de conjunto é soma dos anúncios filhos, campanha vem direto de
 * views_by_campaign.
 */
export function buildCampaignTree(
  cache: CacheRow[],
  revByCampaign: (RevenueRow & { campaign_id: string })[],
  revByAd: (RevenueRow & { ad_id: string })[],
  viewsByCampaign: (ViewsRow & { campaign_id: string })[] = [],
  viewsByAd: (ViewsRow & { ad_id: string })[] = [],
): TreeNode[] {
  const campaigns = cache.filter((r) => r.level === "campaign");
  const adsets = cache.filter((r) => r.level === "adset");
  const ads = cache.filter((r) => r.level === "ad");

  const campaignRevMap = new Map(revByCampaign.map((r) => [r.campaign_id, r]));
  const adRevMap = new Map(revByAd.map((r) => [r.ad_id, r]));
  const campaignViewsMap = new Map(viewsByCampaign.map((r) => [r.campaign_id, Number(r.views)]));
  const adViewsMap = new Map(viewsByAd.map((r) => [r.ad_id, Number(r.views)]));

  return campaigns
    .map((campaign) => {
      const childAdsets = adsets
        .filter((a) => a.parent_id === campaign.entity_id)
        .map((adset) => {
          const childAds = ads
            .filter((ad) => ad.parent_id === adset.entity_id)
            .map((ad) => {
              const rev = adRevMap.get(ad.entity_id);
              const revenue = Number(rev?.revenue ?? 0);
              const conversions = Number(rev?.conversions ?? 0);
              const spend = Number(ad.spend);
              const views = adViewsMap.get(ad.entity_id) ?? 0;
              return {
                id: ad.entity_id,
                name: ad.entity_name ?? ad.entity_id,
                spend,
                revenue,
                conversions,
                views,
                ...metrics(spend, revenue, conversions, views),
              };
            })
            .sort((a, b) => b.spend - a.spend);

          const revenue = childAds.reduce((sum, a) => sum + a.revenue, 0);
          const conversions = childAds.reduce((sum, a) => sum + a.conversions, 0);
          const views = childAds.reduce((sum, a) => sum + a.views, 0);
          const spend = Number(adset.spend);
          return {
            id: adset.entity_id,
            name: adset.entity_name ?? adset.entity_id,
            spend,
            revenue,
            conversions,
            views,
            children: childAds,
            ...metrics(spend, revenue, conversions, views),
          };
        })
        .sort((a, b) => b.spend - a.spend);

      const rev = campaignRevMap.get(campaign.entity_id);
      const revenue = Number(rev?.revenue ?? 0);
      const conversions = Number(rev?.conversions ?? 0);
      const spend = Number(campaign.spend);
      const views = campaignViewsMap.get(campaign.entity_id) ?? 0;
      return {
        id: campaign.entity_id,
        name: campaign.entity_name ?? campaign.entity_id,
        spend,
        revenue,
        conversions,
        views,
        children: childAdsets,
        ...metrics(spend, revenue, conversions, views),
      };
    })
    .sort((a, b) => b.spend - a.spend);
}
