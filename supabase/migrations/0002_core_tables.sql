-- Tabelas core de tracking: visitors, events_log, purchases.
-- gen_random_uuid() é nativo do Postgres >= 13 (não depende de extensão).

create table visitors (
  id uuid primary key default gen_random_uuid(),
  trck_user_id text not null unique,
  email text,
  email_hash text,
  phone text,
  phone_hash text,
  fbp text,
  fbc text,
  ga_client_id text,
  ga_session_id text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  referrer text,
  landing_url text,
  ip text,
  user_agent text,
  geo_country text,
  geo_region text,
  geo_city text,
  geo_postal_code text,
  pixel_id text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_visitors_trck_user_id on visitors (trck_user_id);
create index idx_visitors_email_hash on visitors (email_hash);
create index idx_visitors_phone_hash on visitors (phone_hash);
create index idx_visitors_fbc on visitors (fbc);
create index idx_visitors_created_at on visitors (created_at desc);

comment on table visitors is 'Um registro por trck_user_id. Upsert feito por /api/identify.';
comment on column visitors.email_hash is 'sha256 do email normalizado, usado para matching sem expor o dado em claro em índices.';

-- events_log: um registro por evento (PageView, ViewContent, InitiateCheckout, Purchase...).
-- payload_meta/response_meta/payload_ga4/response_ga4 são ARRAYS jsonb: um item por
-- destino disparado (N pixels Meta + N propriedades GA4). Ver CLAUDE.md.
create table events_log (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  event_name text not null,
  trck_user_id text,
  visitor_id uuid references visitors (id) on delete set null,
  event_source_url text,
  value numeric,
  currency text,
  content_ids text[],
  content_name text,
  content_type text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  ip text,
  geo_country text,
  geo_region text,
  geo_city text,
  status text not null default 'pending',
  payload_meta jsonb not null default '[]'::jsonb,
  response_meta jsonb not null default '[]'::jsonb,
  payload_ga4 jsonb not null default '[]'::jsonb,
  response_ga4 jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_events_log_event_id on events_log (event_id);
create index idx_events_log_visitor_id on events_log (visitor_id);
create index idx_events_log_event_name on events_log (event_name);
create index idx_events_log_created_at on events_log (created_at desc);

comment on column events_log.status is 'pending | sent | partial | error';
comment on column events_log.payload_meta is 'Array: um item {pixel_id, request, ...} por pixel Meta ativo no momento do disparo.';
comment on column events_log.payload_ga4 is 'Array: um item {measurement_id, request, ...} por propriedade GA4 ativa no momento do disparo.';

-- purchases: uma linha por transação Guru (guru_transaction_id único, idempotente).
create table purchases (
  id uuid primary key default gen_random_uuid(),
  guru_transaction_id text not null unique,
  trck_user_id text,
  visitor_id uuid references visitors (id) on delete set null,
  match_method text not null default 'unmatched',
  status text not null,
  product_id text,
  product_name text,
  gross_value numeric,
  net_value numeric,
  currency text,
  payment_method text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  contact_name text,
  contact_email text,
  contact_email_hash text,
  contact_phone text,
  contact_phone_hash text,
  geo_country text,
  ga_client_id text,
  ga_session_id text,
  fbp text,
  fbc text,
  purchase_event_id uuid references events_log (id) on delete set null,
  raw_payload jsonb not null,
  ordered_at timestamptz,
  confirmed_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_purchases_guru_transaction_id on purchases (guru_transaction_id);
create index idx_purchases_visitor_id on purchases (visitor_id);
create index idx_purchases_status on purchases (status);
create index idx_purchases_created_at on purchases (created_at desc);
create index idx_purchases_utm_campaign on purchases (utm_campaign);

comment on column purchases.match_method is 'trck_user_id | email | phone | unmatched';
comment on column purchases.raw_payload is 'Payload bruto recebido do webhook Guru, para auditoria.';
