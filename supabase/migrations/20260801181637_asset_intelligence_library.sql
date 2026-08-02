-- Asset Intelligence Engine (Fase 5): biblioteca de assets reaproveitaveis,
-- taggeados por metadados de contexto (nao por analise de pixel - ver
-- comentario em _shared/assetIntelligence.ts sobre a decisao). Cada asset
-- (imagem Pexels ja usada, ou imagem gerada por IA ja paga) vira candidato a
-- reaproveitamento em geracoes futuras do MESMO usuario, reduzindo custo de
-- imagem por IA (COSTS.aiImage) e aumentando a chance de consistencia visual
-- entre apresentacoes de um mesmo tema/area.
--
-- Escopo por usuario (nao compartilhado entre contas): mesma decisao de
-- design que presentations/slides ja usam (auth.uid() = user_id) - evita
-- misturar bibliotecas de contas diferentes e mantem o modelo de RLS ja
-- estabelecido no projeto sem introduzir uma superficie nova de risco.
CREATE TABLE public.assets (
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

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_assets_user ON public.assets(user_id);
CREATE INDEX idx_assets_metadata_gin ON public.assets USING gin(metadata);

-- Mesmo padrao owner_all ja usado em presentations/slides.
CREATE POLICY "assets_owner_all" ON public.assets FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.assets IS
  'Fase 5 (Asset Intelligence Engine): biblioteca de imagens reaproveitaveis '
  'por usuario, taggeada por metadados de contexto de geracao (nao analise '
  'de pixel). Alimentada e consultada por generate-presentation via '
  '_shared/assetIntelligence.ts. Escopo por usuario via RLS, mesmo padrao '
  'de presentations/slides.';
