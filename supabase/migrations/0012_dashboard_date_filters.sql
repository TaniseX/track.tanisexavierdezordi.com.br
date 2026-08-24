-- Filtro de data global do painel (hoje/7d/30d/personalizado). Cada RPC de
-- agregação passa a aceitar date_from/date_to opcionais (timestamptz).
--
-- IMPORTANTE: as funções abaixo hoje têm zero parâmetros. `create or replace
-- function foo(date_from ..., date_to ...)` NÃO substitui a versão sem
-- parâmetros — cria uma sobrecarga nova, e como os dois parâmetros têm
-- default, ela também vira "chamável com zero argumentos", o que deixa a
-- chamada sem argumento ambígua pro PostgREST. Por isso o `drop function`
-- explícito antes de cada `create or replace`.

drop function if exists funnel_counts();

create or replace function funnel_counts(date_from timestamptz default null, date_to timestamptz default null)
returns table (stage text, visitor_count bigint)
language sql
stable
as $$
  select 'visited'::text as stage, count(distinct trck_user_id) as visitor_count
  from events_log
  where (date_from is null or created_at >= date_from)
    and (date_to is null or created_at <= date_to)
  union all
  select 'lead'::text, count(distinct trck_user_id)
  from events_log
  where event_name = 'Lead'
    and (date_from is null or created_at >= date_from)
    and (date_to is null or created_at <= date_to)
  union all
  select 'checkout'::text, count(distinct trck_user_id)
  from events_log
  where event_name = 'InitiateCheckout'
    and (date_from is null or created_at >= date_from)
    and (date_to is null or created_at <= date_to)
  union all
  select 'purchase'::text, count(distinct coalesce(trck_user_id, id::text))
  from purchases
  where status in ('approved', 'confirmed')
    and (date_from is null or created_at >= date_from)
    and (date_to is null or created_at <= date_to);
$$;

grant execute on function funnel_counts(timestamptz, timestamptz) to authenticated;

drop function if exists count_events_by_name();

create or replace function count_events_by_name(date_from timestamptz default null, date_to timestamptz default null)
returns table (event_name text, event_count bigint)
language sql
stable
as $$
  select event_name, count(*) as event_count
  from events_log
  where (date_from is null or created_at >= date_from)
    and (date_to is null or created_at <= date_to)
  group by event_name
  order by event_count desc;
$$;

grant execute on function count_events_by_name(timestamptz, timestamptz) to authenticated;

drop function if exists billing_summary();

create or replace function billing_summary(date_from timestamptz default null, date_to timestamptz default null)
returns table (total_revenue numeric, avg_ticket numeric, refund_count bigint, total_count bigint)
language sql
stable
as $$
  select
    coalesce(sum(gross_value) filter (where status in ('approved', 'confirmed')), 0) as total_revenue,
    coalesce(avg(gross_value) filter (where status in ('approved', 'confirmed')), 0) as avg_ticket,
    count(*) filter (where status in ('refunded', 'chargeback')) as refund_count,
    count(*) as total_count
  from purchases
  where (date_from is null or created_at >= date_from)
    and (date_to is null or created_at <= date_to);
$$;

grant execute on function billing_summary(timestamptz, timestamptz) to authenticated;

drop function if exists visitors_by_region();

create or replace function visitors_by_region(date_from timestamptz default null, date_to timestamptz default null)
returns table (region text, visitor_count bigint)
language sql
stable
as $$
  select geo_region, count(*)
  from visitors
  where geo_region is not null
    and (date_from is null or created_at >= date_from)
    and (date_to is null or created_at <= date_to)
  group by geo_region;
$$;

grant execute on function visitors_by_region(timestamptz, timestamptz) to authenticated;

drop function if exists visitors_by_country();

create or replace function visitors_by_country(date_from timestamptz default null, date_to timestamptz default null)
returns table (country text, visitor_count bigint)
language sql
stable
as $$
  select geo_country, count(*)
  from visitors
  where geo_country is not null
    and (date_from is null or created_at >= date_from)
    and (date_to is null or created_at <= date_to)
  group by geo_country;
$$;

grant execute on function visitors_by_country(timestamptz, timestamptz) to authenticated;

drop function if exists visitors_by_city();

create or replace function visitors_by_city(date_from timestamptz default null, date_to timestamptz default null)
returns table (city text, region text, visitor_count bigint)
language sql
stable
as $$
  select geo_city, geo_region, count(*)
  from visitors
  where geo_city is not null
    and (date_from is null or created_at >= date_from)
    and (date_to is null or created_at <= date_to)
  group by geo_city, geo_region;
$$;

grant execute on function visitors_by_city(timestamptz, timestamptz) to authenticated;

-- Aba Páginas: taxa de conversão por URL (sem querystring — utms diferentes
-- da mesma LP não devem fragmentar a linha). Purchase não carrega URL
-- própria (nasce no webhook, fora do navegador) — herda a landing_url do
-- visitante casado.
create or replace function page_funnel(date_from timestamptz default null, date_to timestamptz default null)
returns table (
  page_url text,
  pageviews bigint,
  unique_visitors bigint,
  leads bigint,
  checkouts bigint,
  purchases bigint
)
language sql
stable
as $$
  with base as (
    select
      split_part(event_source_url, '?', 1) as page_url,
      trck_user_id,
      event_name
    from events_log
    where event_source_url is not null
      and (date_from is null or created_at >= date_from)
      and (date_to is null or created_at <= date_to)
  ),
  page_events as (
    select
      page_url,
      count(*) filter (where event_name = 'PageView') as pageviews,
      count(distinct trck_user_id) as unique_visitors,
      count(distinct trck_user_id) filter (where event_name = 'Lead') as leads,
      count(distinct trck_user_id) filter (where event_name = 'InitiateCheckout') as checkouts
    from base
    group by page_url
  ),
  page_purchases as (
    select split_part(v.landing_url, '?', 1) as page_url, count(*) as purchase_count
    from purchases p
    join visitors v on v.id = p.visitor_id
    where p.status in ('approved', 'confirmed')
      and (date_from is null or p.created_at >= date_from)
      and (date_to is null or p.created_at <= date_to)
    group by split_part(v.landing_url, '?', 1)
  )
  select
    pe.page_url,
    pe.pageviews,
    pe.unique_visitors,
    pe.leads,
    pe.checkouts,
    coalesce(pp.purchase_count, 0) as purchases
  from page_events pe
  left join page_purchases pp on pp.page_url = pe.page_url;
$$;

grant execute on function page_funnel(timestamptz, timestamptz) to authenticated;
