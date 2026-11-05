// Generate presentation: estrutura completa com DNA narrativo,
// Círculo Narrativo (Hook→Tensão→Jornada→Prova→Clímax), multi-apresentador
// e falas opcionais. Motor híbrido: GPT-4.1 (OpenAI) primário; Gemini 2.5 Pro fallback
// (modelos por etapa em _shared/modelRegistry.ts).
//
// Fase 1 (Creative Director Engine): antes de gerar qualquer slide, uma
// chamada de IA separada e rápida (buildCreativeBrief) decide a direção
// criativa completa (tom, densidade, ritmo, transições permitidas/proibidas
// e, desde o motor v2, o DOMÍNIO do assunto). Esse brief é injetado no prompt
// principal e persistido em presentations.creative_brief.
// Ver supabase/functions/_shared/creativeDirector.ts.
//
// Fase 2 (Story Engine): em paralelo com o Creative Director (nenhum depende
// do outro — Promise.all), outra chamada rápida (buildStoryOutline) planeja
// o arco narrativo completo ANTES da escrita de conteúdo — para cada slide,
// seu narrative_act, função narrativa e mensagem-chave (e, no motor v2, a
// intenção visual e os objetos-chave). Esse esboço é a fonte de verdade para
// narrative_act no pós-processamento. Ver supabase/functions/_shared/storyEngine.ts.
//
// PROFUNDIDADE DE TEXTO: o usuário escolhe "short" | "balanced" | "long" e
// essa escolha altera não só a QUANTIDADE de palavras, mas o NÍVEL DE
// CONTEXTUALIZAÇÃO exigido de cada slide. Ver depthGuide() abaixo.
//
// Fase 3 (Motion Director): este arquivo não escolhe a transição de cada
// slide. Ele só grava o MODO escolhido pelo usuário — "dynamic" (magic move)
// ou "fade" (clássico) — e src/lib/slideTransitions.tsx resolve o resto de
// forma determinística, sem misturar os dois modos na mesma apresentação.
//
// MOTOR CRIATIVO v2 (atrás de engine_version — ver docs/motor-v2): o slide
// deixa de ser texto + imagem e vira uma CENA em quatro camadas. O fluxo passa
// a ser Direção → Plano Visual → Conteúdo → Resolução → Persistência →
// Ativos → Quality Gate, com o mesmo número de chamadas de texto e nenhuma
// chamada de IA nova. A IA decide só o que exige julgamento semântico; regra,
// estilo, layout, ritmo, animação e orçamento são código (_shared/
// visualPlanner.ts, sceneResolver.ts, qualityGate.ts, imageDirector.ts).
//
// MOTOR PRINCIPAL (v1, 11/2026): ganhou o que o v2 tem de mais sólido sem o
// que ainda é instável nele (plano visual forçado slide a slide, imagens
// técnicas geradas por IA). Prompt e schema enxutos (./contentV1.ts — sem os
// campos que o código sobrescrevia), a mecânica de chamada do v2
// (./contentCall.ts — retry só dos slides faltantes), diagramas nativos
// (linha do tempo, fluxo, ciclo, comparação, funil, pirâmide), gráficos
// saneados com novos tipos e composição pelo CONTEÚDO
// (_shared/deckComposer.ts). A capa e o título salvo são o título do
// usuário com correção ortográfica (_shared/deckTitle.ts).
//
// PERSISTÊNCIA NO SERVIDOR (os dois motores, quando o cliente pede
// persist:"server"): a apresentação e os slides são gravados aqui, com os
// ativos pendentes, e o cliente recebe o slug e navega direto para o Editor.
// Acaba a perda de decks pagos ao fechar a aba e o creative_brief nulo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCreativeBriefWithMeta, type CreativeBrief } from "../_shared/creativeDirector.ts";
import { buildStoryOutlineWithMeta, type StoryOutline } from "../_shared/storyEngine.ts";
import { createLogger } from "../_shared/observability.ts";
import { slideDisplaysMedia, type SlideAsset } from "../_shared/sceneMedia.ts";
import { composeDeck, type ComposeReport } from "../_shared/deckComposer.ts";
import { resolveDeckTitle, type DeckTitleResult } from "../_shared/deckTitle.ts";
import { planDeck, stableHash } from "../_shared/visualPlanner.ts";
import { resolveScenes, type ResolveReport } from "../_shared/sceneResolver.ts";
import { ensureReadableTheme } from "../_shared/qualityGate.ts";
import { resolveTheme } from "../_shared/themes.ts";
import { autoFontForContext, resolveFontPairingId } from "../_shared/typography.ts";
import {
  budgetModeFromUsd,
  estimateAiImageUsd,
  maxAiVisualsFor,
  textCostUsd,
  type TokenUsage,
} from "../_shared/modelRegistry.ts";
import { parseRolloutPercent, pickEngine, type EngineDecision } from "../_shared/engineSelection.ts";
import { generateContentV2 } from "./contentV2.ts";
import { generateContentV1 } from "./contentV1.ts";
import { fillSpeakerNotes, normalizeSpeeches } from "./speeches.ts";
import { persistPresentation, type PersistResult, type PersistSlide } from "./persist.ts";
import { flushOpsAlerts, hourBucket, raiseOpsAlert } from "../_shared/opsAlerts.ts";
// Faixa de slides e custo em créditos: _shared/plans.ts, que espelha
// src/lib/cakto.ts (src/test/plansParity.test.ts confere os dois).
import { CREDITS_PER_SLIDE, MAX_SLIDES, MIN_SLIDES, computeCreditsCost } from "../_shared/plans.ts";

export { MAX_SLIDES, MIN_SLIDES, computeCreditsCost };

/** Mesmo teto do slider da tela de geração. */
export const MAX_PRESENTERS = 8;
/**
 * Teto de custo de imagem por geração para quem NÃO é desenvolvedor — o
 * mesmo padrão que a tela sempre enviou (modo equilibrado). O valor vindo do
 * navegador só vale para desenvolvedores: antes, qualquer usuário podia
 * editar o localStorage e ganhar modo premium com mais imagens de IA.
 */
