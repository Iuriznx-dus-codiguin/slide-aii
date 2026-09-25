// Resolução de cenas (motor criativo v2) — pura, determinística e testável.
//
// Recebe o que a IA escreveu (conteúdo + bloco visual escolhido entre os
// candidatos do Plano Visual) e devolve slides prontos para gravar:
//
//   1. valida cada bloco visual contra o registro de comandos e o plano, com
//      uma cadeia de fallback que NUNCA deixa slide vazio ou quebrado
//      (PIPELINE com < 3 etapas → SEQUENCE; SYSTEM_ARCHITECTURE sem arestas →
//      LAYERED_VIEW; dado insuficiente → layout de texto atual);
//   2. decide a mídia (foto real, IA ou desenho nativo) dentro do orçamento;
//   3. deriva animation_intent (tipo, comando, ato), layout, fundo, preset de
//      movimento e acentos, e grava o modo de transição como hoje;
//   4. roda a parte de servidor do Quality Gate (capacidade de texto, ritmo);
//   5. monta a lista de ativos SÓ para slides cujo layout exibe mídia — a
//      mesma regra que o renderer usa (sceneMedia.slideDisplaysMedia).
//
// Nenhuma chamada de rede, nenhuma aleatoriedade: mesmo input → mesmo deck.

import { accentsFor } from "./slideComposition.ts";
import { analyzeItems, resolveCommandChain, sanitizeVisual, checkCommand, type SceneVisual } from "./visualBlock.ts";
import { getCommand, needsMedia, siblingsOf, type SceneLayout, type VisualCommandSpec, type VisualComponent } from "./visualCommands.ts";
import { allowedByOptions, needsAi, PHOTO_SHARE_CAP, stableHash, type DeckPlan } from "./visualPlanner.ts";
import { motionForTextSlide, type MotionSpec } from "./motionPresets.ts";
import {
  IMAGE_COVER_VARIANTS,
  mediaAspectFor,
  SCENE_ENGINE_VERSION,
  slideDisplaysMedia,
  type BackgroundKind,
  type SceneBackgroundSpec,
  type SlideAsset,
} from "./sceneMedia.ts";
import { assessRhythm, fitTextToLayout } from "./qualityGate.ts";
import { trimChars, wordCount, type TextDepth } from "./textMetrics.ts";
import { normalizeKeyObjects, type Domain, type NarrativeActName } from "./sceneCatalog.ts";
import type { BudgetMode } from "./modelRegistry.ts";
import type { ImageRecipe } from "./imageDirector.ts";

export const SLIDE_TYPES = [
  "title_slide", "content", "bullet_points", "quote", "image_text", "data_chart", "section_divider", "conclusion",
] as const;

export const COVER_VARIANTS = [
  "split-hero", "typographic-bold", "full-bleed-image", "minimal-centered", "asymmetric-grid", "gradient-mesh",
] as const;

export interface ResolverOptions {
  preferDynamic: boolean;
  includeImages: boolean;
  includeCharts: boolean;
  budgetMode: BudgetMode;
  textDepth: TextDepth;
  palette: { bg: string; text: string; accent: string; accent2?: string };
  title: string;
}

export interface ResolverBrief {
  domain?: Domain;
  visual_style?: string;
  element_density?: string;
  minimalism_degree?: number;
  creativity_degree?: number;
}

export interface ResolveInput {
  aiSlides: (Record<string, unknown> | undefined)[];
  plan: DeckPlan;
  beats: { narrative_act: NarrativeActName; key_objects?: string[] }[];
  brief: ResolverBrief;
  options: ResolverOptions;
}

export interface ResolvedSlide {
  slide_type: string;
  layout_template: string;
  speaker_notes: string | null;
  content: Record<string, unknown>;
  presenters_data?: unknown;
}

export interface ResolveReport {
  commands: (string | null)[];
  render_modes: (string | null)[];
  fallbacks: { index: number; chain: string[]; reason?: string }[];
  off_plan: number[];
  repeat_swaps: number[];
  rhythm_rescues: { index: number; how: "photo" | "concept" }[];
  text_only: number[];
  text_only_share: number;
  max_text_run: number;
  trims: number;
  images_requested: { pexels: number; ai: number };
  images_displayed: number;
  ai_visuals_used: number;
}

