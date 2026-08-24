-- Visualizações de página por campanha/anúncio, pra taxa de conversão na
-- aba Campanhas. Mesmo princípio de revenue_by_campaign/revenue_by_ad
-- (migration 0009): exige utm_campaign={{campaign.id}}/utm_content={{ad.id}}
-- nos links do anúncio. Sem date_from/date_to — Campanhas não entra no
-- filtro de data global (decisão já registrada no CLAUDE.md, mesmo motivo
-- de revenue_by_campaign/revenue_by_ad ficarem de fora da migration 0012).
create or replace function views_by_campaign()
returns table (campaign_id text, views bigint)
language sql
stable
as $$
  select utm_campaign, count(*)
  from events_log
  where event_name = 'PageView' and utm_campaign is not null
  group by utm_campaign;
$$;

grant execute on function views_by_campaign() to authenticated;

create or replace function views_by_ad()
returns table (ad_id text, views bigint)
language sql
stable
as $$
  select utm_content, count(*)
  from events_log
  where event_name = 'PageView' and utm_content is not null
  group by utm_content;
$$;

grant execute on function views_by_ad() to authenticated;
