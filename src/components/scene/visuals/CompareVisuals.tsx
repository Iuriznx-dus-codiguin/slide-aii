// Comparação nativa: SIDE_BY_SIDE, BEFORE_AFTER (com morph A→B via flubber),
// FEATURE_COMPARISON e SCALE_COMPARISON (áreas proporcionais ao valor).
import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { boxToPercent, layoutColumns, layoutScale } from "@/lib/scene/diagramLayout";
import { formatValue } from "@/lib/scene/visualModel";
import { mix, readableOn, rgba } from "@/lib/scene/color";
import { useMorphPath } from "@/lib/morphing";
import { sceneIcon } from "../sceneIcons";
import { track, VisualFrame, type VisualProps } from "./shared";

// Forma "antes" (irregular) → "depois" (organizada): a transformação é o
// gesto do slide, não um enfeite.
const BEFORE_PATH = "M20,55 L34,22 L52,40 L70,12 L84,48 L66,86 L40,74 Z";
const AFTER_PATH = "M50,10 C72,10 90,28 90,50 C90,72 72,90 50,90 C28,90 10,72 10,50 C10,28 28,10 50,10 Z";

const MorphGlyph = ({ progress, color }: { progress: number; color: string }) => {
  const d = useMorphPath(BEFORE_PATH, AFTER_PATH, progress);
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden>
      <path d={d} fill={color} fillOpacity={0.9} />
    </svg>
  );
};