// ────────────────────────────────────────────────────────────────
// Saneamento do texto vindo da IA
// ────────────────────────────────────────────────────────────────

const str = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  // eslint-disable-next-line no-control-regex -- remove caracteres de controle de propósito
  const s = String(v).replace(/[\u0000-\u0008\u000b-\u001f]+/g, " ").replace(/[ \t]{2,}/g, " ").trim();
  return s ? s.slice(0, max) : undefined;
};

const strList = (v: unknown, maxItems: number, maxLen: number): string[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const out = v.map((x) => str(x, maxLen)).filter((x): x is string => !!x).slice(0, maxItems);
  return out.length ? out : undefined;
};

interface BaseText {
  headline?: string;
  subtitle?: string;
  body_text?: string;
  bullets?: string[];
  stat_value?: string;
  stat_label?: string;
  quote_text?: string;
  quote_author?: string;
  speaker_notes?: string;
  image_query?: string;
}

function baseText(ai: Record<string, unknown>): BaseText {
  return {
    headline: str(ai.headline, 140),
    subtitle: str(ai.subtitle, 260),
    body_text: str(ai.body_text, 2000),
    bullets: strList(ai.bullets, 8, 320),
    stat_value: str(ai.stat_value, 24),
    stat_label: str(ai.stat_label, 220),
    quote_text: str(ai.quote_text, 600),
    quote_author: str(ai.quote_author, 140),
    speaker_notes: str(ai.speaker_notes, 1600),
    image_query: str(ai.image_query, 120),
  };
}

// ────────────────────────────────────────────────────────────────
// Derivações determinísticas
// ────────────────────────────────────────────────────────────────

const DATA_COMPONENTS: VisualComponent[] = ["DataScene"];

/** animation_intent a partir do tipo, do comando e do ato — nunca mais escrito pela IA. */
export function deriveAnimationIntent(
  slideType: string,
  command: string | null,
  act: NarrativeActName | undefined,
  hasStat: boolean,
): string {
  if (slideType === "title_slide") return "hero-impact";
  if (slideType === "quote") return "quote-spotlight";
  if (slideType === "section_divider") return "section-break";
  const spec = command ? getCommand(command) : undefined;
  if (spec && (DATA_COMPONENTS.includes(spec.component) || spec.dataVisual)) return "data-reveal";
  if (!spec && hasStat) return "emphasis-stat";
  if (act === "climax") return "hero-impact";
  if (act === "proof") return spec ? "data-reveal" : hasStat ? "emphasis-stat" : "narrative-build";
  if (act === "tension") return "calm-fade";
  return "narrative-build";
}

// Alternativas equivalentes quando o mesmo intent se repetiria em sequência
// (o modo clássico escolhe a transição por intent: repetir = monotonia).
const INTENT_ALTERNATIVE: Record<string, string> = {
  "narrative-build": "calm-fade",
  "calm-fade": "narrative-build",
  "data-reveal": "emphasis-stat",
  "emphasis-stat": "data-reveal",
  "hero-impact": "narrative-build",
  "quote-spotlight": "calm-fade",
  "section-break": "calm-fade",
};

/** Layouts do desenho nativo de um híbrido sem mídia. */
const NATIVE_TWIN_LAYOUTS: Partial<Record<VisualComponent, readonly SceneLayout[]>> = {
  LayerStack: ["two-columns", "visual-hero", "image-right", "image-left"],
  ConceptMap: ["visual-hero", "two-columns", "diagram-full"],
};

const SIDE_LAYOUTS = new Set(["image-left", "image-right"]);

function pickLayout(options: readonly string[], recent: string[], bodyWords: number, lastSide: string | null): string {
  let pool = [...options];
  // Muito corpo de texto pede o layout com mais área de texto.
  if (bodyWords > 60) {
    const roomy = pool.filter((l) => l === "two-columns" || SIDE_LAYOUTS.has(l));
    if (roomy.length) pool = [...roomy, ...pool.filter((l) => !roomy.includes(l))];
  }
  // Alterna o lado da mídia.
  if (lastSide) {
    const other = lastSide === "image-left" ? "image-right" : "image-left";
    pool = pool.map((l) => (l === lastSide && pool.includes(other) ? other : l));
    pool = Array.from(new Set(pool));
  }
  return pool.find((l) => !recent.includes(l)) ?? pool[0] ?? "visual-hero";
}

