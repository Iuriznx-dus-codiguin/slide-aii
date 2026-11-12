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
import { useEffect, useMemo, useRef } from "react";
import type { NarrativeActName } from "../../supabase/functions/_shared/sceneCatalog.ts";

// Os atos vêm do catálogo compartilhado com o Story Engine (Deno) — antes esta
// união era uma cópia mantida em "sincronia manual". "neutral" é só um estado
// de interface (slide sem ato), nunca uma decisão de conteúdo.
export type NarrativeAct = NarrativeActName | "neutral";

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

  // No celular a fileira de pontos rola: mantém o slide atual à vista.
  const activeDotRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeDotRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [current]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: hidden ? 0 : 1, y: hidden ? 20 : 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      // Só opacidade/posição: o blur animado no elemento fixo era recalculado
      // sobre o slide em movimento a cada quadro.
      // Centraliza pelo framer (x: -50%): o transform animado anulava o
      // -translate-x-1/2 do Tailwind e o HUD ficava deslocado para a direita.
      style={{ x: "-50%" }}
      className="pointer-events-none fixed bottom-4 sm:bottom-6 left-1/2 z-50"
      aria-hidden={hidden || undefined}
    >
      <nav
        aria-label="Navegação dos slides"
        className={`${hidden ? "pointer-events-none" : "pointer-events-auto"} flex max-w-[calc(100vw-1.5rem)] items-center gap-2 sm:gap-4 rounded-full bg-black/70 backdrop-blur-md px-3 sm:px-5 py-2 sm:py-3 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)]`}
      >
        {/* Anel rotativo + número */}
        <div className="relative h-10 w-10 shrink-0 flex items-center justify-center">
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

        {/* Dots interativos por slide — rolam na horizontal quando não cabem (abaixo de
            1024px; o py-1 deixa o anel de foco visível dentro da rolagem); no desktop o
            overflow fica visível para não cortar a dica do hover. */}
        <div className="-my-1 flex min-w-0 items-center gap-1.5 overflow-x-auto py-1 px-0.5 lg:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {dots.map((d) => {
            const isActive = d.idx === current;
            const color = ACT_COLOR[d.act];
            return (
              <button
                key={d.idx}
                ref={isActive ? activeDotRef : undefined}
                type="button"
                onClick={() => onJump(d.idx)}
                aria-label={`Ir para o slide ${d.idx + 1}${ACT_LABEL[d.act] ? ` (${ACT_LABEL[d.act]})` : ""}`}
                aria-current={isActive ? "step" : undefined}
                tabIndex={hidden ? -1 : 0}
                className="group relative flex shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                // 24px: área mínima de toque (WCAG 2.2); o ponto visível continua com 8px.
                style={{ width: 24, height: 24 }}
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
                {/* Antes só o TEXTO sumia: o fundo preto ficava visível sobre cada ponto. */}
                <span aria-hidden className="absolute -top-7 left-1/2 -translate-x-1/2 text-[9px] font-medium uppercase tracking-wider text-white/85 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity whitespace-nowrap pointer-events-none bg-black/70 px-1.5 py-0.5 rounded">
                  {d.idx + 1}
                </span>
              </button>
            );
          })}
        </div>

        {/* Label do ato narrativo */}
        <div className="hidden sm:flex shrink-0 items-center gap-2 pl-2 border-l border-white/10 min-w-[80px]">
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
      </nav>
    </motion.div>
  );
};
