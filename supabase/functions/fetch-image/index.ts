// Resolve image for a slide. Strategy = "pexels" -> search Pexels.
// Strategy = "ai" -> generate image (registro de modelos: gpt-image-2.5-flare,
// gpt-image-1-mini, Gemini do gateway). Returns { url } or { error }.
//
// Segurança: esta função é usada em dois contextos bem diferentes — (1) o
// editor/gerador autenticado pedindo imagens Pexels ou geração por IA, e (2)
// o visualizador público (SlideViewer, sem login) pedindo o vídeo de fundo
// ambiente de uma apresentação já publicada. Por isso o controle de acesso é
// calibrado por estratégia em vez de um auth obrigatório genérico:
//   • strategy "ai"            → é a ÚNICA com custo real em dólar por
//     chamada. Exige usuário autenticado + rate limit de 15/hora por usuário.
//   • strategy "pexels"/"video" → sem custo monetário direto, mas ainda
//     assim sujeitas a um rate limit por IP (60/hora) para não permitir que
//     alguém esgote a cota da API da Pexels do projeto inteiro.
//
// Motor v2 (cota de ativos): quando o pedido vem com `presentation_id` de uma
// apresentação do próprio usuário, fetch-image consome a COTA DE ATIVOS que
// a geração emitiu para ela (tabela presentation_asset_quotas, atrelada ao
// número de imagens planejadas) no lugar do limite genérico — que continua
// valendo para chamadas avulsas do Editor. Sem a migração aplicada, cai no
// limite genérico (comportamento anterior).
//
// Fallback Pexels→IA: antes gerava imagem PAGA sem exigir login, sob o limite
// público de 60/h por IP. Agora exige usuário autenticado, que o pedido
// permita (`allow_ai_fallback`, falso no modo economia) e cota (da
// apresentação ou o limite de IA de 15/h).
//
// Receitas (Image Director): com `recipe`, o prompt é montado por código
// (_shared/imageDirector.ts) — sem texto na imagem, paleta do tema, escala
// realista — e recortes saem com fundo TRANSPARENTE em webp (antes o estilo
// "no-background" pedia fundo branco e virava um retângulo em tema escuro).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { findMatchingAsset, recordAsset, touchAsset } from "../_shared/assetIntelligence.ts";
import { persistGeneratedImage } from "../_shared/assetStorage.ts";
import { createLogger } from "../_shared/observability.ts";
import { buildImagePrompt, sanitizeRecipe, type ImageRecipe } from "../_shared/imageDirector.ts";
import {
  IMAGE_ENDPOINTS,
  IMAGE_MODELS,
  imageCostUsd,
  imageModelChain,
  imageQualityFor,
  imageSizeFor,
  type BudgetMode,
  type ImageAspect,
  type ImageModelId,
  type ImageQuality,
} from "../_shared/modelRegistry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FetchImageBody {
  query?: string;
  ai_prompt?: string;
  strategy: "pexels" | "ai" | "none" | "video";
  orientation?: "landscape" | "portrait" | "square";
  /** Estilo visual quando strategy="ai" (caminho legado, sem receita). */
  style?: "photo" | "illustration" | "no-background" | "3d-render" | "isometric" | "watercolor" | "line-art" | "collage" | "minimal";
  /** URLs já em uso na apresentação — Pexels evitará reutilizá-las. */
  avoid_urls?: string[];
  /** Motor v2: receita do Image Director (prompt montado no servidor). */
  recipe?: ImageRecipe;
  /** Motor v2: apresentação dona do ativo (consome a cota de ativos). */
  presentation_id?: string;
  /** Pexels sem resultado pode cair em IA? Padrão: sim (compatibilidade). */
  allow_ai_fallback?: boolean;
  /** Modo de orçamento da geração (modelo e qualidade da imagem de IA). */
  budget_mode?: BudgetMode;
}

/**
 * Sufixo de estilo do caminho legado (motor v1, sem receita). "no-background"
 * agora significa recorte TRANSPARENTE de verdade (ver `background` abaixo).
 */
