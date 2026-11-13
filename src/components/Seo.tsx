// Metadados por rota (title, description, canonical, robots, Open Graph,
// Twitter e JSON-LD) com react-helmet-async.
//
// As páginas públicas são pré-renderizadas no build (scripts/prerender.ts):
// o mesmo <Seo> gera as tags que vão no HTML estático de cada rota, que
// crawlers sem JavaScript (redes sociais, buscadores de IA) leem direto. No
// navegador, o Helmet assume essas tags (atributo data-rh) e as troca a cada
// navegação, sem duplicar as do index.html.
import { Helmet } from "react-helmet-async";
import { DEFAULT_OG_IMAGE, DEFAULT_OG_IMAGE_ALT, SITE_NAME, absoluteUrl, type JsonLd } from "@/lib/seo";

interface SeoProps {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  image?: string;
  imageAlt?: string;
  jsonLd?: JsonLd | JsonLd[];
  /** Página fora do índice (privada, vazia ou de transação): noindex e sem canonical. */
  noindex?: boolean;
  /** ISO 8601, para artigos. */
  modifiedTime?: string;
}

/** "</script>" dentro de um texto (ex.: título de apresentação) fecharia o bloco: "<" vira <. */
const serializeJsonLd = (data: JsonLd) => JSON.stringify(data).replace(/</g, "\\u003c");

export const Seo = ({ title, description, path, type = "website", image, imageAlt, jsonLd, noindex, modifiedTime }: SeoProps) => {
  const url = absoluteUrl(path);
  const img = image ? absoluteUrl(image) : DEFAULT_OG_IMAGE;
  const alt = image ? imageAlt ?? title : DEFAULT_OG_IMAGE_ALT;
  const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {!noindex && <link rel="canonical" href={url} />}
      <meta
        name="robots"
        content={noindex ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"}
      />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="pt_BR" />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={img} />
      {!image && <meta property="og:image:width" content="1200" />}
      {!image && <meta property="og:image:height" content="630" />}
      <meta property="og:image:alt" content={alt} />
      {type === "article" && modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={img} />
      <meta name="twitter:image:alt" content={alt} />
      {blocks.map((block, i) => (
        <script key={i} type="application/ld+json">{serializeJsonLd(block)}</script>
      ))}
    </Helmet>
  );
};
