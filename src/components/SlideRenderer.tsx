import { motion } from "framer-motion";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { THEMES, FONTS } from "@/lib/slugify";

interface SlideContent {
  headline?: string;
  subtitle?: string;
  body_text?: string;
  bullets?: string[];
  quote_text?: string;
  quote_author?: string;
  suggested_image_query?: string;
  chart?: { type: string; labels: string[]; values: number[]; title?: string };
}

interface Props {
  slide: { slide_type: string; layout_template: string; content: SlideContent };
  themeId: string;
  fontId: string;
}

export const SlideRenderer = ({ slide, themeId, fontId }: Props) => {
  const theme = THEMES[themeId] ?? THEMES["profissional-azul"];
  const font = FONTS[fontId] ?? FONTS["modern-sans"];
  const c = slide.content || {};

  const chartData = c.chart ? c.chart.labels.map((l, i) => ({ name: l, value: c.chart!.values[i] ?? 0 })) : [];
  const COLORS = [theme.accent, "#F59E0B", "#10B981", "#EF4444", "#8B5CF6", "#06B6D4"];

  const renderChart = () => {
    if (!c.chart) return null;
    const t = c.chart.type;
    return (
      <ResponsiveContainer width="100%" height={400}>
        {t === "bar" ? (
          <BarChart data={chartData}><XAxis dataKey="name" stroke={theme.text} /><YAxis stroke={theme.text} /><Tooltip /><Bar dataKey="value" fill={theme.accent} radius={[8, 8, 0, 0]} /></BarChart>
        ) : t === "line" || t === "area" ? (
          t === "line" ? (
            <LineChart data={chartData}><XAxis dataKey="name" stroke={theme.text} /><YAxis stroke={theme.text} /><Tooltip /><Line type="monotone" dataKey="value" stroke={theme.accent} strokeWidth={3} /></LineChart>
          ) : (
            <AreaChart data={chartData}><XAxis dataKey="name" stroke={theme.text} /><YAxis stroke={theme.text} /><Tooltip /><Area type="monotone" dataKey="value" stroke={theme.accent} fill={theme.accent} fillOpacity={0.3} /></AreaChart>
          )
        ) : (
          <PieChart><Pie data={chartData} dataKey="value" nameKey="name" outerRadius={150} innerRadius={t === "donut" ? 80 : 0} label>{chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Legend /><Tooltip /></PieChart>
        )}
      </ResponsiveContainer>
    );
  };

  const isTitle = slide.slide_type === "title_slide" || slide.layout_template === "title-only";
  const isQuote = slide.slide_type === "quote";
  const isChart = slide.slide_type === "data_chart" || c.chart;

  return (
    <div
      className="w-full h-full flex flex-col p-16 overflow-hidden"
      style={{ background: theme.bg, color: theme.text, fontFamily: font.family }}
    >
      {isQuote && c.quote_text ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}>
            <div className="text-7xl mb-6 opacity-30" style={{ color: theme.accent }}>"</div>
            <p className="text-3xl md:text-5xl font-light leading-tight italic max-w-4xl">{c.quote_text}</p>
            {c.quote_author && <p className="mt-8 text-xl opacity-70">— {c.quote_author}</p>}
          </motion.div>
        </div>
      ) : isTitle ? (
        <div className="flex-1 flex flex-col justify-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="h-1 w-24 mb-6" style={{ background: theme.accent }} />
            <h1 className="text-5xl md:text-7xl font-extrabold leading-tight tracking-tight">{c.headline}</h1>
            {c.subtitle && <p className="mt-6 text-xl md:text-2xl opacity-80 max-w-3xl">{c.subtitle}</p>}
          </motion.div>
        </div>
      ) : (
        <>
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-3xl md:text-5xl font-bold mb-2 leading-tight" style={{ color: theme.accent }}>{c.headline}</h2>
            {c.subtitle && <p className="text-lg md:text-xl opacity-70">{c.subtitle}</p>}
          </motion.div>
          <div className="flex-1 mt-8 grid gap-8" style={{ gridTemplateColumns: isChart ? "1fr" : "1fr" }}>
            <div className="flex flex-col justify-center">
              {c.body_text && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                  className="text-lg md:text-xl leading-relaxed mb-6 opacity-90">{c.body_text}</motion.p>
              )}
              {c.bullets && c.bullets.length > 0 && (
                <ul className="space-y-3">
                  {c.bullets.map((b, i) => (
                    <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.08 }}
                      className="flex items-start gap-3 text-lg md:text-xl">
                      <span className="mt-2 h-2 w-2 rounded-full flex-shrink-0" style={{ background: theme.accent }} />
                      <span>{b}</span>
                    </motion.li>
                  ))}
                </ul>
              )}
              {isChart && c.chart && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-4">
                  {c.chart.title && <h3 className="text-lg font-semibold mb-3 opacity-80">{c.chart.title}</h3>}
                  {renderChart()}
                </motion.div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
