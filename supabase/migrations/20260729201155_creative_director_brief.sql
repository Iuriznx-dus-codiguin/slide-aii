-- Creative Director Engine (Fase 1): documento de decisão criativa gerado
-- ANTES do conteúdo, persistido por apresentação. Segue o mesmo padrão já
-- usado para dynamic_theme (coluna jsonb nullable, populada pela edge
-- function e consumida pelo frontend) — nenhuma migração de dado existente
-- é necessária, e presentations antigas simplesmente têm creative_brief = null.
ALTER TABLE public.presentations ADD COLUMN IF NOT EXISTS creative_brief jsonb;

COMMENT ON COLUMN public.presentations.creative_brief IS
  'Documento de decisão criativa (Creative Director Engine): tom, densidade, '
  'minimalismo, ritmo, hierarquia, paleta de transições permitidas/proibidas, '
  'etc. Gerado numa chamada de IA separada e mais barata ANTES da geração de '
  'conteúdo, e usado para parametrizar o prompt principal e o Motion Director '
  '(src/lib/slideTransitions.ts). Nulo para apresentações geradas antes desta feature.';
