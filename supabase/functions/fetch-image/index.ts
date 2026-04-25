// Resolve image for a slide. Strategy = "pexels" -> search Pexels.
// Strategy = "ai" -> generate via Lovable AI (Gemini Image / Nano Banana).
// Returns { url } or { error }.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FetchImageBody {
  query?: string;
  ai_prompt?: string;
  strategy: "pexels" | "ai" | "none" | "video";
  orientation?: "landscape" | "portrait" | "square";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: FetchImageBody = await req.json();
    const strategy = body.strategy;

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
      const r = await fetch(`https://api.pexels.com/v1/search?query=${q}&per_page=5&orientation=${orientation}`, {
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
      const photo = data.photos?.[0];
      const url = photo?.src?.large2x ?? photo?.src?.large ?? photo?.src?.original ?? null;
      return new Response(JSON.stringify({
        url,
        photographer: photo?.photographer ?? null,
        photographer_url: photo?.photographer_url ?? null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (strategy === "ai") {
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
