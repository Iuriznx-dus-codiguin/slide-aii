// ============================================================
// SlideAI — Cinematic HUD (Fase A)
// ------------------------------------------------------------
// Progress Tracker global cinematográfico. Não é uma barra "linear"
// trivial: usa um anel rotativo, dots interativos com glow, e um
// indicador de "ato narrativo" (Hook → Tensão → Jornada → Prova → Clímax).
//
// Renderizado em posição fixa pelo SlideViewer; animado com Framer Motion.
// ============================================================
import { motion, AnimatePresence } from "framer-motion";
import { useMemo } from "react";

export type NarrativeAct = "hook" | "tension" | "journey" | "proof" | "climax" | "neutral";

const ACT_LABEL: Record<NarrativeAct, string> = {
  hook: "Gancho",
  tension: "Tensão",
  journey: "Jornada",
  proof: "Prova",
  climax: "Clímax",
  neutral: "",
};

const ACT_COLOR: Record<NarrativeAct, string> = {
  hook: "#F59E0B",
  tension: "#EF4444",
  journey: "#3B82F6",
  proof: "#10B981",
  climax: "#A855F7",
  neutral: "#94A3B8",
};

/** Heurística: mapeia índice + tipo do slide para um ato narrativo. */
export function actForSlide(
  idx: number,
  total: number,
  slideType?: string,
): NarrativeAct {
  if (slideType === "title_slide") return "hook";
  if (slideType === "conclusion") return "climax";
  if (slideType === "section_divider") return "journey";
  const ratio = total > 1 ? idx / (total - 1) : 0;
  if (ratio < 0.2) return "hook";
  if (ratio < 0.4) return "tension";
  if (ratio < 0.7) return "journey";
  if (ratio < 0.9) return "proof";
  return "climax";
}

interface CinematicHUDProps {
  total: number;
  current: number;
  onJump: (idx: number) => void;
  acts?: NarrativeAct[];
  hidden?: boolean;
  accent?: string;
}

export const CinematicHUD = ({
  total,
  current,
  onJump,
  acts,
  hidden = false,
  accent = "#A855F7",
}: CinematicHUDProps) => {
  const currentAct = acts?.[current] ?? "neutral";
  const progress = total > 0 ? ((current + 1) / total) * 100 : 0;

  const dots = useMemo(
    () => Array.from({ length: total }, (_, i) => ({
      idx: i,
      act: acts?.[i] ?? "neutral",
    })),
    [total, acts],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: hidden ? 0 : 1, y: hidden ? 20 : 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
      style={{ filter: hidden ? "blur(8px)" : "blur(0px)" }}
    >
      <div className="pointer-events-auto flex items-center gap-4 rounded-full bg-black/50 backdrop-blur-xl px-5 py-3 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        {/* Anel rotativo + número */}
        <div className="relative h-10 w-10 flex items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="17" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
            <motion.circle
              cx="20" cy="20" r="17"
              fill="none"
              stroke={ACT_COLOR[currentAct] !== "#94A3B8" ? ACT_COLOR[currentAct] : accent}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 17}
              initial={false}
              animate={{
                strokeDashoffset: 2 * Math.PI * 17 * (1 - progress / 100),
              }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              style={{
                filter: `drop-shadow(0 0 6px ${ACT_COLOR[currentAct] !== "#94A3B8" ? ACT_COLOR[currentAct] : accent})`,
              }}
            />
          </svg>
          <motion.span
            key={current}
            initial={{ scale: 0.6, opacity: 0, rotate: -20 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            className="text-[11px] font-bold tabular-nums text-white"
          >
            {current + 1}
          </motion.span>
        </div>

        {/* Dots interativos por slide */}
        <div className="flex items-center gap-1.5">
          {dots.map((d) => {
            const isActive = d.idx === current;
            const color = ACT_COLOR[d.act];
            return (
              <button
                key={d.idx}
                onClick={() => onJump(d.idx)}
                aria-label={`Ir para slide ${d.idx + 1}`}
                className="group relative flex items-center justify-center"
                style={{ width: 18, height: 18 }}
              >
                <motion.span
                  initial={false}
                  animate={{
                    scale: isActive ? 1.4 : 1,
                    opacity: isActive ? 1 : 0.55,
                  }}
                  whileHover={{ scale: isActive ? 1.4 : 1.25, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  className="block rounded-full"
                  style={{
                    width: 8, height: 8,
                    background: color,
                    boxShadow: isActive ? `0 0 12px ${color}, 0 0 4px ${color}` : "none",
                  }}
                />
                {/* Tooltip pequeno */}
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[9px] font-medium uppercase tracking-wider text-white/0 group-hover:text-white/80 transition-opacity whitespace-nowrap pointer-events-none bg-black/60 backdrop-blur px-1.5 py-0.5 rounded">
                  {d.idx + 1}
                </span>
              </button>
            );
          })}
        </div>

        {/* Label do ato narrativo */}
        <div className="flex items-center gap-2 pl-2 border-l border-white/10 min-w-[80px]">
          <motion.div
            key={`dot-${currentAct}`}
            initial={{ scale: 0, rotate: 45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 20 }}
            className="h-2 w-2 rounded-sm rotate-45"
            style={{ background: ACT_COLOR[currentAct], boxShadow: `0 0 8px ${ACT_COLOR[currentAct]}` }}
          />
          <AnimatePresence mode="wait">
            <motion.span
              key={currentAct}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="text-[10px] uppercase tracking-[0.2em] font-semibold text-white/85"
            >
              {ACT_LABEL[currentAct] || `${current + 1}/${total}`}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};