const DEFAULT_IMAGE_BUDGET_USD = 0.3;
const MAX_DEV_IMAGE_BUDGET_USD = 2;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Orçamento de tempo da geração. A plataforma encerra a função em 150 s; sem
 * teto, um provedor lento derrubava a requisição com erro genérico e o
 * estorno só vinha pela varredura. Cada chamada de IA recebe um timeout que
 * cabe no que resta, com folga para estornar e responder.
 */
export const GENERATION_BUDGET_MS = 135_000;
const AI_TIMEOUT_MESSAGE = "A IA demorou demais para responder — tente de novo, de preferência com menos slides.";
export const isTimeoutError = (e: unknown): boolean =>
  e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");

// Custos: vêm do registro único (_shared/modelRegistry.ts). O custo real de
// texto é calculado a partir do `usage` devolvido por cada chamada; o das
// imagens é o custo por imagem do modo × imagens planejadas (o custo exato de
// cada imagem é registrado pelo fetch-image quando ela é gerada).

interface GenerateRequest {
  title: string;
  description?: string;
  slidesCount: number;
  type: string;
  language: string;
  theme: string;
  fontStyle: string;
  includeCharts: boolean;
  includeImages: boolean;
  persona?: "technical-authority" | "inspirational-leader" | "salesperson" | "educator";
  /** Profundidade dos textos: influencia contextualização, riqueza de detalhes e extensão. */
  textDepth?: "short" | "balanced" | "long";
  presentersCount?: number;
  presentersNames?: string[];
  includeSpeeches?: boolean;
  image_budget_mode?: "economy" | "balanced" | "premium";
  max_budget_usd?: number;
  /** Quando true (padrão), a IA prioriza a transição "dynamic" (magic move) na maioria dos slides. */
  preferDynamic?: boolean;
  /** 1 = motor atual, 2 = motor de cenas. Ausente = rollout do servidor. */
  engineVersion?: 1 | 2;
  /** "server" = o cliente espera receber o slug de um deck já gravado. */
  persist?: "server";
}

/**
 * Motor desta geração: regra em _shared/engineSelection.ts (v1 é o principal;
 * v2 só por escolha de desenvolvedor no Dev Mode ou por rollout percentual,
 * ENGINE_V2_ROLLOUT_PERCENT, padrão 0, estável por usuário).
 */
function decideEngine(requested: unknown, isDev: boolean, userId: string, persistOnServer: boolean): EngineDecision {
  return pickEngine({
    requested,
    isDev,
    persistOnServer,
    rolloutPercent: parseRolloutPercent(Deno.env.get("ENGINE_V2_ROLLOUT_PERCENT") ?? 0),
    bucket: stableHash(`engine-v2|${userId}`),
  });
}

const personaGuide = (p?: string) => {
  switch (p) {
    case "technical-authority":
      return "AUTORIDADE TÉCNICA — vocabulário preciso, dados, fatos, números, gráficos, cite fontes, foque em precisão e profundidade.";
    case "inspirational-leader":
      return "LÍDER INSPIRACIONAL — metáforas, visão, narrativa de propósito, perguntas provocativas, tom elevador.";
    case "salesperson":
      return "VENDEDOR — apresente DOR concreta do cliente, mostre o custo do problema, ofereça SOLUÇÃO clara, prove com casos, termine com CTA forte.";
    case "educator":
      return "EDUCADOR — explique conceitos do simples ao complexo, use analogias, repita pontos-chave, encerre com revisão.";
    default:
      return "EQUILIBRADO — mistura dados, narrativa e clareza didática.";
  }
};

/**
 * Profundidade dos textos (Curto | Equilibrado | Longo).
 * Não é só contagem de palavras: cada nível muda o que o slide precisa
 * ENTREGAR de contexto — de afirmação seca (curto) até causa, exemplo, dado e
 * implicação encadeados (longo).
 */
