-- Adiciona dados de apresentadores por slide (notas técnicas + falas exatas).
-- Estrutura JSON: [{ id, name, technical_notes, exact_speech, transition_anchor }]
ALTER TABLE public.slides
  ADD COLUMN IF NOT EXISTS presenters_data jsonb DEFAULT '[]'::jsonb;

-- Adiciona configuração de DNA da apresentação (persona, profundidade, multi-apresentador).
ALTER TABLE public.presentations
  ADD COLUMN IF NOT EXISTS persona text,
  ADD COLUMN IF NOT EXISTS depth_level text DEFAULT 'high-level',
  ADD COLUMN IF NOT EXISTS presenters_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS presenters_names jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS include_speeches boolean NOT NULL DEFAULT false;