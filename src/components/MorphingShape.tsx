// ============================================================
// SlideAI — MorphingShape (Fase 2)
// ------------------------------------------------------------
// Componente que morfa visualmente entre dois paths SVG usando
// Flubber. Útil para transformar números/silhuetas em barras
// ou donut segments durante a entrada do slide.
//
// Uso:
//   <MorphingNumberToBar value={78} suffix="%" color="#FF7A00" />
// ============================================================

import { motion } from "framer-motion";
import { animated } from "@react-spring/web";
import { useMorphPath, useMorphProgress, rectPath, barPath } from "@/lib/morphing";
import { parseNumberFromString, formatAnimatedNumber } from "@/lib/animations";
import { useSpringNumber } from "@/lib/physics";

interface MorphingNumberToBarProps {
  /** Valor final, ex: "78%" ou "1.2M". */
  value: string;
  /** Cor da barra/número. */
  color: string;
  /** Largura/altura do canvas SVG. */
  width?: number;
  height?: number;
  /** Desativa animação (thumbnails, print). */
  noAnimate?: boolean;
  /** Label opcional abaixo da barra. */
  label?: string;
}

/**
 * Mostra um número grande que progressivamente "vira" uma barra
 * vertical à direita, sugerindo dado quantitativo crescente.
 */
export const MorphingNumberToBar = ({
  value,
  color,
  width = 800,
  height = 360,
  noAnimate = false,
  label,
}: MorphingNumberToBarProps) => {
  const parsed = parseNumberFromString(value);
  const numTarget = parsed?.num ?? 0;
  const animatedNum = useAnimatedNumber(numTarget, 1500, !noAnimate);

  // Path "from" = silhueta retangular grande do número
  const fromPath = rectPath(width * 0.05, height * 0.2, width * 0.55, height * 0.6, 16);
  // Path "to" = barra vertical à direita
  const toPath = barPath(width * 0.7, height * 0.95, width * 0.18, height * 0.85, 12);

  const progress = useMorphProgress({
    duration: 1.4,
    delay: 0.6,
    enabled: !noAnimate,
  });
  const d = useMorphPath(fromPath, toPath, noAnimate ? 1 : progress);

  const display = parsed
    ? `${parsed.prefix}${formatAnimatedNumber(animatedNum, numTarget)}${parsed.suffix}`
    : value;

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <motion.path
          d={d}
          fill={color}
          initial={{ opacity: 0 }}
          animate={{ opacity: noAnimate ? 0.18 : [0, 0.25, 0.15] }}
          transition={{ duration: 2, ease: [0.16, 1, 0.3, 1], times: [0, 0.5, 1] }}
        />
      </svg>

      {/* Número sobreposto */}
      <motion.div
        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        initial={{ opacity: 0, scale: 0.85, filter: "blur(20px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      >
        <span
          className="font-extrabold leading-none tracking-tighter"
          style={{ color, fontSize: "clamp(80px, 14vw, 220px)" }}
        >
          {display}
        </span>
        {label && (
          <motion.span
            className="mt-4 opacity-80 text-center max-w-[80%] leading-snug"
            style={{ fontSize: "clamp(16px, 1.6vw, 24px)" }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 0.85, y: 0 }}
            transition={{ duration: 0.7, delay: 1.0, ease: [0.16, 1, 0.3, 1] }}
          >
            {label}
          </motion.span>
        )}
      </motion.div>
    </div>
  );
};