const STYLE_SUFFIX: Record<NonNullable<FetchImageBody["style"]>, string> = {
  "photo": "Cinematic photograph, dramatic lighting, shallow depth of field, editorial quality, 4k.",
  "illustration": "Flat vector illustration, editorial style, bold color palette, clean composition.",
  "no-background": "Isolated subject on a fully transparent background, product-photography lighting, no floor, no cast shadow, crisp edges — perfect for compositing.",
  "3d-render": "Modern 3D render, soft studio lighting, matte materials, clean isometric or three-quarter view.",
  "isometric": "Isometric 3D illustration, pastel palette, clean geometric composition, subtle depth.",
  "watercolor": "Watercolor illustration, soft washes, organic textures, muted palette, hand-painted feel.",
  "line-art": "Minimalist single-weight line art, one accent color, generous negative space.",
  "collage": "Editorial magazine collage, mixed textures, cut-paper aesthetic, expressive composition.",
  "minimal": "Ultra-minimal composition, one focal object, monochrome palette, generous negative space, gallery aesthetic.",
};

const LEGACY_NO_TEXT = " No text, letters or watermarks in the image.";

interface GenerationRequest {
  prompt: string;
  chain: ImageModelId[];
  quality: ImageQuality;
  aspect: ImageAspect;
  transparent: boolean;
}

interface GenerationResult {
  url: string | null;
  source: string;
  model?: ImageModelId;
  rateLimited?: boolean;
  costUsd?: number;
  estimated?: boolean;
}

/**
 * Geração de imagem pela cadeia de modelos do registro: o primeiro que
 * responder vence. Erro de modelo/tamanho (4xx) ou de provedor passa para o
 * próximo; o Gemini do gateway é a última rede de segurança.
 */
