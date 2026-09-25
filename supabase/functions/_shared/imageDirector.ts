// Image Director (motor criativo v2) — prompt de imagem montado por RECEITA.
//
// Antes, o prompt de imagem era texto livre escrito pela IA de conteúdo
// (`ai_image_prompt`, "SEMPRE preencha", mesmo em slide Pexels) com um sufixo
// de estilo. Nada garantia ausência de texto na imagem, paleta coerente com o
// tema ou escala realista — e o estilo "no-background" pedia fundo BRANCO, que
// vira um retângulo branco em tema escuro.
//
// Aqui o prompt é montado deterministicamente, sem LLM, a partir de:
//   1. sujeito e itens (o que precisa aparecer);
//   2. transformação do comando (vista explodida, corte, raio-x…);
//   3. composição e perspectiva;
//   4. estilo do brief e do domínio;
//   5. paleta em hex do tema resolvido;
//   6. restrições fixas: sem texto, sem marca d'água, escala e relações
//      realistas, nenhuma peça inventada.
// No híbrido a imagem traz no máximo marcadores numéricos discretos; a
// legenda é nativa e editável no slide, nunca texto corrido dentro da imagem.
// Recortes pedem fundo transparente de verdade (webp com alfa); o compositor
// do slide aplica sombra de contato e palco com spotlight.

import { isDomain, type Domain } from "./sceneCatalog.ts";
import type { ImageAspect } from "./modelRegistry.ts";
import type { ImageRecipeKind } from "./visualCommands.ts";

export interface ImageRecipe {
  /** Comando visual (EXPLODED_VIEW, HERO_OBJECT…) ou "COVER"/"PHOTO". */
  command: string;
  kind: ImageRecipeKind;
  subject: string;
  /** Partes/elementos que precisam aparecer — contexto, nunca texto na imagem. */
  items?: string[];
  /** Híbrido: quantidade de marcadores numéricos discretos (1..N). */
  markers?: number;
  composition?: string;
  /** visual_style do Creative Brief. */
  style?: string;
  domain?: Domain;
  palette?: { bg?: string; text?: string; accent?: string; accent2?: string };
  aspect: ImageAspect;
  /** Recorte com fundo transparente real. */
  transparent?: boolean;
}

export interface ImagePromptSpec {
  prompt: string;
  background: "transparent" | "opaque";
  format: "webp" | "png";
  aspect: ImageAspect;
}

/** O que cada comando faz com o sujeito. */
const TRANSFORMATION: Record<string, string> = {
  EXPLODED_VIEW: "Exploded view: the real components of the subject separated along one clear axis with even spacing, perfectly aligned in assembly order, each part fully visible.",
  CUTAWAY: "Cutaway view: a clean section of the outer shell removed to reveal the real internal structure in place.",
  CROSS_SECTION: "Cross-section: the subject sliced by a single flat plane, showing its internal layers from outside to inside with clean cut surfaces.",
  X_RAY_VIEW: "X-ray view: the outer shell rendered translucent so the real internal parts are visible inside it.",
  LAYERED_VIEW: "Layered view: the layers of the subject stacked vertically and slightly separated, each layer a distinct slab, aligned on the same axis.",
  COMPONENT_MAP: "Knolling layout: the real components of the subject laid out flat, organized in a tidy grid with even spacing, top-down view.",
  METAPHOR: "A single, clear visual metaphor rendered as one concrete scene.",
  SCENARIO: "A realistic, candid scene.",
  HISTORICAL_RECONSTRUCTION: "Historically accurate reconstruction with period-correct architecture, clothing, tools and materials; no anachronisms.",
  HERO_OBJECT: "One single hero object, the literal subject, shown whole.",
  COVER: "The most iconic, literal visual symbol of the subject.",
  PHOTO: "A realistic photograph of the subject.",
};

/** Composição/perspectiva padrão por tipo de receita. */
const COMPOSITION: Record<ImageRecipeKind, string> = {
  technical: "Three-quarter isometric perspective, orthographic feel, subject centered with generous margins, neutral seamless backdrop.",
  cutout: "Subject centered and fully in frame with generous margin on every side, three-quarter view, no ground plane.",
  illustration: "Strong single focal point, generous negative space on one side for layout, simple background.",
  scene: "Eye-level composition, natural perspective, clear focal subject, depth of field that separates subject from background.",
  reconstruction: "Wide establishing view with a clear focal point, natural daylight, documentary composition.",
};

/** Linguagem visual por tipo + domínio. */
const RENDER_STYLE: Record<ImageRecipeKind, string> = {
  technical: "Precise technical illustration, clean studio render, matte materials, soft even lighting, high detail.",
  cutout: "Clean product-style render, soft studio key light, crisp edges.",
  illustration: "Editorial illustration, clean shapes, restrained detail, cinematic lighting.",
  scene: "Cinematic photograph, natural light, editorial quality.",
  reconstruction: "Painterly photorealistic rendering, museum-quality historical accuracy.",
};

const DOMAIN_STYLE: Partial<Record<Domain, string>> = {
  medical: "Clinical anatomical accuracy, respectful, not graphic.",
  engineering: "Engineering accuracy: real fasteners, joints and tolerances.",
  science: "Scientifically accurate proportions and structures.",
  tech: "Modern hardware aesthetic, precise geometry.",
  architecture: "Architectural accuracy, correct structural elements and materials.",
  history: "Period-correct details only.",
  geography: "Real landforms and natural features only; no invented geography.",
};

