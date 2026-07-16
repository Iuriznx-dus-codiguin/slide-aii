
-- ============================================================
-- Sistema de Suporte Inteligente + Catálogo de Erros
-- Etapa 1: Fundação (tabelas, RLS, GRANTs, seed)
-- ============================================================

-- 1) ENUMs
DO $$ BEGIN
  CREATE TYPE public.error_severity AS ENUM ('critical','high','medium','low','info');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.occurrence_status AS ENUM ('open','investigating','resolved','reopened');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.conversation_state AS ENUM ('open','diagnosing','awaiting_user','resolved','escalated','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.message_role AS ENUM ('user','assistant','system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) error_catalog
CREATE TABLE IF NOT EXISTS public.error_catalog (
  code TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  tech_description TEXT NOT NULL,
  user_description TEXT NOT NULL,
  severity public.error_severity NOT NULL DEFAULT 'medium',
  module TEXT NOT NULL,
  flow TEXT,
  probable_causes TEXT[] NOT NULL DEFAULT '{}',
  resolution_steps TEXT[] NOT NULL DEFAULT '{}',
  ai_can_resolve BOOLEAN NOT NULL DEFAULT true,
  related_codes TEXT[] NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.error_catalog TO authenticated, anon;
GRANT ALL ON public.error_catalog TO service_role;
ALTER TABLE public.error_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog_read_all" ON public.error_catalog FOR SELECT USING (true);
CREATE POLICY "catalog_admin_write" ON public.error_catalog FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'developer'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'developer'));
CREATE TRIGGER trg_error_catalog_updated
  BEFORE UPDATE ON public.error_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) error_occurrences
CREATE TABLE IF NOT EXISTS public.error_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  request_id TEXT,
  error_code TEXT REFERENCES public.error_catalog(code) ON DELETE SET NULL,
  route TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  stack_summary TEXT,
  status public.occurrence_status NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_err_occ_user ON public.error_occurrences(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_err_occ_code ON public.error_occurrences(error_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_err_occ_status ON public.error_occurrences(status, created_at DESC);
GRANT SELECT, INSERT ON public.error_occurrences TO authenticated;
GRANT ALL ON public.error_occurrences TO service_role;
ALTER TABLE public.error_occurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "occ_own_read" ON public.error_occurrences FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'developer'));
CREATE POLICY "occ_own_insert" ON public.error_occurrences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "occ_admin_update" ON public.error_occurrences FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'developer'));
CREATE TRIGGER trg_err_occ_updated
  BEFORE UPDATE ON public.error_occurrences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) support_conversations
CREATE TABLE IF NOT EXISTS public.support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id TEXT UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  state public.conversation_state NOT NULL DEFAULT 'open',
  subject TEXT,
  related_occurrence_id UUID REFERENCES public.error_occurrences(id) ON DELETE SET NULL,
  related_error_code TEXT REFERENCES public.error_catalog(code) ON DELETE SET NULL,
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  resolved_by_ai BOOLEAN,
  escalated_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conv_user ON public.support_conversations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_state ON public.support_conversations(state, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.support_conversations TO authenticated;
GRANT ALL ON public.support_conversations TO service_role;
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conv_own_read" ON public.support_conversations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'developer'));
CREATE POLICY "conv_own_insert" ON public.support_conversations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "conv_own_update" ON public.support_conversations FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'developer'));
CREATE TRIGGER trg_conv_updated
  BEFORE UPDATE ON public.support_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) support_messages
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  role public.message_role NOT NULL,
  content TEXT NOT NULL,
  code_ref TEXT REFERENCES public.error_catalog(code) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON public.support_messages(conversation_id, created_at);
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg_own_read" ON public.support_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_conversations c
                 WHERE c.id = conversation_id
                   AND (c.user_id = auth.uid()
                        OR public.has_role(auth.uid(),'admin')
                        OR public.has_role(auth.uid(),'developer'))));
