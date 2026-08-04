// Resolve image for a slide. Strategy = "pexels" -> search Pexels.
// Strategy = "ai" -> generate via Lovable AI (Gemini Image / Nano Banana).
// Returns { url } or { error }.
//
// Segurança: esta função é usada em dois contextos bem diferentes — (1) o
// editor/gerador autenticado pedindo imagens Pexels ou geração por IA, e (2)
// o visualizador público (SlideViewer, sem login) pedindo o vídeo de fundo
// ambiente de uma apresentação já publicada. Por isso o controle de acesso é
// calibrado por estratégia em vez de um auth obrigatório genérico:
//   • strategy "ai"            → é a ÚNICA com custo real em dólar por
//     chamada (Lovable AI Gateway). Exige usuário autenticado + rate limit
//     de 15/hora por usuário.
//   • strategy "pexels"/"video" → sem custo monetário direto, mas ainda
//     assim sujeitas a um rate limit por IP (60/hora) para não permitir que
//     alguém esgote a cota da API da Pexels do projeto inteiro.
// Antes desta correção, TODAS as estratégias — incluindo "ai" — podiam ser
// chamadas por qualquer pessoa de posse da chave pública do projeto, sem
// nenhum vínculo com conta e sem limite algum.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { findMatchingAsset, recordAsset, touchAsset } from "../_shared/assetIntelligence.ts";
import { persistGeneratedImage } from "../_shared/assetStorage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FetchImageBody {
  query?: string;
  ai_prompt?: string;
  strategy: "pexels" | "ai" | "none" | "video";
  orientation?: "landscape" | "portrait" | "square";
  /** Estilo visual quando strategy="ai" — molda o prompt final. */
  style?: "photo" | "illustration" | "no-background" | "3d-render" | "isometric" | "watercolor" | "line-art" | "collage" | "minimal";
  /** URLs já em uso na apresentação — Pexels evitará reutilizá-las. */
  avoid_urls?: string[];
}

/** Mapeia estilo → sufixo de prompt cinematográfico para Nano Banana 2. */
const STYLE_SUFFIX: Record<NonNullable<FetchImageBody["style"]>, string> = {
  "photo": "Cinematic photograph, dramatic lighting, shallow depth of field, editorial quality, 4k.",
  "illustration": "Flat vector illustration, editorial style, bold color palette, clean composition.",
  "no-background": "Isolated subject on pure white background, product-photography lighting, no shadow, crisp edges — perfect for compositing.",
  "3d-render": "Modern 3D render, soft studio lighting, matte materials, clean isometric or three-quarter view.",
  "isometric": "Isometric 3D illustration, pastel palette, clean geometric composition, subtle depth.",
  "watercolor": "Watercolor illustration, soft washes, organic textures, muted palette, hand-painted feel.",
  "line-art": "Minimalist single-weight line art, one accent color, generous negative space.",
  "collage": "Editorial magazine collage, mixed textures, cut-paper aesthetic, expressive composition.",
  "minimal": "Ultra-minimal composition, one focal object, monochrome palette, generous negative space, gallery aesthetic.",
};

/**
 * Geração de imagem por IA — OpenAI Images API como motor principal
 * (gpt-image-1-mini, quality "low", 1536x1024 → melhor custo por hero image),
 * com fallback para o gateway Lovable (Gemini Image) apenas se a OpenAI
 * falhar por erro não-tarifário. Pexels continua sempre em primeiro lugar
 * nas rotas acima, então a IA só entra quando realmente necessário.
 */
async function generateAiImage(
  prompt: string,
): Promise<{ url: string | null; source: string; rateLimited?: boolean }> {
  const finalPrompt = prompt.slice(0, 3000);
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  if (OPENAI_API_KEY) {
    try {
      const r = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-image-1-mini",
          prompt: finalPrompt,
          n: 1,
          size: "1536x1024",
          quality: "low",
          output_format: "webp",
        }),
      });
      if (r.ok) {
        const d = await r.json();
        const b64 = d.data?.[0]?.b64_json;
        if (b64) return { url: `data:image/webp;base64,${b64}`, source: "openai" };
        if (d.data?.[0]?.url) return { url: d.data[0].url, source: "openai" };
      } else if (r.status === 429 || r.status === 402) {
        console.warn("OpenAI image rate/credit limit:", r.status);
        return { url: null, source: "openai", rateLimited: true };
      } else {
        const t = await r.text().catch(() => "");
        console.error("OpenAI image error:", r.status, t.slice(0, 400));
      }
    } catch (e) {
      console.warn("OpenAI image request failed:", e instanceof Error ? e.message : e);
    }
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return { url: null, source: "none" };
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: finalPrompt }],
        modalities: ["image", "text"],
      }),
    });
    if (!r.ok) {
      if (r.status === 429 || r.status === 402) return { url: null, source: "lovable", rateLimited: true };
      console.error("Lovable image fallback error:", r.status);
      return { url: null, source: "lovable" };
    }
    const d = await r.json();
    const url = d.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
    return { url, source: "lovable" };
  } catch (e) {
    console.warn("Lovable image fallback failed:", e instanceof Error ? e.message : e);
    return { url: null, source: "none" };
  }
}

