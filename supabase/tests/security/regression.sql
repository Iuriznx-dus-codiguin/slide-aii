\set ON_ERROR_STOP 1
\pset pager off
-- Fluxos legítimos que precisam continuar funcionando depois da 0010.
-- V = vítima/dona 1111..., A = outra conta 2222..., staff = 5478... (admin+developer).
CREATE OR REPLACE FUNCTION pg_temp.as_user(_uid text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('role','authenticated','sub',_uid)::text, false) $$;
CREATE OR REPLACE FUNCTION pg_temp.ok(_cond boolean, _msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF NOT coalesce(_cond, false) THEN RAISE EXCEPTION 'FALHOU: %', _msg; END IF; RAISE NOTICE 'ok: %', _msg; END $$;

-- 1. Dono edita o próprio perfil (Profile.tsx / Settings.tsx / Onboarding).
SET ROLE authenticated; SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
UPDATE public.profiles SET full_name = 'Vítima Nova', role = 'teacher', username = 'vitima', bio = 'b',
  website = 'https://x.com', is_public = true, social_links = '{"github":"v"}', avatar_url = null
 WHERE id = auth.uid();
SELECT pg_temp.ok((SELECT full_name FROM public.profiles WHERE id = auth.uid()) = 'Vítima Nova', 'dono atualiza campos editáveis do perfil');

-- 2. Dono gera via servidor (service_role) e o deck nasce privado.
RESET ROLE; SET ROLE service_role; SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false);
INSERT INTO public.presentations(id, user_id, title, slug, include_speeches)
VALUES ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Deck novo', 'deck-novo-xyz', true);
INSERT INTO public.slides(presentation_id, position, content) VALUES ('aaaaaaaa-0000-0000-0000-000000000002', 0, '{"headline":"Oi"}');
SELECT pg_temp.ok((SELECT NOT is_published AND include_speeches FROM public.presentations WHERE slug = 'deck-novo-xyz'),
  'deck do servidor nasce privado e mantém falas pagas');
UPDATE public.profiles SET credits_bonus = 1000, plan = 'single' WHERE id = '11111111-1111-1111-1111-111111111111';
SELECT pg_temp.ok(true, 'service_role altera colunas de cobrança');
RESET ROLE;

-- 3. Visualizador: privado só para o dono; publicado para qualquer um.
SET ROLE anon; SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SELECT pg_temp.ok(public.get_shared_presentation('deck-novo-xyz') IS NULL, 'anônimo não abre deck privado');
RESET ROLE; SET ROLE authenticated; SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
SELECT pg_temp.ok((public.get_shared_presentation('deck-novo-xyz')->'presentation'->>'is_owner')::boolean, 'dono abre o próprio deck privado (is_owner)');
SELECT pg_temp.ok(jsonb_array_length(public.get_shared_presentation('deck-novo-xyz')->'slides') = 1, 'RPC devolve os slides');
-- Painel: publicar, mover para a lixeira; Editor: slides_count/dynamic_theme/updated_at.
UPDATE public.presentations SET is_published = true WHERE slug = 'deck-novo-xyz';
UPDATE public.presentations SET slides_count = 1, updated_at = now(), dynamic_theme = '{"bg":"#000"}' WHERE slug = 'deck-novo-xyz';
UPDATE public.presentations SET title = 'Renomeado', description = 'd' WHERE slug = 'deck-novo-xyz';
SELECT pg_temp.ok(true, 'dono publica, renomeia e salva pelo Editor');
-- Editor: upsert de slides do próprio deck.
INSERT INTO public.slides(id, presentation_id, position, content)
VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 1, '{}')
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;
SELECT pg_temp.ok(true, 'Editor faz upsert de slides');
SELECT pg_temp.ok((SELECT count(*) = 2 AND bool_and(user_id = auth.uid()) FROM public.presentations), 'dono lista só os próprios decks (Dashboard)');
RESET ROLE; SET ROLE anon; SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SELECT pg_temp.ok(public.get_shared_presentation('deck-novo-xyz')->'presentation'->>'title' = 'Renomeado', 'anônimo abre deck publicado pelo slug');
SELECT pg_temp.ok(public.get_shared_presentation('deck-novo-xyz')->'presentation' ? 'user_id' = false, 'RPC não expõe user_id do autor');
SELECT pg_temp.ok((SELECT count(*) FROM public.presentations) = 0, 'anônimo não lista apresentações');
SELECT pg_temp.ok(public.record_presentation_view('aaaaaaaa-0000-0000-0000-000000000002'), 'visualização registrada');
RESET ROLE;
SELECT pg_temp.ok((SELECT view_count FROM public.presentations WHERE slug = 'deck-novo-xyz') = 1, 'view_count incrementa pelo gatilho');
SET ROLE anon;
SELECT count(*) FILTER (WHERE r) AS aceitas FROM (SELECT public.record_presentation_view('aaaaaaaa-0000-0000-0000-000000000002') AS r FROM generate_series(1, 60)) s \gset
SELECT pg_temp.ok(:aceitas = 29, 'teto de 30 visualizações/hora por visitante e deck');
RESET ROLE;
UPDATE public.presentations SET deleted_at = now() WHERE slug = 'deck-novo-xyz';
SET ROLE anon;
SELECT pg_temp.ok(public.get_shared_presentation('deck-novo-xyz') IS NULL, 'deck na lixeira some do link público');
RESET ROLE;
UPDATE public.presentations SET deleted_at = null WHERE slug = 'deck-novo-xyz';

