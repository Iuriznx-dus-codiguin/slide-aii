# Motor criativo v2 — o que precisa ser aplicado fora do repositório

O código do motor de cenas já está no repositório, na branch
`claude/cool-archimedes-fay1ug`. Quatro coisas não se aplicam por commit:

1. **Migração do banco.** O Lovable Cloud não executa sozinho um `.sql` que
   chega pelo GitHub.
2. **Deploy das edge functions alteradas.**
3. **Secrets opcionais.**
4. **Instalação das dependências, build e testes.** Não rodaram no ambiente
   onde o código foi escrito.

Antes de colar o prompt, faça o merge da branch em `main` (ou abra o PR e
faça o merge). O Lovable sincroniza a branch padrão.

O bloco abaixo pode ser colado **inteiro** no chat do Lovable.

---

```text
Contexto: o repositório recebeu o "motor de cenas v2" do SlideAI (commits
"feat(motor-v2): …"). O código já está pronto e revisado. NÃO reescreva,
refatore nem "corrija" arquivos de código. A tarefa é só aplicar o que não
entra por commit, validar e me reportar. Se alguma etapa falhar, pare e me
mostre o erro exato, sem contornar mudando código.

IMPORTANTE: não altere a tabela de créditos, as funções de cobrança/estorno
nem as políticas existentes. Esta migração não toca nelas.

ETAPA 1 — Migração do banco
Execute exatamente esta migração (é o arquivo
supabase/migrations/20260925000100_scene_engine_v2.sql). Ela é idempotente.

-- início do SQL
ALTER TABLE public.presentations
  ADD COLUMN IF NOT EXISTS engine_version smallint NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.presentation_asset_quotas (
  presentation_id uuid PRIMARY KEY REFERENCES public.presentations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  ai_planned integer NOT NULL DEFAULT 0 CHECK (ai_planned BETWEEN 0 AND 200),
  ai_consumed integer NOT NULL DEFAULT 0 CHECK (ai_consumed >= 0),
  photo_planned integer NOT NULL DEFAULT 0 CHECK (photo_planned BETWEEN 0 AND 200),
  photo_consumed integer NOT NULL DEFAULT 0 CHECK (photo_consumed >= 0),
  ai_cost_usd numeric(10, 5) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE INDEX IF NOT EXISTS presentation_asset_quotas_user_idx
  ON public.presentation_asset_quotas (user_id);

ALTER TABLE public.presentation_asset_quotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asset_quota_owner_read" ON public.presentation_asset_quotas;
CREATE POLICY "asset_quota_owner_read" ON public.presentation_asset_quotas
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
  );

REVOKE INSERT, UPDATE, DELETE ON public.presentation_asset_quotas FROM anon, authenticated;
GRANT SELECT ON public.presentation_asset_quotas TO authenticated;

CREATE OR REPLACE FUNCTION public.consume_presentation_asset(_presentation_id uuid, _uid uuid, _kind text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _remaining integer;
BEGIN
  IF _kind = 'ai' THEN
    UPDATE public.presentation_asset_quotas
       SET ai_consumed = ai_consumed + 1
     WHERE presentation_id = _presentation_id
       AND user_id = _uid
       AND ai_consumed < ai_planned
       AND expires_at > now()
    RETURNING ai_planned - ai_consumed INTO _remaining;
  ELSIF _kind = 'photo' THEN
    UPDATE public.presentation_asset_quotas
       SET photo_consumed = photo_consumed + 1
     WHERE presentation_id = _presentation_id
       AND user_id = _uid
       AND photo_consumed < photo_planned
       AND expires_at > now()
    RETURNING photo_planned - photo_consumed INTO _remaining;
  ELSE
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_kind');
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_quota');
  END IF;
  RETURN jsonb_build_object('ok', true, 'remaining', _remaining);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_presentation_asset(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_presentation_asset(uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.add_presentation_asset_cost(_presentation_id uuid, _uid uuid, _cost_usd numeric)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.presentation_asset_quotas
     SET ai_cost_usd = ai_cost_usd + LEAST(GREATEST(COALESCE(_cost_usd, 0), 0), 5)
   WHERE presentation_id = _presentation_id
     AND user_id = _uid;
$$;

REVOKE ALL ON FUNCTION public.add_presentation_asset_cost(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_presentation_asset_cost(uuid, uuid, numeric) TO service_role;
-- fim do SQL

Depois da migração, confirme com estas consultas e me mostre o resultado:
  SELECT column_name, data_type, column_default
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'presentations' AND column_name = 'engine_version';
  SELECT count(*) FROM public.presentations WHERE engine_version <> 1;   -- deve ser 0
  SELECT proname FROM pg_proc
   WHERE proname IN ('consume_presentation_asset', 'add_presentation_asset_cost');

ETAPA 2 — Tipos
Regenere src/integrations/supabase/types.ts a partir do banco. O arquivo já
tem engine_version, presentation_asset_quotas e as duas funções, então a
regeneração não deve mudar nada além de ordem/formatação. Se aparecer
diferença de conteúdo, me mostre antes de salvar.

ETAPA 3 — Deploy das edge functions
Faça o deploy destas quatro funções. Elas dependem dos novos módulos em
supabase/functions/_shared, que vão junto no bundle:
  - generate-presentation  (inclui contentV2.ts, persist.ts e speeches.ts na mesma pasta)
  - fetch-image
  - chat-editor
  - regenerate-speeches
Nenhuma outra função mudou. Não altere verify_jwt nem o config.toml.

ETAPA 4 — Secrets (todos opcionais; não crie os que eu não pedir)
  - ENGINE_V2_ROLLOUT_PERCENT: NÃO criar agora. Sem ele (padrão 0), só o
    Dev Mode usa o motor v2. Depois de comparar as métricas, vou pedir 10,
    depois 50, depois 100.
  - IMAGE_MODEL_PRIMARY / IMAGE_MODEL_ECONOMY: NÃO criar. O padrão é
    gpt-image-2.5-flare → gpt-image-1-mini → google/gemini-2.5-flash-image.
    Se a conta OpenAI não tiver o primeiro modelo, a cadeia passa sozinha
    para o próximo.
  - Confirme apenas que OPENAI_API_KEY, LOVABLE_API_KEY e PEXELS_API_KEY
    continuam configurados (não mostre os valores).

ETAPA 5 — Dependências, build e testes
Nenhuma dependência nova foi adicionada ao package.json.
  1. npm install   (ou bun install, conforme o lockfile do projeto)
  2. npm run build   → deve terminar sem erro
  3. npm test        → vitest. Suítes novas: src/test/visualPlanner, sceneResolver,
     catalogParity, sceneMotion, imageDirector e qualityGate. As suítes
     existentes devem continuar passando. Os testes *.e2e.test.ts dependem de
     variáveis de ambiente e podem ser pulados, como antes.
Me mostre o resumo final do build e do vitest (quantos passaram/falharam).

ETAPA 6 — Verificação funcional (Dev Mode, conta de desenvolvedor)
  a) Abra o Dev Mode (Ctrl+Shift+D) e ligue "Motor de cenas (v2)".
  b) Gere uma apresentação de 10 slides com imagens ligadas. O esperado:
     depois do carregamento, o app abre direto o Editor (sem tela de
     preview), o deck já está salvo e as imagens aparecem aos poucos no
     Editor.
  c) Desligue o v2 e gere outra com o motor atual. Ela deve se comportar
     exatamente como antes, também salva no servidor.
  d) Abra uma apresentação antiga (criada antes deste deploy). Ela deve
     renderizar igual a antes.
  e) Rode e me mostre:
     SELECT created_at, status, metadata->>'engine_version' AS engine,
            metadata->'tokens'->>'output_per_slide' AS out_per_slide,
            metadata->'images' AS images, actual_cost_usd, duration_ms
       FROM public.generation_logs
      ORDER BY created_at DESC LIMIT 5;
     SELECT * FROM public.presentation_asset_quotas ORDER BY created_at DESC LIMIT 3;
     Espero, na geração v2, images.requested (pexels+ai) igual a
     images.displayed, e uma linha de cota criada para a apresentação.

Não mude código para "melhorar" nada que eu não pedi. Se algo divergir do
esperado, descreva o que viu e pare.
```

---

## Depois do prompt

- **Rollout.** Com as métricas dos dois motores no painel "Métricas Dev"
  (comparação v1 × v2), crie `ENGINE_V2_ROLLOUT_PERCENT=10` e depois suba o
  valor. O percentual é estável por usuário: a mesma pessoa sempre cai no
  mesmo motor.
- **Voltar atrás** não exige deploy. Com o secret removido ou em `0`, as
  gerações novas usam o v1. Decks já gerados no v2 continuam renderizando,
  porque o renderer decide pelo `engine_version` gravado em cada slide.
- **Se a migração ainda não tiver sido aplicada**, o código já se protege:
  - o `insert` em `presentations` tenta de novo sem `engine_version`;
  - a cota por apresentação é marcada como `unavailable`;
  - o `fetch-image` volta ao limite genérico por hora.

  Nada quebra, mas a resolução progressiva de imagens fica sujeita ao teto
  de 15 por hora.
