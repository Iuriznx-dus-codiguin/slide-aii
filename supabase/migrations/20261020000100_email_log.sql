-- Cópia idempotente de drizzle/migrations/0005_email_log.sql, que nunca teve
-- par em supabase/migrations (auditoria de 17/10/2026, B-37). Em bancos onde a
-- tabela já existe, não faz nada; num banco novo, cria o registro de e-mails
-- usado por _shared/email.ts e pela retenção (purge_ops_data).
CREATE TABLE IF NOT EXISTS public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL UNIQUE,
  event text NOT NULL,
  recipient text NOT NULL,
  user_id uuid,
  status text NOT NULL DEFAULT 'pending',
  provider_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.email_log TO service_role;
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS email_log_user_idx ON public.email_log(user_id, created_at DESC);
