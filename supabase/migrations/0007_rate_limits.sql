-- Rate limiting em Postgres pros endpoints públicos (/api/identify, /api/event) —
-- sem dependência externa (Upstash/Redis), decisão do usuário. Janela fixa
-- por chave (ex: "identify:1.2.3.4"), checada atomicamente via upsert.

create table rate_limits (
  key text primary key,
  count integer not null default 1,
  window_start timestamptz not null default now()
);

alter table rate_limits enable row level security;
create policy "service role only" on rate_limits for all to service_role using (true) with check (true);

create or replace function check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into rate_limits (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set count = case
        when rate_limits.window_start < now() - (p_window_seconds || ' seconds')::interval
          then 1
        else rate_limits.count + 1
      end,
      window_start = case
        when rate_limits.window_start < now() - (p_window_seconds || ' seconds')::interval
          then now()
        else rate_limits.window_start
      end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function check_rate_limit(text, integer, integer) from public;
grant execute on function check_rate_limit(text, integer, integer) to service_role;

comment on table rate_limits is 'Linhas antigas (window_start < now() - 1 dia) podem ser podadas periodicamente — ver retenção da Fase 7.';
