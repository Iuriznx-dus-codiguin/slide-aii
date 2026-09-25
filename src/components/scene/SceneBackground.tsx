// Camada 0 do compositor de cenas: o sistema de fundo.
//
// Evolui AmbientBackdrop (orbs + vidro + grão) e GradientMeshDrift para um
// sistema escolhido pelo resolvedor a partir do brief e do ato narrativo:
// sólido, gradient mesh, aurora de blobs com blur alto, grão, grade
// geométrica de 12 colunas, foto em duotone com scrim e palco de spotlight
// para recortes.
//
// Cada efeito que o html2canvas não sabe desenhar (filter, mix-blend-mode)
// tem um equivalente estático, ligado por `staticEffects` (export PDF/PNG):
// blobs desfocados viram gradientes radiais; duotone vira foto + tinta + scrim
// sólidos. Geometria é estrutura, não ruído: a grade alinha com as 12 colunas
// do layout.
import { useId, type ReactNode } from "react";
import { motion } from "framer-motion";
import type { ThemeColors } from "@/lib/slugify";
import { rgba, isDarkColor } from "@/lib/scene/color";
import { useImageInsight } from "@/lib/imageAnalysis";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useSceneRender } from "./SceneRenderContext";
import { scrimAlphaForAA } from "../../../supabase/functions/_shared/qualityGate.ts";
import type { SceneBackgroundSpec } from "../../../supabase/functions/_shared/sceneMedia.ts";

