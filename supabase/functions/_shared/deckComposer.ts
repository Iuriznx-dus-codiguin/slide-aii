// Composição do deck do motor principal (v1) — pura, determinística e testável.
//
// O v1 pedia à IA, em todo slide, campos que o código sobrescrevia ou nunca
// lia (layout, acentos, animação, ato narrativo, estilo e prompt de imagem) e
// depois sorteava o modelo de página SEM olhar o conteúdo: saíam slides
// "citação" sem citação, "seção" que escondia os bullets, gráfico com
// "Gráficos & dados" desligado e foto buscada para slide que não a exibia.
//
// Agora a IA escreve o conteúdo e escolhe UM elemento protagonista por slide;
// este módulo decide o resto pelo próprio conteúdo, com o que o motor v2
// trouxe de melhor e já testado:
//   • diagramas nativos (linha do tempo, fluxo, ciclo, comparação, funil,
//     pirâmide, mapa conceitual) validados pela cadeia de fallback do v2 e
//     desenhados pelo compositor de cenas (SceneSlide) — custo zero de imagem,
//     texto editável e animado;
//   • gráficos saneados (novos tipos e número em destaque, ver chartSpec.ts);
//   • capa com o título do usuário e a imagem mais literal do tema; sem
//     imagens, a capa vai para uma variante tipográfica (nunca slot vazio);
//   • imagem só onde o layout exibe (pedidas = exibidas), foto real primeiro;
//   • texto que não cabe vai para as notas do orador, nunca some.
// O formulário manda: tipo, tema, gráficos, imagens, slide dinâmico e
// profundidade dos textos.

import { accentsFor } from "./slideComposition.ts";
import { checkCommand, resolveCommandChain, sanitizeVisual, type SceneVisual } from "./visualBlock.ts";
import { getCommand, type VisualCommandSpec, type VisualComponent } from "./visualCommands.ts";
import {
  COVER_VARIANTS,
  deriveAnimationIntent,
  INTENT_ALTERNATIVE,
  NO_IMAGE_COVER,
  pickBackground,
  SLIDE_TYPES,
  str,
  strList,
} from "./sceneResolver.ts";
import { SCENE_ENGINE_VERSION, type SlideAsset } from "./sceneMedia.ts";
import { fitTextToLayout } from "./qualityGate.ts";
import { wordCount, type TextDepth } from "./textMetrics.ts";
import { chartToBullets, sanitizeChart, type ChartSpec } from "./chartSpec.ts";
import { stableHash } from "./visualPlanner.ts";
import type { MotionSpec } from "./motionPresets.ts";
import type { BudgetMode } from "./modelRegistry.ts";
import type { ImageRecipe } from "./imageDirector.ts";
import type { Domain, NarrativeActName } from "./sceneCatalog.ts";

/** Diagramas que o motor principal oferece à IA (nativos, sem mídia e sem dado). */
export const V1_VISUAL_COMMANDS = [
  "TIMELINE", "PROCESS_FLOW", "STEP_BY_STEP", "CYCLE", "SIDE_BY_SIDE", "BEFORE_AFTER", "FUNNEL", "PYRAMID", "CONCEPTUAL_MODEL",
] as const;

/** Contrato compacto de cada diagrama, enviado no prompt. */
export const V1_VISUAL_CONTRACTS: Record<(typeof V1_VISUAL_COMMANDS)[number], string> = {
  TIMELINE: "3-7 eventos em ordem cronológica; label = data ou período; detail = o que aconteceu",
  PROCESS_FLOW: "3-6 etapas em ordem; label = etapa; detail = o que acontece nela",
  STEP_BY_STEP: "3-6 passos numerados; label = ação; detail = como fazer",
  CYCLE: "3-6 fases que se repetem em ciclo; label = fase; detail",
  SIDE_BY_SIDE: "2-3 lados comparados; label = nome do lado; detail = descrição",
  BEFORE_AFTER: "2 itens (antes, depois); label + detail",
  FUNNEL: "3-6 estágios do mais amplo ao mais estreito; label, detail, value opcional",
  PYRAMID: "3-6 níveis do topo à base; label, detail",
  CONCEPTUAL_MODEL: "subject = conceito central; 3-6 ideias ligadas a ele (label, detail)",
};

