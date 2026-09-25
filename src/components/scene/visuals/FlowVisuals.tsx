// Visuais nativos de sequência: FlowDiagram (PROCESS_FLOW, STEP_BY_STEP,
// SEQUENCE, PIPELINE, WORKFLOW), CycleDiagram (CYCLE, LOOP) e TimelineDiagram
// (TIMELINE, EVOLUTION, PROGRESSION). SVG/HTML com os tokens do tema e a
// fonte do deck: custo zero, texto editável e animável.
import { useMemo } from "react";
import { motion } from "framer-motion";
import { layoutCycle, layoutFlow, layoutTimeline, W, type Box } from "@/lib/scene/diagramLayout";
import { rgba } from "@/lib/scene/color";
import { ConnectorLayer, NodeCard, track, VisualFrame, type VisualProps } from "./shared";

const NUMBERED = new Set(["steps", "pipeline"]);

export const FlowDiagram = (p: VisualProps & { listToFlow?: boolean }) => {
  const { model, aspect, ctrl, theme, type, displayFont } = p;
  const n = model.nodes.length;
  const geo = useMemo(() => layoutFlow(n, aspect), [n, aspect]);
  // Lista → diagrama: os itens começam empilhados como uma lista (o que o
  // público já leu) e migram para as posições do fluxo.
  const morph = p.listToFlow && !p.noAnimate ? ctrl.sampleFor("morph").count ?? 1 : 1;
  const asList = morph < 0.5;
  const listBoxes: Box[] = useMemo(() => {
    const gap = 10;
    const h = Math.min(90, (geo.H - gap * (n - 1)) / Math.max(1, n));
    return Array.from({ length: n }, (_, i) => ({ x: 0, y: i * (h + gap), w: W * 0.42, h }));
  }, [geo.H, n]);
  const numbered = NUMBERED.has(model.variant);
  return (
    <VisualFrame ctrl={ctrl}>
      {!asList && <ConnectorLayer geo={geo} ctrl={ctrl} theme={theme} type={type} />}
      {model.nodes.map((item, i) => (
        <NodeCard
          key={i}
          box={asList ? listBoxes[i] : geo.nodes[i]}
          geo={geo}
          item={item}
          index={i}
          ctrl={ctrl}
          theme={theme}
          type={type}
          displayFont={displayFont}
          number={numbered ? i + 1 : undefined}
          showDetail={!asList}
          layout={!!p.listToFlow}
          tone={i === n - 1 && model.variant === "pipeline" ? "accent" : "surface"}
        >
          {model.variant === "workflow" && item.group && (
            <span className="rounded-full" style={{ fontSize: p.type.caption, padding: "0.1cqw 0.5cqw", border: `1px solid ${rgba(theme.accent, 0.4)}`, opacity: 0.85 }}>
              {item.group}
            </span>
          )}
        </NodeCard>
      ))}
    </VisualFrame>
  );
};

export const CycleDiagram = (p: VisualProps) => {
  const { model, aspect, ctrl, theme, type, displayFont, visual } = p;
  const n = model.nodes.length;
  const geo = useMemo(() => layoutCycle(n, aspect), [n, aspect]);
  const orbit = ctrl.ambientProps("orbit-ambient");
  return (
    <VisualFrame ctrl={ctrl}>
      <motion.div className="absolute inset-0" {...orbit}>
        <ConnectorLayer geo={geo} ctrl={ctrl} theme={theme} type={type} />
      </motion.div>
      {(visual.subject || visual.annotation) && (
        <div
          className="absolute flex items-center justify-center text-center"
          style={{ left: "30%", right: "30%", top: "38%", bottom: "38%", fontFamily: displayFont, fontSize: type.itemLabel, opacity: 0.85 }}
        >
          {visual.subject ?? visual.annotation}
        </div>
      )}
      {model.nodes.map((item, i) => (
        <NodeCard key={i} box={geo.nodes[i]} geo={geo} item={item} index={i} ctrl={ctrl} theme={theme} type={type} displayFont={displayFont} align="center" />
      ))}
    </VisualFrame>
  );
};

export const TimelineDiagram = (p: VisualProps) => {
  const { model, aspect, ctrl, theme, type, displayFont } = p;
  const n = model.nodes.length;
  const geo = useMemo(() => layoutTimeline(n, aspect), [n, aspect]);
  const axis = geo.shapes.find((s) => s.kind === "axis");
  const ticks = geo.shapes.filter((s) => s.kind === "tick");
  const stems = geo.shapes.filter((s) => s.kind === "stem");
  return (
    <VisualFrame ctrl={ctrl}>
      <motion.div className="absolute inset-0" {...track(ctrl, "axis")}>
        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${geo.W} ${geo.H}`} preserveAspectRatio="none" aria-hidden>
          {axis && <path d={axis.d} stroke={theme.accent} strokeWidth={3} strokeLinecap="round" />}
          {stems.map((s, i) => <path key={i} d={s.d} stroke={rgba(theme.text, 0.3)} strokeWidth={1.4} />)}
        </svg>
      </motion.div>
      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${geo.W} ${geo.H}`} preserveAspectRatio="none" aria-hidden>
        {ticks.map((t, i) => {
          const m = /M([\d.]+),([\d.]+)/.exec(t.d);
          const cx = m ? Number(m[1]) : 0;
          return <motion.circle key={i} cx={cx} cy={geo.H / 2} r={9} fill={theme.accent} stroke={theme.bg} strokeWidth={3} {...track(ctrl, `shape-${i}`)} />;
        })}
      </svg>
      {model.nodes.map((item, i) => (
        <NodeCard
          key={i}
          box={geo.nodes[i]}
          geo={geo}
          item={item}
          index={i}
          ctrl={ctrl}
          theme={theme}
          type={type}
          displayFont={displayFont}
          tone="plain"
          align="center"
          style={{ justifyContent: i % 2 === 0 ? "flex-end" : "flex-start" }}
        />
      ))}
    </VisualFrame>
  );
};