CREATE POLICY "msg_own_insert" ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.support_conversations c
                      WHERE c.id = conversation_id AND c.user_id = auth.uid()));

-- 6) Sequência humana de ticket_id (ex.: TCK-000123)
CREATE SEQUENCE IF NOT EXISTS public.support_ticket_seq START 1000;

CREATE OR REPLACE FUNCTION public.generate_ticket_id()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n BIGINT;
BEGIN
  _n := nextval('public.support_ticket_seq');
  RETURN 'TCK-' || lpad(_n::text, 6, '0');
END; $$;

-- 7) Seed do catálogo — extraído da auditoria real
INSERT INTO public.error_catalog (code, title, tech_description, user_description, severity, module, flow, probable_causes, resolution_steps, ai_can_resolve, related_codes) VALUES
-- AUTH
('AUTH-001','Credenciais inválidas','signInWithPassword retorna invalid_credentials.','Email ou senha incorretos. Verifique os dados e tente novamente.','low','auth','login',
  ARRAY['Senha digitada errada','Email não cadastrado','Conta criada por Google sem senha'],
  ARRAY['Confirme o email digitado','Use "Esqueci minha senha" para redefinir','Se cadastrou com Google, entre por "Continuar com Google"'], true, ARRAY['AUTH-002','AUTH-004']),
('AUTH-002','Email não confirmado','Sessão bloqueada por email_not_confirmed.','Você ainda não confirmou seu email. Verifique a caixa de entrada.','low','auth','signup',
  ARRAY['Email de confirmação não chegou','Foi para spam'],
  ARRAY['Procure na pasta de spam','Solicite reenvio na tela de login'], true, ARRAY['AUTH-001']),
('AUTH-003','Provedor Google não configurado','signInWithOAuth retornou Unsupported provider.','Login com Google indisponível no momento.','high','auth','oauth',
  ARRAY['Provedor Google desativado no backend'],
  ARRAY['Use login por email e senha','Contate o suporte para reativar o Google'], false, ARRAY[]::TEXT[]),
('AUTH-004','Senha fraca','password_schema falhou (mín. 6).','A senha precisa ter ao menos 6 caracteres.','info','auth','signup',
  ARRAY['Senha muito curta'], ARRAY['Escolha uma senha com 6+ caracteres, misturando letras e números'], true, ARRAY[]::TEXT[]),
('AUTH-005','Sessão expirada','JWT expirado; refresh falhou.','Sua sessão expirou. Faça login novamente.','low','auth','session',
  ARRAY['Inatividade prolongada','Token revogado'], ARRAY['Refaça login','Se persistir, limpe cookies do site'], true, ARRAY[]::TEXT[]),
('AUTH-006','Recuperação de senha falhou','resetPasswordForEmail retornou erro.','Não conseguimos enviar o email de recuperação.','medium','auth','reset',
  ARRAY['Email não cadastrado','Provedor de email indisponível'],
  ARRAY['Confirme o email','Tente novamente em alguns minutos','Contate o suporte'], true, ARRAY[]::TEXT[]),

-- PAY (Cakto)
('PAY-001','Webhook sem segredo configurado','CAKTO_WEBHOOK_SECRET ausente na edge function.','Falha temporária no processamento de pagamentos.','critical','payments','webhook',
  ARRAY['Segredo não provisionado no ambiente'], ARRAY['Equipe: configurar CAKTO_WEBHOOK_SECRET nas edge function secrets'], false, ARRAY['PAY-002']),
('PAY-002','Assinatura de webhook inválida','x-cakto-token divergente do segredo.','Nenhuma ação necessária. Segurança bloqueou uma chamada suspeita.','high','payments','webhook',
  ARRAY['Chamada não autorizada','Segredo rotacionado sem atualizar Cakto'], ARRAY['Equipe: verifique se o segredo está sincronizado com o painel Cakto'], false, ARRAY['PAY-001']),
