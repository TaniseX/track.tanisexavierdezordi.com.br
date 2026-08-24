-- Receita por dia (fuso America/Sao_Paulo) pro gráfico "Receita e
-- investimento por dia" da Visão Geral — o "investimento" (gasto Meta) vem
-- ao vivo da API da Meta (lib/dashboard/live-ad-spend.ts), não do banco.
create or replace function revenue_by_day(date_from timestamptz default null, date_to timestamptz default null)
returns table (day date, revenue numeric)
language sql
stable
as $$
  select (created_at at time zone 'America/Sao_Paulo')::date as day, coalesce(sum(gross_value), 0) as revenue
  from purchases
  where status in ('approved', 'confirmed')
    and (date_from is null or created_at >= date_from)
    and (date_to is null or created_at <= date_to)
  group by day
  order by day;
$$;

grant execute on function revenue_by_day(timestamptz, timestamptz) to authenticated;
