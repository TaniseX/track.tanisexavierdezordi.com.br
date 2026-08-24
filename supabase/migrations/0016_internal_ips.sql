-- Tráfego interno (equipe testando o próprio funil) — IPs cadastrados aqui
-- são ignorados em /api/identify, /api/event e no webhook da Guru: nada é
-- gravado no banco e nada é disparado pro Meta/GA4 pra esses IPs. Gerenciado
-- pelo painel (Configurações → Tráfego interno), sem precisar de migration
-- nova pra cada IP.
create table internal_ips (
  id uuid primary key default gen_random_uuid(),
  ip text not null unique,
  label text,
  created_at timestamptz not null default now()
);

alter table internal_ips enable row level security;
create policy "authenticated read" on internal_ips for select to authenticated using (true);
create policy "service role write" on internal_ips for all to service_role using (true) with check (true);
