import { motion } from "framer-motion";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import { resolveTheme, FONTS, type ThemeColors } from "@/lib/slugify";

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
  /** index of this slide — used to vary animation timing */
  index?: number;
  /** disable animations (for thumbnails / print) */
  noAnimate?: boolean;
}

/** Animation variants library. */
const getMotionProps = (preset: string | undefined, noAnimate: boolean) => {
  if (noAnimate) return { initial: false, animate: { opacity: 1 } };
  const p = preset ?? "fade";
  const t = { duration: 0.6, ease: [0.19, 1, 0.22, 1] as any };
  switch (p) {
    case "slide-up":     return { initial: { opacity: 0, y: 60 },  animate: { opacity: 1, y: 0 }, transition: t };
    case "slide-left":   return { initial: { opacity: 0, x: 60 },  animate: { opacity: 1, x: 0 }, transition: t };
    case "slide-right":  return { initial: { opacity: 0, x: -60 }, animate: { opacity: 1, x: 0 }, transition: t };
    case "zoom-in":      return { initial: { opacity: 0, scale: 0.85 }, animate: { opacity: 1, scale: 1 }, transition: t };
    case "blur-in":      return { initial: { opacity: 0, filter: "blur(20px)" }, animate: { opacity: 1, filter: "blur(0px)" }, transition: t };
    case "reveal-mask":  return { initial: { opacity: 0, clipPath: "inset(0 100% 0 0)" }, animate: { opacity: 1, clipPath: "inset(0 0% 0 0)" }, transition: { ...t, duration: 0.9 } };
    case "rotate-in":    return { initial: { opacity: 0, rotate: -8, scale: 0.9 }, animate: { opacity: 1, rotate: 0, scale: 1 }, transition: t };
    case "bounce-in":    return { initial: { opacity: 0, scale: 0.6 }, animate: { opacity: 1, scale: 1 }, transition: { type: "spring", damping: 14, stiffness: 180 } };
    case "stagger-up":   return { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 }, transition: t };
    case "fade":
    default:             return { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: t };
  }
};

