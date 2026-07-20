
-- Link error codes to help articles
ALTER TABLE public.error_catalog
  ADD COLUMN IF NOT EXISTS related_articles text[] NOT NULL DEFAULT '{}';

-- Profile expansion for public portfolios
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text UNIQUE,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Public read policy for published articles already exists (help_articles has 2 policies)
-- Seed suggested relations between error codes and articles by keyword
UPDATE public.error_catalog SET related_articles = ARRAY['como-gerar-primeira-apresentacao','geracao-lenta']
  WHERE code LIKE 'GEN-%' AND related_articles = '{}';
UPDATE public.error_catalog SET related_articles = ARRAY['problemas-com-pagamento','planos-e-precos']
  WHERE code LIKE 'PAY-%' AND related_articles = '{}';
UPDATE public.error_catalog SET related_articles = ARRAY['diagnostico-de-conexao']
  WHERE code LIKE 'NET-%' AND related_articles = '{}';
UPDATE public.error_catalog SET related_articles = ARRAY['exportar-apresentacao']
  WHERE code LIKE 'EXP-%' AND related_articles = '{}';
UPDATE public.error_catalog SET related_articles = ARRAY['atalhos-do-editor','slide-dinamico']
  WHERE code LIKE 'EDIT-%' AND related_articles = '{}';
UPDATE public.error_catalog SET related_articles = ARRAY['imagens-e-midia']
  WHERE code LIKE 'IMG-%' AND related_articles = '{}';
