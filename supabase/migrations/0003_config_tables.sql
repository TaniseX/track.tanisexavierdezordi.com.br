-- Tabelas de configuração (credenciais geridas pelo painel, nunca em env).
-- Segredos vivem no Supabase Vault (extensão supabase_vault, pré-instalada em
-- todo projeto Supabase) — cada linha guarda o uuid do segredo no Vault, não
-- o valor cifrado diretamente. Ver 0004_secrets_vault.sql.

-- settings: linha única (singleton) com o token do webhook e config geral.
create table settings (
  id boolean primary key default true,
  webhook_token_id uuid references vault.secrets (id),
  meta_test_event_code text,
  currency text not null default 'BRL',
  timezone text not null default 'America/Sao_Paulo',
  retention_days integer not null default 14,
  updated_at timestamptz not null default now(),
  constraint settings_singleton check (id)
);

comment on table settings is 'Linha única (id sempre true). webhook_token_id (Vault) valida /api/webhook/guru/[token].';

create table ga4_accounts (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  measurement_id text not null,
  api_secret_id uuid not null references vault.secrets (id),
  is_active boolean not null default true,
  last_tested_at timestamptz,
  last_test_status text,
  last_test_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ga4_accounts_is_active on ga4_accounts (is_active);

create table meta_pixels (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  pixel_id text not null,
  capi_token_id uuid not null references vault.secrets (id),
  is_active boolean not null default true,
  last_tested_at timestamptz,
  last_test_status text,
  last_test_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_meta_pixels_is_active on meta_pixels (is_active);

create table meta_ad_accounts (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  ad_account_id text not null,
  access_token_id uuid not null references vault.secrets (id),
  is_active boolean not null default true,
  last_synced_at timestamptz,
  last_test_status text,
  last_test_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_meta_ad_accounts_is_active on meta_ad_accounts (is_active);