function pickTextLayout(t: BaseText, slideType: string, recent: string[]): string {
  if (t.quote_text) return "quote";
  if (t.stat_value) return "stat-highlight";
  if (slideType === "section_divider") return "centered";
  const bullets = t.bullets?.length ?? 0;
  const short = wordCount(t.body_text) < 40 && bullets === 0;
  const order = bullets >= 4 ? ["two-columns", "title-content", "centered"]
    : short ? ["centered", "title-content", "two-columns"]
    : ["title-content", "two-columns", "centered"];
  return order.find((l) => !recent.includes(l)) ?? order[0];
}

/** Fundo por brief, ato e tipo de visual. Geometria é estrutura, não ruído. */
export function pickBackground(
  act: NarrativeActName | undefined,
  brief: ResolverBrief,
  opts: { mediaKind: SlideAsset["kind"] | null; component: VisualComponent | null; layout: string; index: number },
): SceneBackgroundSpec {
  const minimal = (brief.minimalism_degree ?? 0.5) >= 0.65;
  const creative = (brief.creativity_degree ?? 0.5) >= 0.6;
  const intensity = minimal ? 0.22 : creative ? 0.45 : 0.32;
  let kind: BackgroundKind;
  if (opts.mediaKind === "cutout") kind = "spotlight";
  else if (opts.layout === "full-image") kind = "solid";
  else if (opts.component && ["SystemDiagram", "FlowDiagram", "TimelineDiagram", "DataScene"].includes(opts.component)) {
    kind = minimal ? "solid" : "grid";
  } else if (act === "hook" || act === "climax") kind = creative ? "aurora" : "gradient-mesh";
  else if (act === "tension") kind = "grain";
  else if (act === "proof") kind = minimal ? "solid" : "grid";
  else kind = minimal ? "solid" : opts.index % 2 === 0 ? "gradient-mesh" : "grain";
  return { kind, intensity };
}

/** Variante sem imagem equivalente a cada capa com imagem. */
const NO_IMAGE_COVER: Record<string, string> = {
  "split-hero": "asymmetric-grid",
  "full-bleed-image": "gradient-mesh",
};

const anchorKeyOf = (s: string | undefined): string | undefined => {
  if (!s) return undefined;
  const k = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return k || undefined;
};

// ────────────────────────────────────────────────────────────────
// Ativos (compartilhado com o painel Visual do Editor)
// ────────────────────────────────────────────────────────────────

export interface AssetContext {
  palette: { bg: string; text: string; accent: string; accent2?: string };
  style?: string;
  domain?: Domain;
  budgetMode: BudgetMode;
  /** Sujeito de reserva quando o bloco não traz subject. */
  fallbackSubject: string;
}

/** Receita do Image Director para o bloco visual de um comando com mídia. */
export function recipeForVisual(spec: VisualCommandSpec, visual: SceneVisual, ctx: AssetContext, aspect: "16:9" | "1:1" = "16:9"): ImageRecipe {
  const cutout = spec.imageRecipe === "cutout" || spec.imageRecipe === "technical";
  return {
    command: spec.id,
    kind: spec.imageRecipe ?? "illustration",
    subject: visual.subject ?? ctx.fallbackSubject,
    items: visual.items.filter((it) => !(it.from && it.to)).map((it) => it.label).filter(Boolean),
    markers: spec.renderMode === "hybrid" ? Math.min(9, visual.items.length) : 0,
    composition: visual.composition,
    transparent: cutout,
    aspect,
    style: ctx.style,
    domain: ctx.domain,
    palette: ctx.palette,
  };
}

