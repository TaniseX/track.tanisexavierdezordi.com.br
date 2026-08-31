-- Wrappers em public pra chamar o Vault via RPC do supabase-js: o PostgREST
-- só expõe funções do schema public por padrão, e vault.* não é alcançável
-- direto pelo .rpc() do client. security definer + grant só a service_role.

create or replace function create_secret(secret_value text, secret_name text default null)
returns uuid
language sql
security definer
set search_path = public, vault
as $$
  select vault.create_secret(secret_value, secret_name);
$$;

create or replace function update_secret(secret_id uuid, secret_value text)
returns void
language sql
security definer
set search_path = public, vault
as $$
  select vault.update_secret(secret_id, secret_value);
$$;

create or replace function read_secret(secret_id uuid)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where id = secret_id;
$$;

-- `revoke ... from public` sozinho NÃO bloqueia anon/authenticated no
-- Supabase — esses roles recebem EXECUTE em funções novas do schema public
-- via ALTER DEFAULT PRIVILEGES própria do projeto, um grant direto (não
-- herdado do pseudo-role public). Sem revogar explicitamente de anon e
-- authenticated também, essas funções security definer ficam chamáveis por
-- qualquer um com a publishable key — inclusive read_secret, vazando todos
-- os segredos do Vault. Descoberto e corrigido em auditoria (ver CLAUDE.md).
revoke all on function create_secret(text, text) from public, anon, authenticated;
revoke all on function update_secret(uuid, text) from public, anon, authenticated;
revoke all on function read_secret(uuid) from public, anon, authenticated;
grant execute on function create_secret(text, text) to service_role;
grant execute on function update_secret(uuid, text) to service_role;
grant execute on function read_secret(uuid) to service_role;
