
-- Etapa 2 (migração complementar): help articles, histórico do catálogo,
-- request_id / reopen tracking, allowlist de contexto, novos estados de conversa.

-- ── 1. help_articles: base de conhecimento do papel "guia de uso"
CREATE TABLE public.help_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  category text NOT NULL,
  content_md text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.help_articles TO authenticated, anon;
GRANT ALL ON public.help_articles TO service_role;
ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer um lê artigos publicados"
  ON public.help_articles FOR SELECT
  USING (is_published = true);
CREATE POLICY "Admin/dev gerencia artigos"
  ON public.help_articles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'));

CREATE TRIGGER trg_help_articles_updated_at
  BEFORE UPDATE ON public.help_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_help_articles_keywords ON public.help_articles USING gin(keywords);
CREATE INDEX idx_help_articles_category ON public.help_articles(category) WHERE is_published;

-- Seed inicial de artigos (10)
INSERT INTO public.help_articles (slug, title, category, content_md, keywords) VALUES
('como-gerar-apresentacao','Como gerar uma apresentação','geracao',
 E'1. Acesse **/gerar**.\n2. Descreva o tema, público-alvo e número de slides.\n3. Escolha o template.\n4. Clique em **Gerar**. O processo leva ~30-60s.\n5. Você será redirecionado ao editor.',
 ARRAY['gerar','criar','apresentação','nova','geração','slides']),
('editar-slide','Como editar um slide','editor',
 E'No editor (**/editor/:slug**):\n1. Clique no slide na barra lateral esquerda.\n2. Use o painel direito para ajustar texto, imagem, transição e animação.\n3. A aba **Animação → Transição entre slides** controla o efeito de passagem.\n4. Alterações salvam automaticamente.',
 ARRAY['editar','editor','texto','imagem','slide','modificar']),
('exportar-pdf-pptx','Como exportar em PDF ou PPTX','exportacao',
 E'No editor, clique no botão **Exportar** no topo direito e escolha PDF ou PPTX. O arquivo é baixado localmente.',
 ARRAY['exportar','download','pdf','pptx','baixar','powerpoint']),
('planos-e-precos','Planos disponíveis','planos',
 E'- **Single**: crédito avulso para 1 apresentação.\n- **Mensal**: 20 apresentações/mês.\n- **Anual**: 20 apresentações/mês com desconto.\n\nAssine em **/pricing** (checkout via Cakto).',
 ARRAY['plano','preço','assinar','mensal','anual','single','crédito']),
('login-google-email','Como fazer login','autenticacao',
 E'Acesse **/auth**. Você pode entrar com:\n- Google (um clique)\n- Email + senha (cadastro exige confirmação no e-mail)\n\nSe não recebeu o e-mail de confirmação, verifique o spam.',
 ARRAY['login','entrar','conta','google','email','senha','cadastro']),
('recuperar-senha','Recuperar senha','autenticacao',
 E'Em **/auth**, clique em "Esqueci a senha". Você receberá um link por e-mail para redefinir. O link expira em 1 hora.',
 ARRAY['senha','esqueci','recuperar','reset','redefinir']),
('creditos-consumo','Como funcionam os créditos','planos',
 E'Cada geração bem-sucedida consome 1 crédito (Single) ou 1 unidade do limite mensal (Mensal/Anual). Gerações que falham NÃO consomem crédito.',
 ARRAY['crédito','consumo','limite','cobrança','gerou']),
('trocar-imagem','Como trocar a imagem de um slide','editor',
 E'No editor, selecione o slide → painel direito → aba **Imagem** → clique em **Trocar**. Você pode buscar no banco (Pexels), enviar upload, ou pedir uma nova geração por IA.',
 ARRAY['imagem','foto','trocar','substituir','upload','pexels']),
('modo-apresentacao','Modo apresentação (viewer)','apresentacao',
 E'Abra o editor e clique em **Apresentar** (ícone de play). Use setas ←/→ para navegar. ESC sai. O link **/s/:slug** compartilha a apresentação em modo viewer.',
 ARRAY['apresentar','play','viewer','projetor','compartilhar','link']),
('cancelar-assinatura','Cancelar assinatura','planos',
 E'Acesse **/settings → Assinatura → Gerenciar**. Você será redirecionado ao portal Cakto onde pode cancelar. O acesso permanece até o fim do período pago.',
 ARRAY['cancelar','assinatura','desistir','recorrência']);

-- ── 2. error_catalog_history: auditoria do catálogo
CREATE TABLE public.error_catalog_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  field text NOT NULL,
  old_value jsonb,
  new_value jsonb
);
GRANT SELECT ON public.error_catalog_history TO authenticated;
GRANT ALL ON public.error_catalog_history TO service_role;
ALTER TABLE public.error_catalog_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/dev lê histórico"
  ON public.error_catalog_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'));
-- Escrita apenas via trigger com SECURITY DEFINER — sem policy de INSERT/UPDATE/DELETE.

CREATE INDEX idx_ech_code_time ON public.error_catalog_history(code, changed_at DESC);

CREATE OR REPLACE FUNCTION public.log_error_catalog_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _by uuid := auth.uid();
BEGIN
  IF NEW.title IS DISTINCT FROM OLD.title THEN
    INSERT INTO public.error_catalog_history(code, changed_by, field, old_value, new_value)
    VALUES (NEW.code, _by, 'title', to_jsonb(OLD.title), to_jsonb(NEW.title));
  END IF;
  IF NEW.user_description IS DISTINCT FROM OLD.user_description THEN
    INSERT INTO public.error_catalog_history(code, changed_by, field, old_value, new_value)
    VALUES (NEW.code, _by, 'user_description', to_jsonb(OLD.user_description), to_jsonb(NEW.user_description));
  END IF;
  IF NEW.tech_description IS DISTINCT FROM OLD.tech_description THEN
    INSERT INTO public.error_catalog_history(code, changed_by, field, old_value, new_value)
    VALUES (NEW.code, _by, 'tech_description', to_jsonb(OLD.tech_description), to_jsonb(NEW.tech_description));
  END IF;
  IF NEW.resolution_steps IS DISTINCT FROM OLD.resolution_steps THEN
    INSERT INTO public.error_catalog_history(code, changed_by, field, old_value, new_value)
    VALUES (NEW.code, _by, 'resolution_steps', to_jsonb(OLD.resolution_steps), to_jsonb(NEW.resolution_steps));
  END IF;
  IF NEW.severity IS DISTINCT FROM OLD.severity THEN
    INSERT INTO public.error_catalog_history(code, changed_by, field, old_value, new_value)
    VALUES (NEW.code, _by, 'severity', to_jsonb(OLD.severity::text), to_jsonb(NEW.severity::text));
  END IF;
  IF NEW.ai_can_resolve IS DISTINCT FROM OLD.ai_can_resolve THEN
    INSERT INTO public.error_catalog_history(code, changed_by, field, old_value, new_value)
    VALUES (NEW.code, _by, 'ai_can_resolve', to_jsonb(OLD.ai_can_resolve), to_jsonb(NEW.ai_can_resolve));
  END IF;
  NEW.version := COALESCE(OLD.version, 1) + 1;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_error_catalog_history
  BEFORE UPDATE ON public.error_catalog
  FOR EACH ROW EXECUTE FUNCTION public.log_error_catalog_change();

-- ── 3. Novos estados + colunas em support_conversations
ALTER TYPE public.conversation_state ADD VALUE IF NOT EXISTS 'awaiting_confirmation';
