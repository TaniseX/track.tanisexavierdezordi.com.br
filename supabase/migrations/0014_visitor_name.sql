-- Nome do lead (capturado no formulário de popup das LPs, via evento
-- "Lead" -> /api/event -> visitors). Não existia coluna nenhuma pra isso.
alter table visitors add column if not exists name text;
