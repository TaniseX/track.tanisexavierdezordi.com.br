-- RLS em todas as tabelas: leitura só authenticated (painel), escrita só
-- service_role (server-side, via lib/supabase/admin.ts). Cadastro público
-- de usuários fica desligado na configuração de Auth do projeto (fora do SQL).

alter table visitors enable row level security;
alter table events_log enable row level security;
alter table purchases enable row level security;
alter table settings enable row level security;
alter table ga4_accounts enable row level security;
alter table meta_pixels enable row level security;
alter table meta_ad_accounts enable row level security;

create policy "authenticated read" on visitors for select to authenticated using (true);
create policy "authenticated read" on events_log for select to authenticated using (true);
create policy "authenticated read" on purchases for select to authenticated using (true);
create policy "authenticated read" on settings for select to authenticated using (true);
create policy "authenticated read" on ga4_accounts for select to authenticated using (true);
create policy "authenticated read" on meta_pixels for select to authenticated using (true);
create policy "authenticated read" on meta_ad_accounts for select to authenticated using (true);

create policy "service role write" on visitors for all to service_role using (true) with check (true);
create policy "service role write" on events_log for all to service_role using (true) with check (true);
create policy "service role write" on purchases for all to service_role using (true) with check (true);
create policy "service role write" on settings for all to service_role using (true) with check (true);
create policy "service role write" on ga4_accounts for all to service_role using (true) with check (true);
create policy "service role write" on meta_pixels for all to service_role using (true) with check (true);
create policy "service role write" on meta_ad_accounts for all to service_role using (true) with check (true);
