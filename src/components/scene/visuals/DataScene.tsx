// Visual de dados nativo: GROWTH_VISUAL (barras), TREND_VISUAL (área) e
// DATA_SCENE (barras ou rosca). Reaproveita o recharts já instalado e a
// contagem numérica; o destaque é o número mais recente, contado do zero.
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { formatValue } from "@/lib/scene/visualModel";
import { mix, rgba } from "@/lib/scene/color";
import { track, VisualFrame, type VisualProps } from "./shared";

export const DataScene = (p: VisualProps) => {
  const { model, theme, type, ctrl, noAnimate, displayFont, visual } = p;
  const data = useMemo(
    () => model.nodes
      .map((n) => ({ name: n.label, value: typeof n.value === "number" ? n.value : NaN, unit: n.unit }))
      .filter((d) => Number.isFinite(d.value)),
    [model.nodes],
  );
  const unit = data.find((d) => d.unit)?.unit;
  const donut = model.variant === "categories" && (visual.modifiers ?? []).some((m) => m === "donut" || m === "pie");
  const kind = model.variant === "trend" ? "area" : donut ? "donut" : "bar";
  const last = data[data.length - 1];
  const first = data[0];
  const progress = noAnimate ? 1 : ctrl.sampleFor("value-0").count ?? 1;
  const delta = first && last && first.value !== 0 && kind !== "donut" ? ((last.value - first.value) / Math.abs(first.value)) * 100 : null;
  const duration = noAnimate ? 0 : 1200;
  const tick = { fill: theme.text, fontSize: 13, opacity: 0.7 };
  const colors = data.map((_, i) => mix(theme.accent, theme.accent2 || theme.text, i / Math.max(1, data.length - 1) * 0.7));
  const gradId = `ds-${(visual.command ?? "x").toLowerCase()}`;

  return (
    <VisualFrame ctrl={ctrl} className="flex flex-col" style={{ gap: "0.8cqw" }}>
      {last && (
        <motion.div {...track(ctrl, "visual")} className="flex items-end" style={{ gap: "1.2cqw" }}>
          <div className="font-black tabular-nums leading-none" style={{ fontSize: type.value, color: theme.accent, fontFamily: displayFont }}>
            {formatValue(last.value * Math.max(0, Math.min(1, progress)), unit)}
          </div>
          <div style={{ fontSize: type.itemDetail, opacity: 0.75, paddingBottom: "0.3cqw" }}>
            {last.name}
            {delta !== null && Number.isFinite(delta) && (
              <span className="font-semibold" style={{ marginLeft: "0.6cqw", color: delta >= 0 ? theme.accent : theme.text }}>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%
              </span>
            )}
          </div>
        </motion.div>
      )}
      <motion.div {...track(ctrl, "visual")} className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {kind === "donut" ? (
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="82%" paddingAngle={2} animationDuration={duration} label={({ name }) => name}>
                {data.map((_, i) => <Cell key={i} fill={colors[i]} stroke={theme.bg} strokeWidth={3} />)}
              </Pie>
            </PieChart>
          ) : kind === "area" ? (
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={theme.accent} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={theme.accent} stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={rgba(theme.text, 0.08)} vertical={false} />
              <XAxis dataKey="name" tick={tick} stroke={rgba(theme.text, 0.2)} />
              <YAxis tick={tick} stroke={rgba(theme.text, 0.2)} />
              <Area type="monotone" dataKey="value" stroke={theme.accent} strokeWidth={3} fill={`url(#${gradId})`} animationDuration={duration} />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
              <CartesianGrid stroke={rgba(theme.text, 0.08)} vertical={false} />
              <XAxis dataKey="name" tick={tick} stroke={rgba(theme.text, 0.2)} />
              <YAxis tick={tick} stroke={rgba(theme.text, 0.2)} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} animationDuration={duration}>
                {data.map((_, i) => <Cell key={i} fill={i === data.length - 1 ? theme.accent : rgba(theme.accent, 0.45)} />)}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </motion.div>
      {visual.annotation && <div style={{ fontSize: type.caption, opacity: 0.6 }}>{visual.annotation}</div>}
    </VisualFrame>
  );
};