const depthGuide = (d?: string) => {
  switch (d) {
    case "short":
      return `CURTO — máxima síntese. Cada slide entrega UMA ideia afiada.
  • body_text: 18-35 palavras OU ausente quando há bullets.
  • bullets: 3 itens de 6-10 palavras, cada um autoexplicativo.
  • Sem digressões: afirme e siga. Contexto só quando indispensável para entender.
  • Prefira número + consequência direta ("40% menos custo → equipe realocada").`;
    case "long":
      return `LONGO — profundidade editorial real. Cada slide DEVE contextualizar, não só afirmar.
  • body_text: 90-140 palavras estruturadas em 3 movimentos: (1) contexto/origem do ponto, (2) mecânica ou causa — COMO/POR QUE acontece, (3) implicação prática para o público.
  • bullets: 4-5 itens de 14-22 palavras, cada um com dado, exemplo concreto OU consequência (nunca rótulos soltos).
  • Traga nuance: exceções, trade-offs, contraponto ou o erro comum sobre o tema.
  • Ancore no tempo e no espaço (quando, onde, quem) sempre que o assunto permitir.
  • PROIBIDO encher com sinônimos — profundidade vem de INFORMAÇÃO NOVA por frase.`;
    default:
      return `EQUILIBRADO — clareza com substância.
  • body_text: 45-80 palavras: afirmação + justificativa curta + consequência.
  • bullets: 3-4 itens de 10-16 palavras, cada um com um dado ou exemplo.
  • Explique o "porquê" de cada ponto em uma frase — sem virar ensaio.`;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const t0 = Date.now();
  const deadline = t0 + GENERATION_BUDGET_MS;
  const remainingMs = () => deadline - Date.now();
  /** Timeout de uma chamada de IA: até `cap`, sem passar do que resta (−15 s de folga). */
  const aiSignal = (cap: number) => AbortSignal.timeout(Math.max(5_000, Math.min(cap, remainingMs() - 15_000)));
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const log = createLogger("generate-presentation", req, admin);
  await log.setIpFrom(req);


  // ───────────── Autenticação + Entitlement (RIGOROSO) ─────────────
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    await log.security("unauthorized", { status: 401, detail: { reason: "missing_token" } });
    return new Response(JSON.stringify({ error: "Não autenticado." }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    await log.security("unauthorized", { status: 401, detail: { reason: "invalid_session" } });
    return new Response(JSON.stringify({ error: "Sessão inválida." }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;
  log.setUser(userId);

  // ───────────── Corpo lido ANTES do entitlement ─────────────
  // O custo em créditos depende do pedido (slides, profundidade, falas),
  // então o corpo precisa estar disponível já na checagem de saldo.
  let rawBody: any = {};
  try { rawBody = await req.json(); } catch { rawBody = {}; }
  const requestedSlides = Math.max(MIN_SLIDES, Math.min(MAX_SLIDES, Number(rawBody?.slidesCount) || 8));
  const creditsCost = computeCreditsCost({
    slidesCount: requestedSlides,
    textDepth: rawBody?.textDepth,
    includeSpeeches: !!rawBody?.includeSpeeches,
  });

  // Verifica permissão via função SQL (agora por SALDO de créditos)
  const { data: entitle, error: entErr } = await admin.rpc("can_user_generate", {
    _uid: userId, _credits_cost: creditsCost,
  });
  if (entErr) {
    console.error("can_user_generate err:", entErr);
    return new Response(JSON.stringify({ error: "Erro interno (E_INTERNAL_503). Tente novamente em alguns minutos." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const ent = entitle as { allowed: boolean; reason: string; plan?: string; used?: number };
  if (!ent.allowed) {
    await log.security("forbidden", { status: 403, detail: { reason: ent.reason, plan: ent.plan } });
    // Bloco 9: monthly_limit_reached → 429 com mensagem explícita
    if (ent.reason === "insufficient_credits") {
      const available = (ent as any).credits ?? 0;
      return new Response(JSON.stringify({
        error: `Créditos insuficientes: esta geração custa ${creditsCost} créditos e você tem ${available}.`,
        reason: "insufficient_credits",
        credits: available,
        required: creditsCost,
      }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Uso justo do MAX (Termos, seção 9): o motivo real, com a data da
    // renovação — antes virava um "erro interno" falso (E_GEN_503).
    if (ent.reason === "fair_use_limit") {
      const resetsAt = (ent as { resets_at?: string | null }).resets_at;
      const when = resetsAt ? ` em ${new Date(resetsAt).toLocaleDateString("pt-BR", { timeZone: "UTC" })}` : "";
      return new Response(JSON.stringify({
        error: `Você atingiu o limite da Política de Uso Justo do plano MAX neste ciclo. A cota renova${when}; até lá, você pode usar créditos avulsos.`,
        reason: "fair_use_limit",
        resets_at: resetsAt ?? null,
      }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (ent.reason === "subscription_canceled" || ent.reason === "subscription_expired") {
      return new Response(JSON.stringify({
        error: "Sua assinatura terminou e as gerações estão pausadas. Renove o plano ou use créditos avulsos.",
        reason: ent.reason,
      }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (ent.reason === "no_plan") {
      return new Response(JSON.stringify({ error: "payment_required", reason: "no_plan" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Geração indisponível.", reason: ent.reason }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ───────────── Rate limit por hora / por dia (abuso de custo) ─────────────
  // O plano já limita o total mensal, mas nada impedia disparar dezenas de
  // gerações em rajada (script, aba duplicada, conta MAX).
  // Desenvolvedores NÃO são mais isentos: como não pagam por geração, uma
  // conta dev é justamente a que pode queimar mais dólares sem freio. Para
  // eles o teto é diário e mais apertado (5 apresentações/dia), suficiente
  // para testar e insuficiente para estourar o custo de IA.
  const isDev = ent.reason === "dev";
  if (isDev) {
    const { data: withinDaily } = await admin.rpc("check_rate_limit_daily", {
      _key: `user:${userId}`, _fn: "generate-presentation-dev", _max_per_day: 5,
    });
    if (withinDaily === false) {
      await log.security("daily_limit", { status: 429, detail: { scope: "dev", max_per_day: 5 } });
      return new Response(JSON.stringify({
        error: "Modo desenvolvedor: limite de 5 apresentações por dia atingido. Renova à meia-noite (UTC).",
        reason: "dev_daily_limit",
      }), { status: 429, headers: { ...corsHeaders, ...log.headers, "Content-Type": "application/json" } });
    }
  }
  {
    const { data: withinLimit } = await admin.rpc("check_rate_limit", {
      _key: `user:${userId}`, _fn: "generate-presentation", _max_per_hour: isDev ? 5 : 12,
    });
    if (withinLimit === false) {
      await log.security("rate_limited", { status: 429, detail: { scope: isDev ? "dev" : "user" } });
      return new Response(JSON.stringify({
        error: "Muitas gerações em pouco tempo. Aguarde alguns minutos e tente novamente.",
        reason: "rate_limited",
      }), { status: 429, headers: { ...corsHeaders, ...log.headers, "Content-Type": "application/json" } });
    }
  }


  // Entrega alertas pendentes gravados por rotinas SQL (ex.: estorno de
  // gerações interrompidas). Roda em paralelo à geração.
  void flushOpsAlerts(admin);

  // ───────────── Débito imediato (antes de gastar IA) ─────────────
  // O crédito é cobrado assim que a geração começa, para que fechar a aba no
  // meio não saia de graça. A partir daqui, porém, QUALQUER falha é do
  // sistema — o usuário já fez a parte dele —, então `failGeneration` abaixo
  // estorna a cobrança desta tentativa.
  let creditsCharged = 0;
  // Identificador desta tentativa: torna o estorno idempotente no banco.
  // charge_generation debita e registra a tentativa (generation_attempts) na
  // mesma transação. Se esta função cair antes de marcar o desfecho, a
  // varredura refund_stale_generations devolve os créditos depois de 10 min.
  const attemptRef = crypto.randomUUID();
  if (!isDev && creditsCost > 0) {
    const { data: charge, error: chargeErr } = await admin.rpc("charge_generation", {
      _uid: userId, _credits: creditsCost, _attempt: attemptRef,
    });
    const result = charge as { ok?: boolean; reason?: string; available?: number } | null;
    if (chargeErr || !result?.ok) {
      await log.security("forbidden", { status: 402, detail: { reason: result?.reason ?? "charge_failed" } });
      return new Response(JSON.stringify({
        error: `Créditos insuficientes: esta geração custa ${creditsCost} créditos.`,
        reason: "insufficient_credits",
        credits: result?.available ?? 0,
        required: creditsCost,
      }), { status: 402, headers: { ...corsHeaders, ...log.headers, "Content-Type": "application/json" } });
    }
    creditsCharged = creditsCost;
  }

  // Motor desta tentativa (definido mais abaixo): falhas também entram na
  // comparação v1 × v2 do painel de métricas.
  let engineForLog: EngineDecision | null = null;
  /**
   * Caminho único de falha pós-cobrança.
   *
   * Antes, cada erro retornava direto de dentro do `try`: a mensagem era
   * sempre genérica na tela, nada chegava ao painel admin (os `return`
   * pulavam o `catch`, que era o único lugar que gravava em
   * generation_logs) e o crédito já debitado ficava retido. Aqui os três
   * pontos acontecem juntos: estorna, registra com uma CAUSA identificada e
   * devolve a mensagem específica daquela causa.
   *
   * `message` descreve APENAS a causa e o próximo passo. A frase sobre o
   * estorno é montada aqui, a partir do que de fato aconteceu: afirmar a
   * devolução no texto fixo de cada erro faria a tela mentir sempre que o
   * estorno falhasse (RPC indisponível, por exemplo, enquanto a migration
   * que a cria ainda não foi aplicada).
   */
  const failGeneration = async (opts: {
    code: string;
    message: string;
    status: number;
    detail?: Record<string, unknown>;
  }): Promise<Response> => {
    let refunded = 0;
    let refundFailed = false;
    let deckDelivered = false;
    if (creditsCharged > 0) {
      const { data: refund, error: refundErr } = await admin.rpc("refund_generation_credits", {
        _uid: userId, _credits: creditsCharged, _reference: attemptRef, _reason: opts.code,
      });
      if (refundErr) console.error("refund_generation_credits falhou:", refundErr);
      else if ((refund as { refunded?: boolean } | null)?.refunded) {
        // O banco limita ao que a tentativa ainda guarda (migração 0014).
        refunded = Number((refund as { amount?: number }).amount) || creditsCharged;
      }
      // Tentativa já concluída (migração 0014): o deck foi gravado antes da
      // exceção, então não há o que devolver nem falha de estorno a avisar.
      deckDelivered = (refund as { reason?: string } | null)?.reason === "attempt_succeeded";
      refundFailed = refunded === 0 && !deckDelivered;
      // Estorno feito: o próprio refund_generation_credits marca a tentativa
      // como "refunded". Se falhou, ela continua "running" de propósito, e a
      // varredura tenta de novo sozinha.
    }

    const refundNote = refunded > 0
      ? ` Os ${refunded} créditos desta tentativa foram devolvidos.`
      : refundFailed
        ? " Não foi possível devolver os créditos automaticamente — a equipe já foi notificada."
        : "";
    const userMessage = deckDelivered
      ? "A apresentação foi gerada e salva, mas algo falhou ao finalizar. Abra-a em Minhas apresentações."
      : `${opts.message}${refundNote}`;

    // Painel admin (DevMetricsPanel lê generation_logs em realtime).
    await admin.from("generation_logs").insert({
      user_id: userId,
      status: "error",
      reason: opts.code,
      slides_count: requestedSlides,
      credits_charged: creditsCharged - refunded,
      duration_ms: Date.now() - t0,
      metadata: {
        failure_code: opts.code,
        user_message: userMessage,
        credits_refunded: refunded,
        // Sinaliza no painel admin que ficou crédito retido nesta tentativa.
        refund_failed: refundFailed,
        attempt_ref: attemptRef,
        title: rawBody?.title ?? null,
        plan: ent.plan,
        ...(engineForLog ? { engine_version: engineForLog.engine, engine_reason: engineForLog.reason } : {}),
        ...opts.detail,
      },
    });

    // Alertas: estorno que falhou (crédito retido) e pico de falhas na hora.
    if (refundFailed) {
      await raiseOpsAlert(admin, {
        kind: "generation_refund_failed", severity: "critical", dedupeKey: `generation_refund_failed:${attemptRef}`,
        title: "Geração falhou e o estorno automático não aconteceu",
        details: { usuario: userId, creditos: creditsCharged, causa: opts.code, tentativa: attemptRef,
          observacao: "A varredura de gerações interrompidas tenta de novo em até 15 minutos." },
      });
    }
    const since = new Date(Date.now() - 3600_000).toISOString();
    const [{ count: errors }, { count: successes }] = await Promise.all([
      admin.from("generation_logs").select("id", { count: "exact", head: true }).eq("status", "error").gte("created_at", since),
      admin.from("generation_logs").select("id", { count: "exact", head: true }).eq("status", "success").gte("created_at", since),
    ]);
    const errs = errors ?? 0;
    const total = errs + (successes ?? 0);
    if (errs >= 3 && errs / total >= 0.25) {
      await raiseOpsAlert(admin, {
        kind: "generation_errors", severity: errs / total >= 0.5 ? "critical" : "warning",
        dedupeKey: `generation_errors:${hourBucket()}`,
        title: `${errs} de ${total} gerações falharam na última hora`,
        details: { falhas: errs, total, taxa: `${Math.round((errs / total) * 100)}%`, ultima_causa: opts.code },
      });
    }

    return new Response(JSON.stringify({
      error: userMessage,
      reason: opts.code,
      failure_code: opts.code,
      credits_refunded: refunded,
      refund_failed: refundFailed,
    }), {
      status: opts.status,
      headers: { ...corsHeaders, ...log.headers, "Content-Type": "application/json" },
    });
  };

  try {
    const body: GenerateRequest = rawBody as GenerateRequest;
    const OPENAI_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const useOpenAI = !!OPENAI_API_KEY;
    if (!useOpenAI && !LOVABLE_API_KEY) {
      return await failGeneration({
        code: "no_ai_provider",
        message: "Nenhum provedor de IA está configurado no momento. A equipe já foi avisada.",
        status: 503,
      });
    }

    // ───────────── Sanitização anti prompt-injection ─────────────
    // Título e descrição são texto livre do usuário e vão direto para o
    // prompt. Sem limite de tamanho e sem delimitação, um usuário podia
    // colar "ignore as instruções acima…" e reescrever as regras de custo,
    // idioma e formato. Aqui o conteúdo é truncado, tem quebras de linha
    // colapsadas e é entregue dentro de um bloco explicitamente marcado
    // como DADO — nunca como instrução.
    const sanitize = (v: unknown, max: number): string =>
      String(v ?? "").replace(/[\u0000-\u001f]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);
    body.title = sanitize(body.title, 200);
    body.description = sanitize(body.description, 1500);
    if (!body.title) {
      return await failGeneration({
        code: "missing_title",
        message: "O título da apresentação chegou vazio — preencha o título e tente de novo.",
        status: 400,
      });
    }


    const slidesCount = requestedSlides;
    const isAutoTheme = body.theme === "auto";
    const presenters = Math.max(1, Math.min(MAX_PRESENTERS, Math.round(Number(body.presentersCount) || 1)));
    // O prompt do v1 lê body.presentersCount/presentersNames direto: grava de
    // volta os valores já limitados (nomes vão para o prompt — curtos e limpos).
    body.presentersCount = presenters;
    body.presentersNames = (Array.isArray(body.presentersNames) ? body.presentersNames : [])
      .slice(0, presenters)
      .map((n) => sanitize(n, 60))
      .filter(Boolean);
    const providerKeys = { openaiKey: useOpenAI ? OPENAI_API_KEY : null, lovableKey: LOVABLE_API_KEY };

    // ───────────── Motor e persistência ─────────────
    const persistOnServer = rawBody?.persist === "server";
    // Escolha manual do motor só para desenvolvedores (teste do v2 pelo Dev
    // Mode); para os demais vale o rollout, e sem rollout o v1.
    const engineDecision = decideEngine(rawBody?.engineVersion, isDev, userId, persistOnServer);
    const engine = engineDecision.engine;
    engineForLog = engineDecision;

    // Orçamento de imagem decidido no SERVIDOR. O teto enviado pelo cliente
    // (Dev Mode) só vale para desenvolvedores, limitado a MAX_DEV_IMAGE_BUDGET_USD.
    const imageBudgetUsd = isDev && typeof body.max_budget_usd === "number" && Number.isFinite(body.max_budget_usd)
      ? Math.max(0, Math.min(MAX_DEV_IMAGE_BUDGET_USD, body.max_budget_usd))
      : DEFAULT_IMAGE_BUDGET_USD;
    const budgetMode = budgetModeFromUsd(imageBudgetUsd);
    const pexelsOnly = budgetMode === "economy";
    const preferDynamic = body.preferDynamic !== false;

    // ───────────── Direção: Creative Director + Story Engine em paralelo ─────────────
    // Nenhum lança exceção: qualquer falha cai no fallback determinístico
    // (buildDefaultBrief / buildDefaultOutline). No v2 o Story Engine devolve
    // também visual_intent + key_objects por beat.
    const tDirection = Date.now();
    const [directorRes, storyRes] = await Promise.all([
      buildCreativeBriefWithMeta(
        {
          title: body.title,
          description: body.description,
          type: body.type,
          persona: body.persona,
          depthLevel: body.textDepth === "long" ? "deep-dive" : "high-level",
          slidesCount,
        },
        { openaiKey: OPENAI_API_KEY, lovableKey: LOVABLE_API_KEY, useOpenAI },
      ),
      buildStoryOutlineWithMeta(
        { title: body.title, description: body.description, type: body.type, slidesCount, withVisualPlan: engine === 2 },
        { openaiKey: OPENAI_API_KEY, lovableKey: LOVABLE_API_KEY, useOpenAI },
      ),
    ]);
    const directionMs = Date.now() - tDirection;
    const creativeBrief: CreativeBrief = directorRes.brief;
    const storyOutline: StoryOutline = storyRes.outline;
    const presenterNames = (body.presentersNames ?? []).slice(0, presenters);
    while (presenterNames.length < presenters) presenterNames.push(`Apresentador ${presenterNames.length + 1}`);

    // Saída comum dos dois motores.
    let rows: PersistSlide[] = [];
    let legacySlides: any[] = [];
    let dynamicTheme: Record<string, unknown> | null = null;
    let fontPairingRaw: string | null = null;
    let contentModel = "";
    let planMs = 0;
    let resolveMs = 0;
    let resolveReport: ResolveReport | null = null;
    let composeReport: ComposeReport | null = null;
    let filledFromOutline: number[] = [];
    // Título da apresentação: o do usuário, só com correção ortográfica
    // (validada em _shared/deckTitle.ts). Vale para a capa e para o título salvo.
    let aiDeckTitle: string | null = null;
    let deckTitle: DeckTitleResult = resolveDeckTitle(body.title, null, body.language);
    const contentCalls: { model: string; usage: TokenUsage | null; latency_ms: number; slides_requested?: number; slides_returned?: number }[] = [];
    let retryCall: Record<string, unknown> | null = null;
    const tContent = Date.now();

    if (engine === 2) {
      // ═════════════ MOTOR v2: Plano Visual → Conteúdo → Resolução ═════════════
      const tPlan = Date.now();
      const plan = planDeck(storyOutline.beats, creativeBrief, {
        includeImages: !!body.includeImages,
        includeCharts: !!body.includeCharts,
        budgetMode,
        maxAiVisuals: maxAiVisualsFor(imageBudgetUsd, slidesCount, 2),
        seed: body.title,
      });
      planMs = Date.now() - tPlan;

      const content = await generateContentV2(
        {
          title: body.title,
          description: body.description,
          type: body.type,
          language: body.language,
          slidesCount,
          includeCharts: !!body.includeCharts,
          includeImages: !!body.includeImages,
          includeSpeeches: !!body.includeSpeeches,
          isAutoTheme,
          personaText: personaGuide(body.persona),
          depthText: depthGuide(body.textDepth),
          textDepth: body.textDepth ?? "balanced",
          presenterNames,
        },
        creativeBrief,
        storyOutline,
        plan,
        providerKeys,
        deadline,
      );
      if (!content.ok) {
        return await failGeneration({ code: content.code, message: content.message, status: content.status, detail: content.detail });
      }
      for (const c of content.calls) contentCalls.push(c);
      if (content.retry) retryCall = { ...content.retry };
      filledFromOutline = content.filled_from_outline;
      contentModel = content.calls[0]?.model ?? "";
      fontPairingRaw = content.font_pairing;
      aiDeckTitle = content.deck_title;
      deckTitle = resolveDeckTitle(body.title, content.deck_title, body.language);

      // Quality Gate: contraste AA entre texto e fundo do tema dinâmico (só
      // com "De acordo com o tema"; paleta fixa é escolha do usuário).
      dynamicTheme = isAutoTheme ? ensureReadableTheme(content.dynamic_theme as { bg?: string; text?: string } | null).theme ?? null : null;
      const palette = resolveTheme(body.theme, dynamicTheme as any);

      const speeches = body.includeSpeeches
        ? normalizeSpeeches(content.slides.map((s) => s ?? {}), presenterNames)
        : null;

      const tResolve = Date.now();
      const resolved = resolveScenes({
        aiSlides: content.slides,
        plan,
        beats: storyOutline.beats,
        brief: creativeBrief,
        options: {
          preferDynamic,
          includeImages: !!body.includeImages,
          includeCharts: !!body.includeCharts,
          budgetMode,
          textDepth: body.textDepth ?? "balanced",
          palette: { bg: palette.bg, text: palette.text, accent: palette.accent, accent2: palette.accent2 },
          title: deckTitle.title,
        },
      });
      resolveMs = Date.now() - tResolve;
      resolveReport = resolved.report;
      // Capa com o título pedido pelo usuário (corrigido), como no v1.
      if (resolved.slides[0]) resolved.slides[0].content.headline = deckTitle.title;
      rows = resolved.slides.map((s, i) => ({
        slide_type: s.slide_type,
        layout_template: s.layout_template,
        // Falas pagas (+50 créditos): nota nunca vazia. Sem elas, fica o que a IA mandou.
        speaker_notes: body.includeSpeeches
          ? fillSpeakerNotes(s.speaker_notes, s.content as Parameters<typeof fillSpeakerNotes>[1])
          : s.speaker_notes,
        animation_transition: "fade",
        presenters_data: speeches?.[i] ?? [],
        content: s.content,
      }));
    } else {
      // ═════════════ MOTOR v1 (principal): conteúdo → composição pelo conteúdo ═════════════
      // A IA escreve o texto e escolhe o protagonista de cada slide; layout,
      // acentos, animação, fundo e imagens são decididos em código
      // (_shared/deckComposer.ts), com os diagramas nativos e a mecânica de
      // chamada (retry só dos faltantes) que vieram do motor v2.
      const content = await generateContentV1(
        {
          title: body.title,
          description: body.description,
          type: body.type,
          language: body.language,
          slidesCount,
          includeCharts: !!body.includeCharts,
          includeImages: !!body.includeImages,
          includeSpeeches: !!body.includeSpeeches,
          isAutoTheme,
          personaText: personaGuide(body.persona),
          depthText: depthGuide(body.textDepth),
          textDepth: body.textDepth ?? "balanced",
          presenterNames,
        },
        creativeBrief,
        storyOutline,
        providerKeys,
        deadline,
      );
      if (!content.ok) {
        return await failGeneration({ code: content.code, message: content.message, status: content.status, detail: content.detail });
      }
      for (const c of content.calls) contentCalls.push(c);
      if (content.retry) retryCall = { ...content.retry };
      filledFromOutline = content.filled_from_outline;
      contentModel = content.calls[0]?.model ?? "";
      fontPairingRaw = content.font_pairing;
      aiDeckTitle = content.deck_title;
      deckTitle = resolveDeckTitle(body.title, content.deck_title, body.language);

      // Tema da IA só com "De acordo com o tema": com paleta fixa, a escolha
      // do usuário vale (antes a paleta da IA era gravada mesmo assim).
      dynamicTheme = isAutoTheme ? ensureReadableTheme(content.dynamic_theme as { bg?: string; text?: string } | null).theme ?? null : null;
      const palette = resolveTheme(body.theme, dynamicTheme as any);

      const tResolve = Date.now();
      const composed = composeDeck({
        aiSlides: content.slides,
        beats: storyOutline.beats,
        brief: creativeBrief,
        options: {
          title: deckTitle.title,
          includeImages: !!body.includeImages,
          includeCharts: !!body.includeCharts,
          preferDynamic,
          budgetMode,
          textDepth: body.textDepth ?? "balanced",
          palette: { bg: palette.bg, text: palette.text, accent: palette.accent, accent2: palette.accent2 },
        },
      });
      resolveMs = Date.now() - tResolve;
      composeReport = composed.report;

      // Falas pagas: um objeto por apresentador (sintetizado quando a IA não
      // devolve) e nota do orador nunca vazia — mesma regra de antes.
      const speeches = body.includeSpeeches
        ? normalizeSpeeches(composed.slides.map((s, i) => ({ ...s.content, speaker_notes: s.speaker_notes, presenters_data: content.slides[i]?.presenters_data })), presenterNames)
        : null;
      rows = composed.slides.map((s, i) => ({
        slide_type: s.slide_type,
        layout_template: s.layout_template,
        speaker_notes: body.includeSpeeches
          ? fillSpeakerNotes(s.speaker_notes, s.content as Parameters<typeof fillSpeakerNotes>[1])
          : s.speaker_notes,
        animation_transition: "fade",
        presenters_data: speeches?.[i] ?? [],
        content: s.content,
      }));
      // Cliente antigo (sem persist:"server"): mesmo formato de slide de antes.
      legacySlides = rows.map((r) => ({
        ...r.content,
        slide_type: r.slide_type,
        layout_template: r.layout_template,
        speaker_notes: r.speaker_notes,
        presenters_data: r.presenters_data,
        animation: "fade",
        image_strategy: (r.content as { asset?: unknown }).asset ? "pexels" : "none",
      }));
    }
    const contentMs = Date.now() - tContent - planMs - resolveMs;

    // Direção de arte tipográfica escolhida pela IA para este assunto.
    const fontStyle = resolveFontPairingId(fontPairingRaw, autoFontForContext(body.type, body.theme, body.title));

    // ───────────── Métricas: tokens reais, custo e imagens ─────────────
    const textCalls = [
      { model: directorRes.meta.model ?? "", usage: directorRes.meta.usage ?? null },
      { model: storyRes.meta.model ?? "", usage: storyRes.meta.usage ?? null },
      ...contentCalls,
      ...(retryCall ? [{ model: String(retryCall.model ?? ""), usage: (retryCall.usage as TokenUsage | null) ?? null }] : []),
    ];
    const tokens = textCalls.reduce((acc, c) => ({
      input: acc.input + (c.usage?.input ?? 0),
      output: acc.output + (c.usage?.output ?? 0),
    }), { input: 0, output: 0 });
    const contentOutput = [...contentCalls, ...(retryCall ? [retryCall as { usage: TokenUsage | null }] : [])]
      .reduce((a, c) => a + (c.usage?.output ?? 0), 0);
    const textUsd = textCalls.reduce((a, c) => a + textCostUsd(c.model, c.usage), 0);

    // Imagens: o que foi PLANEJADO e será exibido (servidor) ou, no caminho
    // legado, o que o cliente vai buscar (estratégia por slide, como antes).
    let imagesPexels = 0;
    let imagesAi = 0;
    let imagesDisplayed = 0;
    if (persistOnServer) {
      for (const r of rows) {
        const a = r.content.asset as SlideAsset | undefined;
        if (!a) continue;
        if (a.source === "ai") imagesAi++;
        else imagesPexels++;
        if (slideDisplaysMedia(r)) imagesDisplayed++;
      }
    } else {
      imagesPexels = legacySlides.filter((s: any) => s.image_strategy === "pexels").length;
      imagesAi = legacySlides.filter((s: any) => s.image_strategy === "ai").length;
    }
    const imageUsd = imagesAi * estimateAiImageUsd(budgetMode === "economy" ? "balanced" : budgetMode);
    const actualCost = +(textUsd + imageUsd).toFixed(4);
    const estimatedCost = +imageBudgetUsd.toFixed(4);

    // ───────────── Persistência ─────────────
    let persisted: PersistResult | null = null;
    if (persistOnServer) {
      persisted = await persistPresentation(admin, {
        userId,
        // O título pedido, só com correção ortográfica (o mesmo da capa).
        title: deckTitle.title,
        description: body.description,
        type: body.type,
        language: body.language,
        theme: body.theme,
        fontStyle,
        persona: body.persona ?? null,
        textDepth: body.textDepth ?? null,
        presentersCount: presenters,
        presentersNames: presenterNames,
        includeSpeeches: !!body.includeSpeeches,
        dynamicTheme,
        creativeBrief,
        engineVersion: engine,
        slides: rows,
      });
      if (!persisted.ok) {
        return await failGeneration({
          code: "persist_failed",
          message: "A apresentação foi gerada, mas não conseguimos salvá-la. O problema foi registrado para a equipe.",
          status: 500,
          detail: { persist_error: persisted.error.slice(0, 300), engine_version: engine },
        });
      }
    }

    const slidesTotal = persistOnServer ? rows.length : legacySlides.length;

    // A cobrança foi pelo número de slides pedido. Se a IA entregou menos,
    // devolve a diferença (10 créditos por slide); a função é idempotente
    // por tentativa e reduz a tentativa, então a varredura não estorna o
    // valor cheio depois.
    let shortfallRefunded = 0;
    if (creditsCharged > 0 && slidesTotal < requestedSlides) {
      const { data: sf, error: sfErr } = await admin.rpc("refund_generation_shortfall", {
        _uid: userId, _credits: (requestedSlides - slidesTotal) * CREDITS_PER_SLIDE, _reference: attemptRef,
      });
      if (sfErr) console.warn("refund_generation_shortfall falhou:", sfErr.code, sfErr.message);
      else if ((sf as { refunded?: boolean } | null)?.refunded) {
        shortfallRefunded = Number((sf as { credits?: number }).credits) || 0;
      }
    }

    // Desfecho da tentativa cobrada: sucesso (a varredura de estorno ignora).
    // Uma falha aqui é rara, mas faria a varredura estornar um deck entregue:
    // tenta de novo e, persistindo, avisa a equipe.
    const outcomeErrors: string[] = [];
    if (creditsCharged > 0) {
      const markSucceeded = () => admin.from("generation_attempts")
        .update({ status: "succeeded", finished_at: new Date().toISOString() }).eq("id", attemptRef);
      let { error: attemptErr } = await markSucceeded();
      if (attemptErr) ({ error: attemptErr } = await markSucceeded());
      if (attemptErr) {
        console.error("generation_attempts_update_failed", attemptErr.message);
        outcomeErrors.push(`tentativa: ${attemptErr.message}`);
      }
    }

    // Contador de perfil incrementado no servidor (antes era autodeclarado
    // pelo cliente, o que podia divergir de generation_logs).
    await admin.rpc("increment_profile_generations", { _uid: userId });

    // Log de sucesso para o painel de métricas Dev: latência, tokens reais,
    // comandos, fallbacks e imagens solicitadas × exibidas, por etapa.
    const successLog = {
      user_id: userId,
      status: "success",
      reason: ent.reason,
      model: contentModel,
      mode: budgetMode,
      slides_count: slidesTotal,
      credits_charged: isDev ? 0 : creditsCost - shortfallRefunded,
      images_pexels: imagesPexels,
      images_ai: imagesAi,
      estimated_cost_usd: estimatedCost,
      actual_cost_usd: actualCost,
      duration_ms: Date.now() - t0,
      presentation_id: persisted?.ok ? persisted.id : null,
      metadata: {
        attempt_ref: attemptRef,
        title: body.title,
        deck_title: deckTitle.title,
        deck_title_source: deckTitle.source,
        deck_title_ai: aiDeckTitle,
        type: body.type,
        plan: ent.plan,
        slides_requested: requestedSlides,
        credits_shortfall_refunded: shortfallRefunded,
        creative_brief_style: creativeBrief.visual_style,
        domain: creativeBrief.domain ?? null,
        arc_shape: storyOutline.arc_shape,
        text_depth: body.textDepth ?? "balanced",
        engine_version: engine,
        engine_requested: engineDecision.requested,
        engine_reason: engineDecision.reason,
        persisted: !!persisted?.ok,
        stages: {
          director: directorRes.meta,
          story: storyRes.meta,
          direction_ms: directionMs,
          plan_ms: planMs,
          content: { latency_ms: contentMs, calls: contentCalls, retry: retryCall, filled_from_outline: filledFromOutline },
          resolve_ms: resolveMs,
          persist: persisted?.ok ? { latency_ms: persisted.latency_ms, quota: persisted.quota } : null,
        },
        tokens: {
          ...tokens,
          content_output: contentOutput,
          output_per_slide: slidesTotal ? Math.round(contentOutput / slidesTotal) : 0,
        },
        text_cost_usd: +textUsd.toFixed(5),
        images: { requested: { pexels: imagesPexels, ai: imagesAi }, displayed: persistOnServer ? imagesDisplayed : null },
        ...(resolveReport ? {
          commands: resolveReport.commands,
          render_modes: resolveReport.render_modes,
          fallbacks: resolveReport.fallbacks,
          off_plan: resolveReport.off_plan,
          repeat_swaps: resolveReport.repeat_swaps,
          rhythm_rescues: resolveReport.rhythm_rescues,
          text_only_share: resolveReport.text_only_share,
          max_text_run: resolveReport.max_text_run,
          trims: resolveReport.trims,
          ai_visuals_used: resolveReport.ai_visuals_used,
        } : {}),
        ...(composeReport ? {
          elements: composeReport.elements,
          layouts: composeReport.layouts,
          commands: composeReport.visuals,
          charts: composeReport.charts,
          dropped: composeReport.dropped,
          trims: composeReport.trims,
        } : {}),
      },
    };
    let { error: logErr } = await admin.from("generation_logs").insert(successLog);
    if (logErr) ({ error: logErr } = await admin.from("generation_logs").insert(successLog));
    if (logErr) {
      console.error("generation_logs_insert_failed", logErr.message);
      outcomeErrors.push(`log: ${logErr.message}`);
    }
    if (creditsCharged > 0 && outcomeErrors.length) {
      await raiseOpsAlert(admin, {
        kind: "generation_outcome_unrecorded", severity: "warning",
        dedupeKey: `generation_outcome_unrecorded:${attemptRef}`,
        title: "Geração entregue sem desfecho registrado",
        details: {
          usuario: userId, tentativa: attemptRef, apresentacao: persisted?.ok ? persisted.id : null,
          erros: outcomeErrors.join(" | ").slice(0, 300),
          observacao: "Se a tentativa ficou 'running', a varredura vai estornar um deck que foi entregue.",
        },
      });
    }

    const metrics = {
      actual_cost_usd: actualCost,
      images_pexels: imagesPexels,
      images_ai: imagesAi,
      duration_ms: Date.now() - t0,
      engine_version: engine,
      engine_requested: engineDecision.requested,
      engine_reason: engineDecision.reason,
      credits_shortfall_refunded: shortfallRefunded,
    };

    if (persisted?.ok) {
      return new Response(JSON.stringify({
        slug: persisted.slug,
        presentation_id: persisted.id,
        engine_version: engine,
        engine_reason: engineDecision.reason,
        creative_brief: creativeBrief,
        _metrics: metrics,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Caminho legado (cliente sem persist:"server"): mesma resposta de antes.
    return new Response(JSON.stringify({
      slides: legacySlides,
      dynamic_theme: dynamicTheme,
      font_pairing: fontPairingRaw,
      creative_brief: creativeBrief,
      _metrics: metrics,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-presentation error:", e);
    if (isTimeoutError(e)) {
      return await failGeneration({
        code: "ai_timeout",
        message: AI_TIMEOUT_MESSAGE,
        status: 504,
        detail: { elapsed_ms: Date.now() - t0 },
      });
    }
    return await failGeneration({
      code: "internal_error",
      message: "Algo quebrou no meio da geração. O erro foi registrado para a equipe.",
      status: 500,
      detail: { exception: e instanceof Error ? e.message.slice(0, 300) : "unknown" },
    });
  }
});