const hexToRgba = (hex: string, alpha: number) => {
  const h = hex.replace("#", "");
  const bigint = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const SlideRenderer = ({ slide, themeId, fontId, dynamicTheme, noAnimate = false }: Props) => {
  const theme = resolveTheme(themeId, dynamicTheme);
  const font = FONTS[fontId] ?? FONTS["modern-sans"];
  const c = slide.content || {};
  const motionProps = getMotionProps(c.animation, noAnimate);

  const COLORS = [theme.accent, theme.accent2 || "#F59E0B", "#10B981", "#EF4444", "#8B5CF6", "#06B6D4"];
  const isDark = (() => {
    const h = theme.bg.replace("#", "");
    const big = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h, 16);
    const r = (big >> 16) & 255, g = (big >> 8) & 255, b = big & 255;
    return (r * 0.299 + g * 0.587 + b * 0.114) < 140;
  })();

  const chartData = c.chart ? c.chart.labels.map((l, i) => ({ name: l, value: c.chart!.values[i] ?? 0 })) : [];

  const renderChart = () => {
    if (!c.chart) return null;
    const t = c.chart.type;
    const gridColor = hexToRgba(theme.text, 0.1);
    const tickStyle = { fill: theme.text, fontSize: 14, opacity: 0.7 };
    return (
      <ResponsiveContainer width="100%" height="100%">
        {t === "bar" ? (
          <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
            <CartesianGrid stroke={gridColor} vertical={false} />
            <XAxis dataKey="name" stroke={theme.text} tick={tickStyle} />
            <YAxis stroke={theme.text} tick={tickStyle} />
            <Tooltip cursor={{ fill: hexToRgba(theme.accent, 0.1) }} contentStyle={{ background: theme.bg, border: `1px solid ${hexToRgba(theme.text, 0.2)}`, borderRadius: 12, color: theme.text }} />
            <Bar dataKey="value" fill={theme.accent} radius={[10, 10, 0, 0]} />
          </BarChart>
        ) : t === "line" ? (
          <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
            <CartesianGrid stroke={gridColor} vertical={false} />
            <XAxis dataKey="name" stroke={theme.text} tick={tickStyle} />
            <YAxis stroke={theme.text} tick={tickStyle} />
            <Tooltip contentStyle={{ background: theme.bg, border: `1px solid ${hexToRgba(theme.text, 0.2)}`, borderRadius: 12, color: theme.text }} />
            <Line type="monotone" dataKey="value" stroke={theme.accent} strokeWidth={3} dot={{ fill: theme.accent, r: 5 }} />
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
            <Area type="monotone" dataKey="value" stroke={theme.accent} fill="url(#areaFill)" strokeWidth={3} />
          </AreaChart>
        ) : (
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" outerRadius="75%" innerRadius={t === "donut" ? "45%" : 0} paddingAngle={2}>
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
  const isTitle = slide.slide_type === "title_slide" || layout === "title-only" || layout === "split-hero";
  const isQuote = slide.slide_type === "quote" || layout === "quote";
  const isChart = slide.slide_type === "data_chart" || layout === "data-chart" || (!!c.chart && layout !== "image-right" && layout !== "image-left");
  const isStat = layout === "stat-highlight" && c.stat_value;
  const isCentered = layout === "centered" || slide.slide_type === "section_divider";
  const hasImage = !!c.image_url && (layout === "image-right" || layout === "image-left" || layout === "full-image" || layout === "split-hero");

  const containerStyle: React.CSSProperties = {
    background: theme.gradient || theme.bg,
    color: theme.text,
    fontFamily: font.family,
  };

  // FULL IMAGE LAYOUT — image as background, text overlay
  if (layout === "full-image" && c.image_url) {
    return (
      <div className="relative w-full h-full overflow-hidden" style={containerStyle}>
        <img src={c.image_url} alt={c.headline || ""} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${hexToRgba(theme.bg, 0.85)} 0%, ${hexToRgba(theme.bg, 0.4)} 100%)` }} />
        <motion.div {...motionProps} className="relative h-full flex flex-col justify-end p-[5%]">
          <div className="h-1.5 w-24 mb-6" style={{ background: theme.accent }} />
          <h1 className="text-[5vw] md:text-[4.5vw] font-extrabold leading-[1.05] tracking-tight max-w-[80%]">{c.headline}</h1>
          {c.subtitle && <p className="mt-4 text-[2vw] md:text-[1.8vw] opacity-90 max-w-[70%]">{c.subtitle}</p>}
        </motion.div>
      </div>
    );
  }

  // SPLIT HERO — image takes half, text takes half
  if (layout === "split-hero" && c.image_url) {
    return (
      <div className="w-full h-full grid grid-cols-2 overflow-hidden" style={containerStyle}>
        <motion.div {...motionProps} className="flex flex-col justify-center p-[5%]">
          <div className="h-1.5 w-20 mb-6" style={{ background: theme.accent }} />
          <h1 className="text-[4vw] font-extrabold leading-[1.05] tracking-tight">{c.headline}</h1>
          {c.subtitle && <p className="mt-5 text-[1.7vw] opacity-80">{c.subtitle}</p>}
          {c.body_text && <p className="mt-4 text-[1.2vw] opacity-70 leading-relaxed">{c.body_text}</p>}
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }} className="relative">
          <img src={c.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-y-0 left-0 w-32" style={{ background: `linear-gradient(90deg, ${theme.bg}, transparent)` }} />
        </motion.div>
      </div>
    );
  }

  // QUOTE
  if (isQuote && c.quote_text) {
    return (
      <div className="w-full h-full flex items-center justify-center p-[6%] relative overflow-hidden" style={containerStyle}>
        <div className="absolute inset-0 opacity-[0.04]" style={{ background: `radial-gradient(circle at 30% 20%, ${theme.accent}, transparent 60%)` }} />
        <motion.div {...motionProps} className="text-center max-w-5xl relative">
          <div className="text-[10vw] leading-none mb-4 font-serif" style={{ color: theme.accent, opacity: 0.4 }}>“</div>
          <p className="text-[3vw] font-light leading-[1.25] italic">{c.quote_text}</p>
          {c.quote_author && (
            <div className="mt-10 flex items-center justify-center gap-4">
              <div className="h-px w-12" style={{ background: theme.accent }} />
              <p className="text-[1.3vw] tracking-wide uppercase opacity-80">{c.quote_author}</p>
              <div className="h-px w-12" style={{ background: theme.accent }} />
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // STAT HIGHLIGHT
  if (isStat) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-[5%] relative overflow-hidden" style={containerStyle}>
        <motion.div {...motionProps} className="text-center">
          {c.subtitle && <p className="text-[1.4vw] uppercase tracking-[0.3em] opacity-60 mb-6">{c.subtitle}</p>}
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", damping: 12, stiffness: 100, delay: 0.2 }}
            className="text-[14vw] font-extrabold leading-none tracking-tighter" style={{ color: theme.accent }}>
            {c.stat_value}
          </motion.div>
          <p className="mt-8 text-[2vw] max-w-3xl mx-auto opacity-90 leading-snug">{c.stat_label || c.headline}</p>
        </motion.div>
      </div>
    );
  }

  // TITLE
  if (isTitle) {
    return (
      <div className="w-full h-full flex flex-col p-[6%] relative overflow-hidden" style={containerStyle}>
        <div className="absolute -top-1/4 -right-1/4 w-[60%] h-[60%] rounded-full opacity-[0.08]" style={{ background: theme.accent, filter: "blur(80px)" }} />
        <div className="flex-1 flex flex-col justify-center relative">
          <motion.div {...motionProps}>
            <div className="h-1.5 w-32 mb-8" style={{ background: theme.accent }} />
            <h1 className="text-[6vw] font-extrabold leading-[1.02] tracking-tighter">{c.headline}</h1>
            {c.subtitle && <p className="mt-8 text-[2vw] opacity-80 max-w-[75%] leading-snug">{c.subtitle}</p>}
          </motion.div>
        </div>
        <div className="text-[1vw] opacity-50 tracking-widest uppercase">SlideAI</div>
      </div>
    );
  }

  // CENTERED / SECTION DIVIDER
  if (isCentered) {
    return (
      <div className="w-full h-full flex items-center justify-center p-[6%] text-center" style={containerStyle}>
        <motion.div {...motionProps}>
          {c.subtitle && <p className="text-[1.3vw] uppercase tracking-[0.3em] opacity-60 mb-6">{c.subtitle}</p>}
          <h1 className="text-[5vw] font-extrabold leading-[1.05] tracking-tight">{c.headline}</h1>
          {c.body_text && <p className="mt-6 text-[1.6vw] opacity-80 max-w-3xl mx-auto">{c.body_text}</p>}
          <div className="mt-10 mx-auto h-1 w-24" style={{ background: theme.accent }} />
        </motion.div>
      </div>
    );
  }

  // IMAGE-LEFT / IMAGE-RIGHT
  if (hasImage && (layout === "image-right" || layout === "image-left")) {
    const imageSide = layout === "image-right" ? "right" : "left";
    return (
      <div className="w-full h-full grid grid-cols-12 gap-[3%] p-[4%]" style={containerStyle}>
        {imageSide === "left" && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7 }} className="col-span-5 rounded-3xl overflow-hidden relative">
            <img src={c.image_url!} alt="" className="absolute inset-0 w-full h-full object-cover" />
          </motion.div>
        )}
        <motion.div {...motionProps} className={`col-span-7 flex flex-col justify-center ${imageSide === "left" ? "" : "pr-[2%]"}`}>
          <h2 className="text-[3.5vw] font-bold leading-tight mb-4" style={{ color: theme.accent }}>{c.headline}</h2>
          {c.subtitle && <p className="text-[1.6vw] opacity-75 mb-6">{c.subtitle}</p>}
          {c.body_text && <p className="text-[1.3vw] leading-relaxed opacity-90 mb-5">{c.body_text}</p>}
          {c.bullets && c.bullets.length > 0 && (
            <ul className="space-y-3">
              {c.bullets.map((b, i) => (
                <motion.li key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.08 }}
                  className="flex items-start gap-3 text-[1.3vw]">
                  <span className="mt-[0.6em] h-2 w-2 rounded-full flex-shrink-0" style={{ background: theme.accent }} />
                  <span className="leading-snug">{b}</span>
                </motion.li>
              ))}
            </ul>
          )}
        </motion.div>
        {imageSide === "right" && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7 }} className="col-span-5 rounded-3xl overflow-hidden relative">
            <img src={c.image_url!} alt="" className="absolute inset-0 w-full h-full object-cover" />
          </motion.div>
        )}
      </div>
    );
  }

  // DATA CHART
  if (isChart && c.chart) {
    return (
      <div className="w-full h-full flex flex-col p-[5%]" style={containerStyle}>
        <motion.div {...motionProps}>
          <h2 className="text-[3vw] font-bold leading-tight" style={{ color: theme.accent }}>{c.headline}</h2>
          {c.subtitle && <p className="text-[1.4vw] opacity-70 mt-1">{c.subtitle}</p>}
        </motion.div>
        <div className="grid grid-cols-12 gap-[3%] flex-1 mt-6">
          <div className="col-span-7 min-h-0">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.6 }} className="h-full">
              {renderChart()}
            </motion.div>
          </div>
          <div className="col-span-5 flex flex-col justify-center">
            {c.body_text && <p className="text-[1.25vw] leading-relaxed opacity-90 mb-5">{c.body_text}</p>}
            {c.bullets && c.bullets.length > 0 && (
              <ul className="space-y-3">
                {c.bullets.map((b, i) => (
                  <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.08 }}
                    className="flex items-start gap-2 text-[1.2vw]">
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
  }

  // DEFAULT: title + content + bullets
  return (
    <div className="w-full h-full flex flex-col p-[5%]" style={containerStyle}>
      <motion.div {...motionProps}>
        <h2 className="text-[3.2vw] font-bold leading-tight" style={{ color: theme.accent }}>{c.headline}</h2>
        {c.subtitle && <p className="text-[1.5vw] opacity-70 mt-1">{c.subtitle}</p>}
      </motion.div>
      <div className="flex-1 mt-6 flex flex-col justify-center">
        {c.body_text && (
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="text-[1.4vw] leading-relaxed opacity-95 mb-6 max-w-[90%]">
            {c.body_text}
          </motion.p>
        )}
        {c.bullets && c.bullets.length > 0 && (
          <ul className="space-y-4">
            {c.bullets.map((b, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.1, ease: [0.19, 1, 0.22, 1] }}
                className="flex items-start gap-4 text-[1.4vw]">
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
