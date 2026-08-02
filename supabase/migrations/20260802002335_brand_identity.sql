-- Brand Identity Extraction (Fase 6): resultado da extracao heuristica de
-- identidade visual a partir de uma URL fornecida pelo usuario (ver
-- _shared/brandIdentity.ts). Mesmo padrao aditivo ja usado para
-- dynamic_theme/creative_brief - coluna jsonb nullable, populada pela edge
-- function, sem necessidade de migrar dado existente.
ALTER TABLE public.presentations ADD COLUMN IF NOT EXISTS brand_identity jsonb;

COMMENT ON COLUMN public.presentations.brand_identity IS
  'Fase 6 (Brand Identity Extraction): resultado bruto da extracao heuristica '
  '(cor primaria/acento, fontes Google Fonts, logo, nivel de confianca) a '
  'partir da URL opcional fornecida pelo usuario no formulario de geracao. '
  'Nulo quando nenhuma URL foi fornecida ou a extracao nao encontrou sinais '
  'uteis. O override de tema resultante (accent/accent2) ja fica refletido '
  'em dynamic_theme - esta coluna existe para auditoria/exibicao no Editor '
  '("extraido de seusite.com"), nao e a fonte consumida pela renderizacao.';
