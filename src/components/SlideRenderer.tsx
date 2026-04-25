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
  PRESETS, presetForSlide, presetFromLegacy, kenBurnsVariants,
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
import { sharedId } from "@/lib/morphing";
import { MorphingNumberToBar } from "@/components/MorphingShape";
import { renderCover, type CoverVariant } from "@/components/slides/CoverLayouts";
import { AmbientBackdrop, videoQueryForSlide } from "@/components/AmbientBackdrop";

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
  /** IA contextual: papel narrativo da animação (Fase 2.5). */
  animation_intent?: AnimationIntent;
  /** Novo: variante de capa (apenas title slides). */
  cover_variant?: CoverVariant;
  chart?: { type: string; labels: string[]; values: number[]; title?: string };
}

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
}

const hexToRgba = (hex: string, alpha: number) => {
  const h = hex.replace("#", "");
  const big = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(big >> 16) & 255}, ${(big >> 8) & 255}, ${big & 255}, ${alpha})`;
};

/** Animated stat value (counter). */
const AnimatedStat = ({ value, color, enabled }: { value: string; color: string; enabled: boolean }) => {
  const parsed = parseNumberFromString(value);
  if (!parsed) {
    return <span style={{ color }}>{value}</span>;
  }
  const animated = useAnimatedNumber(parsed.num, 1600, enabled);
  return (
    <span style={{ color }}>
      {parsed.prefix}
      {formatAnimatedNumber(animated, parsed.num)}
      {parsed.suffix}
    </span>
  );
};

/* ---------- Subcomponentes com timeline (Rules of Hooks safe) ---------- */

interface QuoteSlideProps { c: SlideContent; theme: ThemeColors; containerStyle: React.CSSProperties; noAnimate: boolean; displayFont: string; videoQuery: string | null; }
const QuoteSlide = ({ c, theme, containerStyle, noAnimate, displayFont, videoQuery }: QuoteSlideProps) => {
  const tl = useMemo(() => applyIntent(buildQuoteScenario(), c.animation_intent ?? "quote-spotlight"), [c.animation_intent]);
  const ctrl = useTimeline(tl, { skip: noAnimate });
  return (
    <div className="w-full h-full flex items-center justify-center p-[6%] relative overflow-hidden" style={containerStyle}>
      <AmbientBackdrop theme={theme} videoQuery={videoQuery} noVideo={noAnimate} glassOpacity={0.6} orbCount={3} />
      <div className="text-center max-w-5xl relative z-10">
        <motion.div {...ctrl.motionProps("mark")} className="text-[10vw] leading-none mb-4 font-serif" style={{ color: theme.accent, fontFamily: displayFont }}>"</motion.div>
        <motion.p {...ctrl.motionProps("quote")} className="text-[3vw] font-light leading-[1.25] italic" style={{ fontFamily: displayFont }}>{c.quote_text}</motion.p>
        {c.quote_author && (
          <motion.div {...ctrl.motionProps("author")} className="mt-10 flex items-center justify-center gap-4">
            <div className="h-px w-12" style={{ background: theme.accent }} />
            <p className="text-[1.3vw] tracking-wide uppercase opacity-80">{c.quote_author}</p>
            <div className="h-px w-12" style={{ background: theme.accent }} />
          </motion.div>
        )}
      </div>
    </div>
  );
};

interface StatSlideProps { c: SlideContent; theme: ThemeColors; containerStyle: React.CSSProperties; noAnimate: boolean; displayFont: string; videoQuery: string | null; }
const StatSlide = ({ c, theme, containerStyle, noAnimate, displayFont, videoQuery }: StatSlideProps) => {
  const tl = useMemo(() => applyIntent(buildStatScenario(), c.animation_intent ?? "emphasis-stat"), [c.animation_intent]);
  const ctrl = useTimeline(tl, { skip: noAnimate });
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-[5%] relative overflow-hidden" style={containerStyle}>
      <AmbientBackdrop theme={theme} videoQuery={videoQuery} noVideo={noAnimate} glassOpacity={0.55} orbCount={4} />
      <div className="relative z-10 w-full max-w-5xl flex flex-col items-center">
        {c.subtitle && (
          <motion.p {...ctrl.motionProps("kicker")} className="text-[1.4vw] uppercase tracking-[0.3em] mb-6">{c.subtitle}</motion.p>
        )}
        <motion.div
          {...ctrl.motionProps("stat")}
          layoutId={sharedId("stat", c.stat_value)}
          className="w-full"
          style={{ height: "min(50vh, 360px)", fontFamily: displayFont }}
        >
          <MorphingNumberToBar value={c.stat_value!} color={theme.accent} noAnimate={noAnimate} />
        </motion.div>
        <motion.p {...ctrl.motionProps("label")} className="mt-8 text-[2vw] max-w-3xl text-center opacity-90 leading-snug">
          {c.stat_label || c.headline}
        </motion.p>
      </div>
    </div>
  );
};

interface ChartSlideProps { c: SlideContent; theme: ThemeColors; containerStyle: React.CSSProperties; noAnimate: boolean; renderChart: () => React.ReactNode; displayFont: string; }
const ChartSlide = ({ c, theme, containerStyle, noAnimate, renderChart, displayFont }: ChartSlideProps) => {
  const tl = useMemo(
    () => applyIntent(buildChartScenario(c.bullets?.length ?? 0), c.animation_intent ?? "data-reveal"),
    [c.bullets?.length, c.animation_intent]
  );
  const ctrl = useTimeline(tl, { skip: noAnimate });
  return (
    <div className="w-full h-full flex flex-col p-[5%] relative" style={containerStyle}>
      <div className="relative z-10">
        <motion.h2 {...ctrl.motionProps("title")} layoutId={sharedId("title", c.headline?.slice(0, 24))} className="text-[3vw] font-bold leading-tight" style={{ color: theme.accent, fontFamily: displayFont }}>{c.headline}</motion.h2>
        {c.subtitle && <motion.p {...ctrl.motionProps("subtitle")} className="text-[1.4vw] opacity-70 mt-1">{c.subtitle}</motion.p>}
      </div>
      <div className="grid grid-cols-12 gap-[3%] flex-1 mt-6 relative z-10">
        <div className="col-span-7 min-h-0">
          <motion.div
            {...ctrl.motionProps("chart")}
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
                <motion.li key={i} {...ctrl.motionProps(`bullet-${i}`)} className="flex items-start gap-2 text-[1.2vw]">
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

interface DefaultSlideProps { c: SlideContent; theme: ThemeColors; containerStyle: React.CSSProperties; noAnimate: boolean; displayFont: string; }
const DefaultSlide = ({ c, theme, containerStyle, noAnimate, displayFont }: DefaultSlideProps) => {
  const tl = useMemo(
    () => applyIntent(buildEditorialScenario(c.bullets?.length ?? 0), c.animation_intent ?? "narrative-build"),
    [c.bullets?.length, c.animation_intent]
  );
  const ctrl = useTimeline(tl, { skip: noAnimate });
  // Word-by-word stagger no headline (kinetic type)
  const headlineWords = (c.headline ?? "").split(" ");
  return (
    <div className="w-full h-full flex flex-col p-[5%] relative" style={containerStyle}>
      <div className="relative z-10">
        <motion.h2
          {...ctrl.motionProps("title")}
          layoutId={sharedId("title", c.headline?.slice(0, 24))}
          className="text-[3.2vw] font-bold leading-[1.05] tracking-tight"
          style={{ color: theme.accent, fontFamily: displayFont, perspective: 1000 }}
        >
          {headlineWords.map((w, i) => (
            <motion.span
              key={i}
              initial={noAnimate ? false : { opacity: 0, y: 24, rotateX: -30 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.7, delay: 0.25 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="inline-block mr-[0.25em]"
            >
              {w}
            </motion.span>
          ))}
        </motion.h2>
        {c.subtitle && <motion.p {...ctrl.motionProps("subtitle")} className="text-[1.5vw] opacity-70 mt-1">{c.subtitle}</motion.p>}
      </div>
      <div className="flex-1 mt-6 flex flex-col justify-center relative z-10">
        {c.body_text && (
          <motion.p {...ctrl.motionProps("body")} className="text-[1.4vw] leading-relaxed opacity-95 mb-6 max-w-[90%]">
            {c.body_text}
          </motion.p>
        )}
        {c.bullets && c.bullets.length > 0 && (
          <ul className="space-y-4">
            {c.bullets.map((b, i) => (
              <motion.li key={i} {...ctrl.motionProps(`bullet-${i}`)} className="flex items-start gap-4 text-[1.4vw]">
                <span className="mt-[0.5em] h-3 w-3 rounded-sm flex-shrink-0 rotate-45" style={{ background: theme.accent }} />
                <span className="leading-snug">{b}</span>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export const SlideRenderer = ({ slide, themeId, fontId, dynamicTheme, noAnimate = false }: Props) => {
  const theme = resolveTheme(themeId, dynamicTheme);
  const font = FONTS[fontId] ?? FONTS["modern-sans"];
  const displayFont = font.display ?? font.family;
  const c = slide.content || {};
  const videoQuery = videoQueryForSlide(c);

  // Escolha do preset cinematográfico:
  // 1) se a IA setou animation, mapeia legacy → preset
  // 2) senão, deduz pelo tipo de slide
  const preset: CinematicPreset =
    presetFromLegacy(c.animation) ?? presetForSlide(slide.slide_type, slide.layout_template);
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

  /* ---------- TITLE SLIDE → escolhe entre 6 covers ---------- */
  if (isTitle) {
    return (
      <div className="w-full h-full overflow-hidden" style={{ fontFamily: font.family }}>
        {renderCover(c.cover_variant, {
          headline: c.headline,
          subtitle: c.subtitle,
          imageUrl: c.image_url,
          theme,
          fontFamily: font.family,
        })}
      </div>
    );
  }

  /* ---------- FULL IMAGE (slide normal com fundo de imagem) ---------- */
  if (layout === "full-image" && c.image_url) {
    return (
      <div className="relative w-full h-full overflow-hidden" style={containerStyle}>
        <motion.img src={c.image_url} alt={c.headline || ""} className="absolute inset-0 w-full h-full object-cover" variants={kenBurnsVariants} initial="initial" animate="animate" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${hexToRgba(theme.bg, 0.85)} 0%, ${hexToRgba(theme.bg, 0.4)} 100%)` }} />
        <motion.div {...motionMode} variants={variants.container} className="relative h-full flex flex-col justify-end p-[5%]">
          <motion.div variants={variants.item} className="h-1.5 w-24 mb-6" style={{ background: theme.accent }} />
          <motion.h1 variants={variants.item} className="text-[5vw] md:text-[4.5vw] font-extrabold leading-[1.05] tracking-tight max-w-[80%]">{c.headline}</motion.h1>
          {c.subtitle && <motion.p variants={variants.item} className="mt-4 text-[2vw] md:text-[1.8vw] opacity-90 max-w-[70%]">{c.subtitle}</motion.p>}
        </motion.div>
      </div>
    );
  }

  /* ---------- QUOTE ---------- */
  if (isQuote && c.quote_text) {
    return <QuoteSlide c={c} theme={theme} containerStyle={containerStyle} noAnimate={noAnimate} displayFont={displayFont} videoQuery={videoQuery} />;
  }

  /* ---------- STAT HIGHLIGHT (morph número→barra) ---------- */
  if (isStat) {
    return <StatSlide c={c} theme={theme} containerStyle={containerStyle} noAnimate={noAnimate} displayFont={displayFont} videoQuery={videoQuery} />;
  }

  /* ---------- CENTERED / SECTION DIVIDER ---------- */
  if (isCentered) {
    return (
      <div className="w-full h-full flex items-center justify-center p-[6%] text-center relative overflow-hidden" style={containerStyle}>
        <AmbientBackdrop theme={theme} videoQuery={videoQuery} noVideo={noAnimate} glassOpacity={0.5} orbCount={3} />
        <motion.div {...motionMode} variants={variants.container} className="relative z-10">
          {c.subtitle && <motion.p variants={variants.item} className="text-[1.3vw] uppercase tracking-[0.3em] opacity-60 mb-6">{c.subtitle}</motion.p>}
          <motion.h1 variants={variants.item} className="text-[5vw] font-extrabold leading-[1.05] tracking-tight" style={{ fontFamily: displayFont }}>{c.headline}</motion.h1>
          {c.body_text && <motion.p variants={variants.item} className="mt-6 text-[1.6vw] opacity-80 max-w-3xl mx-auto">{c.body_text}</motion.p>}
          <motion.div variants={variants.item} className="mt-10 mx-auto h-1 w-24" style={{ background: theme.accent }} />
        </motion.div>
      </div>
    );
  }

  /* ---------- IMAGE-LEFT / IMAGE-RIGHT ---------- */
  if (hasImage && (layout === "image-right" || layout === "image-left")) {
    const imageSide = layout === "image-right" ? "right" : "left";
    return (
      <div className="w-full h-full grid grid-cols-12 gap-[3%] p-[4%]" style={containerStyle}>
        {imageSide === "left" && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, ease: EASE.editorial as any }} className="col-span-5 rounded-3xl overflow-hidden relative">
            <motion.img src={c.image_url!} alt="" className="absolute inset-0 w-full h-full object-cover" variants={kenBurnsVariants} initial="initial" animate="animate" />
          </motion.div>
        )}
        <motion.div {...motionMode} variants={variants.container} className={`col-span-7 flex flex-col justify-center ${imageSide === "left" ? "" : "pr-[2%]"}`}>
          <motion.h2 variants={variants.item} className="text-[3.5vw] font-bold leading-tight mb-4" style={{ color: theme.accent }}>{c.headline}</motion.h2>
          {c.subtitle && <motion.p variants={variants.item} className="text-[1.6vw] opacity-75 mb-6">{c.subtitle}</motion.p>}
          {c.body_text && <motion.p variants={variants.item} className="text-[1.3vw] leading-relaxed opacity-90 mb-5">{c.body_text}</motion.p>}
          {c.bullets && c.bullets.length > 0 && (
            <ul className="space-y-3">
              {c.bullets.map((b, i) => (
                <motion.li key={i} variants={variants.item} className="flex items-start gap-3 text-[1.3vw]">
                  <span className="mt-[0.6em] h-2 w-2 rounded-full flex-shrink-0" style={{ background: theme.accent }} />
                  <span className="leading-snug">{b}</span>
                </motion.li>
              ))}
            </ul>
          )}
        </motion.div>
        {imageSide === "right" && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, ease: EASE.editorial as any }} className="col-span-5 rounded-3xl overflow-hidden relative">
            <motion.img src={c.image_url!} alt="" className="absolute inset-0 w-full h-full object-cover" variants={kenBurnsVariants} initial="initial" animate="animate" />
          </motion.div>
        )}
      </div>
    );
  }

  /* ---------- DATA CHART ---------- */
  if (isChart && c.chart) {
    return <ChartSlide c={c} theme={theme} containerStyle={containerStyle} noAnimate={noAnimate} renderChart={renderChart} displayFont={displayFont} />;
  }

  /* ---------- DEFAULT ---------- */
  return <DefaultSlide c={c} theme={theme} containerStyle={containerStyle} noAnimate={noAnimate} displayFont={displayFont} />;
};
