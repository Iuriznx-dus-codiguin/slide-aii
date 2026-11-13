// Fonte única dos dados de SEO do site: endereço canônico, marca e os blocos
// de dados estruturados (Schema.org) reutilizados pelas páginas. As páginas
// públicas são pré-renderizadas no build (scripts/prerender.ts), então tudo
// aqui precisa rodar também no Node — nada de window/document.
import { LEGAL } from "@/lib/legal";
import { PLAN_PRICE_CENTS, type PaidPlan } from "@/lib/cakto";

export const SITE_URL = "https://slideai.com.br";
export const SITE_NAME = "SlideAI";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;
export const DEFAULT_OG_IMAGE_ALT = "SlideAI: crie apresentações com IA";
export const LOGO_URL = `${SITE_URL}/logo.png`;

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const SOFTWARE_ID = `${SITE_URL}/#software`;

/** Título e descrição da home (os mesmos do bloco seo do index.html). */
export const HOME_TITLE = "SlideAI: Gerador de Apresentações e Slides com IA";
export const HOME_DESCRIPTION =
  "Crie apresentações profissionais com inteligência artificial em cerca de um minuto. Descreva o tema e receba slides editáveis, prontos para PowerPoint e PDF.";

/** Descrição longa da marca (dados estruturados e llms.txt). */
export const BRAND_DESCRIPTION =
  "Crie apresentações profissionais com inteligência artificial em cerca de um minuto. Descreva o tema e receba slides editáveis com design, imagens e gráficos, prontos para PowerPoint e PDF.";

export type JsonLd = Record<string, unknown>;

export const absoluteUrl = (path: string): string => (path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`);

/** Texto curto para meta description: corta na última palavra inteira e fecha com reticências. */
export function truncateDescription(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.–—-]+$/, "")}…`;
}

/**
 * Resumo em texto puro de um Markdown: pula títulos, tabelas e blocos de
 * código, remove a marcação de links e ênfases e devolve o começo do texto.
 */
export function summarizeMarkdown(md: string, max = 155): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const prose: string[] = [];
  let inCode = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("```")) { inCode = !inCode; continue; }
    if (inCode || !line || line.startsWith("#") || line.startsWith("|")) continue;
    prose.push(line);
    if (prose.join(" ").length > max * 2) break;
  }
  const text = prose.join(" ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/g, "")
    .replace(/\s(?:[-*+]|\d+\.)\s+/g, " ")
    .replace(/[*_`>]/g, "");
  return truncateDescription(text, max);
}

export function organizationJsonLd(): JsonLd {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    logo: { "@type": "ImageObject", url: LOGO_URL, width: 256, height: 256 },
    email: LEGAL.supportEmail,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: LEGAL.supportEmail,
      availableLanguage: ["Portuguese"],
      areaServed: "BR",
    },
    // Só o que está preenchido em src/lib/legal.ts (nada inventado).
    ...(LEGAL.legalName ? { legalName: LEGAL.legalName } : {}),
    ...(LEGAL.taxId ? { taxID: LEGAL.taxId } : {}),
    ...(LEGAL.address ? { address: LEGAL.address } : {}),
  };
}

export function websiteJsonLd(): JsonLd {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description: "Gerador de apresentações e slides com inteligência artificial em português.",
    inLanguage: "pt-BR",
    publisher: { "@id": ORGANIZATION_ID },
  };
}

const price = (plan: PaidPlan) => (PLAN_PRICE_CENTS[plan] / 100).toFixed(2);

/** O produto em si, com os preços reais de src/lib/cakto.ts (sem avaliações inventadas). */
export function softwareApplicationJsonLd(): JsonLd {
  const offer = (name: string, plan: PaidPlan, description: string) => ({
    "@type": "Offer",
    name,
    description,
    price: price(plan),
    priceCurrency: "BRL",
    url: `${SITE_URL}/#pricing`,
    availability: "https://schema.org/InStock",
  });
  return {
    "@type": "SoftwareApplication",
    "@id": SOFTWARE_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Gerador de apresentações com IA",
    operatingSystem: "Web (navegador)",
    inLanguage: "pt-BR",
    description: BRAND_DESCRIPTION,
    image: DEFAULT_OG_IMAGE,
    publisher: { "@id": ORGANIZATION_ID },
    featureList: [
      "Geração de apresentações completas com IA a partir de um tema",
      "Editor visual de slides com assistente de edição por IA",
      "Gráficos automáticos a partir dos dados do tema",
      "Imagens do Pexels e imagens geradas por IA",
      "Falas dos apresentadores e notas do orador",
      "Exportação em PowerPoint (.pptx), PDF e PNG",
      "Link público para apresentar em qualquer dispositivo",
    ],
    offers: [
      offer("Geração única", "single", "500 créditos permanentes (cerca de 3 apresentações de 10 slides com falas)."),
      offer("PRO Mensal", "mensal", "1.700 créditos por mês, renovação mensal."),
      offer("MAX Mensal", "max_mensal", "Uso ilimitado para uma pessoa, dentro da Política de Uso Justo."),
    ],
  };
}

export interface Crumb { name: string; path: string }

/** Trilha de navegação (BreadcrumbList), sempre começando pela home. */
export function breadcrumbJsonLd(crumbs: Crumb[]): JsonLd {
  const all = [{ name: "Início", path: "/" }, ...crumbs];
  return {
    "@type": "BreadcrumbList",
    itemListElement: all.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

/** Junta vários blocos num único documento JSON-LD com @graph. */
export const jsonLdGraph = (...nodes: JsonLd[]): JsonLd => ({ "@context": "https://schema.org", "@graph": nodes });
