// Pré-render de preview de link compartilhado (Open Graph dinâmico).
//
// Problema: o app é uma SPA. Crawlers de WhatsApp, LinkedIn, Slack, X e
// Facebook NÃO executam JavaScript — eles leem apenas o HTML estático do
// index.html. Por isso todo link de apresentação compartilhado mostrava o
// mesmo título e a mesma imagem genérica do site, nunca a capa e o título
// reais da apresentação.
//
// Solução: esta função devolve um HTML mínimo, renderizado no servidor, com
// as meta tags corretas da apresentação (título, descrição, imagem da capa)
// e um redirect para a rota real — de modo que um humano que abra a URL cai
// no app normalmente, enquanto o crawler já leu o que precisava.
//
// Só expõe apresentações PUBLICADAS e não deletadas: o mesmo critério do
// visualizador público. Uma apresentação privada devolve 404 sem vazar nada.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createLogger } from "../_shared/observability.ts";

const SITE = "https://slideai.com.br";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Só http(s) — impede que uma URL `javascript:` acabe dentro de uma meta tag. */
const safeUrl = (u: unknown): string | null => {
  if (typeof u !== "string") return null;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch { return null; }
};

function page(opts: {
  title: string; description: string; image: string | null; url: string;
}): string {
  const { title, description, image, url } = opts;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(url)}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="SlideAI" />
<meta property="og:locale" content="pt_BR" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(url)}" />
${image ? `<meta property="og:image" content="${esc(image)}" />` : ""}
<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
${image ? `<meta name="twitter:image" content="${esc(image)}" />` : ""}
<meta http-equiv="refresh" content="0; url=${esc(url)}" />
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "PresentationDigitalDocument",
    name: title,
    description,
    url,
    ...(image ? { image } : {}),
  })}</script>
</head>
<body>
<h1>${esc(title)}</h1>
<p>${esc(description)}</p>
<p><a href="${esc(url)}">Abrir apresentação no SlideAI</a></p>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const log = createLogger("og-preview", req, admin);

  const url = new URL(req.url);
  // Aceita ?slug=... ou o slug no final do path (/og-preview/meu-slide).
  const slug = (url.searchParams.get("slug")
    || url.pathname.split("/").filter(Boolean).pop()
    || "").slice(0, 120);

  const html = (body: string, status = 200) =>
    new Response(body, {
      status,
      headers: {
        ...corsHeaders, ...log.headers,
        "Content-Type": "text/html; charset=utf-8",
        // Crawlers reconsultam com frequência; 10 min de cache já evita
        // martelar o banco sem deixar o preview desatualizado por muito tempo.
        "Cache-Control": "public, max-age=600, s-maxage=600",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
    });

  if (!slug || slug === "og-preview") {
    return html(page({
      title: "SlideAI — Crie apresentações em segundos com IA",
      description: "Descreva o tema e receba slides editáveis com design, imagens e animações.",
      image: null,
      url: `${SITE}/`,
    }), 404);
  }

  const { data: pres, error } = await admin
    .from("presentations")
    .select("id, title, description, slug, is_published, deleted_at")
    .eq("slug", slug)
    .is("deleted_at", null)
    .eq("is_published", true)
    .maybeSingle();

  const target = `${SITE}/slides/${slug}`;

  if (error || !pres) {
    log.info("preview_not_found", { slug });
    return html(page({
      title: "Apresentação não encontrada — SlideAI",
      description: "Este link não existe mais ou a apresentação não está publicada.",
      image: null,
      url: target,
    }), 404);
  }

  // Capa = primeira imagem disponível do slide de posição mais baixa.
  const { data: slides } = await admin
    .from("slides")
    .select("background_image_url, content")
    .eq("presentation_id", pres.id)
    .order("position", { ascending: true })
    .limit(4);

  let cover: string | null = null;
  for (const s of slides ?? []) {
    cover = safeUrl(s.background_image_url) ?? safeUrl((s.content as any)?.image_url);
    if (cover) break;
  }

  log.info("preview_served", { slug, has_cover: !!cover });
  return html(page({
    title: `${pres.title} — SlideAI`,
    description: (pres.description || `Apresentação criada com SlideAI: ${pres.title}.`).slice(0, 200),
    image: cover,
    url: target,
  }));
});