export const ComparisonDiagram = (p: VisualProps) => {
  const { model, aspect, ctrl, theme, type, displayFont } = p;
  const variant = model.variant;

  // ── Escala: círculos com ÁREA proporcional ao valor ───────────────────
  const values = model.nodes.map((n) => (typeof n.value === "number" ? n.value : 0));
  // Chave estável: o array é recriado a cada render, os números não.
  const valuesKey = values.join(",");
  const scaleGeo = useMemo(
    () => (variant === "scale" ? layoutScale(valuesKey ? valuesKey.split(",").map(Number) : [], aspect) : null),
    [variant, aspect, valuesKey],
  );
  if (variant === "scale" && scaleGeo) {
    const max = Math.max(...values, 1);
    return (
      <VisualFrame ctrl={ctrl}>
        {model.nodes.map((item, i) => {
          const b = scaleGeo.nodes[i];
          const c = track(ctrl, `value-${i}`);
          const progress = p.noAnimate ? 1 : ctrl.sampleFor(`value-${i}`).count ?? 1;
          const fill = mix(theme.accent, theme.accent2 || theme.accent, i / Math.max(1, model.nodes.length - 1));
          return (
            <div key={i}>
              <motion.div
                {...track(ctrl, `node-${i}`)}
                className="absolute rounded-full flex items-center justify-center"
                style={{ ...boxToPercent(b, scaleGeo), background: rgba(fill, 0.22 + 0.6 * (values[i] / max)), border: `2px solid ${fill}` }}
              >
                <motion.span {...c} className="font-bold tabular-nums" style={{ fontSize: type.value, fontFamily: displayFont, color: readableOn(theme.bg) }}>
                  {formatValue(values[i] * progress, item.unit)}
                </motion.span>
              </motion.div>
              <div
                className="absolute text-center leading-tight"
                style={{ left: `${(b.x / scaleGeo.W) * 100}%`, width: `${(b.w / scaleGeo.W) * 100}%`, top: "88%", fontSize: type.itemLabel, fontWeight: 600 }}
              >
                {item.label}
              </div>
            </div>
          );
        })}
      </VisualFrame>
    );
  }

  // ── Antes/depois em linhas (from → to) ────────────────────────────────
  if (variant === "before-after" && model.rows.length >= 2) {
    return (
      <VisualFrame ctrl={ctrl} className="flex flex-col justify-center" style={{ gap: "1.1cqw" }}>
        {model.rows.map((row, i) => (
          <motion.div key={i} {...track(ctrl, `node-${i}`)} className="grid items-center" style={{ gridTemplateColumns: "1fr auto 1fr", gap: "1.2cqw" }}>
            <div style={{ fontSize: type.itemLabel, opacity: 0.6, textDecoration: "line-through", textDecorationColor: rgba(theme.text, 0.35) }}>{row.from}</div>
            <ArrowRight style={{ width: "1.8cqw", height: "1.8cqw", color: theme.accent }} />
            <div className="font-semibold" style={{ fontSize: type.itemLabel, color: theme.text }}>
              <span style={{ borderBottom: `3px solid ${theme.accent}` }}>{row.to}</span>
              {row.label && <span className="block" style={{ fontSize: type.itemDetail, opacity: 0.7, fontWeight: 400 }}>{row.label}</span>}
            </div>
          </motion.div>
        ))}
      </VisualFrame>
    );
  }

  // ── Recursos por lado (FEATURE_COMPARISON) ─────────────────────────────
  if (variant === "features") {
    const sides = model.groups.slice(0, 2);
    const geo = layoutColumns(2, aspect, 60);
    let k = 0;
    return (
      <VisualFrame ctrl={ctrl}>
        {sides.map((side, s) => (
          <div key={side} className="absolute flex flex-col" style={{ ...boxToPercent(geo.nodes[s], geo), gap: "0.8cqw" }}>
            <div className="font-bold uppercase tracking-[0.2em]" style={{ fontSize: type.caption, color: s === 0 ? theme.accent : theme.accent2 || theme.accent }}>
              {side}
            </div>
            {model.nodes.filter((n) => n.group === side).map((item) => {
              const idx = k++;
              const Icon = sceneIcon(item.icon);
              return (
                <motion.div key={idx} {...track(ctrl, `node-${idx}`)} className="flex items-start" style={{ gap: "0.6cqw", paddingBottom: "0.6cqw", borderBottom: `1px solid ${rgba(theme.text, 0.1)}` }}>
                  {Icon ? <Icon style={{ width: "1.4cqw", height: "1.4cqw", color: theme.accent, flexShrink: 0 }} /> : <span className="rounded-full" style={{ width: "0.6cqw", height: "0.6cqw", marginTop: "0.5cqw", background: theme.accent, flexShrink: 0 }} />}
                  <div>
                    <div className="font-semibold leading-tight" style={{ fontSize: type.itemLabel }}>{item.label}</div>
                    {item.detail && <div style={{ fontSize: type.itemDetail, opacity: 0.75 }}>{item.detail}</div>}
                  </div>
                </motion.div>
              );
            })}
          </div>
        ))}
      </VisualFrame>
    );
  }

  // ── Lados (SIDE_BY_SIDE) e antes/depois em dois painéis ────────────────
  const sides = model.nodes.slice(0, variant === "before-after" ? 2 : 3);
  const geo = layoutColumns(sides.length, aspect, sides.length === 2 ? 120 : 56);
  const morph = p.noAnimate ? 1 : ctrl.sampleFor("morph").count ?? 1;
  return (
    <VisualFrame ctrl={ctrl}>
      {sides.map((item, i) => {
        const Icon = sceneIcon(item.icon);
        const after = variant === "before-after" && i === 1;
        const before = variant === "before-after" && i === 0;
        // Painéis NÃO idênticos: cada lado com sua cor; "antes" esmaecido.
        const color = i === 0 ? theme.accent : theme.accent2 || mix(theme.accent, theme.text, 0.35);
        return (
          <motion.div
            key={i}
            {...track(ctrl, `node-${i}`)}
            className="absolute flex flex-col"
            style={{
              ...boxToPercent(geo.nodes[i], geo),
              padding: "1.4cqw",
              borderRadius: "1.1cqw",
              gap: "0.7cqw",
              background: after ? rgba(color, 0.14) : rgba(theme.text, before ? 0.03 : 0.05),
              border: `1px solid ${rgba(color, after ? 0.6 : 0.28)}`,
              opacity: before ? 0.82 : 1,
            }}
          >
            <div className="h-[0.35cqw] w-[4cqw] rounded-full" style={{ background: color }} />
            {Icon && <Icon style={{ width: "2.2cqw", height: "2.2cqw", color }} strokeWidth={1.6} />}
            <div className="font-bold leading-tight" style={{ fontSize: `calc(${type.itemLabel} * 1.35)`, fontFamily: displayFont }}>{item.label}</div>
            {typeof item.value === "number" && <div className="font-black tabular-nums" style={{ fontSize: type.value, color }}>{formatValue(item.value, item.unit)}</div>}
            {item.detail && <div className="leading-snug" style={{ fontSize: `calc(${type.itemDetail} * 1.12)`, opacity: 0.8 }}>{item.detail}</div>}
          </motion.div>
        );
      })}
      {sides.length === 2 && (
        <div
          className="absolute flex items-center justify-center"
          style={{ left: "44%", width: "12%", top: "38%", height: "24%" }}
        >
          {variant === "before-after"
            ? <MorphGlyph progress={Math.max(0, Math.min(1, morph))} color={theme.accent} />
            : <span className="rounded-full flex items-center justify-center font-black" style={{ width: "4cqw", height: "4cqw", fontSize: type.caption, background: theme.accent, color: theme.bg }}>VS</span>}
        </div>
      )}
    </VisualFrame>
  );
};
