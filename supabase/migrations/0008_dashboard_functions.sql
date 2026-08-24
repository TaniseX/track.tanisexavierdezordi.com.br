-- Agregações pro dashboard (Fase 5). Sem security definer: rodam com o
-- privilégio de quem chama (authenticated), que já tem select via RLS —
-- evita puxar todas as linhas pro client só pra contar/agrupar.

create or replace function count_events_by_name()
returns table (event_name text, event_count bigint)
language sql
stable
as $$
  select event_name, count(*) as event_count
  from events_log
  group by event_name
  order by event_count desc;
$$;

grant execute on function count_events_by_name() to authenticated;

-- Visitou (qualquer evento) → iniciou checkout → comprou. coalesce no
-- purchase pra não perder as unmatched (trck_user_id nulo) na contagem —
-- count(distinct x) ignora NULL.
create or replace function funnel_counts()
returns table (stage text, visitor_count bigint)
language sql
stable
as $$
  select 'visited'::text as stage, count(distinct trck_user_id) as visitor_count
  from events_log
  union all
  select 'checkout'::text, count(distinct trck_user_id)
  from events_log
  where event_name = 'InitiateCheckout'
  union all
  select 'purchase'::text, count(distinct coalesce(trck_user_id, id::text))
  from purchases
  where status in ('approved', 'confirmed');
$$;

grant execute on function funnel_counts() to authenticated;

create or replace function billing_summary()
returns table (total_revenue numeric, avg_ticket numeric, refund_count bigint, total_count bigint)
language sql
stable
as $$
  select
    coalesce(sum(gross_value) filter (where status in ('approved', 'confirmed')), 0) as total_revenue,
    coalesce(avg(gross_value) filter (where status in ('approved', 'confirmed')), 0) as avg_ticket,
    count(*) filter (where status in ('refunded', 'chargeback')) as refund_count,
    count(*) as total_count
  from purchases;
$$;

grant execute on function billing_summary() to authenticated;