-- 4. Outro usuário não lê nem altera o deck alheio.
SET ROLE authenticated; SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
SELECT pg_temp.ok((SELECT count(*) FROM public.slides WHERE presentation_id = 'aaaaaaaa-0000-0000-0000-000000000002') = 0, 'outra conta não lê slides alheios pela API');
UPDATE public.presentations SET title = 'hack' WHERE slug = 'deck-novo-xyz';
SELECT pg_temp.ok((SELECT count(*) FROM public.presentations WHERE title = 'hack') = 0, 'outra conta não altera deck alheio');
SELECT pg_temp.ok((public.get_shared_presentation('deck-novo-xyz')->'presentation'->>'is_owner')::boolean = false, 'outra conta abre publicado sem is_owner');
RESET ROLE;

-- 5. Reservas atômicas e crédito por pedido (service_role).
SET ROLE service_role; SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false);
SELECT pg_temp.ok((SELECT count(*) FROM generate_series(1, 8) g WHERE public.reserve_speech_regen('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 5) IS NOT NULL) = 5, 'reserva de falas para em 5');
SELECT public.release_speech_regen('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111');
SELECT pg_temp.ok((SELECT speech_regen_count FROM public.presentations WHERE slug = 'deck-novo-xyz') = 4, 'liberação devolve a vaga');
SELECT pg_temp.ok(public.reserve_speech_regen('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 5) IS NULL, 'reserva exige ser o dono');
SELECT pg_temp.ok((SELECT count(*) FROM generate_series(1, 12) g WHERE public.reserve_ai_edit_usage('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', false, 10, 3) IS NOT NULL) = 10, 'chat: 10 mensagens');
UPDATE public.presentations SET ai_edit_messages = 0, ai_edit_complex = 0 WHERE slug = 'deck-novo-xyz';
SELECT pg_temp.ok((SELECT count(*) FROM generate_series(1, 5) g WHERE public.reserve_ai_edit_usage('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', true, 10, 3) IS NOT NULL) = 3, 'chat: 3 edições complexas');
SELECT pg_temp.ok((public.grant_order_bonus_credits('11111111-1111-1111-1111-111111111111', 'ORD-1', 500, 'single_purchase')->>'granted')::boolean, 'avulso credita o pedido');
SELECT pg_temp.ok(NOT (public.grant_order_bonus_credits('11111111-1111-1111-1111-111111111111', 'ORD-1', 500, 'single_purchase')->>'granted')::boolean, 'mesmo pedido não credita de novo');
SELECT pg_temp.ok((SELECT credits_bonus FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111') = 1500, 'saldo final do bônus correto');
SELECT pg_temp.ok((public.revoke_order_credits('11111111-1111-1111-1111-111111111111', 'ORD-1', 500, false, 'refund_revoke')->>'revoked')::int = 500, 'reembolso estorna o pedido');
RESET ROLE;

-- 6. Rotinas do banco sem JWT (pg_cron / SQL editor) alteram cobrança.
SELECT set_config('request.jwt.claims', '', false);
SELECT public.ensure_monthly_credits('11111111-1111-1111-1111-111111111111');
UPDATE public.profiles SET credits_monthly = 7 WHERE id = '11111111-1111-1111-1111-111111111111';
SELECT pg_temp.ok(true, 'SQL editor/pg_cron altera cobrança sem forjar JWT');

-- 7. Troca de e-mail no Auth atualiza o perfil.
SET ROLE supabase_auth_admin;
UPDATE auth.users SET email = 'Nova@Example.com' WHERE id = '11111111-1111-1111-1111-111111111111';
RESET ROLE;
SELECT pg_temp.ok((SELECT email FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111') = 'nova@example.com', 'profiles.email acompanha auth.users');

-- 8. Suporte: dono avalia; equipe muda estado e responde.
INSERT INTO public.support_conversations(id, user_id) VALUES ('cccccccc-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111');
SET ROLE authenticated; SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
UPDATE public.support_conversations SET rating = 5 WHERE id = 'cccccccc-0000-0000-0000-000000000009';
INSERT INTO public.support_messages(conversation_id, role, content) VALUES ('cccccccc-0000-0000-0000-000000000009', 'user', 'oi');
SELECT pg_temp.ok(true, 'dono avalia e escreve como user');
SELECT pg_temp.as_user('54783c81-cf39-4789-ac0a-794a55c5f465');
UPDATE public.support_conversations SET state = 'resolved', resolved_by_human = true WHERE id = 'cccccccc-0000-0000-0000-000000000009';
INSERT INTO public.support_messages(conversation_id, role, content) VALUES ('cccccccc-0000-0000-0000-000000000009', 'assistant', 'resposta da equipe');
SELECT pg_temp.ok((SELECT state::text FROM public.support_conversations WHERE id = 'cccccccc-0000-0000-0000-000000000009') = 'resolved', 'equipe resolve e responde');
SELECT pg_temp.ok((public.get_content_metrics()->>'presentations_total')::int >= 2, 'equipe lê métricas de conteúdo');
SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
DO $$ BEGIN PERFORM public.get_content_metrics(); RAISE EXCEPTION 'FALHOU: métricas abertas a não-equipe'; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: métricas restritas à equipe'; END $$;
RESET ROLE;

-- 9. Avatares: dono lê a própria pasta.
INSERT INTO storage.objects(bucket_id, name) VALUES ('avatars', '22222222-2222-2222-2222-222222222222/a.png');
SET ROLE authenticated; SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
SELECT pg_temp.ok((SELECT count(*) FROM storage.objects WHERE bucket_id = 'avatars') = 1, 'dono vê só a própria pasta de avatar');
RESET ROLE;
SELECT pg_temp.ok((SELECT file_size_limit FROM storage.buckets WHERE id = 'avatars') = 4194304, 'limite do bucket de avatares');

-- 10. Portfólio público continua funcionando.
SET ROLE anon; SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SELECT pg_temp.ok((SELECT count(*) FROM public.get_portfolio_presentations('11111111-1111-1111-1111-111111111111')) = 1, 'portfólio público lista o deck publicado');
SELECT pg_temp.ok((SELECT access_state FROM public.get_profile_for_viewer('vitima')) = 'granted', 'perfil público abre');
RESET ROLE;
\echo 'REGRESSAO OK'