/** Diagrama nativo aceito no v1 (também os fallbacks da cadeia, como SEQUENCE). */
export const isV1Diagram = (spec: VisualCommandSpec): boolean =>
  spec.mvp && spec.renderMode === "native" && !spec.dataVisual && spec.itemShape !== "graph";

/** Modelos de página por componente: o primeiro é o preferido; o segundo evita repetição. */
const DIAGRAM_LAYOUTS: Partial<Record<VisualComponent, string[]>> = {
  TimelineDiagram: ["diagram-full", "title-content"],
  FlowDiagram: ["diagram-full", "visual-hero"],
  ComparisonDiagram: ["diagram-full", "visual-hero"],
  CycleDiagram: ["visual-hero", "two-columns"],
  FunnelDiagram: ["visual-hero", "two-columns"],
  PyramidDiagram: ["visual-hero", "two-columns"],
  ConceptMap: ["visual-hero", "two-columns"],
};

const IMAGE_COVERS = ["split-hero", "full-bleed-image"] as const;
const TEXT_COVERS = ["typographic-bold", "minimal-centered", "asymmetric-grid", "gradient-mesh"] as const;

/** Fração máxima de slides de conteúdo com foto (os demais variam entre diagrama, dado e texto). */
export const PHOTO_SHARE = 0.45;

export interface ComposeOptions {
  /** Título final da apresentação (o do usuário, corrigido). */
  title: string;
  includeImages: boolean;
  includeCharts: boolean;
  preferDynamic: boolean;
  budgetMode: BudgetMode;
  textDepth: TextDepth;
  palette: { bg: string; text: string; accent: string; accent2?: string };
}

export interface ComposeBrief {
  domain?: Domain;
  visual_style?: string;
  element_density?: string;
  minimalism_degree?: number;
  creativity_degree?: number;
}

export interface ComposeInput {
  /** Slides da IA por posição (buracos já preenchidos pelo roteiro). */
  aiSlides: (Record<string, unknown> | undefined)[];
  beats: { narrative_act: NarrativeActName; key_message?: string; key_objects?: string[] }[];
  brief: ComposeBrief;
  options: ComposeOptions;
}

export interface ComposedSlide {
  slide_type: string;
  layout_template: string;
  speaker_notes: string | null;
  content: Record<string, unknown>;
}

export type SlideElement = "cover" | "visual" | "chart" | "quote" | "stat" | "photo" | "text";

export interface ComposeReport {
  elements: SlideElement[];
  layouts: string[];
  visuals: (string | null)[];
  charts: (string | null)[];
  photos: number;
  dropped: { charts_disabled: number; invalid_charts: number; invalid_visuals: number; photos_over_cap: number; images_disabled: number };
  trims: number;
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

const words = (s: string | undefined) => wordCount(s);

const appendNotes = (notes: string | undefined, extra: string | undefined): string | undefined => {
  const e = extra?.trim();
  if (!e) return notes;
  return notes ? `${notes}\n\n${e}` : e;
};

function coverVariant(raw: unknown, includeImages: boolean, title: string): string {
  const v = typeof raw === "string" ? raw : "";
  const h = Math.floor(stableHash(title) * 1000);
  if (includeImages) {
    // Com imagens a capa SEMPRE mostra o símbolo do tema.
    return (IMAGE_COVERS as readonly string[]).includes(v) ? v : IMAGE_COVERS[h % IMAGE_COVERS.length];
  }
  if ((TEXT_COVERS as readonly string[]).includes(v)) return v;
  return NO_IMAGE_COVER[v] ?? TEXT_COVERS[h % TEXT_COVERS.length];
}

function photoAsset(query: string, subject: string, opts: ComposeOptions, brief: ComposeBrief, command: "COVER" | "PHOTO"): SlideAsset {
  const recipe: ImageRecipe = {
    command,
    kind: "scene",
    subject: subject.slice(0, 160),
    aspect: "16:9",
    style: brief.visual_style,
    domain: brief.domain,
    palette: opts.palette,
  };
  return {
    status: "pending",
    source: "pexels",
    kind: "photo",
    aspect: "16:9",
    query,
    // Foto real primeiro; IA só se a Pexels não achar (nunca no modo economia).
    allow_ai_fallback: opts.budgetMode !== "economy",
    budget_mode: opts.budgetMode,
    recipe,
  };
}

/** Diagrama válido para o v1, já pela cadeia de fallback do motor de cenas. */
function resolveDiagram(raw: unknown): { visual: SceneVisual | null; invalid: boolean } {
  const clean = sanitizeVisual(raw);
  if (!clean) return { visual: null, invalid: raw !== undefined && raw !== null };
  const res = resolveCommandChain(clean, isV1Diagram);
  if (!res.visual) return { visual: null, invalid: true };
  return { visual: { ...res.visual, render_mode: "native" }, invalid: false };
}

/** Itens de um diagrama recusado viram bullets (o conteúdo nunca some). */
const itemsToBullets = (raw: unknown): string[] => {
  const items = (raw as { items?: unknown[] } | null)?.items;
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => {
      const r = it as { label?: unknown; detail?: unknown };
      const label = str(r?.label, 60);
      const detail = str(r?.detail, 200);
      return label && detail ? `${label}: ${detail}` : label ?? detail;
    })
    .filter((x): x is string => !!x)
    .slice(0, 6);
};

