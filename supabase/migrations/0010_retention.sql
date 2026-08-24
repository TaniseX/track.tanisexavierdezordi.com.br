-- Retenção de logs (Fase 7): zera os campos jsonb pesados de events_log com
-- mais de settings.retention_days (default 14), em lotes — SEM apagar a
-- linha (mantém data, evento, UTMs e geo pro dashboard).

create or replace function purge_old_event_payloads()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_retention_days integer;
  v_total integer := 0;
  v_batch integer;
  v_batches integer := 0;
  c_batch_size constant integer := 5000;
  -- teto de segurança por execução (até 500k linhas/dia); se o backlog inicial
  -- for maior que isso, termina de limpar nos dias seguintes automaticamente.
  c_max_batches constant integer := 100;
begin
  select retention_days into v_retention_days from settings where id = true;
  v_retention_days := coalesce(v_retention_days, 14);

  loop
    with old_rows as (
      select id from events_log
      where created_at < now() - (v_retention_days || ' days')::interval
        and payload_meta <> '[]'::jsonb
      limit c_batch_size
    )
    update events_log
    set payload_meta = '[]'::jsonb,
        response_meta = '[]'::jsonb,
        payload_ga4 = '[]'::jsonb,
        response_ga4 = '[]'::jsonb
    from old_rows
    where events_log.id = old_rows.id;

    get diagnostics v_batch = row_count;
    v_total := v_total + v_batch;
    v_batches := v_batches + 1;

    exit when v_batch < c_batch_size or v_batches >= c_max_batches;
  end loop;

  return v_total;
end;
$$;

revoke all on function purge_old_event_payloads() from public;
grant execute on function purge_old_event_payloads() to service_role;

select cron.schedule(
  'purge-old-event-payloads',
  '0 3 * * *',
  $$select purge_old_event_payloads();$$
);

-- Higiene extra: limpa linhas antigas de rate_limits (comentário deixado na
-- migration 0007 — a tabela cresce um pouco a cada IP novo, sem TTL nativo).
create or replace function purge_old_rate_limits()
returns integer
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from rate_limits where window_start < now() - interval '1 day' returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke all on function purge_old_rate_limits() from public;
grant execute on function purge_old_rate_limits() to service_role;

select cron.schedule(
  'purge-old-rate-limits',
  '15 3 * * *',
  $$select purge_old_rate_limits();$$
);
