-- Hospedagem das apresentações (redução de custo de hospedagem).
-- • Assinatura vigente (sem falha de cobrança aberta) mantém tudo no ar.
-- • Sem assinatura: cada apresentação fica no ar até hosting_expires_at
--   (3 meses após a geração ou a última compra de créditos).
-- • Fora do ar: link público, portfólio e slides bloqueados; o dono vê só a
--   lista. Restaurável por 30 dias (reativar plano ou comprar créditos);
--   depois disso, slides e imagens são excluídos de vez.

ALTER TABLE public.presentations
  ADD COLUMN IF NOT EXISTS hosting_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS offline_since timestamptz;

COMMENT ON COLUMN public.presentations.hosting_expires_at IS
  'Fim da hospedagem paga por créditos avulsos (3 meses após a geração ou a última compra). NULL: depende só da assinatura do dono.';
COMMENT ON COLUMN public.presentations.offline_since IS
  'Quando a apresentação saiu do ar por falta de plano ou créditos. Exclusão definitiva 30 dias depois. NULL: no ar.';

CREATE INDEX IF NOT EXISTS presentations_offline_since_idx
  ON public.presentations (offline_since) WHERE offline_since IS NOT NULL;

-- Dono com hospedagem garantida: equipe, ou assinatura vigente sem falha de
-- cobrança mais nova que o último pagamento (renovação recusada ou atraso
-- tiram do ar na primeira falha).
CREATE OR REPLACE FUNCTION public.owner_hosting_active(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_internal_account(_uid) OR EXISTS (
    SELECT 1 FROM public.profiles p
    LEFT JOIN public.billing_profiles b ON b.user_id = p.id
    WHERE p.id = _uid
      AND public.subscription_is_current(p.plan, p.subscription_status, p.subscription_renews_at)
      AND NOT (
        b.billing_alert IS NOT NULL
        AND b.billing_alert_at IS NOT NULL
        AND (p.subscription_period_start IS NULL OR b.billing_alert_at > p.subscription_period_start)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.presentation_is_hosted(_presentation_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.presentations pr
     WHERE pr.id = _presentation_id
       AND (COALESCE(pr.hosting_expires_at > now(), false) OR public.owner_hosting_active(pr.user_id))
  );
$$;

-- Nova apresentação sem assinatura vigente: 3 meses de hospedagem.
CREATE OR REPLACE FUNCTION public.set_presentation_hosting()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.offline_since := NULL;
  IF NOT public.owner_hosting_active(NEW.user_id) THEN
    NEW.hosting_expires_at := GREATEST(COALESCE(NEW.hosting_expires_at, now()), now() + interval '3 months');
  ELSE
    NEW.hosting_expires_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS presentations_set_hosting ON public.presentations;
CREATE TRIGGER presentations_set_hosting
  BEFORE INSERT ON public.presentations
  FOR EACH ROW EXECUTE FUNCTION public.set_presentation_hosting();

-- O cliente não altera as colunas de hospedagem.
CREATE OR REPLACE FUNCTION public.protect_presentation_hosting()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     AND (NEW.hosting_expires_at IS DISTINCT FROM OLD.hosting_expires_at
          OR NEW.offline_since IS DISTINCT FROM OLD.offline_since) THEN
    RAISE EXCEPTION 'A hospedagem da apresentação não pode ser alterada pelo cliente.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS presentations_protect_hosting ON public.presentations;
CREATE TRIGGER presentations_protect_hosting
  BEFORE UPDATE ON public.presentations
  FOR EACH ROW EXECUTE FUNCTION public.protect_presentation_hosting();

-- Marca/desmarca "fora do ar" de uma conta e agenda os avisos.
CREATE OR REPLACE FUNCTION public.sync_user_presentation_hosting(_uid uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _active boolean := public.owner_hosting_active(_uid);
  _off integer;
  _on integer;
  _purge timestamptz;
BEGIN
  UPDATE public.presentations
     SET offline_since = now()
   WHERE user_id = _uid AND deleted_at IS NULL AND offline_since IS NULL
     AND NOT _active AND NOT COALESCE(hosting_expires_at > now(), false);
  GET DIAGNOSTICS _off = ROW_COUNT;

  UPDATE public.presentations
     SET offline_since = NULL
   WHERE user_id = _uid AND offline_since IS NOT NULL
     AND (_active OR COALESCE(hosting_expires_at > now(), false));
  GET DIAGNOSTICS _on = ROW_COUNT;

  IF _off > 0 THEN
    _purge := now() + interval '30 days';
    INSERT INTO public.email_schedule(user_id, template, send_at, dedupe_key, data)
    VALUES
      (_uid, 'presentations_offline', now(),
       format('presentations_offline:%s:%s', _uid, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD')),
       jsonb_build_object('count', _off, 'purge_at', _purge)),
      (_uid, 'presentations_deletion_soon', now() + interval '23 days',
       format('presentations_deletion_soon:%s:%s', _uid, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD')),
       jsonb_build_object('purge_at', _purge))
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('offline', _off, 'restored', _on, 'active', _active);
END;
$$;

-- Varredura geral (no máximo uma vez por hora; chamada pelo despachante).
CREATE OR REPLACE FUNCTION public.run_presentation_hosting_if_due()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _last timestamptz;
  _uid uuid;
  _users integer := 0;
  _off integer := 0;
  _on integer := 0;
  _r jsonb;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('slideai:presentation-hosting')) THEN
    RETURN jsonb_build_object('skipped', 'locked');
  END IF;
  SELECT last_run_at INTO _last FROM public.maintenance_runs WHERE task = 'presentation_hosting';
  IF _last IS NOT NULL AND _last > now() - interval '55 minutes' THEN
    RETURN jsonb_build_object('skipped', 'not_due');
  END IF;

  FOR _uid IN
    SELECT DISTINCT pr.user_id FROM public.presentations pr
     WHERE pr.offline_since IS NOT NULL
        OR (pr.deleted_at IS NULL AND NOT COALESCE(pr.hosting_expires_at > now(), false)
            AND NOT public.owner_hosting_active(pr.user_id))
  LOOP
    _r := public.sync_user_presentation_hosting(_uid);
    _users := _users + 1;
    _off := _off + COALESCE((_r->>'offline')::integer, 0);
    _on := _on + COALESCE((_r->>'restored')::integer, 0);
  END LOOP;

  _r := jsonb_build_object('users', _users, 'offline', _off, 'restored', _on);
  INSERT INTO public.maintenance_runs(task, last_run_at, last_result)
  VALUES ('presentation_hosting', now(), _r)
  ON CONFLICT (task) DO UPDATE SET last_run_at = EXCLUDED.last_run_at, last_result = EXCLUDED.last_result;
  RETURN _r;
END;
$$;

-- Compra de créditos: tudo no ar por mais 3 meses (restaura o que estiver fora).
CREATE OR REPLACE FUNCTION public.extend_presentations_hosting(_uid uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _n integer;
BEGIN
  UPDATE public.presentations
     SET hosting_expires_at = GREATEST(COALESCE(hosting_expires_at, now()), now() + interval '3 months'),
         offline_since = NULL
   WHERE user_id = _uid AND deleted_at IS NULL;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

-- Reembolso ou chargeback: o que dependia de créditos sai do ar na hora.
CREATE OR REPLACE FUNCTION public.revoke_presentations_hosting(_uid uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.presentations
     SET hosting_expires_at = now()
   WHERE user_id = _uid AND hosting_expires_at > now();
  RETURN public.sync_user_presentation_hosting(_uid);
END;
$$;

-- Exclusão definitiva: fora do ar há mais de 30 dias.
CREATE OR REPLACE FUNCTION public.presentation_purge_candidates(_limit integer DEFAULT 25)
RETURNS TABLE(id uuid, user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT pr.id, pr.user_id FROM public.presentations pr
   WHERE pr.offline_since IS NOT NULL
     AND pr.offline_since < now() - interval '30 days'
     AND NOT public.presentation_is_hosted(pr.id)
   ORDER BY pr.offline_since
   LIMIT GREATEST(1, LEAST(COALESCE(_limit, 25), 100));
$$;

CREATE OR REPLACE FUNCTION public.purge_offline_presentation(_presentation_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.presentations pr
   WHERE pr.id = _presentation_id
     AND pr.offline_since IS NOT NULL
     AND pr.offline_since < now() - interval '30 days'
     AND NOT public.presentation_is_hosted(pr.id);
  RETURN FOUND;
END;
$$;

-- Arquivos que nenhuma outra apresentação da conta usa: podem ser apagados.
-- Também esquece esses arquivos na biblioteca de imagens reaproveitáveis.
CREATE OR REPLACE FUNCTION public.release_storage_paths(_uid uuid, _paths text[])
RETURNS text[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _free text[];
BEGIN
  SELECT COALESCE(array_agg(p), '{}') INTO _free
    FROM unnest(COALESCE(_paths, '{}')) AS p
   WHERE length(p) > 10
     AND NOT EXISTS (
       SELECT 1 FROM public.slides s
         JOIN public.presentations pr ON pr.id = s.presentation_id
        WHERE pr.user_id = _uid
          AND (s.content::text LIKE '%' || p || '%' OR COALESCE(s.background_image_url, '') LIKE '%' || p || '%'));
  IF array_length(_free, 1) > 0 THEN
    DELETE FROM public.assets a
     WHERE a.user_id = _uid
       AND EXISTS (SELECT 1 FROM unnest(_free) f WHERE a.url LIKE '%' || f || '%');
  END IF;
  RETURN _free;
END;
$$;

-- Situação da hospedagem da conta logada (para o painel).
CREATE OR REPLACE FUNCTION public.my_hosting_status()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _p public.profiles%ROWTYPE;
  _b public.billing_profiles%ROWTYPE;
  _active boolean;
  _reason text;
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;
  _active := public.owner_hosting_active(_uid);
  SELECT * INTO _p FROM public.profiles WHERE id = _uid;
  SELECT * INTO _b FROM public.billing_profiles WHERE user_id = _uid;
  IF _active THEN
    _reason := 'subscription';
  ELSIF public.subscription_is_current(_p.plan, _p.subscription_status, _p.subscription_renews_at) THEN
    _reason := 'payment_failed';
  ELSIF _p.plan IN ('mensal','trimestral','anual','max_mensal','max_trimestral','max_anual') THEN
    _reason := 'subscription_ended';
  ELSE
    _reason := 'no_subscription';
  END IF;
  RETURN jsonb_build_object(
    'active', _active,
    'reason', _reason,
    'subscription_ends_at', CASE WHEN _active AND _p.subscription_status = 'canceled' THEN _p.subscription_renews_at END,
    'grace_days', 30
  );
END;
$$;

-- Link compartilhado: fora do ar não mostra conteúdo.
CREATE OR REPLACE FUNCTION public.get_shared_presentation(_slug text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  _p public.presentations%ROWTYPE;
  _owner boolean;
BEGIN
  SELECT * INTO _p FROM public.presentations
   WHERE slug = _slug AND deleted_at IS NULL
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  _owner := auth.uid() IS NOT NULL AND auth.uid() = _p.user_id;
  -- Privada: só o dono abre.
  IF NOT (COALESCE(_p.is_published, false) OR _owner) THEN
    RETURN NULL;
  END IF;

  IF NOT public.presentation_is_hosted(_p.id) THEN
    RETURN jsonb_build_object(
      'unavailable', true,
      'reason', 'hosting',
      'is_owner', _owner,
      'presentation', CASE WHEN _owner THEN jsonb_build_object(
        'id', _p.id, 'title', _p.title, 'slug', _p.slug,
        'offline_since', _p.offline_since,
        'purge_at', COALESCE(_p.offline_since, now()) + interval '30 days'
      ) END
    );
  END IF;

  RETURN jsonb_build_object(
    'presentation', jsonb_build_object(
      'id', _p.id,
      'title', _p.title,
      'description', _p.description,
      'theme', _p.theme,
      'font_style', _p.font_style,
      'slug', _p.slug,
      'include_speeches', _p.include_speeches,
      'presenters_names', _p.presenters_names,
      'dynamic_theme', _p.dynamic_theme,
      'creative_brief', _p.creative_brief,
      'is_published', COALESCE(_p.is_published, false),
      'is_owner', _owner
    ),
    'slides', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'position', s.position,
        'slide_type', s.slide_type,
        'layout_template', s.layout_template,
        'content', s.content,
        'speaker_notes', s.speaker_notes,
        'presenters_data', s.presenters_data
      ) ORDER BY s.position)
      FROM public.slides s
      WHERE s.presentation_id = _p.id
    ), '[]'::jsonb)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_portfolio_presentations(_owner uuid)
RETURNS TABLE(id uuid, title text, slug text, description text, slides_count integer, view_count integer, created_at timestamp with time zone, cover_image_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $function$
  SELECT pr.id, pr.title, pr.slug, pr.description, pr.slides_count, pr.view_count, pr.created_at,
    (SELECT s.background_image_url FROM public.slides s
      WHERE s.presentation_id = pr.id AND s.background_image_url IS NOT NULL
      ORDER BY s.position ASC LIMIT 1)
  FROM public.presentations pr
  WHERE pr.user_id = _owner
    AND pr.is_published = true
    AND pr.deleted_at IS NULL
    AND public.can_view_portfolio(_owner, auth.uid())
    AND public.presentation_is_hosted(pr.id)
  ORDER BY pr.created_at DESC
$function$;

CREATE OR REPLACE FUNCTION public.record_slide_view(_presentation_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  _info jsonb := public.request_client_info();
  _salt text;
  _hash text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.presentations
     WHERE id = _presentation_id
       AND COALESCE(is_published, false)
       AND deleted_at IS NULL
       AND user_id IS DISTINCT FROM auth.uid()
  ) OR NOT public.presentation_is_hosted(_presentation_id) THEN
    RETURN;
  END IF;
  DELETE FROM public.view_dedupe_salt WHERE day < current_date;
  INSERT INTO public.view_dedupe_salt(day, salt)
  VALUES (current_date, gen_random_uuid()::text || gen_random_uuid()::text)
  ON CONFLICT (day) DO NOTHING;
  SELECT salt INTO _salt FROM public.view_dedupe_salt WHERE day = current_date;
  _hash := md5(_salt || '|' || COALESCE(_info->>'ip', '') || '|' || COALESCE(_info->>'user_agent', ''));
  IF EXISTS (
    SELECT 1 FROM public.slide_views
     WHERE presentation_id = _presentation_id
       AND viewer_ip_hash = _hash
       AND created_at > now() - interval '30 minutes'
  ) THEN
    RETURN;
  END IF;
  INSERT INTO public.slide_views(presentation_id, viewer_ip_hash, user_agent)
  VALUES (_presentation_id, _hash, left(_info->>'user_agent', 300));
END;
$function$;

-- Slides de apresentação fora do ar: nem o dono lê ou edita.
DROP POLICY IF EXISTS slides_owner_all ON public.slides;
CREATE POLICY slides_owner_all ON public.slides
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.presentations p
                  WHERE p.id = slides.presentation_id AND p.user_id = auth.uid())
         AND public.presentation_is_hosted(slides.presentation_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.presentations p
                       WHERE p.id = slides.presentation_id AND p.user_id = auth.uid())
              AND public.presentation_is_hosted(slides.presentation_id));

-- Transição: apresentações já existentes de contas sem assinatura recebem
-- 3 meses a partir da criação, com no mínimo 15 dias de aviso (Termos, 21.1).
UPDATE public.presentations pr
   SET hosting_expires_at = GREATEST(pr.created_at + interval '3 months', now() + interval '15 days')
 WHERE pr.hosting_expires_at IS NULL
   AND NOT public.owner_hosting_active(pr.user_id);

-- Permissões.
REVOKE ALL ON FUNCTION public.owner_hosting_active(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_user_presentation_hosting(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_presentation_hosting_if_due() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.extend_presentations_hosting(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_presentations_hosting(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.presentation_purge_candidates(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_offline_presentation(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_storage_paths(uuid, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_presentation_hosting() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.my_hosting_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_hosting_active(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_user_presentation_hosting(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_presentation_hosting_if_due() TO service_role;
GRANT EXECUTE ON FUNCTION public.extend_presentations_hosting(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_presentations_hosting(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.presentation_purge_candidates(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_offline_presentation(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_storage_paths(uuid, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.my_hosting_status() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.presentation_is_hosted(uuid) TO anon, authenticated, service_role;
