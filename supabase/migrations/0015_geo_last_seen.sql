-- visitors_by_region/country/city filtravam por visitors.created_at (quando
-- o visitante foi visto PELA PRIMEIRA VEZ) — um visitante recorrente ativo
-- hoje mas criado em dia anterior ficava fora do filtro "Hoje", mesmo tendo
-- eventos hoje. last_seen_at é atualizado a cada /api/identify (toda visita),
-- então reflete atividade no período, não só primeira aparição.

create or replace function visitors_by_region(date_from timestamptz default null, date_to timestamptz default null)
returns table (region text, visitor_count bigint)
language sql
stable
as $$
  select geo_region, count(*)
  from visitors
  where geo_region is not null
    and (date_from is null or last_seen_at >= date_from)
    and (date_to is null or last_seen_at <= date_to)
  group by geo_region;
$$;

create or replace function visitors_by_country(date_from timestamptz default null, date_to timestamptz default null)
returns table (country text, visitor_count bigint)
language sql
stable
as $$
  select geo_country, count(*)
  from visitors
  where geo_country is not null
    and (date_from is null or last_seen_at >= date_from)
    and (date_to is null or last_seen_at <= date_to)
  group by geo_country;
$$;

create or replace function visitors_by_city(date_from timestamptz default null, date_to timestamptz default null)
returns table (city text, region text, visitor_count bigint)
language sql
stable
as $$
  select geo_city, geo_region, count(*)
  from visitors
  where geo_city is not null
    and (date_from is null or last_seen_at >= date_from)
    and (date_to is null or last_seen_at <= date_to)
  group by geo_city, geo_region;
$$;