interface Props {
  spec?: SceneBackgroundSpec | null;
  theme: ThemeColors;
  /** Mídia do slide (fundo "photo-duotone"). */
  imageUrl?: string | null;
  noAnimate?: boolean;
  /** Centro do spotlight, em % do slide. */
  focus?: { x: number; y: number };
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export const SceneBackground = ({ spec, theme, imageUrl, noAnimate = false, focus }: Props) => {
  const { staticEffects } = useSceneRender();
  const reduce = usePrefersReducedMotion();
  const still = noAnimate || staticEffects || reduce;
  const grainId = useId();
  const kind = spec?.kind ?? "solid";
  const k = clamp01(spec?.intensity ?? 0.32);
  const accent = theme.accent;
  const accent2 = theme.accent2 || theme.accent;
  const dark = isDarkColor(theme.bg);
  const insight = useImageInsight(kind === "photo-duotone" ? imageUrl ?? null : null);

  const base = <div className="absolute inset-0" style={{ background: theme.gradient || theme.bg }} />;

  const vignette = (
    <div
      className="absolute inset-0"
      style={{ background: `radial-gradient(120% 90% at 50% 45%, transparent 55%, ${rgba(theme.bg, dark ? 0.55 : 0.35)} 100%)` }}
    />
  );

  let layer: ReactNode = null;
  switch (kind) {
    case "gradient-mesh": {
      const mesh = `radial-gradient(60% 55% at 12% 18%, ${rgba(accent, 0.34 * k)} 0%, transparent 70%),
        radial-gradient(55% 55% at 88% 84%, ${rgba(accent2, 0.3 * k)} 0%, transparent 70%),
        radial-gradient(40% 40% at 72% 16%, ${rgba(accent, 0.16 * k)} 0%, transparent 70%)`;
      layer = still
        ? <div className="absolute inset-0" style={{ background: mesh }} />
        : (
          <motion.div
            className="absolute -inset-[6%]"
            style={{ background: mesh }}
            animate={{ scale: [1, 1.06, 1], x: ["0%", "2%", "0%"] }}
            transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
          />
        );
      break;
    }
    case "aurora": {
      const blobs = [
        { c: accent, x: 18, y: 22, s: 58 },
        { c: accent2, x: 82, y: 78, s: 52 },
        { c: accent, x: 64, y: 30, s: 38 },
      ];
      layer = still
        ? (
          // Fallback estático: gradientes radiais no lugar de blur + blend.
          <div
            className="absolute inset-0"
            style={{
              background: blobs
                .map((b) => `radial-gradient(${b.s}% ${b.s * 1.1}% at ${b.x}% ${b.y}%, ${rgba(b.c, 0.42 * k)} 0%, transparent 70%)`)
                .join(", "),
            }}
          />
        )
        : blobs.map((b, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${b.x - b.s / 2}%`,
              top: `${b.y - b.s / 2}%`,
              width: `${b.s}%`,
              height: `${b.s * 1.2}%`,
              background: b.c,
              filter: "blur(110px)",
              opacity: 0.55 * k,
              mixBlendMode: dark ? "screen" : "multiply",
            }}
            animate={{ x: [0, 40 - i * 20, 0], y: [0, 24 - i * 18, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: 22 + i * 5, repeat: Infinity, ease: "easeInOut" }}
          />
        ));
      break;
    }
    case "grain":
      layer = (
        <>
          <div className="absolute inset-0" style={{ background: `radial-gradient(80% 70% at 30% 25%, ${rgba(accent, 0.12 * k)} 0%, transparent 70%)` }} />
          <svg className="absolute inset-0 w-full h-full" style={{ opacity: staticEffects ? 0.05 : 0.08, mixBlendMode: staticEffects ? undefined : "overlay" }} aria-hidden>
            <filter id={grainId}>
              <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter={`url(#${grainId})`} />
          </svg>
        </>
      );
      break;
    case "grid": {
      // 12 colunas do layout (margem de 5%) + linhas de base.
      const cols = Array.from({ length: 13 }, (_, i) => 5 + (i * 90) / 12);
      const rows = Array.from({ length: 7 }, (_, i) => 8 + (i * 84) / 6);
      layer = (
        <>
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            {cols.map((x, i) => (
              <line key={`c${i}`} x1={x} x2={x} y1={0} y2={100} stroke={theme.text} strokeOpacity={0.05 + 0.05 * k} strokeWidth={0.06} vectorEffect="non-scaling-stroke" />
            ))}
            {rows.map((y, i) => (
              <line key={`r${i}`} x1={0} x2={100} y1={y} y2={y} stroke={theme.text} strokeOpacity={0.035 + 0.04 * k} strokeWidth={0.06} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          <div className="absolute inset-0" style={{ background: `radial-gradient(70% 60% at 70% 40%, ${rgba(accent, 0.1 * k)} 0%, transparent 70%)` }} />
        </>
      );
      break;
    }
    case "photo-duotone": {
      // Scrim com a menor opacidade que garante contraste AA do texto sobre a
      // foto (Quality Gate, parte cliente — luminância medida da imagem).
      const scrim = insight ? scrimAlphaForAA(theme.text, theme.bg, insight.textHalfLuminance, 0.45) : 0.72;
      layer = imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt=""
            crossOrigin="anonymous"
            className="absolute inset-0 w-full h-full object-cover"
            style={staticEffects ? undefined : { filter: "grayscale(1) contrast(1.08) brightness(0.92)" }}
          />
          <div className="absolute inset-0" style={{ background: accent, opacity: staticEffects ? 0.22 : 0.5, mixBlendMode: staticEffects ? undefined : "multiply" }} />
          <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${rgba(theme.bg, scrim)} 0%, ${rgba(theme.bg, scrim * 0.85)} 55%, ${rgba(theme.bg, scrim * 0.6)} 100%)` }} />
        </>
      ) : (
        <div className="absolute inset-0" style={{ background: `radial-gradient(60% 55% at 20% 20%, ${rgba(accent, 0.25)} 0%, transparent 70%)` }} />
      );
      break;
    }
    case "spotlight": {
      const fx = focus?.x ?? 66;
      const fy = focus?.y ?? 50;
      layer = (
        <>
          <div
            className="absolute inset-0"
            style={{ background: `radial-gradient(38% 58% at ${fx}% ${fy}%, ${rgba(accent, 0.2 + 0.18 * k)} 0%, ${rgba(theme.text, dark ? 0.05 : 0.03)} 42%, transparent 72%)` }}
          />
          {/* Chão do palco: elipse suave sob o recorte. */}
          <div
            className="absolute"
            style={{
              left: `${fx - 22}%`, width: "44%", top: `${Math.min(92, fy + 30)}%`, height: "10%",
              background: `radial-gradient(50% 50% at 50% 50%, ${rgba(dark ? "#000000" : theme.text, dark ? 0.45 : 0.14)} 0%, transparent 70%)`,
            }}
          />
        </>
      );
      break;
    }
    case "solid":
    default:
      layer = null;
  }

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }} aria-hidden>
      {base}
      {layer}
      {kind !== "photo-duotone" && kind !== "solid" && vignette}
    </div>
  );
};
