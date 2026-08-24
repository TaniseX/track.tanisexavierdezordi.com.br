-- Pós-launch: adiciona etapa "lead" no funil de conversão (visitou -> lead ->
-- iniciou checkout -> comprou) e quebra de geo por país e cidade (antes só
-- tinha estado, via visitors_by_region).

create or replace function funnel_counts()
returns table (stage text, visitor_count bigint)
language sql
stable
as $$
  select 'visited'::text as stage, count(distinct trck_user_id) as visitor_count
  from events_log
  union all
  select 'lead'::text, count(distinct trck_user_id)
  from events_log
  where event_name = 'Lead'
  union all
  select 'checkout'::text, count(distinct trck_user_id)
  from events_log
  where event_name = 'InitiateCheckout'
  union all
  select 'purchase'::text, count(distinct coalesce(trck_user_id, id::text))
  from purchases
  where status in ('approved', 'confirmed');
$$;

create or replace function visitors_by_country()
returns table (country text, visitor_count bigint)
language sql
stable
as $$
  select geo_country, count(*)
  from visitors
  where geo_country is not null
  group by geo_country;
$$;

grant execute on function visitors_by_country() to authenticated;

create or replace function visitors_by_city()
returns table (city text, region text, visitor_count bigint)
language sql
stable
as $$
  select geo_city, geo_region, count(*)
  from visitors
  where geo_city is not null
  group by geo_city, geo_region;
$$;

grant execute on function visitors_by_city() to authenticated;
