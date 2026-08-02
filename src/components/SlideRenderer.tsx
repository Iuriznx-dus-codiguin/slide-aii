// ============================================================
// SlideAI — SlideRenderer (Fase 1: cinemático)
// ------------------------------------------------------------
// Substitui presets simples por engine coordenada (Framer Motion
// variants + cubic-bezier easings + stagger + counters animados +
// 6 capas novas + Ken Burns nos fundos com imagem).
// ============================================================

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import { resolveTheme, FONTS, type ThemeColors } from "@/lib/slugify";
import {
  PRESETS, presetForSlide, presetFromLegacy, presetFromIntent, kenBurnsVariants,
  parseNumberFromString, useAnimatedNumber, formatAnimatedNumber, EASE,
  type CinematicPreset,
} from "@/lib/animations";
import {
  useTimeline,
  buildEditorialScenario,
  buildChartScenario,
  buildStatScenario,
  buildQuoteScenario,
  applyIntent,
  type AnimationIntent,
} from "@/lib/timeline";
import { anchorLayoutId, ANCHOR_LAYOUT_TRANSITION } from "@/lib/morphing";
import { MorphingNumberToBar } from "@/components/MorphingShape";
import { renderCover, type CoverVariant } from "@/components/slides/CoverLayouts";
import { AmbientBackdrop, videoQueryForSlide } from "@/components/AmbientBackdrop";
import {
  OrbitalRings, DotGrid, FloatingShapes, CornerBrackets, DiagonalLines, AnimatedBlob, PulseGrid, ParticleField,
  LayeredPanels, GradientMeshDrift, ReactiveDotGrid, CardStack,
} from "@/components/SlideDecorations";
import { useImageInsight } from "@/lib/imageAnalysis";
import { useChoreo } from "@/lib/slideChoreography";
import { computeCompositionSpec, type SpacingBrief } from "@/lib/compositionEngine";

export type VisualAccent =
  | "orbital-rings" | "dot-grid" | "floating-shapes" | "diagonal-lines"
  | "corner-brackets" | "data-pattern" | "wave-form"
  | "animated-blob" | "pulse-grid" | "particle-field"
  | "layered-panels" | "gradient-drift" | "reactive-dots" | "card-stack";

export interface SlideContent {
  headline?: string;
  subtitle?: string;
  body_text?: string;
  bullets?: string[];
  stat_value?: string;
  stat_label?: string;
  quote_text?: string;
  quote_author?: string;
  image_query?: string;
  image_strategy?: "pexels" | "ai" | "none";
  image_url?: string | null;
  ai_image_prompt?: string;
  animation?: string;
  animation_intent?: AnimationIntent;
  /** Posição no Círculo Narrativo (Fase 2 — Story Engine). Consumido também pelo Motion Director. */
  narrative_act?: import("@/components/CinematicHUD").NarrativeAct;
  cover_variant?: CoverVariant;
  /** IA: elementos visuais decorativos sugeridos. */
  visual_accents?: VisualAccent[];
  chart?: { type: string; labels: string[]; values: number[]; title?: string };
  /** Dica de transição de slide inteiro (dynamic, fade, slide, ...). Consumida pelo SlideStage. */
  transition?: import("@/lib/slideTransitions").SlideTransition;
  /** Dica de coreografia per-element. Consumida pelo SlideStage. */
  choreography?: import("@/lib/slideChoreography").ChoreographyName;
}

/** Renderiza acentos visuais sugeridos pela IA, com fallback para defaults por tipo. */
const AccentLayer = ({ accents, theme, noAnimate, defaults = [] }: {
  accents?: VisualAccent[]; theme: ThemeColors; noAnimate: boolean; defaults?: VisualAccent[];
}) => {
  const list = (accents && accents.length > 0 ? accents : defaults).slice(0, 3);
  return (
    <>
      {list.map((a, i) => {
        const intensity = 0.45 + i * 0.1;
        switch (a) {
          case "orbital-rings": return <OrbitalRings key={i} theme={theme} noAnimate={noAnimate} position={i % 2 === 0 ? "right" : "left"} intensity={intensity} />;
          case "dot-grid": return <DotGrid key={i} theme={theme} noAnimate={noAnimate} intensity={intensity} />;
          case "floating-shapes": return <FloatingShapes key={i} theme={theme} noAnimate={noAnimate} intensity={intensity} />;
          case "diagonal-lines": return <DiagonalLines key={i} theme={theme} noAnimate={noAnimate} intensity={intensity} />;
          case "corner-brackets": return <CornerBrackets key={i} theme={theme} noAnimate={noAnimate} intensity={intensity} />;
          case "data-pattern": return <DotGrid key={i} theme={theme} noAnimate={noAnimate} cols={10} rows={6} intensity={intensity * 0.8} />;
          case "wave-form": return <DiagonalLines key={i} theme={theme} noAnimate={noAnimate} intensity={intensity * 0.9} />;
          case "animated-blob": return <AnimatedBlob key={i} theme={theme} noAnimate={noAnimate} intensity={intensity} position={i % 2 === 0 ? "right" : "left"} />;
          case "pulse-grid": return <PulseGrid key={i} theme={theme} noAnimate={noAnimate} intensity={intensity} />;
          case "particle-field": return <ParticleField key={i} theme={theme} noAnimate={noAnimate} intensity={intensity} />;
          case "layered-panels": return <LayeredPanels key={i} theme={theme} noAnimate={noAnimate} intensity={intensity} position={i % 2 === 0 ? "right" : "left"} />;
          case "gradient-drift": return <GradientMeshDrift key={i} theme={theme} noAnimate={noAnimate} intensity={intensity} />;
          case "reactive-dots": return <ReactiveDotGrid key={i} theme={theme} noAnimate={noAnimate} intensity={intensity} />;
          case "card-stack": return <CardStack key={i} theme={theme} noAnimate={noAnimate} intensity={intensity} position={i % 2 === 0 ? "right" : "left"} />;
          default: return null;
        }
      })}
    </>
  );
};

