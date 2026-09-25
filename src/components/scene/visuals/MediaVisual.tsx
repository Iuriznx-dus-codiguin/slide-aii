// Mídia do motor de cenas: foto real, imagem gerada e híbridos (imagem com
// marcadores numéricos discretos + legenda NATIVA e editável — nunca texto
// corrido dentro da imagem). Recortes (fundo transparente) ganham sombra de
// contato sobre o palco de spotlight do fundo, para se integrarem à cena.
import { motion } from "framer-motion";
import { anchorLayoutId, semanticAnchorId } from "@/lib/morphing";
import { readableOn, rgba } from "@/lib/scene/color";
import { track, type VisualProps } from "./shared";

/** Silhueta do próprio comando enquanto a mídia não chega (nunca slot vazio). */
const MediaPlaceholder = ({ variant, p }: { variant: string; p: VisualProps }) => {
  const stroke = rgba(p.theme.accent, 0.45);
  const fill = rgba(p.theme.text, 0.05);
  const pulse = p.noAnimate || p.staticEffects ? "" : "animate-pulse";
  return (
    <div className={`w-full h-full rounded-[1.1cqw] flex items-center justify-center ${pulse}`} style={{ background: fill, border: `1px dashed ${stroke}` }} aria-hidden>
      <svg viewBox="0 0 200 120" className="w-[55%] h-[55%]">
        {variant === "exploded" || variant === "components"
          ? [0, 1, 2].map((i) => <rect key={i} x={40 + i * 18} y={20 + i * 22} width={90} height={26} rx={6} fill="none" stroke={stroke} strokeWidth={2} strokeDasharray="6 5" />)
          : variant === "layers" || variant === "cross-section"
            ? [0, 1, 2, 3].map((i) => <path key={i} d={`M40 ${30 + i * 20} L140 ${30 + i * 20} L165 ${42 + i * 20} L65 ${42 + i * 20} Z`} fill="none" stroke={stroke} strokeWidth={2} />)
            : variant === "cutaway" || variant === "x-ray"
              ? <><circle cx={100} cy={60} r={42} fill="none" stroke={stroke} strokeWidth={2} /><path d="M100 60 L142 60 A42 42 0 0 0 100 18 Z" fill={rgba(p.theme.accent, 0.18)} stroke={stroke} strokeWidth={2} /></>
              : <rect x={30} y={15} width={140} height={90} rx={10} fill="none" stroke={stroke} strokeWidth={2} />}
      </svg>
    </div>
  );
};

/** Quando a mídia falhou e o comando não tem desenho nativo: cartão editorial. */
export const EditorialCard = (p: VisualProps) => {
  const { theme, visual, type, displayFont } = p;
  const accent2 = theme.accent2 || theme.accent;
  return (
    <motion.div
      {...track(p.ctrl, "media")}
      className="w-full h-full flex flex-col justify-end"
      style={{
        borderRadius: "1.2cqw", padding: "2.2cqw",
        background: `linear-gradient(135deg, ${rgba(theme.accent, 0.92)} 0%, ${rgba(accent2, 0.7)} 100%)`,
        color: readableOn(theme.accent),
      }}
    >
      <div className="font-bold leading-[1.05]" style={{ fontFamily: displayFont, fontSize: `calc(${type.headline} * 0.8)` }}>{visual.subject}</div>
      {visual.annotation && <div style={{ fontSize: type.itemDetail, marginTop: "0.8cqw", opacity: 0.85 }}>{visual.annotation}</div>}
    </motion.div>
  );
};

export const MediaVisual = (p: VisualProps & { bleed?: boolean }) => {
  const { model, visual, imageUrl, theme, type, ctrl, displayFont, staticEffects } = p;
  const cutout = model.spec.imageRecipe === "cutout" || model.spec.imageRecipe === "technical";
  const legend = model.spec.renderMode === "hybrid" && model.nodes.length > 0;
  const anchorsOn = !!p.dynamicMode && !p.noAnimate;
  const layoutId = p.anchorKey ? semanticAnchorId(p.anchorKey, anchorsOn) : anchorLayoutId("hero-media", anchorsOn);
  const ambient = ctrl.ambientProps("media-ambient");
  const wide = p.aspect >= 1.1;

  const image = !imageUrl ? (
    <MediaPlaceholder variant={model.variant} p={p} />
  ) : cutout ? (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Sombra de contato: ancora o recorte no "chão" do palco. */}
      <div
        className="absolute left-[18%] right-[18%] bottom-[4%] h-[9%]"
        style={{ background: `radial-gradient(50% 50% at 50% 50%, ${rgba("#000000", 0.45)} 0%, transparent 70%)` }}
      />
      <motion.img
        src={imageUrl}
        alt={visual.subject ?? ""}
        crossOrigin="anonymous"
        className="relative w-full h-full object-contain"
        style={staticEffects ? undefined : { filter: `drop-shadow(0 1.4cqw 2cqw ${rgba("#000000", 0.35)})` }}
        {...ambient}
      />
    </div>
  ) : (
    <div className={`relative w-full h-full overflow-hidden ${p.bleed ? "" : "rounded-[1.1cqw]"}`}>
      <motion.img src={imageUrl} alt={visual.subject ?? ""} crossOrigin="anonymous" className="absolute inset-0 w-full h-full object-cover" {...ambient} />
    </div>
  );

  return (
    <div className={`relative w-full h-full ${legend ? (wide ? "grid" : "flex flex-col") : ""}`} style={legend ? (wide ? { gridTemplateColumns: "62% 1fr", gap: "1.6cqw" } : { gap: "1cqw" }) : undefined}>
      <motion.div layoutId={layoutId} {...track(ctrl, "media")} className="relative w-full h-full min-h-0">
        {image}
      </motion.div>
      {legend && (
        <ol className="flex flex-col justify-center min-h-0" style={{ gap: "0.9cqw" }}>
          {model.nodes.map((item, i) => (
            <li key={i} className="flex items-start" style={{ gap: "0.8cqw" }}>
              <motion.span
                {...track(ctrl, `marker-${i}`)}
                className="inline-flex items-center justify-center rounded-full font-bold tabular-nums shrink-0"
                style={{ width: "1.9cqw", height: "1.9cqw", fontSize: type.caption, background: theme.accent, color: theme.bg }}
              >
                {i + 1}
              </motion.span>
              <motion.div {...track(ctrl, `label-${i}`)}>
                <div className="font-semibold leading-tight" style={{ fontSize: type.itemLabel, fontFamily: displayFont }}>{item.label}</div>
                {item.detail && <div className="leading-snug" style={{ fontSize: type.itemDetail, opacity: 0.75 }}>{item.detail}</div>}
              </motion.div>
            </li>
          ))}
        </ol>
      )}
      {visual.annotation && !legend && (
        <div className="absolute left-0 bottom-[-2.2cqw]" style={{ fontSize: type.caption, opacity: 0.6 }}>{visual.annotation}</div>
      )}
    </div>
  );
};
