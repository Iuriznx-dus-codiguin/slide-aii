// Peças comuns dos visuais nativos do motor de cenas: tipos, cartão de nó e
// camada de conectores. Texto é HTML (editável, com a fonte do deck, e
// rasterizado com fidelidade pelo html2canvas); conectores e formas são SVG
// no mesmo sistema de coordenadas da geometria (src/lib/scene/diagramLayout).
import { useId, type CSSProperties, type ReactNode } from "react";
import { motion } from "framer-motion";
import type { ThemeColors } from "@/lib/slugify";
import type { TimelineController } from "@/lib/timeline";
import { boxToPercent, type Box, type DiagramGeometry } from "@/lib/scene/diagramLayout";
import { formatValue, type VisualModel } from "@/lib/scene/visualModel";
import { rgba } from "@/lib/scene/color";
import type { TypeScale } from "@/lib/scene/typeScale";
import { sceneIcon } from "../sceneIcons";
import type { SceneVisual, VisualItem } from "../../../../supabase/functions/_shared/visualBlock.ts";

export interface VisualProps {
  model: VisualModel;
  visual: SceneVisual;
  theme: ThemeColors;
  type: TypeScale;
  displayFont: string;
  /** Proporção largura/altura do slot de mídia do layout. */
  aspect: number;
  ctrl: TimelineController;
  noAnimate: boolean;
  staticEffects: boolean;
  imageUrl?: string | null;
  assetStatus?: string | null;
  /** Modo dinâmico ativo (magic move). */
  dynamicMode?: boolean;
  anchorKey?: string;
}

/** Props de movimento de uma trilha (vazio quando a trilha não existe). */
export function track(ctrl: TimelineController, id: string) {
  return ctrl.motionProps(id);
}

interface NodeCardProps {
  box: Box;
  geo: Pick<DiagramGeometry, "W" | "H">;
  item: VisualItem;
  index: number;
  ctrl: TimelineController;
  theme: ThemeColors;
  type: TypeScale;
  displayFont: string;
  /** Número mostrado no selo (só quando o conteúdo é de fato uma sequência). */
  number?: number;
  tone?: "surface" | "accent" | "plain";
  align?: "left" | "center";
  showDetail?: boolean;
  trackId?: string;
  /** Anima mudança de posição (lista → diagrama). */
  layout?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
}

export const NodeCard = ({
  box, geo, item, index, ctrl, theme, type, displayFont, number, tone = "surface", align = "left",
  showDetail = true, trackId, layout = false, children, style,
}: NodeCardProps) => {
  const Icon = sceneIcon(item.icon);
  const mp = track(ctrl, trackId ?? `node-${index}`);
  const surface: CSSProperties = tone === "accent"
    ? { background: theme.accent, color: theme.bg, border: `1px solid ${rgba(theme.accent, 0.9)}` }
    : tone === "plain"
      ? { background: "transparent", border: "none" }
      : {
        // Preenchimento translúcido sólido — sem backdrop-filter, que o
        // export (html2canvas) não desenha.
        background: rgba(theme.text, 0.05),
        border: `1px solid ${rgba(theme.accent, 0.3)}`,
      };
  const value = formatValue(item.value, item.unit);
  return (
    <motion.div
      {...mp}
      layout={layout}
      className="absolute flex flex-col overflow-hidden"
      style={{
        ...boxToPercent(box, geo),
        padding: tone === "plain" ? "0.3cqw 0.4cqw" : "0.8cqw 0.95cqw",
        borderRadius: "0.9cqw",
        justifyContent: "center",
        alignItems: align === "center" ? "center" : "flex-start",
        textAlign: align,
        gap: "0.35cqw",
        ...surface,
        ...style,
      }}
    >
      {(number !== undefined || Icon) && (
        <div className="flex items-center" style={{ gap: "0.5cqw" }}>
          {number !== undefined && (
            <span
              className="inline-flex items-center justify-center font-bold tabular-nums"
              style={{
                width: "1.9cqw", height: "1.9cqw", borderRadius: "999px", fontSize: type.caption,
                background: tone === "accent" ? theme.bg : theme.accent, color: tone === "accent" ? theme.accent : theme.bg,
              }}
            >
              {number}
            </span>
          )}
          {Icon && <Icon style={{ width: "1.7cqw", height: "1.7cqw", color: tone === "accent" ? theme.bg : theme.accent }} strokeWidth={1.8} />}
        </div>
      )}
      <div className="font-semibold leading-tight" style={{ fontSize: type.itemLabel, fontFamily: displayFont }}>{item.label}</div>
      {value && <div className="font-bold tabular-nums leading-none" style={{ fontSize: type.itemLabel, color: tone === "accent" ? theme.bg : theme.accent }}>{value}</div>}
      {showDetail && item.detail && (
        <div
          className="leading-snug"
          style={{
            fontSize: type.itemDetail, opacity: 0.78,
            display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}
        >
          {item.detail}
        </div>
      )}
      {children}
    </motion.div>
  );
};

interface ConnectorLayerProps {
  geo: DiagramGeometry;
  ctrl: TimelineController;
  theme: ThemeColors;
  type: TypeScale;
  arrows?: boolean;
  dashed?: boolean;
  /** Trilhas "edge-i" por índice na lista de arestas. */
  trackOffset?: number;
}

export const ConnectorLayer = ({ geo, ctrl, theme, type, arrows = true, dashed = false, trackOffset = 0 }: ConnectorLayerProps) => {
  const markerId = useId().replace(/:/g, "");
  return (
    <>
      <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" viewBox={`0 0 ${geo.W} ${geo.H}`} preserveAspectRatio="none" aria-hidden>
        <defs>
          <marker id={markerId} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={theme.accent} />
          </marker>
        </defs>
        {geo.edges.map((e, i) => (
          <motion.path
            key={i}
            d={e.d}
            fill="none"
            stroke={theme.accent}
            strokeOpacity={0.85}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeDasharray={dashed ? "6 8" : undefined}
            markerEnd={arrows ? `url(#${markerId})` : undefined}
            {...track(ctrl, `edge-${i + trackOffset}`)}
          />
        ))}
      </svg>
      {geo.edges.map((e, i) => e.label ? (
        <motion.span
          key={`l${i}`}
          {...track(ctrl, `edge-${i + trackOffset}`)}
          className="absolute whitespace-nowrap rounded-full"
          style={{
            left: `${(e.mid.x / geo.W) * 100}%`, top: `${(e.mid.y / geo.H) * 100}%`, transform: "translate(-50%, -50%)",
            fontSize: type.caption, padding: "0.15cqw 0.6cqw", background: theme.bg, color: theme.text,
            border: `1px solid ${rgba(theme.accent, 0.35)}`,
          }}
        >
          {e.label}
        </motion.span>
      ) : null)}
    </>
  );
};

/** Wrapper do slot: posiciona o visual e aplica a respiração ambiente. */
export const VisualFrame = ({ ctrl, children, className = "", style }: { ctrl: TimelineController; children: ReactNode; className?: string; style?: CSSProperties }) => {
  const amb = ctrl.ambientProps("visual-ambient");
  return (
    <motion.div className={`relative w-full h-full ${className}`} style={style} {...amb}>
      {children}
    </motion.div>
  );
};
