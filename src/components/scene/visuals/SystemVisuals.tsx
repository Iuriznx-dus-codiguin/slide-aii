// Sistemas e conceitos nativos: SystemDiagram (SYSTEM_ARCHITECTURE,
// DATA_FLOW, NETWORK_MAP) com layout em camadas determinístico, e ConceptMap
// (CONCEPTUAL_MODEL; também é o desenho nativo de vistas técnicas sem mídia).
import { useMemo } from "react";
import { motion } from "framer-motion";
import { boxToPercent, layoutConcept, layoutSystem } from "@/lib/scene/diagramLayout";
import { rgba } from "@/lib/scene/color";
import { ConnectorLayer, NodeCard, track, VisualFrame, type VisualProps } from "./shared";

export const SystemDiagram = (p: VisualProps) => {
  const { model, aspect, ctrl, theme, type, displayFont } = p;
  const n = model.nodes.length;
  const groups = model.nodes.map((node) => node.group);
  const geo = useMemo(
    () => layoutSystem(n, model.edges, aspect, groups),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [n, aspect, JSON.stringify(model.edges), groups.join("|")],
  );
  // Cabeçalhos de camada quando os nós trazem `group`.
  const headers = useMemo(() => {
    if (!groups.some(Boolean)) return [];
    const seen = new Map<string, { x: number; y: number; w: number }>();
    model.nodes.forEach((node, i) => {
      if (!node.group || seen.has(node.group)) return;
      const b = geo.nodes[i];
      seen.set(node.group, { x: b.x, y: b.y, w: b.w });
    });
    return [...seen.entries()];
  }, [geo, model.nodes, groups]);
  return (
    <VisualFrame ctrl={ctrl}>
      <ConnectorLayer geo={geo} ctrl={ctrl} theme={theme} type={type} />
      {geo.orientation === "horizontal" && headers.map(([name, h]) => (
        <div
          key={name}
          className="absolute uppercase tracking-[0.22em] font-semibold"
          style={{ left: `${(h.x / geo.W) * 100}%`, width: `${(h.w / geo.W) * 100}%`, top: "-4%", fontSize: type.caption, color: theme.accent, opacity: 0.85 }}
        >
          {name}
        </div>
      ))}
      {model.nodes.map((item, i) => (
        <NodeCard key={i} box={geo.nodes[i]} geo={geo} item={item} index={i} ctrl={ctrl} theme={theme} type={type} displayFont={displayFont} />
      ))}
    </VisualFrame>
  );
};

export const ConceptMap = (p: VisualProps) => {
  const { model, aspect, ctrl, theme, type, displayFont, visual } = p;
  const n = model.nodes.length;
  const geo = useMemo(() => layoutConcept(n, aspect), [n, aspect]);
  const hubLabel = visual.subject ?? visual.annotation ?? "";
  return (
    <VisualFrame ctrl={ctrl}>
      <ConnectorLayer geo={geo} ctrl={ctrl} theme={theme} type={type} arrows={false} />
      <motion.div
        {...track(ctrl, "hub")}
        className="absolute flex items-center justify-center text-center font-bold leading-tight"
        style={{
          ...boxToPercent(geo.hub, geo),
          borderRadius: "999px",
          padding: "0.6cqw 1.2cqw",
          background: theme.accent,
          color: theme.bg,
          fontFamily: displayFont,
          fontSize: `calc(${type.itemLabel} * 1.15)`,
          boxShadow: `0 0 0 0.6cqw ${rgba(theme.accent, 0.14)}`,
        }}
      >
        {hubLabel}
      </motion.div>
      {model.nodes.map((item, i) => (
        <NodeCard key={i} box={geo.nodes[i]} geo={geo} item={item} index={i} ctrl={ctrl} theme={theme} type={type} displayFont={displayFont} align="center" />
      ))}
    </VisualFrame>
  );
};
