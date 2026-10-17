-- Atualização de um banco que já tinha dados gravados pelos buracos que a 0010
-- fecha (upgrade_before.sql): as linhas continuam utilizáveis e o suporte não
-- tropeça em números de chamado ocupados.
\set ON_ERROR_STOP 1
\pset pager off
CREATE OR REPLACE FUNCTION pg_temp.ok(_cond boolean, _msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF NOT coalesce(_cond, false) THEN RAISE EXCEPTION 'FALHOU: %', _msg; END IF; RAISE NOTICE 'ok: %', _msg; END $$;

SELECT pg_temp.ok((SELECT bool_and(convalidated) FROM pg_constraint
                    WHERE conname IN ('presentations_ai_usage_nonnegative', 'presentations_prompt_field_sizes',
                                      'profile_access_requests_message_len')), 'restrições validadas sobre as linhas antigas');

-- Dona revoga o pedido antigo (antes: a restrição barrava o UPDATE).
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}', false);
UPDATE public.profile_access_requests SET status = 'denied' WHERE owner_id = auth.uid();
SELECT pg_temp.ok((SELECT status = 'denied' AND char_length(message) = 500 FROM public.profile_access_requests
                    WHERE owner_id = auth.uid()), 'dona revoga pedido antigo com mensagem longa');

-- Dono do deck antigo publica e manda para a lixeira.
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"22222222-2222-2222-2222-222222222222"}', false);
UPDATE public.presentations SET is_published = true WHERE slug = 'deck-antigo-grande';
UPDATE public.presentations SET deleted_at = now() WHERE slug = 'deck-antigo-grande';
SELECT pg_temp.ok((SELECT deleted_at IS NOT NULL AND char_length(title) = 300 AND ai_edit_messages = 0
                     AND ai_edit_complex = 0 AND speech_regen_count = 0
                     FROM public.presentations WHERE slug = 'deck-antigo-grande'), 'deck antigo grande volta a aceitar alterações');
RESET ROLE;

-- Suporte abre atendimento sem colidir com os números ocupados.
SET ROLE service_role; SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false);
INSERT INTO public.support_conversations(user_id, ticket_id, state)
VALUES ('11111111-1111-1111-1111-111111111111', public.generate_ticket_id(), 'diagnosing');
SELECT pg_temp.ok((SELECT count(*) FROM public.support_conversations WHERE ticket_id = 'TCK-001003') = 1,
  'próximo chamado pula os números ocupados');
RESET ROLE;
\echo 'ATUALIZACAO OK'