export interface SlideData {
  slide_type: string;
  layout_template: string;
  content: SlideContent;
}

interface Props {
  slide: SlideData;
  themeId: string;
  fontId: string;
  dynamicTheme?: Partial<ThemeColors> | null;
  index?: number;
  noAnimate?: boolean;
  /**
   * true quando a transição ativa para este slide é "dynamic" — habilita o
   * magic move de âncoras (título/imagem-hero/stat) via layoutId. Fica de
   * fora por padrão (false) para as 12 transições legadas, que já têm seu
   * próprio efeito de container e não devem competir com uma projeção de
   * layout simultânea nos elementos internos.
   */
  dynamicMode?: boolean;
  /** Ativa o backdrop em vídeo do AmbientBackdrop (ver SlideViewer). */
  enableVideo?: boolean;
  /**
   * Fase 1 (Creative Director Engine): usado pela Fase 4 (Design Intelligence)
   * para restringir a faixa de padding/gap ao spacing do tema. Opcional —
   * apresentações sem brief caem no comportamento "balanced" (equivalente ao
   * padding fixo de antes desta feature).
   */
  creativeBrief?: SpacingBrief | null;
}

const hexToRgba = (hex: string, alpha: number) => {
  const h = hex.replace("#", "");
  const big = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(big >> 16) & 255}, ${(big >> 8) & 255}, ${big & 255}, ${alpha})`;
};

/** Animated stat value (counter). */
const AnimatedStat = ({ value, color, enabled }: { value: string; color: string; enabled: boolean }) => {
  const parsed = parseNumberFromString(value);
  // IMPORTANT: hook must be called unconditionally on every render to satisfy
  // the Rules of Hooks. We always call useAnimatedNumber and only use the
  // animated value when `parsed` is non-null. Otherwise we'd get React #310
  // (Rendered fewer/more hooks than during previous render) when `value`
  // toggles between numeric and non-numeric across slide transitions.
  const animated = useAnimatedNumber(parsed?.num ?? 0, 1600, enabled && !!parsed);
  if (!parsed) {
    return <span style={{ color }}>{value}</span>;
  }
  return (
    <span style={{ color }}>
      {parsed.prefix}
      {formatAnimatedNumber(animated, parsed.num)}
      {parsed.suffix}
    </span>
  );
};

/* ---------- Subcomponentes com timeline (Rules of Hooks safe) ---------- */

interface QuoteSlideProps { c: SlideContent; theme: ThemeColors; containerStyle: React.CSSProperties; noAnimate: boolean; displayFont: string; videoQuery: string | null; enableVideo?: boolean; }
const QuoteSlide = ({ c, theme, containerStyle, noAnimate, displayFont, videoQuery, enableVideo }: QuoteSlideProps) => {
  const tl = useMemo(() => applyIntent(buildQuoteScenario(), c.animation_intent ?? "quote-spotlight"), [c.animation_intent]);
  const ctrl = useTimeline(tl, { skip: noAnimate });
  const choreo = useChoreo();
  return (
    <div className="w-full h-full flex items-center justify-center p-[6%] relative overflow-hidden" style={containerStyle}>
      <AmbientBackdrop theme={theme} videoQuery={videoQuery} noVideo={noAnimate} enableVideo={enableVideo} glassOpacity={0.6} orbCount={3} />
      <AccentLayer accents={c.visual_accents} theme={theme} noAnimate={noAnimate} defaults={["orbital-rings", "corner-brackets", "particle-field"]} />
      <div className="text-center max-w-5xl relative z-10">
        <motion.div {...ctrl.motionProps("mark")} exit={choreo.exitFor("mark")} className="text-[10vw] leading-none mb-4 font-serif" style={{ color: theme.accent, fontFamily: displayFont }}>"</motion.div>
        <motion.p {...ctrl.motionProps("quote")} exit={choreo.exitFor("quote")} className="text-[3vw] font-light leading-[1.25] italic" style={{ fontFamily: displayFont }}>{c.quote_text}</motion.p>
        {c.quote_author && (
          <motion.div {...ctrl.motionProps("author")} exit={choreo.exitFor("author")} className="mt-10 flex items-center justify-center gap-4">
            <div className="h-px w-12" style={{ background: theme.accent }} />
            <p className="text-[1.3vw] tracking-wide uppercase opacity-80">{c.quote_author}</p>
            <div className="h-px w-12" style={{ background: theme.accent }} />
          </motion.div>
        )}
      </div>
    </div>
  );
};

interface StatSlideProps { c: SlideContent; theme: ThemeColors; containerStyle: React.CSSProperties; noAnimate: boolean; displayFont: string; videoQuery: string | null; dynamicMode?: boolean; enableVideo?: boolean; }
const StatSlide = ({ c, theme, containerStyle, noAnimate, displayFont, videoQuery, dynamicMode, enableVideo }: StatSlideProps) => {
  const tl = useMemo(() => applyIntent(buildStatScenario(), c.animation_intent ?? "emphasis-stat"), [c.animation_intent]);
  const ctrl = useTimeline(tl, { skip: noAnimate });
  const choreo = useChoreo();
  const statActive = !!dynamicMode && !noAnimate;
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-[5%] relative overflow-hidden" style={containerStyle}>
      <AmbientBackdrop theme={theme} videoQuery={videoQuery} noVideo={noAnimate} enableVideo={enableVideo} glassOpacity={0.55} orbCount={4} />
      <AccentLayer accents={c.visual_accents} theme={theme} noAnimate={noAnimate} defaults={["pulse-grid", "animated-blob"]} />
      <div className="relative z-10 w-full max-w-5xl flex flex-col items-center">
        {c.subtitle && (
          <motion.p {...ctrl.motionProps("kicker")} exit={choreo.exitFor("kicker")} className="text-[1.4vw] uppercase tracking-[0.3em] mb-6">{c.subtitle}</motion.p>
        )}
        <motion.div
          {...ctrl.motionProps("stat")}
          exit={choreo.exitFor("stat")}
          layoutId={anchorLayoutId("stat", statActive)}
          transition={statActive ? { ...ctrl.motionProps("stat").transition, layout: ANCHOR_LAYOUT_TRANSITION } : ctrl.motionProps("stat").transition}
          className="w-full"
          style={{ height: "min(50vh, 360px)", fontFamily: displayFont }}
        >
          <MorphingNumberToBar value={c.stat_value!} color={theme.accent} noAnimate={noAnimate} />
        </motion.div>
        <motion.p {...ctrl.motionProps("label")} exit={choreo.exitFor("label")} className="mt-8 text-[2vw] max-w-3xl text-center opacity-90 leading-snug">
          {c.stat_label || c.headline}
        </motion.p>
      </div>
    </div>
  );
};

interface ChartSlideProps { c: SlideContent; theme: ThemeColors; containerStyle: React.CSSProperties; noAnimate: boolean; renderChart: () => React.ReactNode; displayFont: string; dynamicMode?: boolean; }
const ChartSlide = ({ c, theme, containerStyle, noAnimate, renderChart, displayFont, dynamicMode }: ChartSlideProps) => {
  const tl = useMemo(
    () => applyIntent(buildChartScenario(c.bullets?.length ?? 0), c.animation_intent ?? "data-reveal"),
    [c.bullets?.length, c.animation_intent]
  );
  const ctrl = useTimeline(tl, { skip: noAnimate });
  const choreo = useChoreo();
  const titleActive = !!dynamicMode && !noAnimate;
  return (
    <div className="w-full h-full flex flex-col p-[5%] relative overflow-hidden" style={containerStyle}>
      <AccentLayer accents={c.visual_accents} theme={theme} noAnimate={noAnimate} defaults={["data-pattern", "wave-form", "particle-field"]} />
      <div className="relative z-10">
        <motion.h2
          {...ctrl.motionProps("title")}
          exit={choreo.exitFor("title")}
          layoutId={anchorLayoutId("title", titleActive)}
          transition={titleActive ? { ...ctrl.motionProps("title").transition, layout: ANCHOR_LAYOUT_TRANSITION } : ctrl.motionProps("title").transition}
          className="text-[3vw] font-bold leading-tight"
          style={{ color: theme.accent, fontFamily: displayFont }}
        >
          {c.headline}
        </motion.h2>
        {c.subtitle && <motion.p {...ctrl.motionProps("subtitle")} exit={choreo.exitFor("subtitle")} className="text-[1.4vw] opacity-70 mt-1">{c.subtitle}</motion.p>}
      </div>
      <div className="grid grid-cols-12 gap-[3%] flex-1 mt-6 relative z-10">
        <div className="col-span-7 min-h-0">
          <motion.div
            {...ctrl.motionProps("chart")}
            exit={choreo.exitFor("chart")}
            className="h-full rounded-2xl p-3"
            style={{
              background: `linear-gradient(135deg, ${theme.bg}99 0%, ${theme.accent}10 100%)`,
              backdropFilter: "blur(8px)",
              border: `1px solid ${theme.accent}20`,
            }}
          >
            {renderChart()}
          </motion.div>
        </div>
        <div className="col-span-5 flex flex-col justify-center">
          {c.body_text && <p className="text-[1.25vw] leading-relaxed opacity-90 mb-5">{c.body_text}</p>}
          {c.bullets && c.bullets.length > 0 && (
            <ul className="space-y-3">
              {c.bullets.map((b, i) => (
                <motion.li key={i} {...ctrl.motionProps(`bullet-${i}`)} exit={choreo.exitFor("bullet", i)} className="flex items-start gap-2 text-[1.2vw]">
                  <span className="mt-[0.6em] h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: theme.accent }} />
                  <span className="leading-snug">{b}</span>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

interface DefaultSlideProps { c: SlideContent; theme: ThemeColors; containerStyle: React.CSSProperties; noAnimate: boolean; displayFont: string; videoQuery: string | null; dynamicMode?: boolean; enableVideo?: boolean; }
const DefaultSlide = ({ c, theme, containerStyle, noAnimate, displayFont, videoQuery, dynamicMode, enableVideo }: DefaultSlideProps) => {
  const tl = useMemo(
    () => applyIntent(buildEditorialScenario(c.bullets?.length ?? 0), c.animation_intent ?? "narrative-build"),
    [c.bullets?.length, c.animation_intent]
  );
  const ctrl = useTimeline(tl, { skip: noAnimate });
  const choreo = useChoreo();
  const titleActive = !!dynamicMode && !noAnimate;
  const headlineWords = (c.headline ?? "").split(" ");
  const hasImage = !!c.image_url;
  return (
    <div className="w-full h-full flex flex-col p-[5%] relative overflow-hidden" style={containerStyle}>
      {!hasImage && (
        <>
          <AmbientBackdrop theme={theme} videoQuery={videoQuery} noVideo={noAnimate} enableVideo={enableVideo} glassOpacity={0.3} orbCount={3} />
          {!noAnimate && (
            <svg className="absolute -right-10 top-0 h-full w-1/3 opacity-[0.15] pointer-events-none" viewBox="0 0 200 600" preserveAspectRatio="none">
              <defs>
                <linearGradient id="ln" x1="0" x2="1">
                  <stop offset="0%" stopColor={theme.accent} stopOpacity="0" />
                  <stop offset="60%" stopColor={theme.accent} stopOpacity="1" />
                  <stop offset="100%" stopColor={theme.accent} stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.line
                  key={i}
                  x1="0" x2="200" y1={80 + i * 110} y2={80 + i * 110}
                  stroke="url(#ln)" strokeWidth="1.2"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  exit={{ pathLength: 0, opacity: 0, transition: { duration: 0.5 } }}
                  transition={{ duration: 1.6, delay: 0.3 + i * 0.15, ease: [0.22, 1, 0.36, 1] }}
                />
              ))}
            </svg>
          )}
          <motion.div
            className="absolute top-[5%] right-[5%] flex items-center gap-2 z-10"
            initial={noAnimate ? false : { opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={choreo.exitFor("accent-line")}
            transition={{ duration: 0.7, delay: 0.4 }}
          >
            <div className="h-2 w-2 rounded-full" style={{ background: theme.accent }} />
            <div className="h-px w-10" style={{ background: theme.accent, opacity: 0.5 }} />
          </motion.div>
          <AccentLayer accents={c.visual_accents} theme={theme} noAnimate={noAnimate} defaults={["floating-shapes", "animated-blob", "particle-field"]} />
        </>
      )}
      {hasImage && <AccentLayer accents={c.visual_accents} theme={theme} noAnimate={noAnimate} defaults={["corner-brackets", "particle-field"]} />}
      <div className="relative z-10">
        <motion.h2
          {...ctrl.motionProps("title")}
          exit={choreo.exitFor("title")}
          layoutId={anchorLayoutId("title", titleActive)}
          transition={titleActive ? { ...ctrl.motionProps("title").transition, layout: ANCHOR_LAYOUT_TRANSITION } : ctrl.motionProps("title").transition}
          className="text-[3.2vw] font-bold leading-[1.05] tracking-tight"
          style={{ color: theme.accent, fontFamily: displayFont, perspective: 1000 }}
        >
          {headlineWords.map((w, i) => (
            <motion.span
              key={i}
              initial={noAnimate ? false : { opacity: 0, y: 24, rotateX: -30 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              exit={choreo.exitFor("title", i)}
              transition={{ duration: 0.7, delay: 0.25 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="inline-block mr-[0.25em]"
            >
              {w}
            </motion.span>
          ))}
        </motion.h2>
        {c.subtitle && <motion.p {...ctrl.motionProps("subtitle")} exit={choreo.exitFor("subtitle")} className="text-[1.5vw] opacity-70 mt-1">{c.subtitle}</motion.p>}
      </div>
      <div className="flex-1 mt-6 flex flex-col justify-center relative z-10">
        {c.body_text && (
          <motion.p {...ctrl.motionProps("body")} exit={choreo.exitFor("body")} className="text-[1.4vw] leading-relaxed opacity-95 mb-6 max-w-[90%]">
            {c.body_text}
          </motion.p>
        )}
        {c.bullets && c.bullets.length > 0 && (
          <ul className="space-y-4">
            {c.bullets.map((b, i) => (
              <motion.li key={i} {...ctrl.motionProps(`bullet-${i}`)} exit={choreo.exitFor("bullet", i)} className="flex items-start gap-4 text-[1.4vw]">
                <motion.span
                  className="mt-[0.5em] h-3 w-3 rounded-sm flex-shrink-0 rotate-45"
                  style={{ background: theme.accent }}
                  initial={noAnimate ? false : { scale: 0, rotate: 0 }}
                  animate={{ scale: 1, rotate: 45 }}
                  exit={choreo.exitFor("decoration", i)}
                  transition={{ duration: 0.4, delay: 0.5 + i * 0.08, type: "spring", stiffness: 220 }}
                />
                <span className="leading-snug">{b}</span>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

/* ---------- Two Columns Slide (Bloco 2) ---------- */
interface TwoColProps { c: SlideContent; theme: ThemeColors; containerStyle: React.CSSProperties; noAnimate: boolean; displayFont: string; videoQuery: string | null; renderChart: () => React.ReactNode; dynamicMode?: boolean; enableVideo?: boolean; }
const TwoColumnsSlide = ({ c, theme, containerStyle, noAnimate, displayFont, videoQuery, renderChart, dynamicMode, enableVideo }: TwoColProps) => {
  const bullets = c.bullets ?? [];
  const leftBullets = bullets.slice(0, 3);
  const rightBullets = bullets.slice(3);
  const tl = useMemo(
    () => applyIntent(buildEditorialScenario(Math.max(leftBullets.length, rightBullets.length)), c.animation_intent ?? "narrative-build"),
    [leftBullets.length, rightBullets.length, c.animation_intent]
  );
  const ctrl = useTimeline(tl, { skip: noAnimate });
  const choreo = useChoreo();
  const titleActive = !!dynamicMode && !noAnimate;
  const hasStat = !!(c.stat_value && c.stat_label);
  const hasChart = !!c.chart;
  return (
    <div className="w-full h-full grid grid-cols-12 gap-[3%] p-[5%] relative overflow-hidden" style={containerStyle}>
      <AmbientBackdrop theme={theme} videoQuery={videoQuery} noVideo={noAnimate} enableVideo={enableVideo} glassOpacity={0.35} orbCount={2} />
      <CornerBrackets theme={theme} noAnimate={noAnimate} intensity={0.5} />
      <AccentLayer accents={c.visual_accents} theme={theme} noAnimate={noAnimate} defaults={["dot-grid", "diagonal-lines"]} />

      {/* Coluna 1: cols 1-5 */}
      <div className="col-span-5 flex flex-col justify-center relative z-10 pr-[2%]">
        <motion.h2
          {...ctrl.motionProps("title")}
          exit={choreo.exitFor("title")}
          layoutId={anchorLayoutId("title", titleActive)}
          transition={titleActive ? { ...ctrl.motionProps("title").transition, layout: ANCHOR_LAYOUT_TRANSITION } : ctrl.motionProps("title").transition}
          className="text-[2.8vw] font-bold leading-[1.05] tracking-tight"
          style={{ color: theme.accent, fontFamily: displayFont }}
        >
          {c.headline}
        </motion.h2>
        {c.subtitle && (
          <motion.p {...ctrl.motionProps("subtitle")} exit={choreo.exitFor("subtitle")} className="text-[1.3vw] opacity-70 mt-2">{c.subtitle}</motion.p>
        )}
        {c.body_text && (
          <motion.p {...ctrl.motionProps("body")} exit={choreo.exitFor("body")} className="mt-5 text-[1.15vw] leading-relaxed opacity-90">{c.body_text}</motion.p>
        )}
        {leftBullets.length > 0 && (
          <ul className="mt-5 space-y-3">
            {leftBullets.map((b, i) => (
              <motion.li key={i} {...ctrl.motionProps(`bullet-${i}`)} exit={choreo.exitFor("bullet", i)} className="flex items-start gap-3 text-[1.15vw]">
                <span className="mt-[0.55em] h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: theme.accent }} />
                <span className="leading-snug">{b}</span>
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      {/* Divisor vertical sutil */}
      <div className="col-span-0 absolute left-1/2 top-[12%] bottom-[12%] w-px pointer-events-none z-[2]" style={{ background: theme.accent, opacity: 0.2 }} aria-hidden />

      {/* Coluna 2: cols 7-12 */}
      <div className="col-start-7 col-span-6 flex flex-col justify-center relative z-10 pl-[2%]">
        {hasStat && (
          <motion.div {...ctrl.motionProps("body")} exit={choreo.exitFor("stat")} className="mb-6">
            <div className="text-[5vw] font-black leading-none" style={{ color: theme.accent, fontFamily: displayFont }}>
              <AnimatedStat value={c.stat_value!} color={theme.accent} enabled={!noAnimate} />
            </div>
            <p className="mt-2 text-[1.2vw] opacity-85 leading-snug">{c.stat_label}</p>
          </motion.div>
        )}
        {rightBullets.length > 0 ? (
          <ul className="space-y-3">
            {rightBullets.map((b, i) => (
              <motion.li key={i} {...ctrl.motionProps(`bullet-${i}`)} exit={choreo.exitFor("bullet", i + 3)} className="flex items-start gap-3 text-[1.2vw]">
                <span className="mt-[0.6em] h-2 w-2 rounded-sm rotate-45 flex-shrink-0" style={{ background: theme.accent }} />
                <span className="leading-snug">{b}</span>
              </motion.li>
            ))}
          </ul>
        ) : hasChart ? (
          <motion.div
            {...ctrl.motionProps("body")}
            exit={choreo.exitFor("chart")}
            className="w-full h-[55%] rounded-2xl p-3"
            style={{
              background: `linear-gradient(135deg, ${theme.bg}99 0%, ${theme.accent}10 100%)`,
              border: `1px solid ${theme.accent}25`,
            }}
          >
            {renderChart()}
          </motion.div>
        ) : null}
      </div>
    </div>
  );
};

/* ---------- Smart Layout: Image Split (anti-overlap) ---------- */
interface ImageSplitProps {
  c: SlideContent; theme: ThemeColors; containerStyle: React.CSSProperties;
  variants: any; motionMode: any; requestedSide: "left" | "right";
  noAnimate?: boolean; dynamicMode?: boolean;
}
const ImageSplitSlide = ({ c, theme, containerStyle, variants, motionMode, requestedSide, noAnimate = false, dynamicMode = false }: ImageSplitProps) => {
  const insight = useImageInsight(c.image_url ?? null);
  const choreo = useChoreo();
  const anchorsActive = dynamicMode && !noAnimate;
  const imageSide: "left" | "right" = insight
    ? (insight.safeSide === "left" ? "right" : "left")
    : requestedSide;
  return (
    <div className="w-full h-full grid grid-cols-12 gap-[3%] p-[4%] relative overflow-hidden" style={containerStyle}>
      <CornerBrackets theme={theme} noAnimate={false} intensity={0.5} />
      <OrbitalRings theme={theme} noAnimate={false} position={imageSide === "left" ? "right" : "left"} intensity={0.35} />
      {imageSide === "left" && (
        <motion.div
          layoutId={anchorLayoutId("hero-media", anchorsActive)}
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={choreo.exitFor("image")}
          transition={anchorsActive ? { duration: 0.9, ease: EASE.editorial as any, layout: ANCHOR_LAYOUT_TRANSITION } : { duration: 0.9, ease: EASE.editorial as any }}
          className="col-span-5 rounded-3xl overflow-hidden relative"
        >
          <motion.img src={c.image_url!} alt="" className="absolute inset-0 w-full h-full object-cover" variants={kenBurnsVariants} initial="initial" animate="animate" />
        </motion.div>
      )}
      <motion.div {...motionMode} variants={variants.container} exit={choreo.exitFor("card")} className={`col-span-7 flex flex-col justify-center ${imageSide === "left" ? "" : "pr-[2%]"}`}>
        <motion.h2
          variants={variants.item}
          exit={choreo.exitFor("title")}
          layoutId={anchorLayoutId("title", anchorsActive)}
          transition={anchorsActive ? { layout: ANCHOR_LAYOUT_TRANSITION } : undefined}
          className="text-[3.5vw] font-bold leading-tight mb-4"
          style={{ color: theme.accent }}
        >
          {c.headline}
        </motion.h2>
        {c.subtitle && <motion.p variants={variants.item} exit={choreo.exitFor("subtitle")} className="text-[1.6vw] opacity-75 mb-6">{c.subtitle}</motion.p>}
        {c.body_text && <motion.p variants={variants.item} exit={choreo.exitFor("body")} className="text-[1.3vw] leading-relaxed opacity-90 mb-5">{c.body_text}</motion.p>}
        {c.bullets && c.bullets.length > 0 && (
          <ul className="space-y-3">
            {c.bullets.map((b, i) => (
              <motion.li key={i} variants={variants.item} exit={choreo.exitFor("bullet", i)} className="flex items-start gap-3 text-[1.3vw]">
                <span className="mt-[0.6em] h-2 w-2 rounded-full flex-shrink-0" style={{ background: theme.accent }} />
                <span className="leading-snug">{b}</span>
              </motion.li>
            ))}
          </ul>
        )}
      </motion.div>
      {imageSide === "right" && (
        <motion.div
          layoutId={anchorLayoutId("hero-media", anchorsActive)}
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={choreo.exitFor("image")}
          transition={anchorsActive ? { duration: 0.9, ease: EASE.editorial as any, layout: ANCHOR_LAYOUT_TRANSITION } : { duration: 0.9, ease: EASE.editorial as any }}
          className="col-span-5 rounded-3xl overflow-hidden relative"
        >
          <motion.img src={c.image_url!} alt="" className="absolute inset-0 w-full h-full object-cover" variants={kenBurnsVariants} initial="initial" animate="animate" />
        </motion.div>
      )}
    </div>
  );
};

/* ---------- Smart Layout: Full Image com Auto-Contraste WCAG ---------- */
interface FullImageProps {
  c: SlideContent; theme: ThemeColors; containerStyle: React.CSSProperties;
  variants: any; motionMode: any; noAnimate?: boolean; dynamicMode?: boolean;
}
const FullImageSlide = ({ c, theme, containerStyle, variants, motionMode, noAnimate = false, dynamicMode = false }: FullImageProps) => {
  const insight = useImageInsight(c.image_url ?? null);
  const choreo = useChoreo();
  const anchorsActive = dynamicMode && !noAnimate;
  const anchor = insight?.safeAnchor ?? "bottom-left";
  const textColor = insight?.textColor ?? "#FFFFFF";
  const overlayColor = insight?.overlay.color ?? "#000000";
  const overlayAlpha = insight?.overlay.alpha ?? 0.5;
  const anchorClass = {
    "top-left": "items-start justify-start text-left",
    "top-right": "items-start justify-end text-right",
    "bottom-left": "items-end justify-start text-left",
    "bottom-right": "items-end justify-end text-right",
    "center": "items-center justify-center text-center",
  }[anchor];
  const gradientDir = anchor.includes("right") ? "to left" : anchor.includes("left") ? "to right" : "to top";
  return (
    <div className="relative w-full h-full overflow-hidden" style={containerStyle}>
      <motion.img
        src={c.image_url!} alt={c.headline || ""} exit={choreo.exitFor("image")}
        layoutId={anchorLayoutId("hero-media", anchorsActive)}
        className="absolute inset-0 w-full h-full object-cover" variants={kenBurnsVariants} initial="initial" animate="animate"
      />
      <div className="absolute inset-0" style={{
        background: `linear-gradient(${gradientDir}, ${hexToRgba(overlayColor, overlayAlpha)} 0%, ${hexToRgba(overlayColor, overlayAlpha * 0.3)} 55%, transparent 90%)`,
      }} />
      <CornerBrackets theme={theme} intensity={0.7} />
      <motion.div {...motionMode} variants={variants.container} className={`relative h-full flex flex-col p-[5%] ${anchorClass}`} style={{ color: textColor }}>
        <div className={`flex flex-col ${anchor.includes("right") ? "items-end" : anchor === "center" ? "items-center" : "items-start"} max-w-[80%]`}>
          <motion.div variants={variants.item} exit={choreo.exitFor("accent-line")} className="h-1.5 w-24 mb-6" style={{ background: theme.accent }} />
          <motion.h1
            variants={variants.item}
            exit={choreo.exitFor("title")}
            layoutId={anchorLayoutId("title", anchorsActive)}
            className="text-[5vw] md:text-[4.5vw] font-extrabold leading-[1.05] tracking-tight"
            style={{ color: textColor }}
          >
            {c.headline}
          </motion.h1>
          {c.subtitle && <motion.p variants={variants.item} exit={choreo.exitFor("subtitle")} className="mt-4 text-[2vw] md:text-[1.8vw] opacity-90" style={{ color: textColor }}>{c.subtitle}</motion.p>}
        </div>
      </motion.div>
    </div>
  );
};

export const SlideRenderer = ({ slide, themeId, fontId, dynamicTheme, noAnimate = false, dynamicMode = false, enableVideo = false, creativeBrief }: Props) => {
  const theme = resolveTheme(themeId, dynamicTheme);
  const font = FONTS[fontId] ?? FONTS["modern-sans"];
  const displayFont = font.display ?? font.family;
  const c = slide.content || {};
  const videoQuery = videoQueryForSlide(c);
  const choreo = useChoreo();


  // Escolha do preset cinematográfico (precedência corrigida — ver comentário
  // em presetFromIntent, src/lib/animations.ts):
  // 1) animation_intent (papel narrativo, bem guiado no prompt) decide primeiro
  // 2) animation (legado, sem guidance no schema) como fallback
  // 3) senão, deduz pelo tipo de slide
  const preset: CinematicPreset =
    presetFromIntent(c.animation_intent) ?? presetFromLegacy(c.animation) ?? presetForSlide(slide.slide_type, slide.layout_template);
  const variants = PRESETS[preset];

  // Quando noAnimate (thumbnails / print), pulamos diretamente ao "show"
  const motionMode = noAnimate
    ? { initial: false as const, animate: "show" as const }
    : { initial: "hidden" as const, animate: "show" as const };

  const COLORS = [theme.accent, theme.accent2 || "#F59E0B", "#10B981", "#EF4444", "#8B5CF6", "#06B6D4"];

  const chartData = c.chart ? c.chart.labels.map((l, i) => ({ name: l, value: c.chart!.values[i] ?? 0 })) : [];

  const renderChart = () => {
    if (!c.chart) return null;
    const t = c.chart.type;
    const gridColor = hexToRgba(theme.text, 0.1);
    const tickStyle = { fill: theme.text, fontSize: 14, opacity: 0.7 };
    const animationDuration = noAnimate ? 0 : 1400;
    return (
      <ResponsiveContainer width="100%" height="100%">
        {t === "bar" ? (
          <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
            <CartesianGrid stroke={gridColor} vertical={false} />
            <XAxis dataKey="name" stroke={theme.text} tick={tickStyle} />
            <YAxis stroke={theme.text} tick={tickStyle} />
            <Tooltip cursor={{ fill: hexToRgba(theme.accent, 0.1) }} contentStyle={{ background: theme.bg, border: `1px solid ${hexToRgba(theme.text, 0.2)}`, borderRadius: 12, color: theme.text }} />
            <Bar dataKey="value" fill={theme.accent} radius={[10, 10, 0, 0]} animationDuration={animationDuration} animationEasing="ease-out" />
          </BarChart>
        ) : t === "line" ? (
          <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
            <CartesianGrid stroke={gridColor} vertical={false} />
            <XAxis dataKey="name" stroke={theme.text} tick={tickStyle} />
            <YAxis stroke={theme.text} tick={tickStyle} />
            <Tooltip contentStyle={{ background: theme.bg, border: `1px solid ${hexToRgba(theme.text, 0.2)}`, borderRadius: 12, color: theme.text }} />
            <Line type="monotone" dataKey="value" stroke={theme.accent} strokeWidth={3} dot={{ fill: theme.accent, r: 5 }} animationDuration={animationDuration} />
          </LineChart>
        ) : t === "area" ? (
          <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
            <defs>
              <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={theme.accent} stopOpacity={0.6} />
                <stop offset="100%" stopColor={theme.accent} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={gridColor} vertical={false} />
            <XAxis dataKey="name" stroke={theme.text} tick={tickStyle} />
            <YAxis stroke={theme.text} tick={tickStyle} />
            <Tooltip contentStyle={{ background: theme.bg, border: `1px solid ${hexToRgba(theme.text, 0.2)}`, borderRadius: 12, color: theme.text }} />
            <Area type="monotone" dataKey="value" stroke={theme.accent} fill="url(#areaFill)" strokeWidth={3} animationDuration={animationDuration} />
          </AreaChart>
        ) : (
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" outerRadius="75%" innerRadius={t === "donut" ? "45%" : 0} paddingAngle={2} animationDuration={animationDuration}>
              {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke={theme.bg} strokeWidth={3} />)}
            </Pie>
            <Legend wrapperStyle={{ color: theme.text, fontSize: 14 }} />
            <Tooltip contentStyle={{ background: theme.bg, border: `1px solid ${hexToRgba(theme.text, 0.2)}`, borderRadius: 12, color: theme.text }} />
          </PieChart>
        )}
      </ResponsiveContainer>
    );
  };

  const layout = slide.layout_template || "title-content";
  const isTitle =
    slide.slide_type === "title_slide" || layout === "title-only" || layout === "split-hero";
  const isQuote = slide.slide_type === "quote" || layout === "quote";
  const isChart =
    slide.slide_type === "data_chart" || layout === "data-chart" ||
    (!!c.chart && layout !== "image-right" && layout !== "image-left");
  const isStat = layout === "stat-highlight" && c.stat_value;
  const isCentered = layout === "centered" || slide.slide_type === "section_divider";
  const hasImage = !!c.image_url && (layout === "image-right" || layout === "image-left" || layout === "full-image");

  const containerStyle: React.CSSProperties = {
    background: theme.gradient || theme.bg,
    color: theme.text,
    fontFamily: font.family,
  };

  // Fase 4 (Design Intelligence Engine): padding/gap deixam de ser fixos
  // (p-[5%]/p-[6%]/p-[4%]/gap-[3%] hardcoded nas classes Tailwind de cada
  // sub-componente) e passam a ser calculados por slide, a partir da
  // densidade real de conteúdo + creative_brief.spacing. containerStyle já é
  // passado como `style` para os 7 sub-componentes (QuoteSlide, StatSlide,
  // ChartSlide, DefaultSlide, TwoColumnsSlide, ImageSplitSlide, FullImageSlide)
  // — style inline tem precedência sobre a classe Tailwind, então nenhuma
  // dessas 7 JSX precisou ser tocada para a substituição ter efeito.
  const compositionSpec = computeCompositionSpec(
    { headline: c.headline, subtitle: c.subtitle, bodyText: c.body_text, bullets: c.bullets, hasChart: !!c.chart },
    creativeBrief,
  );
  containerStyle.padding = compositionSpec.padding;
  containerStyle.gap = compositionSpec.gap;

  /* ---------- TITLE SLIDE → escolhe entre 6 covers ---------- */
  if (isTitle) {
    return (
      <div className="w-full h-full overflow-hidden" style={{ fontFamily: font.family }}>
        {renderCover(c.cover_variant, {
          headline: c.headline,
          subtitle: c.subtitle,
          imageUrl: c.image_url,
          theme,
          fontFamily: displayFont,
          kicker: (c as any).kicker,
          footer: (c as any).footer,
          noAnimate,
          dynamicMode,
        })}
      </div>
    );
  }

  /* ---------- FULL IMAGE (slide normal com fundo de imagem) ---------- */
  if (layout === "full-image" && c.image_url) {
    return <FullImageSlide c={c} theme={theme} containerStyle={containerStyle} variants={variants} motionMode={motionMode} noAnimate={noAnimate} dynamicMode={dynamicMode} />;
  }

  /* ---------- QUOTE ---------- */
  if (isQuote && c.quote_text) {
    return <QuoteSlide c={c} theme={theme} containerStyle={containerStyle} noAnimate={noAnimate} displayFont={displayFont} videoQuery={videoQuery} enableVideo={enableVideo} />;
  }

  /* ---------- STAT HIGHLIGHT (morph número→barra) ---------- */
  if (isStat) {
    return <StatSlide c={c} theme={theme} containerStyle={containerStyle} noAnimate={noAnimate} displayFont={displayFont} videoQuery={videoQuery} dynamicMode={dynamicMode} enableVideo={enableVideo} />;
  }

  /* ---------- CENTERED / SECTION DIVIDER ---------- */
  if (isCentered) {
    const titleActive = dynamicMode && !noAnimate;
    return (
      <div className="w-full h-full flex items-center justify-center p-[6%] text-center relative overflow-hidden" style={containerStyle}>
      <AmbientBackdrop theme={theme} videoQuery={videoQuery} noVideo={noAnimate} enableVideo={enableVideo} glassOpacity={0.5} orbCount={3} />
      <AccentLayer accents={c.visual_accents} theme={theme} noAnimate={noAnimate} defaults={["diagonal-lines", "orbital-rings", "corner-brackets"]} />
        <motion.div {...motionMode} variants={variants.container} className="relative z-10">
          {c.subtitle && <motion.p variants={variants.item} exit={choreo.exitFor("kicker")} className="text-[1.3vw] uppercase tracking-[0.3em] opacity-60 mb-6">{c.subtitle}</motion.p>}
          <motion.h1
            variants={variants.item}
            exit={choreo.exitFor("title")}
            layoutId={anchorLayoutId("title", titleActive)}
            transition={titleActive ? { layout: ANCHOR_LAYOUT_TRANSITION } : undefined}
            className="text-[5vw] font-extrabold leading-[1.05] tracking-tight"
            style={{ fontFamily: displayFont }}
          >
            {c.headline}
          </motion.h1>
          {c.body_text && <motion.p variants={variants.item} exit={choreo.exitFor("body")} className="mt-6 text-[1.6vw] opacity-80 max-w-3xl mx-auto">{c.body_text}</motion.p>}
          <motion.div variants={variants.item} exit={choreo.exitFor("accent-line")} className="mt-10 mx-auto h-1 w-24" style={{ background: theme.accent }} />
        </motion.div>
      </div>
    );
  }

  /* ---------- IMAGE-LEFT / IMAGE-RIGHT (Smart Layout: anti-overlap) ---------- */
  if (hasImage && (layout === "image-right" || layout === "image-left")) {
    return <ImageSplitSlide c={c} theme={theme} containerStyle={containerStyle} variants={variants} motionMode={motionMode} requestedSide={layout === "image-right" ? "right" : "left"} noAnimate={noAnimate} dynamicMode={dynamicMode} />;
  }

  /* ---------- DATA CHART ---------- */
  if (isChart && c.chart) {
    return <ChartSlide c={c} theme={theme} containerStyle={containerStyle} noAnimate={noAnimate} renderChart={renderChart} displayFont={displayFont} dynamicMode={dynamicMode} />;
  }

  /* ---------- TWO COLUMNS (Bloco 2) ---------- */
  if (layout === "two-columns") {
    return <TwoColumnsSlide c={c} theme={theme} containerStyle={containerStyle} noAnimate={noAnimate} displayFont={displayFont} videoQuery={videoQuery} renderChart={renderChart} dynamicMode={dynamicMode} enableVideo={enableVideo} />;
  }

  /* ---------- DEFAULT ---------- */
  return <DefaultSlide c={c} theme={theme} containerStyle={containerStyle} noAnimate={noAnimate} displayFont={displayFont} videoQuery={videoQuery} dynamicMode={dynamicMode} enableVideo={enableVideo} />;
};
