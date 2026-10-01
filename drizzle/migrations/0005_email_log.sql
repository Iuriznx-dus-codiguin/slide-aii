CREATE TABLE public.email_log (
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
CREATE INDEX email_log_user_idx ON public.email_log(user_id, created_at DESC);