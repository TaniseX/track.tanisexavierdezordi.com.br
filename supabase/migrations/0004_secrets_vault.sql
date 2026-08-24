-- Segredos (webhook_token, api_secret, capi_token, access_token) vivem no
-- Supabase Vault, não em colunas bytea com chave própria: ALTER DATABASE/ROLE
-- SET de parâmetros customizados exige superusuário, indisponível no Postgres
-- gerenciado do Supabase. Vault resolve isso nativamente (pgsodium por baixo,
-- chave de cifra nunca fica junto dos dados). Ver CLAUDE.md.
--
-- Uso, sempre a partir do servidor (lib/supabase/admin.ts, secret role):
--   criar : select vault.create_secret('valor', 'label opcional') -- retorna uuid
--   trocar: select vault.update_secret('<uuid>', 'novo valor')
--   ler   : select decrypted_secret from vault.decrypted_secrets where id = '<uuid>'
--
-- Reforço de segurança: schema vault só é acessível pelo service_role.
revoke all on schema vault from anon, authenticated;
revoke all on all tables in schema vault from anon, authenticated;
