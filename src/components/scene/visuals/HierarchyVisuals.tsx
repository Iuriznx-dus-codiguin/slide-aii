// Hierarquias nativas: FunnelDiagram (FUNNEL), PyramidDiagram (PYRAMID) e
// LayerStack (desenho nativo fiel de LAYERED_VIEW e CROSS_SECTION quando não
// há mídia). Faixas SVG + rótulos HTML.
import { useMemo } from "react";
import { motion } from "framer-motion";
import { boxToPercent, layoutFunnel, layoutLayers, layoutPyramid, type DiagramGeometry } from "@/lib/scene/diagramLayout";
import { formatValue } from "@/lib/scene/visualModel";
import { mix, readableOn, rgba } from "@/lib/scene/color";
import { track, VisualFrame, type VisualProps } from "./shared";

function Bands({ geo, p, kind }: { geo: DiagramGeometry; p: VisualProps; kind: "band" | "plate" }) {
  const { theme, ctrl, model } = p;
  const n = Math.max(1, model.nodes.length);
  const accent2 = theme.accent2 || mix(theme.accent, theme.bg, 0.45);
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${geo.W} ${geo.H}`} preserveAspectRatio="none" aria-hidden>
      {geo.shapes.map((s, i) => {
        const idx = s.index ?? 0;
        const t = idx / Math.max(1, n - 1);
        const fill = mix(theme.accent, accent2, t);
        if (s.kind === "leader") return <motion.path key={i} d={s.d} stroke={rgba(theme.text, 0.35)} strokeWidth={1.4} fill="none" {...track(ctrl, `shape-${idx}`)} />;
        if (s.kind === "plate-side") return <motion.path key={i} d={s.d} fill={mix(fill, "#000000", 0.35)} {...track(ctrl, `shape-${idx}`)} />;
        if (s.kind !== kind) return null;
        return <motion.path key={i} d={s.d} fill={fill} fillOpacity={kind === "plate" ? 0.92 : 0.9 - t * 0.35} {...track(ctrl, `shape-${idx}`)} />;
      })}
    </svg>
  );
}

function BandLabels({ geo, p, onBand }: { geo: DiagramGeometry; p: VisualProps; onBand: boolean }) {
  const { theme, ctrl, model, type, displayFont } = p;
  const n = Math.max(1, model.nodes.length);
  const accent2 = theme.accent2 || mix(theme.accent, theme.bg, 0.45);
  return (
    <>
      {model.nodes.map((item, i) => {
        const fill = mix(theme.accent, accent2, i / Math.max(1, n - 1));
        const color = onBand ? readableOn(fill) : theme.text;
        const value = formatValue(item.value, item.unit);
        return (
          <motion.div
            key={i}
            {...track(ctrl, `node-${i}`)}
            className="absolute flex flex-col justify-center"
            style={{ ...boxToPercent(geo.nodes[i], geo), color, textAlign: onBand ? "center" : "left", alignItems: onBand ? "center" : "flex-start", gap: "0.2cqw" }}
          >
            <div className="font-bold leading-tight" style={{ fontSize: type.itemLabel, fontFamily: displayFont }}>
              {item.label}{value && <span className="tabular-nums" style={{ marginLeft: "0.6cqw", opacity: 0.9 }}>{value}</span>}
            </div>
            {item.detail && <div className="leading-snug" style={{ fontSize: type.itemDetail, opacity: 0.85, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.detail}</div>}
          </motion.div>
        );
      })}
    </>
  );
}

export const FunnelDiagram = (p: VisualProps) => {
  const n = p.model.nodes.length;
  const geo = useMemo(() => layoutFunnel(n, p.aspect), [n, p.aspect]);
  return (
    <VisualFrame ctrl={p.ctrl}>
      <Bands geo={geo} p={p} kind="band" />
      <BandLabels geo={geo} p={p} onBand />
    </VisualFrame>
  );
};

export const PyramidDiagram = (p: VisualProps) => {
  const n = p.model.nodes.length;
  const geo = useMemo(() => layoutPyramid(n, p.aspect), [n, p.aspect]);
  return (
    <VisualFrame ctrl={p.ctrl}>
      <Bands geo={geo} p={p} kind="band" />
      <BandLabels geo={geo} p={p} onBand />
    </VisualFrame>
  );
};

export const LayerStack = (p: VisualProps) => {
  const n = p.model.nodes.length;
  const geo = useMemo(() => layoutLayers(n, p.aspect), [n, p.aspect]);
  return (
    <VisualFrame ctrl={p.ctrl}>
      <Bands geo={geo} p={p} kind="plate" />
      <BandLabels geo={geo} p={p} onBand={false} />
      {p.visual.subject && (
        <div className="absolute uppercase tracking-[0.25em] font-semibold" style={{ left: 0, bottom: 0, fontSize: p.type.caption, opacity: 0.6 }}>
          {p.visual.subject}
        </div>
      )}
    </VisualFrame>
  );
};