('PAY-003','Pagamento aprovado mas plano não atualizado','payment_events processed=true mas profiles.plan não mudou.','Seu pagamento foi aprovado, mas o plano ainda não apareceu na conta.','high','payments','activation',
  ARRAY['Email do pagamento diferente do email cadastrado','Usuário não encontrado na base'],
  ARRAY['Confirme se o email usado no checkout é o mesmo da conta','Envie o comprovante ao suporte'], false, ARRAY['PAY-004']),
('PAY-004','Créditos avulsos não creditados','grant_single_credit falhou.','Compra reconhecida mas créditos ainda não liberados.','high','payments','credits',
  ARRAY['Erro transitório no banco'], ARRAY['Aguarde 1 minuto e recarregue','Se persistir, envie o ID da compra ao suporte'], false, ARRAY['PAY-003']),
('PAY-005','Assinatura cancelada','subscription_status = canceled.','Sua assinatura foi cancelada.','info','payments','subscription',
  ARRAY['Cancelamento voluntário','Falha de cobrança recorrente'], ARRAY['Renove o plano em Configurações → Plano'], true, ARRAY[]::TEXT[]),

-- GEN (generate-presentation)
('GEN-001','Limite mensal atingido','can_user_generate retornou monthly_limit_reached.','Você já usou as 20 gerações deste mês.','info','generation','quota',
  ARRAY['Plano mensal/anual com 20 usos consumidos'], ARRAY['Aguarde a virada do mês','Faça upgrade ou compre créditos avulsos'], true, ARRAY['GEN-002']),
('GEN-002','Sem plano ativo','can_user_generate retornou no_plan.','Você ainda não tem um plano ativo.','info','generation','quota',
  ARRAY['Usuário no plano free'], ARRAY['Escolha um plano na página de Planos'], true, ARRAY['GEN-001']),
('GEN-003','OpenAI 400 max_completion_tokens','Modelo excedeu ceiling; fallback para Gemini.','Geração levou mais tempo que o esperado, mas concluiu.','low','generation','openai',
  ARRAY['Muitos slides pedidos','Prompt muito longo'], ARRAY['Reduza o número de slides','Encurte o tema'], true, ARRAY['GEN-004']),
('GEN-004','Menos slides que o pedido','Resposta veio com <70% dos slides.','A apresentação saiu com menos slides do que você pediu.','medium','generation','openai',
  ARRAY['Modelo truncou por limite de tokens'], ARRAY['Tente novamente','Reduza o número solicitado','Simplifique o tema'], true, ARRAY['GEN-003']),
('GEN-005','Rate limit da geração','check_rate_limit bloqueou.','Muitas gerações em pouco tempo. Aguarde um instante.','low','generation','ratelimit',
  ARRAY['Uso intenso na última hora'], ARRAY['Aguarde 5-10 minutos e tente novamente'], true, ARRAY[]::TEXT[]),
('GEN-006','Créditos exauridos no gateway','Lovable AI 402.','Serviço de IA momentaneamente indisponível.','high','generation','ai_gateway',
  ARRAY['Créditos da workspace acabaram'], ARRAY['Equipe: recarregar créditos em Settings → Plans'], false, ARRAY[]::TEXT[]),

-- INT (integrações)
('INT-001','Falha ao buscar imagem','fetch-image retornou erro.','Não conseguimos carregar uma imagem para o slide.','low','integrations','pexels',
  ARRAY['Termo sem resultados','Pexels fora do ar'], ARRAY['Troque o termo de busca','Escolha imagem manualmente'], true, ARRAY[]::TEXT[]),
('INT-002','Chat do editor indisponível','chat-editor falhou.','O assistente do editor está temporariamente indisponível.','medium','integrations','chat',
  ARRAY['Rate limit','Gateway AI instável'], ARRAY['Aguarde 1 min e tente novamente'], true, ARRAY[]::TEXT[]),

