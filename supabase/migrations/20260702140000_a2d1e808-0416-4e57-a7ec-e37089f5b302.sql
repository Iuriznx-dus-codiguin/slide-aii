-- ============================================================================
-- Auditoria de segurança — julho/2026
-- Fecha escalonamento de privilégio em profiles, corrige condições de corrida
-- na concessão de créditos/idempotência de webhook, restringe escrita de logs
-- ao service role, adiciona leitura administrativa de profiles e cria
-- infraestrutura reutilizável de rate limit para as edge functions públicas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) CRÍTICO — bloqueia escrita de campos de faturamento por qualquer client
--    autenticado. A policy "profiles_update_own" permite UPDATE na própria
--    linha mas nunca restringiu QUAIS colunas podiam mudar; sem isso, o
--    próprio usuário podia se autoconceder plano pago, status de assinatura
--    e créditos direto pelo client (RLS só valida `auth.uid() = id`).
--    A trigger abaixo é a barreira real: qualquer tentativa de alterar um
--    campo de faturamento vinda de fora do service_role é rejeitada com erro
--    explícito. Fluxos legítimos (webhook Cakto, RPCs internas) usam a
--    service role key e continuam funcionando exatamente como hoje.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_billing_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF NEW.plan IS DISTINCT FROM OLD.plan
       OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
       OR NEW.subscription_period_start IS DISTINCT FROM OLD.subscription_period_start
       OR NEW.subscription_renews_at IS DISTINCT FROM OLD.subscription_renews_at
       OR NEW.single_credits IS DISTINCT FROM OLD.single_credits
       OR NEW.cakto_customer_id IS DISTINCT FROM OLD.cakto_customer_id
       OR NEW.cakto_subscription_id IS DISTINCT FROM OLD.cakto_subscription_id
    THEN
      RAISE EXCEPTION 'Campos de faturamento não podem ser alterados diretamente pelo usuário.'
        USING ERRCODE = '42501'; -- insufficient_privilege
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_billing_columns ON public.profiles;
CREATE TRIGGER trg_protect_billing_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_billing_columns();

-- ----------------------------------------------------------------------------
-- 2) Leitura administrativa de profiles — hoje só existe "profiles_select_own",
--    então o próprio DevDashboard (acessado por admin/developer) só enxergava
--    a própria linha do administrador, exibindo métricas incompletas sem
--    avisar. Adiciona leitura ampla para quem tem papel admin/developer,
--    mantendo a policy de leitura própria intacta para os demais usuários.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'));

-- ----------------------------------------------------------------------------
-- 3) generation_logs é a fonte de verdade que `can_user_generate` usa para
--    contar o uso mensal — não há motivo para o client poder inserir ali
--    diretamente (só a edge function, com service role, precisa escrever).
--    Remove a permissão de INSERT do client autenticado.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "logs_owner_insert" ON public.generation_logs;

-- ----------------------------------------------------------------------------
-- 4) Idempotência real de payment_events — antes, duas entregas quase
--    simultâneas do mesmo evento (comum em gateways de pagamento, que
--    reentregam webhooks) podiam passar pela checagem "SELECT ... WHERE
--    processed = true" ao mesmo tempo, já que nenhuma delas via a outra como
--    processada ainda, resultando em processamento duplicado. Um índice único
--    parcial (ignora nulos, já que nem todo payload traz cakto_id) faz o
--    Postgres rejeitar atomicamente a segunda linha duplicada — a própria
--    inserção passa a ser o mecanismo de trava, não uma leitura prévia.
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_payment_events_cakto_id_unique;
CREATE UNIQUE INDEX idx_payment_events_cakto_id_unique
  ON public.payment_events (cakto_id)
  WHERE cakto_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 5) Concessão atômica de crédito avulso — substitui o padrão
--    "SELECT single_credits" seguido de "UPDATE ... = valor_calculado" (que
--    perde incrementos sob concorrência) por um incremento feito inteiramente
--    dentro de uma única instrução UPDATE no banco.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_single_credit(_uid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_balance integer;
BEGIN
  UPDATE public.profiles
    SET single_credits = COALESCE(single_credits, 0) + 1
    WHERE id = _uid
    RETURNING single_credits INTO _new_balance;
  RETURN _new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_single_credit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_single_credit(uuid) TO service_role;

-- ----------------------------------------------------------------------------
-- 6) Contador cosmético "generations_count" (exibido em Settings/DevDashboard,
--    NÃO usado por can_user_generate) também é hoje incrementado pelo client
--    com o mesmo padrão ler→calcular→gravar. Não é um campo de faturamento,
--    então não entra na trigger de proteção acima, mas merece a mesma correção
--    de atomicidade. RPC dedicada, incrementando só a própria linha.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_own_generations_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_count integer;
BEGIN
  UPDATE public.profiles
    SET generations_count = COALESCE(generations_count, 0) + 1
    WHERE id = auth.uid()
    RETURNING generations_count INTO _new_count;
  RETURN _new_count;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_own_generations_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_own_generations_count() TO authenticated;

-- ----------------------------------------------------------------------------
-- 7) Infraestrutura de rate limit reutilizável para edge functions públicas.
--    fetch-image (estratégia "ai") hoje não exige autenticação nenhuma e
--    chat-editor autentica mas não verifica plano/limite — ambas passam a
--    chamar check_rate_limit antes de consumir orçamento de IA/Pexels.
--    A chave é texto livre (não uuid) de propósito: chamadas autenticadas
--    usam "user:<uuid>", mas fetch-image também atende o visualizador público
--    (SlideViewer, sem login, para o backdrop em vídeo) e precisa limitar por
--    IP nesse caso — daí "ip:<endereço>". Janela fixa por hora, contagem
--    atômica via INSERT ... ON CONFLICT ... DO UPDATE (sem condição de corrida).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  rl_key text NOT NULL,
  fn_name text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (rl_key, fn_name, window_start)
);
ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy para anon/authenticated: só service_role (que ignora RLS)
-- deve tocar nesta tabela. Isso já é suficiente para bloquear o client.

CREATE OR REPLACE FUNCTION public.check_rate_limit(_key text, _fn text, _max_per_hour integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window timestamptz := date_trunc('hour', now());
  _count integer;
BEGIN
  INSERT INTO public.edge_rate_limits (rl_key, fn_name, window_start, request_count)
  VALUES (_key, _fn, _window, 1)
  ON CONFLICT (rl_key, fn_name, window_start)
  DO UPDATE SET request_count = public.edge_rate_limits.request_count + 1
  RETURNING request_count INTO _count;

  -- Limpeza oportunista e barata (roda raramente, custo amortizado):
  -- descarta janelas com mais de 2 dias para o contador não crescer sem limite.
  IF random() < 0.01 THEN
    DELETE FROM public.edge_rate_limits WHERE window_start < now() - interval '2 days';
  END IF;

  RETURN _count <= _max_per_hour;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer) TO service_role;
