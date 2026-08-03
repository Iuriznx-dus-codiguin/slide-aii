ALTER TABLE public.presentations ADD COLUMN IF NOT EXISTS creative_brief jsonb;

COMMENT ON COLUMN public.presentations.creative_brief IS
  'Documento de decisao criativa (Creative Director Engine): tom, densidade, minimalismo, ritmo, hierarquia, paleta de transicoes permitidas/proibidas. Gerado numa chamada de IA separada ANTES da geracao de conteudo. Nulo para apresentacoes anteriores a esta feature.';

ALTER TABLE public.presentations ADD COLUMN IF NOT EXISTS brand_identity jsonb;

COMMENT ON COLUMN public.presentations.brand_identity IS
  'Fase 6 (Brand Identity Extraction): resultado bruto da extracao heuristica (cor primaria/acento, fontes, logo, confianca) a partir da URL opcional do formulario. O override de tema resultante ja fica refletido em dynamic_theme; esta coluna existe para auditoria/exibicao no Editor.';

CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('pexels', 'ai')),
  query TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  usage_count INTEGER NOT NULL DEFAULT 1,
  presentation_id UUID REFERENCES public.presentations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assets_owner_all" ON public.assets;
CREATE POLICY "assets_owner_all" ON public.assets FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_assets_user ON public.assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_metadata_gin ON public.assets USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_assets_lookup ON public.assets(user_id, source, last_used_at DESC);

COMMENT ON TABLE public.assets IS
  'Fase 5 (Asset Intelligence Engine): biblioteca de imagens reaproveitaveis por usuario, taggeada por metadados de contexto de geracao. Alimentada e consultada por fetch-image via _shared/assetIntelligence.ts.';