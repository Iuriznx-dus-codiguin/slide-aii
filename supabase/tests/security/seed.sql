-- Dados de teste: vítima (V), atacante (A). Executado como postgres.
INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES
 ('11111111-1111-1111-1111-111111111111', 'vitima@example.com', '{"full_name":"Vitima"}'),
 ('22222222-2222-2222-2222-222222222222', 'atacante@example.com', '{"full_name":"Atacante"}');
-- Deck da vítima gravado como o servidor grava hoje (persist.ts).
SET ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false);
INSERT INTO public.presentations(id, user_id, title, description, slug)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        'Plano de demissões Q4', 'Prompt confidencial: cortar 30% do time', 'plano-demissoes-q4-abc123');
INSERT INTO public.slides(presentation_id, position, content, speaker_notes)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 0, '{"headline":"Cortes"}', 'nota privada do apresentador');
UPDATE public.profiles SET credits_bonus = 500 WHERE id = '22222222-2222-2222-2222-222222222222';
RESET ROLE;
SELECT set_config('request.jwt.claims', '', false);