function textLayout(t: { bullets?: string[]; body_text?: string }, aiType: string, prev: string | undefined): string {
  const bullets = t.bullets?.length ?? 0;
  const body = words(t.body_text);
  const options: string[] = [];
  if (aiType === "section_divider" && bullets === 0 && body <= 45) options.push("centered");
  if (bullets >= 4) options.push("two-columns", "title-content");
  else if (bullets === 0 && body < 40) options.push("centered", "title-content");
  else options.push("title-content", "two-columns");
  return options.find((l) => l !== prev) ?? options[0];
}

// ────────────────────────────────────────────────────────────────
// Composição
// ────────────────────────────────────────────────────────────────

export function composeDeck(input: ComposeInput): { slides: ComposedSlide[]; report: ComposeReport } {
  const { aiSlides, beats, brief, options } = input;
  const n = aiSlides.length;
  const contentCount = Math.max(0, n - 1);
  const photoCap = options.includeImages ? Math.max(1, Math.round(contentCount * PHOTO_SHARE)) : 0;
  const transition = options.preferDynamic ? "dynamic" : "fade";
  const report: ComposeReport = {
    elements: [], layouts: [], visuals: [], charts: [], photos: 0, trims: 0,
    dropped: { charts_disabled: 0, invalid_charts: 0, invalid_visuals: 0, photos_over_cap: 0, images_disabled: 0 },
  };
  const out: ComposedSlide[] = [];
  let prevLayout: string | undefined;
  let prevIntent: string | undefined;
  let lastSide = "image-left";
  let photos = 0;
  let contentPhotos = 0;

  for (let i = 0; i < n; i++) {
    const ai = aiSlides[i] ?? {};
    const beat = beats[i];
    const act = beat?.narrative_act;
    const aiType = str(ai.slide_type, 30) ?? "content";
    let notes = str(ai.speaker_notes, 1600);

    // ── Capa: o título do usuário e a imagem mais literal do tema ─────────
    if (i === 0) {
      const variant = coverVariant(ai.cover_variant, options.includeImages, options.title);
      const subtitle = str(ai.subtitle, 260);
      const content: Record<string, unknown> = {
        headline: options.title,
        ...(subtitle ? { subtitle } : {}),
        cover_variant: variant,
        image_url: null,
        narrative_act: act ?? "hook",
        animation_intent: "hero-impact",
        transition,
        visual_accents: accentsFor({ slide_type: "title_slide", animation_intent: "hero-impact" }, 0, brief.element_density),
      };
      if (options.includeImages) {
        const query = str(ai.image_query, 120) ?? options.title;
        content.image_query = query;
        content.image_strategy = "pexels";
        // A busca (inglês) vem primeiro; o título dá o contexto se a IA precisar gerar.
        content.asset = photoAsset(query, `${query} — ${options.title}`, options, brief, "COVER");
        photos++;
      } else if (ai.image_query) {
        report.dropped.images_disabled++;
      }
      out.push({ slide_type: "title_slide", layout_template: "split-hero", speaker_notes: notes ?? null, content });
      report.elements.push("cover");
      report.layouts.push("split-hero");
      report.visuals.push(null);
      report.charts.push(null);
      prevLayout = "split-hero";
      prevIntent = "hero-impact";
      continue;
    }

    // ── Texto saneado ─────────────────────────────────────────────────────
    let headline = str(ai.headline, 140);
    const subtitle = str(ai.subtitle, 260);
    let body_text = str(ai.body_text, 2000);
    let bullets = strList(ai.bullets, 8, 320);
    let stat_value = str(ai.stat_value, 24);
    let stat_label = str(ai.stat_label, 220);
    let quote_text = str(ai.quote_text, 600);
    const quote_author = str(ai.quote_author, 140);

    // ── Candidatos a protagonista ─────────────────────────────────────────
    const diagram = resolveDiagram(ai.visual);
    if (diagram.invalid) {
      report.dropped.invalid_visuals++;
      if (!bullets?.length) {
        const fromItems = itemsToBullets(ai.visual);
        if (fromItems.length) bullets = fromItems;
      }
    }
    let chart: ChartSpec | null = null;
    if (ai.chart) {
      if (!options.includeCharts) {
        report.dropped.charts_disabled++;
      } else {
        chart = sanitizeChart(ai.chart);
        if (!chart) report.dropped.invalid_charts++;
      }
    }
    const rawQuery = str(ai.image_query, 120);
    if (rawQuery && !options.includeImages) report.dropped.images_disabled++;
    const wantsPhoto = options.includeImages && !!rawQuery;

    // Um protagonista por slide: diagrama > gráfico > citação > número > foto > texto.
    let element: SlideElement = "text";
    if (diagram.visual) element = "visual";
    else if (chart) element = "chart";
    else if (quote_text && (aiType === "quote" || !bullets?.length)) element = "quote";
    else if (stat_value) element = "stat";
    else if (wantsPhoto) element = "photo";
    if (element === "photo" && contentPhotos >= photoCap) {
      element = stat_value ? "stat" : "text";
      report.dropped.photos_over_cap++;
    }
    // Elementos que perderam a disputa: a informação vai para as notas.
    if (element !== "quote" && quote_text) {
      notes = appendNotes(notes, `Citação: "${quote_text}"${quote_author ? ` — ${quote_author}` : ""}`);
      quote_text = undefined;
    }
    if (element !== "stat" && stat_value && element !== "text") {
      notes = appendNotes(notes, `Destaque: ${stat_value}${stat_label ? ` — ${stat_label}` : ""}`);
      stat_value = undefined;
      stat_label = undefined;
    }

    if (!headline) headline = (beat?.key_message ?? "").split(/\s+/).slice(0, 6).join(" ") || `Parte ${i + 1}`;
    // Slide nunca vazio: sem nenhum conteúdo além do título, usa a mensagem do roteiro.
    if (element === "text" && !body_text && !bullets?.length && !stat_value) {
      body_text = beat?.key_message || subtitle || undefined;
    }

    // ── Layout e conteúdo por protagonista ───────────────────────────────
    let layout: string;
    let slideType: string;
    const content: Record<string, unknown> = {};
    let visual: SceneVisual | null = null;
    let component: VisualComponent | null = null;

    switch (element) {
      case "visual": {
        visual = diagram.visual!;
        const spec = getCommand(visual.command)!;
        component = spec.component;
        const opts = DIAGRAM_LAYOUTS[spec.component] ?? ["visual-hero", "two-columns"];
        layout = opts.find((l) => l !== prevLayout) ?? opts[0];
        slideType = aiType === "conclusion" ? "conclusion" : aiType === "bullet_points" ? "bullet_points" : "content";
        break;
      }
      case "chart":
        layout = "data-chart";
        slideType = "data_chart";
        content.chart = chart;
        break;
      case "quote":
        layout = "quote";
        slideType = "quote";
        // O slide de citação mostra só a citação: o resto vai para as notas.
        if (bullets?.length) notes = appendNotes(notes, bullets.map((b) => `• ${b}`).join("\n"));
        if (body_text) notes = appendNotes(notes, body_text);
        bullets = undefined;
        body_text = undefined;
        break;
      case "stat": {
        // Com qualquer texto de apoio, o número vai para a coluna da direita do
        // two-columns: o stat-highlight mostra só o número e o rótulo.
        const rich = (bullets?.length ?? 0) > 0 || words(body_text) > 0;
        layout = rich ? "two-columns" : "stat-highlight";
        if (!stat_label) stat_label = subtitle ?? headline;
        slideType = "content";
        break;
      }
      case "photo": {
        const impact = !bullets?.length && words(body_text) === 0;
        if (impact && prevLayout !== "full-image") layout = "full-image";
        else {
          layout = lastSide === "image-right" ? "image-left" : "image-right";
          lastSide = layout;
        }
        slideType = "image_text";
        photos++;
        contentPhotos++;
        break;
      }
      default:
        layout = textLayout({ bullets, body_text }, aiType, prevLayout);
        slideType = layout === "centered" && aiType === "section_divider" ? "section_divider"
          : aiType === "conclusion" ? "conclusion"
          : aiType === "bullet_points" && (bullets?.length ?? 0) > 0 ? "bullet_points"
          : "content";
    }
    if (!(SLIDE_TYPES as readonly string[]).includes(slideType)) slideType = "content";

    // ── Quality Gate: o texto cabe na caixa; o excedente vai para as notas ─
    // Gráfico e número dividem a tela com o texto como uma coluna do two-columns.
    const sharesScreen = element === "chart" || (element === "stat" && layout === "two-columns");
    const hasVisual = element === "visual" || element === "photo" || sharesScreen;
    const fit = fitTextToLayout(
      {
        headline, subtitle, body_text, bullets, speaker_notes: notes,
        items: visual?.items.filter((it) => !(it.from && it.to)),
      },
      sharesScreen ? "two-columns" : layout,
      hasVisual,
      options.textDepth,
    );
    report.trims += fit.trims;
    const f = fit.value;
    if (visual && f.items) {
      let k = 0;
      const nodes = f.items;
      visual = { ...visual, items: visual.items.map((it) => (it.from && it.to ? it : nodes[k++] ?? it)) };
    }

    // ── Derivações (nunca escritas pela IA) ─────────────────────────────
    let intent = element === "chart" ? "data-reveal"
      : deriveAnimationIntent(slideType, visual?.command ?? null, act, element === "stat");
    if (intent === prevIntent) intent = INTENT_ALTERNATIVE[intent] ?? intent;

    Object.assign(content, {
      headline: f.headline,
      subtitle: f.subtitle,
      body_text: f.body_text,
      bullets: f.bullets,
      ...(element === "stat" ? { stat_value, stat_label } : {}),
      ...(element === "quote" ? { quote_text, quote_author } : {}),
      image_url: null,
      narrative_act: act,
      animation_intent: intent,
      transition,
      visual_accents: accentsFor({ slide_type: slideType, animation_intent: intent, hasImage: hasVisual }, i, brief.element_density),
    });

    if (element === "photo" && rawQuery) {
      content.image_query = rawQuery;
      content.image_strategy = "pexels";
      content.asset = photoAsset(rawQuery, `${rawQuery} — ${f.headline ?? options.title}`, options, brief, "PHOTO");
    }

    if (visual && component) {
      // Cena do motor de cenas (SceneSlide): o mesmo compositor testado no v2.
      content.engine_version = SCENE_ENGINE_VERSION;
      content.visual = visual;
      content.motion = { preset: getCommand(visual.command)!.motion } satisfies MotionSpec;
      content.background = pickBackground(act, brief, { mediaKind: null, component, layout, index: i });
    }

    // Sem chaves vazias no jsonb (o renderer trata ausente e undefined igual).
    for (const k of Object.keys(content)) if (content[k] === undefined) delete content[k];

    out.push({ slide_type: slideType, layout_template: layout, speaker_notes: f.speaker_notes ?? null, content });
    report.elements.push(element);
    report.layouts.push(layout);
    report.visuals.push(visual?.command ?? null);
    report.charts.push(chart?.type ?? null);
    prevLayout = layout;
    prevIntent = intent;
  }
  report.photos = photos;
  return { slides: out, report };
}

/** Os diagramas oferecidos à IA estão no registro e são nativos (teste de paridade). */
export function v1DiagramSpecs(): VisualCommandSpec[] {
  return V1_VISUAL_COMMANDS.map((id) => getCommand(id)).filter((s): s is VisualCommandSpec => !!s && isV1Diagram(s));
}

/** O conteúdo do diagrama cumpre o contrato do comando? (validação usada pelo chat). */
export function diagramIsValid(visual: SceneVisual): boolean {
  const spec = getCommand(visual.command);
  return !!spec && isV1Diagram(spec) && checkCommand(spec, visual).ok;
}

/** Converte o gráfico recusado em bullets (reexportado para o chat-editor). */
export { chartToBullets };
