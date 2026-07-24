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

    if (strategy === "pexels") {
      const PEXELS_API_KEY = Deno.env.get("PEXELS_API_KEY");
      if (!PEXELS_API_KEY) {
        return new Response(JSON.stringify({ url: null, error: "PEXELS_API_KEY not configured" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const q = encodeURIComponent(body.query || "abstract");
      const orientation = body.orientation || "landscape";
      const r = await fetch(`https://api.pexels.com/v1/search?query=${q}&per_page=15&orientation=${orientation}`, {
        headers: { Authorization: PEXELS_API_KEY },
      });
      if (!r.ok) {
        const t = await r.text();
        console.error("Pexels error:", r.status, t);
        return new Response(JSON.stringify({ url: null, error: "Pexels error" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await r.json();
      const avoid = new Set((body.avoid_urls ?? []).map((u) => u));
      const photos = (data.photos ?? []) as any[];
      const photo = photos.find((p) => {
        const candidate = p?.src?.large2x ?? p?.src?.large ?? p?.src?.original ?? "";
        return candidate && !avoid.has(candidate);
      }) ?? photos[0];
      const url = photo?.src?.large2x ?? photo?.src?.large ?? photo?.src?.original ?? null;
      // Fallback: se Pexels não retornou nada útil, tenta gerar via IA usando ai_prompt|query.
      if (!url) {
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (LOVABLE_API_KEY) {
          try {
            const prompt = body.ai_prompt || body.query || "abstract editorial composition";
            const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-image",
                messages: [{ role: "user", content: `${prompt}. Cinematic, professional, presentation hero image.` }],
                modalities: ["image", "text"],
              }),
            });
            if (ai.ok) {
              const aiData = await ai.json();
              const aiUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
              if (aiUrl) {
                return new Response(JSON.stringify({ url: aiUrl, source: "ai-fallback" }), {
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }
            }
          } catch (e) {
            console.warn("AI fallback after Pexels miss failed:", e);
          }
        }
      }
      return new Response(JSON.stringify({
        url,
        photographer: photo?.photographer ?? null,
        photographer_url: photo?.photographer_url ?? null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (strategy === "ai") {
      // PEXELS-FIRST: tenta Pexels mesmo quando estratégia é "ai" — só recorre à IA se Pexels não retornar nada útil.
      const PEXELS_API_KEY = Deno.env.get("PEXELS_API_KEY");
      if (PEXELS_API_KEY && body.query) {
        try {
          const q = encodeURIComponent(body.query);
          const orientation = body.orientation || "landscape";
          const r0 = await fetch(`https://api.pexels.com/v1/search?query=${q}&per_page=15&orientation=${orientation}`, {
            headers: { Authorization: PEXELS_API_KEY },
          });
          if (r0.ok) {
            const data0 = await r0.json();
            const avoid = new Set((body.avoid_urls ?? []).map((u) => u));
            const photos = (data0.photos ?? []) as any[];
            const photo = photos.find((p) => {
              const candidate = p?.src?.large2x ?? p?.src?.large ?? p?.src?.original ?? "";
              return candidate && !avoid.has(candidate);
            });
            if (photo) {
              const url = photo?.src?.large2x ?? photo?.src?.large ?? photo?.src?.original ?? null;
              if (url) {
                return new Response(JSON.stringify({
                  url, source: "pexels-fallback",
                  photographer: photo?.photographer ?? null,
                  photographer_url: photo?.photographer_url ?? null,
                }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
              }
            }
          }
        } catch (e) {
          console.warn("Pexels-first fallback failed, going to AI:", e);
        }
      }

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
      const prompt = body.ai_prompt || body.query || "abstract beautiful illustration";

      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [{ role: "user", content: `${prompt}. Cinematic, professional, high quality, presentation hero image.` }],
          modalities: ["image", "text"],
        }),
      });

      if (!r.ok) {
        if (r.status === 429 || r.status === 402) {
          return new Response(JSON.stringify({ url: null, error: "AI image rate-limited" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await r.text();
        console.error("AI image error:", r.status, t);
        return new Response(JSON.stringify({ url: null, error: "AI image failed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await r.json();
      const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
      return new Response(JSON.stringify({ url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
