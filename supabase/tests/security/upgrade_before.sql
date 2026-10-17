-- Dados que só o esquema ANTERIOR à 0010 permitia gravar pela API, para
-- conferir que a migração os corrige em vez de travar as linhas
-- (upgrade.sql). Executado num banco sem a 0010.
\set ON_ERROR_STOP 1
UPDATE public.profiles SET username = 'dona', is_public = false, allow_access_requests = true
 WHERE id = '11111111-1111-1111-1111-111111111111';
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"22222222-2222-2222-2222-222222222222"}', false);
-- Pedido de acesso com mensagem acima do novo teto (a tela corta em 400).
INSERT INTO public.profile_access_requests(owner_id, requester_id, message)
VALUES ('11111111-1111-1111-1111-111111111111', auth.uid(), repeat('m', 600));
-- Deck criado pelo cliente com título enorme e contadores negativos.
INSERT INTO public.presentations(id, user_id, title, slug, ai_edit_messages, ai_edit_complex, speech_regen_count)
VALUES ('aaaaaaaa-0000-0000-0000-0000000000c1', auth.uid(), repeat('T', 400), 'deck-antigo-grande', -5, -5, -5);
-- Conversas de suporte com os próximos números de chamado.
INSERT INTO public.support_conversations(user_id, ticket_id, state)
SELECT auth.uid(), 'TCK-' || lpad(n::text, 6, '0'), 'resolved' FROM generate_series(1000, 1002) n;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}', false);
UPDATE public.profile_access_requests SET status = 'approved' WHERE owner_id = auth.uid();
RESET ROLE;