/** Ativo de IA pendente para o bloco (vista técnica, recorte, metáfora…). */
export function aiAssetFor(spec: VisualCommandSpec, visual: SceneVisual, ctx: AssetContext, layout?: string): SlideAsset {
  const cutout = spec.imageRecipe === "cutout" || spec.imageRecipe === "technical";
  const kind: SlideAsset["kind"] = cutout ? "cutout" : "illustration";
  const aspect = mediaAspectFor(layout, kind);
  return { status: "pending", source: "ai", kind, aspect, budget_mode: ctx.budgetMode, recipe: recipeForVisual(spec, visual, ctx, aspect) };
}

/** Ativo de foto real pendente (Pexels primeiro; IA só se permitido). */
export function photoAssetFor(spec: VisualCommandSpec, visual: SceneVisual, ctx: AssetContext, query: string, allowAi: boolean): SlideAsset {
  return {
    status: "pending", source: "pexels", kind: "photo", aspect: "16:9", query,
    allow_ai_fallback: allowAi && ctx.budgetMode !== "economy",
    budget_mode: ctx.budgetMode,
    recipe: recipeForVisual(spec, visual, ctx, "16:9"),
  };
}

// ────────────────────────────────────────────────────────────────
// Resolução
// ────────────────────────────────────────────────────────────────