async function generateAiImage(req: GenerationRequest): Promise<GenerationResult> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const prompt = req.prompt.slice(0, 3000);
  let rateLimited = false;

  for (const model of req.chain) {
    const spec = IMAGE_MODELS[model];
    if (spec.provider === "openai") {
      if (!OPENAI_API_KEY) continue;
      try {
        const payload: Record<string, unknown> = {
          model,
          prompt,
          n: 1,
          size: imageSizeFor(model, req.aspect),
          output_format: "webp",
        };
        if (spec.capabilities.qualityScale) payload.quality = req.quality;
        if (req.transparent && spec.capabilities.transparent) payload.background = "transparent";
        const r = await fetch(IMAGE_ENDPOINTS.openai, {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (r.ok) {
          const d = await r.json();
          const b64 = d.data?.[0]?.b64_json;
          const url = b64 ? `data:image/webp;base64,${b64}` : d.data?.[0]?.url ?? null;
          if (url) {
            const cost = imageCostUsd(model, req.quality, req.aspect, d.usage ?? null);
            return { url, source: "openai", model, costUsd: cost.usd, estimated: cost.estimated };
          }
        } else if (r.status === 429 || r.status === 402) {
          console.warn("image rate/credit limit:", model, r.status);
          rateLimited = true;
        } else {
          const t = await r.text().catch(() => "");
          console.error("image error:", model, r.status, t.slice(0, 300));
        }
      } catch (e) {
        console.warn("image request failed:", model, e instanceof Error ? e.message : e);
      }
      continue;
    }
    // Gateway Lovable (Gemini): sem transparência nem escala de qualidade.
    if (!LOVABLE_API_KEY) continue;
    try {
      const r = await fetch(IMAGE_ENDPOINTS.gateway, {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
      });
      if (!r.ok) {
        if (r.status === 429 || r.status === 402) rateLimited = true;
        else console.error("gateway image error:", r.status);
        continue;
      }
      const d = await r.json();
      const url = d.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
      if (url) {
        const cost = imageCostUsd(model, req.quality, req.aspect, null);
        return { url, source: "lovable", model, costUsd: cost.usd, estimated: true };
      }
    } catch (e) {
      console.warn("gateway image failed:", e instanceof Error ? e.message : e);
    }
  }
  return { url: null, source: "none", rateLimited };
}

/**
 * Busca uma foto na Pexels evitando URLs já usadas na apresentação.
 * Centralizado aqui porque existem TRÊS caminhos que precisam disso
 * (strategy "pexels", fallback da strategy "ai" e a capa).
 */
async function searchPexels(
  query: string,
  orientation: string,
  avoidUrls: string[],
): Promise<{ url: string | null; photographer?: string | null; photographer_url?: string | null }> {
  const PEXELS_API_KEY = Deno.env.get("PEXELS_API_KEY");
  if (!PEXELS_API_KEY || !query) return { url: null };
  try {
    const r = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15&orientation=${orientation}`,
      { headers: { Authorization: PEXELS_API_KEY } },
    );
    if (!r.ok) {
      console.error("Pexels error:", r.status, (await r.text().catch(() => "")).slice(0, 200));
      return { url: null };
    }
    const data = await r.json();
    const avoid = new Set(avoidUrls);
    // deno-lint-ignore no-explicit-any
    const photos = (data.photos ?? []) as any[];
    // deno-lint-ignore no-explicit-any
    const pick = (p: any) => p?.src?.large2x ?? p?.src?.large ?? p?.src?.original ?? null;
    const photo = photos.find((p) => { const c = pick(p); return c && !avoid.has(c); }) ?? photos[0];
    return {
      url: photo ? pick(photo) : null,
      photographer: photo?.photographer ?? null,
      photographer_url: photo?.photographer_url ?? null,
    };
  } catch (e) {
    console.warn("Pexels search failed:", e instanceof Error ? e.message : e);
    return { url: null };
  }
}

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const log = createLogger("fetch-image", req, admin);
  await log.setIpFrom(req);

  // Resolve usuário se um token vier presente, mas NÃO exige — o
  // visualizador público chama esta função (estratégia "video"/"pexels")
  // sem sessão nenhuma, para apresentações já publicadas.
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  let userId: string | null = null;
  if (token) {
    const { data: userData } = await admin.auth.getUser(token);
    userId = userData?.user?.id ?? null;
    log.setUser(userId);
  }

  // Chave de rate limit: por usuário quando autenticado, por IP quando não.
  const clientIp = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown")
    .split(",")[0].trim();
  const rlKey = userId ? `user:${userId}` : `ip:${clientIp}`;

  try {
    const body: FetchImageBody = await req.json();
    const strategy = body.strategy;

    // Validação de entrada (auditoria): tudo aqui vira prompt de IA ou query
    // de API externa. Sem teto, um cliente podia enviar um prompt enorme
    // (custo de tokens) ou centenas de avoid_urls (URL da Pexels gigante).
    const clean = (v: unknown, max: number) =>
      String(v ?? "").replace(/[\u0000-\u001f]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);
    body.query = clean(body.query, 300);
    body.ai_prompt = clean(body.ai_prompt, 1200);
    body.avoid_urls = (Array.isArray(body.avoid_urls) ? body.avoid_urls : [])
      .filter((u) => typeof u === "string" && u.length <= 2048).slice(0, 30);
    const ALLOWED_STRATEGIES = ["pexels", "ai", "none", "video"];
    if (!ALLOWED_STRATEGIES.includes(strategy)) {
      return json({ url: null, error: "Estratégia inválida." }, 400);
    }
    // Estilo fora do catálogo viraria "undefined" dentro do prompt final.
    if (body.style && !(body.style in STYLE_SUFFIX)) body.style = undefined;
    const recipe = body.recipe ? sanitizeRecipe(body.recipe) : null;
    const budgetMode: BudgetMode = body.budget_mode === "premium" || body.budget_mode === "economy" ? body.budget_mode : "balanced";
    const presentationId = typeof body.presentation_id === "string" && UUID_RE.test(body.presentation_id) ? body.presentation_id : null;

    // ───────────── Cota de ativos da apresentação (motor v2) ─────────────
    // Devolve true se esta chamada foi coberta pela cota; false (sem cota,
    // esgotada, apresentação de outro usuário ou migração pendente) faz o
    // pedido cair no limite genérico de antes.
    const consumeQuota = async (kind: "ai" | "photo"): Promise<boolean> => {
      if (!userId || !presentationId) return false;
      try {
        const { data, error } = await admin.rpc("consume_presentation_asset", {
          _presentation_id: presentationId, _uid: userId, _kind: kind,
        });
        if (error) return false;
        return (data as { ok?: boolean } | null)?.ok === true;
      } catch {
        return false;
      }
    };
    const recordCost = async (usd: number | undefined) => {
      if (!userId || !presentationId || !usd) return;
      try {
        await admin.rpc("add_presentation_asset_cost", { _presentation_id: presentationId, _uid: userId, _cost_usd: usd });
      } catch { /* métrica, nunca bloqueia */ }
    };
    const withinGenericAiLimit = async (): Promise<boolean> => {
      const { data } = await admin.rpc("check_rate_limit", { _key: rlKey, _fn: "fetch-image-ai", _max_per_hour: 15 });
      if (data === false) {
        await log.security("rate_limited", { status: 429, detail: { strategy: "ai", max_per_hour: 15 } });
        return false;
      }
      return true;
    };

    if (strategy === "ai") {
      // Único caminho com custo real em dólar por chamada — exige conta.
      if (!userId) {
        await log.security("unauthorized", { status: 401, detail: { strategy: "ai" } });
        return json({ url: null, error: "Autenticação necessária para geração de imagem por IA." }, 401);
      }
      if (!(await consumeQuota("ai")) && !(await withinGenericAiLimit())) {
        return json({ url: null, error: "Limite de gerações de imagem por IA atingido nesta hora." }, 429);
      }
    } else if (strategy !== "none") {
      // pexels/video: sem custo monetário direto, mas ainda limitado por
      // IP/usuário para proteger a cota da Pexels do projeto inteiro.
      const covered = strategy === "pexels" && (await consumeQuota("photo"));
      if (!covered) {
        const { data: withinLimit } = await admin.rpc("check_rate_limit", {
          _key: rlKey, _fn: "fetch-image-public", _max_per_hour: 60,
        });
        if (withinLimit === false) {
          await log.security("rate_limited", { status: 429, detail: { strategy, max_per_hour: 60 } });
          return json({ url: null, error: "Limite de requisições de imagem atingido. Aguarde um pouco." }, 429);
        }
      }
    }

    if (strategy === "none") return json({ url: null });

    if (strategy === "video") {
      const PEXELS_API_KEY = Deno.env.get("PEXELS_API_KEY");
      if (!PEXELS_API_KEY) return json({ url: null, error: "PEXELS_API_KEY not configured" });
      const q = encodeURIComponent(body.query || "abstract motion");
      const r = await fetch(`https://api.pexels.com/videos/search?query=${q}&per_page=8&orientation=landscape&size=medium`, {
        headers: { Authorization: PEXELS_API_KEY },
      });
      if (!r.ok) {
        console.error("Pexels videos error:", r.status, await r.text());
        return json({ url: null, error: "Pexels videos error" });
      }
      const data = await r.json();
      // Pega o vídeo curto (<= 20s) com melhor resolução em mp4
      // deno-lint-ignore no-explicit-any
      const video = (data.videos ?? []).find((v: any) => v.duration && v.duration <= 25) ?? data.videos?.[0];
      // deno-lint-ignore no-explicit-any
      const file = video?.video_files?.find((f: any) => f.file_type === "video/mp4" && f.width && f.width <= 1920 && f.width >= 960)
        // deno-lint-ignore no-explicit-any
        ?? video?.video_files?.find((f: any) => f.file_type === "video/mp4")
        ?? video?.video_files?.[0];
      return json({
        url: file?.link ?? null,
        poster: video?.image ?? null,
        photographer: video?.user?.name ?? null,
        photographer_url: video?.user?.url ?? null,
        duration: video?.duration ?? null,
      });
    }

    const orientation = body.orientation || "landscape";
    const avoidUrls = body.avoid_urls ?? [];

    // Pedido de geração: receita (v2) ou prompt livre + estilo (v1).
    const buildGeneration = (fallbackText: string): GenerationRequest => {
      if (recipe) {
        const spec = buildImagePrompt(recipe);
        return {
          prompt: spec.prompt,
          chain: imageModelChain(recipe.kind, budgetMode === "economy" ? "balanced" : budgetMode, {
            primary: Deno.env.get("IMAGE_MODEL_PRIMARY"),
            economy: Deno.env.get("IMAGE_MODEL_ECONOMY"),
          }),
          quality: imageQualityFor(budgetMode === "economy" ? "balanced" : budgetMode),
          aspect: spec.aspect,
          transparent: spec.background === "transparent",
        };
      }
      // Caminho legado (motor v1): mesmo modelo e qualidade de antes, para
      // que a comparação de custo entre motores seja justa.
      const styleSuffix = body.style ? STYLE_SUFFIX[body.style] : "Cinematic, professional, high quality, presentation hero image.";
      return {
        prompt: `${fallbackText}. ${styleSuffix}${LEGACY_NO_TEXT}`,
        chain: ["gpt-image-1-mini", "google/gemini-2.5-flash-image"],
        quality: "low",
        aspect: "16:9",
        transparent: body.style === "no-background",
      };
    };
    // Chave de cache do Asset Intelligence: receitas diferenciam comando,
    // tipo e transparência (um recorte nunca substitui uma cena).
    const cacheStyle = recipe ? `recipe:${recipe.command}:${recipe.kind}${recipe.transparent ? ":t" : ""}` : body.style;
    const cacheQuery = recipe ? [recipe.subject, ...(recipe.items ?? [])].join(" ") : "";

    if (strategy === "pexels") {
      const found = await searchPexels(body.query || recipe?.subject || "abstract", orientation, avoidUrls);
      if (found.url) {
        // Ativos Pexels também são registrados na biblioteca do usuário.
        await recordAsset(admin, userId, found.url, body.style, body.query || "", "pexels");
        return json({ url: found.url, source: "pexels", photographer: found.photographer, photographer_url: found.photographer_url });
      }
      // Pexels não achou nada útil → IA como último recurso, mas só com conta,
      // permissão do pedido e cota (apresentação ou limite de IA).
      if (!userId || body.allow_ai_fallback === false) return json({ url: null });
      const fallbackText = body.ai_prompt || body.query || "abstract professional background";
      const matchText = cacheQuery || fallbackText;
      const cachedFallback = await findMatchingAsset(admin, userId, cacheStyle, matchText);
      if (cachedFallback) {
        await touchAsset(admin, cachedFallback.id, cachedFallback.usage_count);
        return json({ url: cachedFallback.url, source: "asset-library" });
      }
      if (!(await consumeQuota("ai")) && !(await withinGenericAiLimit())) return json({ url: null });
      const genFb = await generateAiImage(buildGeneration(fallbackText));
      if (genFb.url) {
        const persisted = await persistGeneratedImage(admin, userId, genFb.url);
        await recordAsset(admin, userId, persisted, cacheStyle, matchText, "ai");
        await recordCost(genFb.costUsd);
        return json({ url: persisted, source: `${genFb.source}-fallback`, model: genFb.model, cost_usd: genFb.costUsd });
      }
      return json({ url: null });
    }

    if (strategy === "ai") {
      // ───────────── Asset Intelligence ─────────────
      // Antes de gastar dinheiro numa nova geração, verifica se o mesmo
      // usuário já pagou por uma imagem equivalente (mesma chave de estilo +
      // prompt semanticamente parecido). Falha aqui nunca bloqueia.
      const queryForMatch = cacheQuery || body.ai_prompt || body.query || "";
      const cached = await findMatchingAsset(admin, userId, cacheStyle, queryForMatch);
      if (cached) {
        await touchAsset(admin, cached.id, cached.usage_count);
        return json({ url: cached.url, source: "asset-library" });
      }

      // "ai" significa IA de verdade; a Pexels só entra se a geração falhar.
      const basePrompt = body.ai_prompt || body.query || "abstract beautiful illustration";
      const gen = await generateAiImage(buildGeneration(basePrompt));
      if (gen.url) {
        // Sobe o binário para o Storage (data-URLs base64 não são cacheáveis
        // nem devem viver dentro de slides.content) e registra na biblioteca.
        const persistedUrl = await persistGeneratedImage(admin, userId, gen.url);
        await recordAsset(admin, userId, persistedUrl, cacheStyle, queryForMatch, "ai");
        await recordCost(gen.costUsd);
        return json({
          url: persistedUrl, source: gen.source, model: gen.model, cost_usd: gen.costUsd,
          transparent: !!recipe?.transparent || body.style === "no-background",
        });
      }

      // IA indisponível (rate limit, crédito, erro) → Pexels como rede de
      // segurança para o slide não ficar sem imagem nenhuma. Um recorte ou
      // vista técnica NÃO tem equivalente fotográfico: aí o slide cai no
      // fallback nativo do comando (o cliente recebe url null).
      const technical = recipe && (recipe.kind === "technical" || recipe.transparent);
      if (!technical) {
        const rescue = await searchPexels(body.query || recipe?.subject || basePrompt, orientation, avoidUrls);
        if (rescue.url) {
          await recordAsset(admin, userId, rescue.url, body.style, body.query || "", "pexels");
          return json({ url: rescue.url, source: "pexels-rescue", photographer: rescue.photographer, photographer_url: rescue.photographer_url });
        }
      }
      return json({ url: null, error: gen.rateLimited ? "AI image rate-limited" : "AI image failed" });
    }

    return json({ url: null });
  } catch (e) {
    console.error("fetch-image error:", e);
    return json({ url: null, error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
