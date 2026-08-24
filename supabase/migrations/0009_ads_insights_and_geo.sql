-- Cache de insights do Meta Ads (Fase 6). Uma linha por entidade (não por
-- dia): cada sync SOBRESCREVE o total da janela consultada — é cache, não
-- série histórica. unique(meta_ad_account_id, level, entity_id) garante isso.
create table ads_insights_cache (
  id uuid primary key default gen_random_uuid(),
  meta_ad_account_id uuid not null references meta_ad_accounts (id) on delete cascade,
  level text not null check (level in ('campaign', 'adset', 'ad')),
  entity_id text not null,
  entity_name text,
  parent_id text,
  date_start date,
  date_stop date,
  spend numeric not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  fetched_at timestamptz not null default now(),
  unique (meta_ad_account_id, level, entity_id)
);

create index idx_ads_cache_account on ads_insights_cache (meta_ad_account_id);
create index idx_ads_cache_parent on ads_insights_cache (parent_id);

alter table ads_insights_cache enable row level security;
create policy "authenticated read" on ads_insights_cache for select to authenticated using (true);
create policy "service role write" on ads_insights_cache for all to service_role using (true) with check (true);

-- Receita por campanha/anúncio: exige que os links de anúncio usem os
-- parâmetros dinâmicos do Meta (utm_campaign={{campaign.id}},
-- utm_content={{ad.id}} — decisão registrada no CLAUDE.md) pra bater com
-- campaign_id/ad_id do cache acima.
create or replace function revenue_by_campaign()
returns table (campaign_id text, revenue numeric, conversions bigint)
language sql
stable
as $$
  select utm_campaign, coalesce(sum(gross_value), 0), count(*)
  from purchases
  where status in ('approved', 'confirmed') and utm_campaign is not null
  group by utm_campaign;
$$;

grant execute on function revenue_by_campaign() to authenticated;

create or replace function revenue_by_ad()
returns table (ad_id text, revenue numeric, conversions bigint)
language sql
stable
as $$
  select utm_content, coalesce(sum(gross_value), 0), count(*)
  from purchases
  where status in ('approved', 'confirmed') and utm_content is not null
  group by utm_content;
$$;

grant execute on function revenue_by_ad() to authenticated;

-- Geo (Fase 6): visitantes por estado (geo_region, ISO 3166-2 sem o
-- prefixo do país — ex "SP", não "BR-SP").
create or replace function visitors_by_region()
returns table (region text, visitor_count bigint)
language sql
stable
as $$
  select geo_region, count(*)
  from visitors
  where geo_region is not null
  group by geo_region;
$$;

grant execute on function visitors_by_region() to authenticated;