export function resolveScenes(input: ResolveInput): { slides: ResolvedSlide[]; report: ResolveReport } {
  const { plan, beats, brief, options } = input;
  const n = plan.slides.length;
  const economy = options.budgetMode === "economy";
  const contentCount = Math.max(0, n - 1);
  const photoCap = options.includeImages ? Math.ceil(contentCount * PHOTO_SHARE_CAP) : 0;
  let photosUsed = 0;
  let aiUsed = 0;
  const report: ResolveReport = {
    commands: [], render_modes: [], fallbacks: [], off_plan: [], repeat_swaps: [], rhythm_rescues: [],
    text_only: [], text_only_share: 0, max_text_run: 0, trims: 0,
    images_requested: { pexels: 0, ai: 0 }, images_displayed: 0, ai_visuals_used: 0,
  };

  const style = str(brief.visual_style, 60);
  const recipeBase = { style, domain: brief.domain, palette: options.palette };
  const transition = options.preferDynamic ? "dynamic" : "fade";

  const out: ResolvedSlide[] = [];
  const layouts: string[] = [];
  let lastSide: string | null = null;
  let prevCommand: string | null = null;
  let prevIntent: string | null = null;
  let listToFlowUsed = false;

  const canServePhoto = (spec: VisualCommandSpec, planned: boolean) =>
    !!spec.photoEligible && options.includeImages && (planned || photosUsed < photoCap);
  const canServeAi = (planned: boolean) =>
    options.includeImages && !economy && (planned || aiUsed < plan.maxAiVisuals);

  for (let i = 0; i < n; i++) {
    const ai = input.aiSlides[i] ?? {};
    const sp = plan.slides[i];
    const beat = beats[i];
    const keyObjects = normalizeKeyObjects(beat?.key_objects);
    const t = baseText(ai);
    const recent = layouts.slice(-2);

    // ── Capa ────────────────────────────────────────────────────────────
    if (i === 0) {
      const aiVariant = str(ai.cover_variant, 40);
      let cover_variant: string = aiVariant && (COVER_VARIANTS as readonly string[]).includes(aiVariant)
        ? aiVariant
        : COVER_VARIANTS[Math.floor(stableHash(options.title) * COVER_VARIANTS.length)];
      // Quality Gate: sem imagens, uma capa desenhada para foto ficaria com o
      // slot vazio — vai para a variante tipográfica equivalente (só no v2).
      if (!options.includeImages) cover_variant = NO_IMAGE_COVER[cover_variant] ?? cover_variant;
      const content: Record<string, unknown> = {
        engine_version: SCENE_ENGINE_VERSION,
        headline: t.headline ?? options.title,
        subtitle: t.subtitle,
        body_text: t.body_text,
        cover_variant,
        image_url: null,
        narrative_act: beat?.narrative_act ?? "hook",
        animation_intent: "hero-impact",
        motion: { preset: "hero" } satisfies MotionSpec,
        transition,
        visual_accents: accentsFor({ slide_type: "title_slide", animation_intent: "hero-impact" }, 0, brief.element_density),
      };
      const shows = (IMAGE_COVER_VARIANTS as readonly string[]).includes(cover_variant);
      if (shows && options.includeImages) {
        const subject = keyObjects[0] ?? t.headline ?? options.title;
        const query = t.image_query ?? keyObjects[0] ?? options.title;
        content.image_query = query;
        content.asset = {
          status: "pending", source: "pexels", kind: "photo", aspect: "16:9", query,
          allow_ai_fallback: !economy && aiUsed < plan.maxAiVisuals,
          budget_mode: options.budgetMode,
          recipe: { command: "COVER", kind: "scene", subject, aspect: "16:9", ...recipeBase } satisfies ImageRecipe,
        } satisfies SlideAsset;
      }
      out.push({ slide_type: "title_slide", layout_template: "split-hero", speaker_notes: t.speaker_notes ?? null, content });
      layouts.push("split-hero");
      report.commands.push(null);
      report.render_modes.push(null);
      prevIntent = "hero-impact";
      continue;
    }

    // ── Bloco visual ────────────────────────────────────────────────────
    let slideType = str(ai.slide_type, 30) ?? "content";
    if (!(SLIDE_TYPES as readonly string[]).includes(slideType) || slideType === "title_slide") slideType = "content";

    const rawVisual = sanitizeVisual(ai.visual);
    let visual: SceneVisual | null = rawVisual ? { ...rawVisual } : null;

    const allowed = (spec: VisualCommandSpec): boolean => {
      if (!allowedByOptions(spec, options)) return false;
      if (!needsMedia(spec)) return true;
      if (spec.nativeComponent) return true; // desenha nativo se faltar mídia
      if (canServePhoto(spec, sp.photo)) return true;
      return needsAi(spec) || spec.photoEligible ? canServeAi(sp.aiVisual) : false;
    };

    // Validação contra o plano: comando fora dos candidatos é trocado pelo
    // primeiro candidato que aceita os MESMOS itens.
    if (visual && sp.candidates.length && !sp.candidates.includes(visual.command)) {
      const coerced = sp.candidates.find((id) => {
        const spec = getCommand(id);
        return !!spec && allowed(spec) && checkCommand(spec, { ...visual!, command: id }).ok;
      });
      if (coerced) visual.command = coerced;
      else report.off_plan.push(i);
    }

    let chainInfo: { chain: string[]; reason?: string } | null = null;
    if (visual) {
      const res = resolveCommandChain(visual, allowed);
      if (res.fallbacks.length || !res.visual) chainInfo = { chain: res.fallbacks, reason: res.reason };
      visual = res.visual;
    }

    // Nenhum comando repetido em sequência: troca por um irmão que aceite os itens.
    if (visual && visual.command === prevCommand) {
      const current: SceneVisual = visual;
      const sibling: VisualCommandSpec | undefined = siblingsOf(current.command)
        .find((s) => allowed(s) && checkCommand(s, { ...current, command: s.id }).ok);
      if (sibling) {
        visual = { ...visual, command: sibling.id };
        report.repeat_swaps.push(i);
      }
    }
    if (chainInfo) report.fallbacks.push({ index: i, ...chainInfo });

    // ── Mídia ───────────────────────────────────────────────────────────
    let asset: SlideAsset | undefined;
    const spec = visual ? getCommand(visual.command)! : undefined;
    if (visual && spec) {
      let mode = spec.renderMode;
      if (needsMedia(spec)) {
        const assetCtx: AssetContext = {
          palette: options.palette, style, domain: brief.domain, budgetMode: options.budgetMode,
          fallbackSubject: keyObjects[0] ?? t.headline ?? options.title,
        };
        if (canServePhoto(spec, sp.photo)) {
          photosUsed++;
          const query = t.image_query || keyObjects.join(" ") || visual.subject || t.headline || options.title;
          asset = photoAssetFor(spec, visual, assetCtx, query, !economy && canServeAi(false));
        } else if (canServeAi(sp.aiVisual)) {
          aiUsed++;
          asset = aiAssetFor(spec, visual, assetCtx);
        } else {
          mode = "native"; // desenho nativo fiel (nativeComponent)
        }
      }
      visual.render_mode = mode;
    }

    // Dado insuficiente num visual de dados com UM número: vira destaque de stat.
    if (!visual && rawVisual && !t.stat_value) {
      const nums = rawVisual.items.filter((it) => it.value !== undefined);
      if (nums.length === 1) {
        t.stat_value = `${nums[0].value}${nums[0].unit ?? ""}`;
        t.stat_label = t.stat_label ?? nums[0].detail ?? nums[0].label;
      }
    }

    // ── Layout ──────────────────────────────────────────────────────────
    let layout: string;
    if (visual && spec) {
      const twin = visual.render_mode === "native" && spec.nativeComponent ? NATIVE_TWIN_LAYOUTS[spec.nativeComponent] : undefined;
      const choices = twin ?? spec.layouts;
      layout = pickLayout(choices, recent, wordCount(t.body_text), lastSide);
      if (asset) asset.aspect = mediaAspectFor(layout, asset.kind);
      if (asset?.recipe) asset.recipe.aspect = asset.aspect;
    } else {
      layout = pickTextLayout(t, slideType, recent);
    }
    if (SIDE_LAYOUTS.has(layout)) lastSide = layout;

    // ── Derivações ──────────────────────────────────────────────────────
    let intent = deriveAnimationIntent(slideType, visual?.command ?? null, beat?.narrative_act, !!t.stat_value);
    if (intent === prevIntent) intent = INTENT_ALTERNATIVE[intent] ?? intent;
    prevIntent = intent;

    let motion: MotionSpec;
    if (visual && spec) {
      const preset = visual.render_mode === "native" && spec.renderMode !== "native"
        ? (spec.nativeComponent === "LayerStack" ? "stack-build" : "hub-radiate")
        : spec.motion;
      motion = { preset };
      // Uma assinatura por deck: a primeira lista curta vira o diagrama.
      if (!listToFlowUsed && spec.component === "FlowDiagram" && options.preferDynamic && visual.items.length <= 5) {
        motion = { preset: "list-to-flow" };
        listToFlowUsed = true;
      }
    } else {
      motion = motionForTextSlide(intent, slideType);
    }

    const background = pickBackground(beat?.narrative_act, brief, {
      mediaKind: asset?.kind ?? null,
      component: visual && spec ? (visual.render_mode === "native" && spec.nativeComponent ? spec.nativeComponent : spec.component) : null,
      layout,
      index: i,
    });

    // Com bloco visual: no máximo um acento, de baixa intensidade.
    const hasVisual = !!visual || !!asset;
    const visual_accents = accentsFor({ slide_type: slideType, animation_intent: intent, hasImage: hasVisual }, i, brief.element_density);

    // ── Quality Gate (servidor): texto cabe na caixa do layout ──────────
    const fit = fitTextToLayout(
      { ...t, items: visual?.items.filter((it) => !(it.from && it.to)) },
      layout,
      !!visual,
      options.textDepth,
    );
    report.trims += fit.trims;
    const fitted = fit.value;
    if (visual && fitted.items) {
      // Recoloca os itens ajustados preservando as arestas.
      const nodes = fitted.items;
      let k = 0;
      visual.items = visual.items.map((it) => (it.from && it.to ? it : nodes[k++] ?? it));
    }

    const content: Record<string, unknown> = {
      engine_version: SCENE_ENGINE_VERSION,
      headline: fitted.headline,
      subtitle: fitted.subtitle,
      body_text: fitted.body_text,
      bullets: fitted.bullets,
      stat_value: fitted.stat_value,
      stat_label: fitted.stat_label,
      quote_text: fitted.quote_text,
      quote_author: fitted.quote_author,
      image_url: null,
      narrative_act: beat?.narrative_act,
      animation_intent: intent,
      transition,
      visual_accents,
      background,
      motion,
    };
    if (visual) content.visual = visual;
    if (asset) {
      content.asset = asset;
      if (asset.query) content.image_query = asset.query;
    }

    out.push({ slide_type: slideType, layout_template: layout, speaker_notes: fitted.speaker_notes ?? null, content });
    layouts.push(layout);
    prevCommand = visual?.command ?? null;
    report.commands.push(visual?.command ?? null);
    report.render_modes.push(visual?.render_mode ?? null);
  }

  // ── Ritmo do deck: ≤2 só-texto seguidos e ≤30% do deck ────────────────
  const isTextOnly = (s: ResolvedSlide, i: number) =>
    i > 0 && !s.content.visual && !s.content.asset && s.layout_template !== "stat-highlight";
  const rhythm = assessRhythm(out.map(isTextOnly));
  for (const i of rhythm.violations) {
    const s = out[i];
    const c = s.content;
    const keyObjects = normalizeKeyObjects(beats[i]?.key_objects);
    const query = (c.image_query as string | undefined) ?? (keyObjects.length ? keyObjects.join(" ") : undefined);
    if (options.includeImages && query && photosUsed < photoCap + 1) {
      photosUsed++;
      c.background = { kind: "photo-duotone", intensity: 0.55 } satisfies SceneBackgroundSpec;
      c.image_query = query;
      c.asset = {
        status: "pending", source: "pexels", kind: "photo", aspect: "16:9", query,
        allow_ai_fallback: false,
        budget_mode: options.budgetMode,
      } satisfies SlideAsset;
      report.rhythm_rescues.push({ index: i, how: "photo" });
      continue;
    }
    const bullets = (c.bullets as string[] | undefined) ?? [];
    if (bullets.length >= 3 && c.headline) {
      const concept: SceneVisual = {
        intent: "EXPLAIN",
        command: "CONCEPTUAL_MODEL",
        subject: trimChars(String(c.headline), 60),
        items: bullets.slice(0, 6).map((b) => {
          const [head, ...rest] = b.split(/[:—–-]\s+/);
          return rest.length ? { label: trimChars(head, 28), detail: rest.join(" ") } : { label: trimChars(b, 28), detail: b.length > 28 ? b : undefined };
        }),
        render_mode: "native",
      };
      if (checkCommand(getCommand("CONCEPTUAL_MODEL")!, concept).ok) {
        c.visual = concept;
        delete c.bullets;
        c.motion = { preset: "hub-radiate" } satisfies MotionSpec;
        s.layout_template = layouts[i - 1] === "visual-hero" ? "two-columns" : "visual-hero";
        c.visual_accents = accentsFor({ slide_type: s.slide_type, animation_intent: String(c.animation_intent), hasImage: true }, i, brief.element_density);
        report.commands[i] = "CONCEPTUAL_MODEL";
        report.render_modes[i] = "native";
        report.rhythm_rescues.push({ index: i, how: "concept" });
      }
    }
  }

  // ── Âncoras semânticas do magic move (só no modo dinâmico) ────────────
  if (options.preferDynamic) {
    const keys = out.map((s, i) => {
      const v = s.content.visual as SceneVisual | undefined;
      return i === 0 ? undefined : anchorKeyOf(v?.subject ?? normalizeKeyObjects(beats[i]?.key_objects)[0]);
    });
    for (let i = 2; i < n; i++) {
      if (keys[i] && keys[i] === keys[i - 1]) {
        out[i].content.anchor_key = keys[i];
        out[i - 1].content.anchor_key = keys[i];
      }
    }
  }

  // ── Métricas finais ───────────────────────────────────────────────────
  const finalRhythm = assessRhythm(out.map(isTextOnly));
  report.text_only = finalRhythm.textOnly;
  report.text_only_share = +finalRhythm.share.toFixed(3);
  report.max_text_run = finalRhythm.maxRun;
  for (const s of out) {
    const a = s.content.asset as SlideAsset | undefined;
    if (a) report.images_requested[a.source]++;
    if (a && slideDisplaysMedia(s)) report.images_displayed++;
  }
  report.ai_visuals_used = aiUsed;
  return { slides: out, report };
}

/** Pedido de mídia deste slide, se houver (usado pela persistência e pelas métricas). */
export function assetOf(slide: ResolvedSlide): SlideAsset | undefined {
  return slide.content.asset as SlideAsset | undefined;
}

// Reexporta para quem só precisa validar blocos (chat-editor, Editor).
export { analyzeItems };