/**
 * Busca uma foto na Pexels evitando URLs já usadas na apresentação.
 * Centralizado aqui porque agora existem TRÊS caminhos que precisam disso
 * (strategy "pexels", fallback da strategy "ai" e a capa) — antes o mesmo
 * bloco estava copiado duas vezes com pequenas divergências de comportamento.
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
    const photos = (data.photos ?? []) as any[];
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Resolve usuário se um token vier presente, mas NÃO exige — o
  // visualizador público chama esta função (estratégia "video"/"pexels")
  // sem sessão nenhuma, para apresentações já publicadas.
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  let userId: string | null = null;
  if (token) {
    const { data: userData } = await admin.auth.getUser(token);
    userId = userData?.user?.id ?? null;
  }

  // Chave de rate limit: por usuário quando autenticado, por IP quando não.
  // x-forwarded-for é preenchido pelo edge runtime/CDN; é a melhor aproximação
  // disponível para um chamador anônimo (spoofável, mas já eleva bastante o
  // custo de abuso em relação ao endpoint totalmente aberto de antes).
  const clientIp = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown")
    .split(",")[0].trim();
  const rlKey = userId ? `user:${userId}` : `ip:${clientIp}`;

  try {
    const body: FetchImageBody = await req.json();
    const strategy = body.strategy;

    if (strategy === "ai") {
      // Único caminho com custo real em dólar por chamada — exige conta.
      if (!userId) {
        return new Response(JSON.stringify({ url: null, error: "Autenticação necessária para geração de imagem por IA." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: withinAiLimit } = await admin.rpc("check_rate_limit", {
        _key: rlKey, _fn: "fetch-image-ai", _max_per_hour: 15,
      });
      if (withinAiLimit === false) {
        return new Response(JSON.stringify({ url: null, error: "Limite de gerações de imagem por IA atingido nesta hora." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // pexels/video/none: sem custo monetário direto, mas ainda limitado
      // por IP/usuário para proteger a cota da Pexels do projeto inteiro.
      const { data: withinLimit } = await admin.rpc("check_rate_limit", {
        _key: rlKey, _fn: "fetch-image-public", _max_per_hour: 60,
      });
      if (withinLimit === false) {
        return new Response(JSON.stringify({ url: null, error: "Limite de requisições de imagem atingido. Aguarde um pouco." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (strategy === "none") {
      return new Response(JSON.stringify({ url: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (strategy === "video") {
      const PEXELS_API_KEY = Deno.env.get("PEXELS_API_KEY");
      if (!PEXELS_API_KEY) {
        return new Response(JSON.stringify({ url: null, error: "PEXELS_API_KEY not configured" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const q = encodeURIComponent(body.query || "abstract motion");
      const r = await fetch(`https://api.pexels.com/videos/search?query=${q}&per_page=8&orientation=landscape&size=medium`, {
        headers: { Authorization: PEXELS_API_KEY },
      });
      if (!r.ok) {
        console.error("Pexels videos error:", r.status, await r.text());
        return new Response(JSON.stringify({ url: null, error: "Pexels videos error" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await r.json();
      // Pega o vídeo curto (<= 20s) com melhor resolução em mp4
      const video = (data.videos ?? []).find((v: any) => v.duration && v.duration <= 25) ?? data.videos?.[0];
      const file = video?.video_files?.find((f: any) => f.file_type === "video/mp4" && f.width && f.width <= 1920 && f.width >= 960)
        ?? video?.video_files?.find((f: any) => f.file_type === "video/mp4")
        ?? video?.video_files?.[0];
      const url = file?.link ?? null;
      const poster = video?.image ?? null;
      return new Response(JSON.stringify({
        url, poster,
        photographer: video?.user?.name ?? null,
        photographer_url: video?.user?.url ?? null,
        duration: video?.duration ?? null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const orientation = body.orientation || "landscape";
    const avoidUrls = body.avoid_urls ?? [];

    if (strategy === "pexels") {
      const found = await searchPexels(body.query || "abstract", orientation, avoidUrls);
      if (found.url) {
        // Consistência da biblioteca (auditoria): ativos Pexels também são
        // registrados agora. Antes só imagens de IA entravam em public.assets,
        // então a "biblioteca de ativos" do usuário mostrava, na melhor das
        // hipóteses, ~40% do que a apresentação realmente usava.
        await recordAsset(admin, userId, found.url, body.style, body.query || "", "pexels");
        return new Response(JSON.stringify({
          url: found.url, source: "pexels",
          photographer: found.photographer, photographer_url: found.photographer_url,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Pexels não achou nada útil → gera por IA como último recurso.
      // BUG histórico corrigido: aqui se usava uma variável `prompt` nunca
      // declarada, que resolvia para o global `prompt` do runtime Deno.
      const fallbackPrompt = body.ai_prompt || body.query || "abstract professional background";
      const cachedFallback = await findMatchingAsset(admin, userId, body.style, fallbackPrompt);
      if (cachedFallback) {
        await touchAsset(admin, cachedFallback.id, cachedFallback.usage_count);
        return new Response(JSON.stringify({ url: cachedFallback.url, source: "asset-library" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const genFb = await generateAiImage(`${fallbackPrompt}. ${body.style ? STYLE_SUFFIX[body.style] : "Cinematic, professional, presentation hero image."}`);
      if (genFb.url) {
        const persisted = await persistGeneratedImage(admin, userId, genFb.url);
        await recordAsset(admin, userId, persisted, body.style, fallbackPrompt, "ai");
        return new Response(JSON.stringify({ url: persisted, source: `${genFb.source}-fallback` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ url: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (strategy === "ai") {
      // ───────────── Fase 5: Asset Intelligence Engine ─────────────
      // Antes de gastar dinheiro numa nova geração, verifica se o mesmo
      // usuário já pagou por uma imagem equivalente (mesmo style + prompt
      // semanticamente parecido). Falha aqui nunca bloqueia: cai na geração.
      const queryForMatch = body.ai_prompt || body.query || "";
      const cached = await findMatchingAsset(admin, userId, body.style, queryForMatch);
      if (cached) {
        await touchAsset(admin, cached.id, cached.usage_count);
        return new Response(JSON.stringify({ url: cached.url, source: "asset-library" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // INCONSISTÊNCIA CORRIGIDA (auditoria desta rodada): este caminho fazia
      // "Pexels-first" — ou seja, quando o Diretor Criativo pedia
      // explicitamente strategy="ai" (ilustração, 3D, aquarela, recorte sem
      // fundo…), a função devolvia silenciosamente uma FOTO da Pexels sempre
      // que a busca retornasse qualquer coisa. Na prática a estratégia "ai"
      // quase nunca rodava: o estilo pedido era ignorado e a tabela
      // public.assets nunca crescia. Agora "ai" significa IA de verdade, e a
      // Pexels só entra se a geração falhar. Quem quer economizar continua
      // protegido: no modo economia, generate-presentation converte todo
      // "ai" em "pexels" ANTES de chegar aqui.
      const basePrompt = body.ai_prompt || body.query || "abstract beautiful illustration";
      const styleSuffix = body.style ? STYLE_SUFFIX[body.style] : "Cinematic, professional, high quality, presentation hero image.";
      const gen = await generateAiImage(`${basePrompt}. ${styleSuffix}`);

      if (gen.url) {
        // Fase 5: sobe o binário para o Storage (data-URLs base64 de centenas
        // de KB não são cacheáveis nem devem viver dentro de slides.content)
        // e registra a URL persistente na biblioteca do usuário.
        const persistedUrl = await persistGeneratedImage(admin, userId, gen.url);
        await recordAsset(admin, userId, persistedUrl, body.style, queryForMatch, "ai");
        return new Response(JSON.stringify({ url: persistedUrl, source: gen.source }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // IA indisponível (rate limit, crédito, erro) → Pexels como rede de
      // segurança para o slide não ficar sem imagem nenhuma.
      const rescue = await searchPexels(body.query || basePrompt, orientation, avoidUrls);
      if (rescue.url) {
        await recordAsset(admin, userId, rescue.url, body.style, body.query || "", "pexels");
        return new Response(JSON.stringify({
          url: rescue.url, source: "pexels-rescue",
          photographer: rescue.photographer, photographer_url: rescue.photographer_url,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({
        url: null,
        error: gen.rateLimited ? "AI image rate-limited" : "AI image failed",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    return new Response(JSON.stringify({ url: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fetch-image error:", e);
    return new Response(JSON.stringify({ url: null, error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