/** Restrições fixas — valem para toda imagem gerada. */
export const IMAGE_CONSTRAINTS = [
  "Absolutely no text, letters, words, labels, captions, logos, signatures or watermarks anywhere in the image.",
  "Realistic scale and correct physical relationships between all components.",
  "Do not invent parts, features or elements that do not exist in the real subject.",
] as const;

const MARKER_RULE = (n: number) =>
  `The only permitted marks are ${n} small, discrete numbered circular markers (1 to ${n}), one next to each listed part; no other numbers or text.`;

// Pedidos de texto embutidos no sujeito ("uma placa escrita 'ABERTO'") viram
// texto renderizado na imagem. O Image Director corta essas cláusulas.
const TEXT_REQUEST = /\b(that says|saying|which reads|with the words?|written (?:on|in|with)|lettering|with (?:a |the )?(?:caption|label|title|headline)s?|escrit[ao]s? (?:com|em|na|no)|dizendo|com a palavra|com (?:a )?legenda|com (?:o )?r[oó]tulo)\b.*$/i;

/** Limpa um fragmento de conteúdo antes de entrar no prompt. */
export function cleanFragment(v: unknown, max = 140): string {
  if (typeof v !== "string") return "";
  return v
    // eslint-disable-next-line no-control-regex -- remove caracteres de controle de propósito
    .replace(/[\u0000-\u001f]+/g, " ")
    .replace(/["“”'‘’«»`]/g, "")
    .replace(TEXT_REQUEST, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/[,;:\-–—]+$/, "")
    .slice(0, max);
}

const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v.trim());

/** Monta o prompt final da receita. Determinístico: mesma receita → mesmo prompt. */
export function buildImagePrompt(recipe: ImageRecipe): ImagePromptSpec {
  const subject = cleanFragment(recipe.subject) || "the main subject";
  const items = (recipe.items ?? []).map((i) => cleanFragment(i, 50)).filter(Boolean).slice(0, 8);
  const transparent = !!recipe.transparent;
  const markers = Math.max(0, Math.min(9, Math.round(recipe.markers ?? 0)));

  const parts: string[] = [];
  parts.push(`Subject: ${subject}.`);
  parts.push(TRANSFORMATION[recipe.command] ?? TRANSFORMATION.PHOTO);
  if (items.length) parts.push(`It must clearly show these real parts: ${items.join(", ")}.`);
  const composition = cleanFragment(recipe.composition, 60);
  parts.push(composition ? `Composition: ${composition}. ${COMPOSITION[recipe.kind]}` : COMPOSITION[recipe.kind]);
  parts.push(RENDER_STYLE[recipe.kind]);
  if (recipe.domain && isDomain(recipe.domain) && DOMAIN_STYLE[recipe.domain]) parts.push(DOMAIN_STYLE[recipe.domain]!);
  const style = cleanFragment(recipe.style, 60);
  if (style) parts.push(`Art direction: ${style}.`);

  const palette = [recipe.palette?.accent, recipe.palette?.accent2, recipe.palette?.bg].filter(isHex);
  if (palette.length) {
    parts.push(
      recipe.kind === "scene" || recipe.kind === "reconstruction"
        ? `Color grading leaning toward ${palette.slice(0, 2).join(" and ")}.`
        : `Color palette restricted to ${palette.join(", ")} plus neutral grays.`,
    );
  }

  if (transparent) {
    parts.push("Isolated subject on a fully transparent background (alpha channel), no floor, no backdrop, no cast shadow, clean anti-aliased edges.");
  }
  parts.push(`Aspect ratio ${recipe.aspect}.`);
  parts.push(...IMAGE_CONSTRAINTS);
  if (markers > 0) parts.push(MARKER_RULE(markers));

  return {
    prompt: parts.join(" ").slice(0, 3000),
    background: transparent ? "transparent" : "opaque",
    // webp preserva o alfa do recorte e é leve para as fotos opacas.
    format: "webp",
    aspect: recipe.aspect,
  };
}

const KINDS: ImageRecipeKind[] = ["technical", "cutout", "illustration", "scene", "reconstruction"];

/** Valida uma receita vinda do cliente (fetch-image). */
export function sanitizeRecipe(raw: unknown): ImageRecipe | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const subject = cleanFragment(r.subject, 160);
  if (!subject) return null;
  const kind = KINDS.includes(r.kind as ImageRecipeKind) ? (r.kind as ImageRecipeKind) : "illustration";
  const command = typeof r.command === "string" && /^[A-Z_]{2,40}$/.test(r.command) ? r.command : "PHOTO";
  const pal = (r.palette && typeof r.palette === "object" ? r.palette : {}) as Record<string, unknown>;
  const palette: ImageRecipe["palette"] = {};
  for (const k of ["bg", "text", "accent", "accent2"] as const) if (isHex(pal[k])) palette[k] = String(pal[k]).trim();
  return {
    command,
    kind,
    subject,
    items: (Array.isArray(r.items) ? r.items : []).map((i) => cleanFragment(i, 50)).filter(Boolean).slice(0, 8),
    markers: typeof r.markers === "number" ? Math.max(0, Math.min(9, Math.round(r.markers))) : 0,
    composition: cleanFragment(r.composition, 60) || undefined,
    style: cleanFragment(r.style, 60) || undefined,
    domain: isDomain(r.domain) ? r.domain : undefined,
    palette: Object.keys(palette).length ? palette : undefined,
    aspect: r.aspect === "1:1" ? "1:1" : "16:9",
    transparent: r.transparent === true,
  };
}
