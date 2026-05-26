// ============================================================
// SlideAI — Decorative Animated Shapes
// ------------------------------------------------------------
// Reusable, theme-aware geometric decorations for slides.
// All shapes:
//   • Use theme.accent + low opacity
//   • Animate with framer-motion
//   • Respect useReducedMotion (render static if reduced)
//   • Are absolute-positioned, pointer-events-none
//   • Composable: stack multiple in a single slide
// ============================================================
import { motion, useReducedMotion } from "framer-motion";
import type { ThemeColors } from "@/lib/slugify";

interface BaseProps {
  theme: ThemeColors;
  noAnimate?: boolean;
  /** Multiplica opacidade base. Default 1. */
  intensity?: number;
}

/** Anéis concêntricos com pathLength reveal + rotação infinita lenta. */
export const OrbitalRings = ({
  theme,
  noAnimate,
  intensity = 1,
  position = "right",
}: BaseProps & { position?: "left" | "right" | "center" }) => {
  const reduce = useReducedMotion();
  const skip = noAnimate || reduce;
  const pos =
    position === "left"
      ? "-left-[15%] top-1/2 -translate-y-1/2"
      : position === "center"
      ? "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      : "-right-[15%] top-1/2 -translate-y-1/2";
  return (
    <div
      className={`absolute ${pos} pointer-events-none z-[1]`}
      style={{ width: "55%", aspectRatio: "1 / 1", opacity: 0.18 * intensity }}
      aria-hidden
    >
      <motion.svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        animate={skip ? {} : { rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
      >
        {[42, 32, 22, 12].map((r, i) => (
          <motion.circle
            key={r}
            cx={50}
            cy={50}
            r={r}
            fill="none"
            stroke={theme.accent}
            strokeWidth={0.4}
            strokeDasharray={i === 1 ? "1 2" : undefined}
            initial={skip ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 2.2, delay: 0.2 + i * 0.18, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
        <motion.circle
          cx={50}
          cy={50}
          r={2}
          fill={theme.accent}
          initial={skip ? false : { scale: 0 }}
          animate={{ scale: [0, 1.4, 1] }}
          transition={{ duration: 1.2, delay: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
        />
      </motion.svg>
    </div>
  );
};

/** Grade pontilhada que aparece em wave por linha. */
export const DotGrid = ({
  theme,
  noAnimate,
  intensity = 1,
  cols = 14,
  rows = 8,
}: BaseProps & { cols?: number; rows?: number }) => {
  const reduce = useReducedMotion();
  const skip = noAnimate || reduce;
  return (
    <div
      className="absolute inset-0 pointer-events-none z-[1] flex items-center justify-center overflow-hidden"
      style={{ opacity: 0.18 * intensity }}
      aria-hidden
    >
      <svg viewBox={`0 0 ${cols * 10} ${rows * 10}`} className="w-[110%] h-[110%]" preserveAspectRatio="xMidYMid slice">
        {Array.from({ length: rows }).flatMap((_, r) =>
          Array.from({ length: cols }).map((__, c) => {
            const delay = (r + c) * 0.04;
            return (
              <motion.circle
                key={`${r}-${c}`}
                cx={c * 10 + 5}
                cy={r * 10 + 5}
                r={0.9}
                fill={theme.accent}
                initial={skip ? false : { opacity: 0, scale: 0 }}
                animate={{ opacity: 0.6, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.3 + delay, ease: [0.16, 1, 0.3, 1] }}
              />
            );
          })
        )}
      </svg>
    </div>
  );
};

/** Formas geométricas flutuantes (círculos vazados, quadrado rotacionado, triângulo). */
export const FloatingShapes = ({ theme, noAnimate, intensity = 1 }: BaseProps) => {
  const reduce = useReducedMotion();
  const skip = noAnimate || reduce;
  const stroke = theme.accent;
  const float = (delay: number, range = 14): any =>
    skip ? {} : {
      animate: { y: [0, -range, 0], rotate: [0, 6, 0] },
      transition: { duration: 9 + delay, repeat: Infinity, ease: "easeInOut" as const, delay },
    };
  return (
    <div className="absolute inset-0 pointer-events-none z-[1]" style={{ opacity: 0.45 * intensity }} aria-hidden>
      {/* Círculo vazado top-left */}
      <motion.div
        className="absolute top-[12%] left-[6%]"
        initial={skip ? false : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div {...float(0.2)}>
          <svg width="84" height="84" viewBox="0 0 84 84">
            <circle cx={42} cy={42} r={36} fill="none" stroke={stroke} strokeWidth={1.6} />
            <circle cx={42} cy={42} r={6} fill={stroke} opacity={0.7} />
          </svg>
        </motion.div>
      </motion.div>

      {/* Quadrado rotacionado bottom-right */}
      <motion.div
        className="absolute bottom-[14%] right-[8%]"
        initial={skip ? false : { opacity: 0, rotate: 0 }}
        animate={{ opacity: 1, rotate: 45 }}
        transition={{ duration: 1.4, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div {...float(0.6, 18)}>
          <div
            className="h-16 w-16 border-2"
            style={{ borderColor: stroke, background: `${stroke}15` }}
          />
        </motion.div>
      </motion.div>

      {/* Triângulo top-right */}
      <motion.div
        className="absolute top-[20%] right-[14%]"
        initial={skip ? false : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div {...float(1.2)}>
          <svg width="56" height="50" viewBox="0 0 56 50">
            <polygon points="28,4 52,46 4,46" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" />
          </svg>
        </motion.div>
      </motion.div>

      {/* Linha + ponto bottom-left */}
      <motion.div
        className="absolute bottom-[18%] left-[10%] flex items-center gap-2"
        initial={skip ? false : { opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1.0, delay: 1.0 }}
      >
        <div className="h-2 w-2 rounded-full" style={{ background: stroke }} />
        <div className="h-px w-20" style={{ background: stroke, opacity: 0.6 }} />
      </motion.div>
    </div>
  );
};

/** Colchetes editoriais nos 4 cantos com clip-path reveal. */
export const CornerBrackets = ({ theme, noAnimate, intensity = 1 }: BaseProps) => {
  const reduce = useReducedMotion();
  const skip = noAnimate || reduce;
  const c = theme.accent;
  const Bracket = ({ pos, delay }: { pos: "tl" | "tr" | "bl" | "br"; delay: number }) => {
    const map = {
      tl: "top-[3%] left-[3%]",
      tr: "top-[3%] right-[3%] rotate-90",
      bl: "bottom-[3%] left-[3%] -rotate-90",
      br: "bottom-[3%] right-[3%] rotate-180",
    };
    return (
      <motion.div
        className={`absolute ${map[pos]}`}
        initial={skip ? false : { opacity: 0, clipPath: "inset(50% 50% 50% 50%)" }}
        animate={{ opacity: 1, clipPath: "inset(0 0 0 0)" }}
        transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        <svg width="32" height="32" viewBox="0 0 32 32">
          <path d="M2 14 L2 2 L14 2" fill="none" stroke={c} strokeWidth={1.5} strokeLinecap="square" />
        </svg>
      </motion.div>
    );
  };
  return (
    <div className="absolute inset-0 pointer-events-none z-[2]" style={{ opacity: 0.55 * intensity }} aria-hidden>
      <Bracket pos="tl" delay={0.3} />
      <Bracket pos="tr" delay={0.4} />
      <Bracket pos="bl" delay={0.5} />
      <Bracket pos="br" delay={0.6} />
    </div>
  );
};

/** Linhas diagonais com pathLength reveal. */
export const DiagonalLines = ({ theme, noAnimate, intensity = 1 }: BaseProps) => {
  const reduce = useReducedMotion();
  const skip = noAnimate || reduce;
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-[1]"
      style={{ opacity: 0.16 * intensity }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <motion.line
          key={i}
          x1={-10}
          y1={i * 22 - 10}
          x2={110}
          y2={i * 22 + 30}
          stroke={theme.accent}
          strokeWidth={0.25}
          initial={skip ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2, delay: 0.2 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </svg>
  );
};

/** Blob orgânico que morfa continuamente entre 3 paths. Forte presença visual. */
export const AnimatedBlob = ({
  theme, noAnimate, intensity = 1, position = "right",
}: BaseProps & { position?: "left" | "right" }) => {
  const reduce = useReducedMotion();
  const skip = noAnimate || reduce;
  const paths = [
    "M421,300 Q470,180 360,120 Q220,70 140,180 Q60,290 160,400 Q260,510 380,460 Q500,410 421,300Z",
    "M440,320 Q500,200 380,100 Q230,40 130,170 Q40,310 170,420 Q280,520 400,480 Q520,440 440,320Z",
    "M410,290 Q450,160 340,110 Q200,60 130,200 Q50,330 180,420 Q290,500 390,450 Q490,400 410,290Z",
  ];
  const pos = position === "left" ? "-left-[18%]" : "-right-[18%]";
  return (
    <div
      className={`absolute ${pos} top-1/2 -translate-y-1/2 pointer-events-none z-[1]`}
      style={{ width: "65%", aspectRatio: "1/1", opacity: 0.28 * intensity }}
      aria-hidden
    >
      <svg viewBox="0 0 560 560" className="w-full h-full">
        <defs>
          <radialGradient id={`blob-${theme.accent.replace("#", "")}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={theme.accent} stopOpacity="0.9" />
            <stop offset="60%" stopColor={theme.accent} stopOpacity="0.35" />
            <stop offset="100%" stopColor={theme.accent} stopOpacity="0" />
          </radialGradient>
        </defs>
        <motion.path
          fill={`url(#blob-${theme.accent.replace("#", "")})`}
          initial={skip ? false : { d: paths[0], scale: 0.9, opacity: 0 }}
          animate={skip ? { d: paths[0] } : {
            d: [paths[0], paths[1], paths[2], paths[0]],
            scale: [0.95, 1.05, 0.98, 0.95],
            opacity: 1,
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "center" }}
        />
      </svg>
    </div>
  );
};

/** Grade de pontos que pulsa em ondas radiais a partir do centro. */
export const PulseGrid = ({ theme, noAnimate, intensity = 1 }: BaseProps) => {
  const reduce = useReducedMotion();
  const skip = noAnimate || reduce;
  const cols = 16, rows = 9;
  return (
    <div
      className="absolute inset-0 pointer-events-none z-[1] overflow-hidden"
      style={{ opacity: 0.22 * intensity }}
      aria-hidden
    >
      <svg viewBox={`0 0 ${cols * 10} ${rows * 10}`} className="w-full h-full" preserveAspectRatio="xMidYMid slice">
        {Array.from({ length: rows }).flatMap((_, r) =>
          Array.from({ length: cols }).map((__, c) => {
            const cx = c * 10 + 5;
            const cy = r * 10 + 5;
            const dist = Math.hypot(cx - cols * 5, cy - rows * 5);
            const delay = dist * 0.012;
            return (
              <motion.circle
                key={`${r}-${c}`}
                cx={cx} cy={cy} r={0.7}
                fill={theme.accent}
                initial={skip ? false : { opacity: 0.15, scale: 1 }}
                animate={skip ? {} : {
                  opacity: [0.15, 0.8, 0.15],
                  scale: [1, 1.8, 1],
                }}
                transition={{
                  duration: 3.2, repeat: Infinity, ease: "easeInOut",
                  delay: delay % 3.2,
                }}
              />
            );
          })
        )}
      </svg>
    </div>
  );
};

/** Partículas flutuantes que sobem lentamente — sensação de profundidade. */
export const ParticleField = ({ theme, noAnimate, intensity = 1 }: BaseProps) => {
  const reduce = useReducedMotion();
  const skip = noAnimate || reduce;
  const particles = Array.from({ length: 22 }).map((_, i) => ({
    x: (i * 37) % 100,
    delay: (i * 0.31) % 6,
    size: 1 + ((i * 7) % 4),
    dur: 8 + ((i * 3) % 6),
  }));
  return (
    <div
      className="absolute inset-0 pointer-events-none z-[1] overflow-hidden"
      style={{ opacity: 0.55 * intensity }}
      aria-hidden
    >
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            bottom: "-5%",
            width: p.size * 3,
            height: p.size * 3,
            background: theme.accent,
            boxShadow: `0 0 ${p.size * 6}px ${theme.accent}`,
          }}
          initial={skip ? false : { y: 0, opacity: 0 }}
          animate={skip ? {} : { y: ["0vh", "-110vh"], opacity: [0, 0.7, 0.7, 0] }}
          transition={{
            duration: p.dur, repeat: Infinity, delay: p.delay, ease: "linear",
          }}
        />
      ))}
    </div>
  );
};
