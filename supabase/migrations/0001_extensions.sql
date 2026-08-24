-- Extensões necessárias: pgcrypto (hash/cifra de segredos) e pg_cron (retenção de logs, Fase 7).
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron with schema extensions;
