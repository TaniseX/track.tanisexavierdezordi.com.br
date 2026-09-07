-- Bug real (achado numa venda de verdade, 2026-09-06): todas as RPCs de
-- agregação que somam/contam vendas confirmadas foram escritas só com o
-- vocabulário de status da Guru ('approved'/'confirmed'). Desde que o
-- webhook da Kiwify entrou (ver CLAUDE.md), `purchases.status` também
-- recebe os valores dela (`order_approved`/`paid` — confirmados numa venda
-- real; `compra_aprovada` é o nome do trigger, mantido por segurança caso
-- apareça em algum payload). A compra em si e o disparo pro Meta/GA4 já
-- funcionavam certo (isso é decidido em código, por `shouldTriggerPurchase`
-- de cada provedor — lib/guru/status-map.ts / lib/kiwify/status-map.ts) —
-- só o PAINEL (funil, faturamento, receita por dia/campanha/anúncio,
-- páginas) não reconhecia os status da Kiwify e mostrava a venda como se
-- não tivesse acontecido.
--
-- Sem `drop function` antes: diferente da migration 0012 (que mudava a
-- lista de parâmetros, causando ambiguidade de sobrecarga), aqui a
-- assinatura de cada função continua idêntica — só o corpo muda.

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
  where status in ('approved', 'confirmed', 'paid', 'order_approved', 'compra_aprovada')
    and (date_from is null or created_at >= date_from)
    and (date_to is null or created_at <= date_to);
$$;

create or replace function billing_summary(date_from timestamptz default null, date_to timestamptz default null)
returns table (total_revenue numeric, avg_ticket numeric, refund_count bigint, total_count bigint)
language sql
stable
as $$
  select
    coalesce(sum(gross_value) filter (where status in ('approved', 'confirmed', 'paid', 'order_approved', 'compra_aprovada')), 0) as total_revenue,
    coalesce(avg(gross_value) filter (where status in ('approved', 'confirmed', 'paid', 'order_approved', 'compra_aprovada')), 0) as avg_ticket,
    count(*) filter (where status in ('refunded', 'chargeback', 'compra_reembolsada')) as refund_count,
    count(*) as total_count
  from purchases
  where (date_from is null or created_at >= date_from)
    and (date_to is null or created_at <= date_to);
$$;

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
    where p.status in ('approved', 'confirmed', 'paid', 'order_approved', 'compra_aprovada')
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

create or replace function revenue_by_day(date_from timestamptz default null, date_to timestamptz default null)
returns table (day date, revenue numeric)
language sql
stable
as $$
  select (created_at at time zone 'America/Sao_Paulo')::date as day, coalesce(sum(gross_value), 0) as revenue
  from purchases
  where status in ('approved', 'confirmed', 'paid', 'order_approved', 'compra_aprovada')
    and (date_from is null or created_at >= date_from)
    and (date_to is null or created_at <= date_to)
  group by day
  order by day;
$$;

create or replace function revenue_by_campaign()
returns table (campaign_id text, revenue numeric, conversions bigint)
language sql
stable
as $$
  select utm_campaign, coalesce(sum(gross_value), 0), count(*)
  from purchases
  where status in ('approved', 'confirmed', 'paid', 'order_approved', 'compra_aprovada') and utm_campaign is not null
  group by utm_campaign;
$$;

create or replace function revenue_by_ad()
returns table (ad_id text, revenue numeric, conversions bigint)
language sql
stable
as $$
  select utm_content, coalesce(sum(gross_value), 0), count(*)
  from purchases
  where status in ('approved', 'confirmed', 'paid', 'order_approved', 'compra_aprovada') and utm_content is not null
  group by utm_content;
$$;