-- DB
('DB-001','Violação de RLS','new row violates row-level security policy.','Você não tem permissão para essa ação.','medium','database','rls',
  ARRAY['user_id não corresponde a auth.uid()','Sessão perdida'], ARRAY['Refaça login','Se persistir, envie print ao suporte'], false, ARRAY['AUTH-005']),
('DB-002','Registro não encontrado','SELECT retornou vazio para chave esperada.','O item que você tentou abrir não existe ou foi removido.','low','database','read',
  ARRAY['Slug incorreto','Item deletado'], ARRAY['Volte ao Dashboard e escolha outro item'], true, ARRAY[]::TEXT[]),
('DB-003','Rate limit do banco','check_rate_limit devolveu false.','Muitas requisições recentes. Aguarde um pouco.','low','database','ratelimit',
  ARRAY['Uso excessivo'], ARRAY['Aguarde alguns minutos'], true, ARRAY['GEN-005']),

-- UI
('UI-001','Erro de renderização','React ErrorBoundary capturou uma exceção.','Algo quebrou visualmente. Recarregue a página.','high','ui','render',
  ARRAY['Dados inesperados no componente','Bug de frontend'], ARRAY['Recarregue a página','Se persistir, envie o código do erro ao suporte'], false, ARRAY[]::TEXT[]),
('UI-002','Erro de rede','fetch/XHR falhou.','Falha de conexão. Verifique sua internet.','low','ui','network',
  ARRAY['Sem internet','Timeout'], ARRAY['Cheque a conexão','Tente novamente'], true, ARRAY[]::TEXT[]),
('UI-003','Exportação PDF falhou','exportPdf lançou exceção.','Não conseguimos gerar o PDF.','medium','ui','export',
  ARRAY['Apresentação muito grande','Recurso do navegador insuficiente'], ARRAY['Feche outras abas e tente novamente','Use Chrome atualizado'], true, ARRAY['UI-004']),
('UI-004','Exportação PPTX falhou','exportPptx lançou exceção.','Não conseguimos gerar o arquivo PowerPoint.','medium','ui','export',
  ARRAY['Erro no gerador de PPTX'], ARRAY['Tente novamente','Exporte em PDF como alternativa'], true, ARRAY['UI-003']),

-- SEC
('SEC-001','Tentativa de alterar campos de billing','Trigger protect_billing_columns bloqueou UPDATE.','Ação bloqueada por segurança.','high','security','billing',
  ARRAY['UI enviou campo protegido','Tentativa maliciosa'], ARRAY['Equipe: revisar client que enviou o UPDATE'], false, ARRAY[]::TEXT[]),
('SEC-002','Acesso admin negado','has_role retornou false.','Você não tem permissão para acessar essa área.','info','security','authorization',
  ARRAY['Usuário sem papel admin/developer'], ARRAY['Contate um administrador se precisar de acesso'], true, ARRAY[]::TEXT[]),

-- SUP (o próprio suporte)
('SUP-001','Rate limit do suporte','check_rate_limit no support-chat.','Você enviou muitas mensagens. Aguarde alguns minutos.','low','support','ratelimit',
  ARRAY['Mais de 30 msg na hora'], ARRAY['Aguarde e retome o chamado'], true, ARRAY[]::TEXT[]),
('SUP-002','IA de suporte indisponível','Gateway AI falhou no support-chat.','Assistente temporariamente fora do ar.','medium','support','ai',
  ARRAY['Gateway 5xx','Créditos exauridos'], ARRAY['Aguarde alguns minutos','Se urgente, aguardaremos contato humano'], true, ARRAY['GEN-006']),
('SUP-999','Erro não catalogado','Falha sem correspondência no catálogo.','Encontramos uma situação nova. A equipe vai investigar.','medium','support','uncatalogued',
  ARRAY['Nova classe de erro'], ARRAY['A equipe será notificada e retornará em breve'], false, ARRAY[]::TEXT[])
ON CONFLICT (code) DO NOTHING;
