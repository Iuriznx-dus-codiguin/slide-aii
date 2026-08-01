// ============================================================
// SlideAI — Engine de animação cinematográfica (Fase 1)
// ------------------------------------------------------------
// Substitui os presets simples por uma engine baseada em
// Framer Motion variants com:
//   • Easings cubic-bezier inspirados em Apple/Stripe
//   • Stagger inteligente (palavras, bullets, gráficos)
//   • Coordenação container ↔ filhos
//   • Counter animation hook (useAnimatedNumber)
//   • Camera transitions entre slides (pan+zoom+blur)
//   • Ken Burns para fundos (drift contínuo)
// ============================================================

import type { Variants, Transition } from "framer-motion";
import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

/* ---------- Easings ---------- */
export const EASE = {
  /** Apple-like, smooth deceleration. Default for entradas. */
  smooth: [0.22, 1, 0.36, 1] as const,
  /** Snappy, mais firme — para CTAs e dados. */
  snap: [0.34, 1.56, 0.64, 1] as const,
  /** Editorial, lento e elegante — para headlines de capa. */
  editorial: [0.16, 1, 0.3, 1] as const,
  /** Inertia tipo física — desacelera de forma natural. */
  inertia: [0.05, 0.7, 0.1, 1] as const,
};

/* ---------- Presets cinematográficos ----------
   Cada preset retorna { container, item } variants para
   coordenar parent (orchestration) com filhos (entrada).
------------------------------------------------- */

export type CinematicPreset =
  | "cinematic-reveal"   // blur→sharp + lift sutil — uso geral
  | "editorial-stagger"  // cascata por elemento — bullets, listas
  | "hero-zoom"          // scale 1.05→1, entrada lenta — capas
  | "data-build"         // rise + fade rápido — gráficos, números
  | "quote-spotlight"    // lift + opacidade lenta — citações
  | "kinetic-type"       // por palavra com perspectiva — títulos fortes
  | "split-curtain"      // clip-path reveal — divisores
  | "fade-soft";         // fallback minimal

interface PresetVariants {
  container: Variants;
  item: Variants;
  /** Delay aplicado no children stagger. */
  stagger: number;
}

const baseTransition = (duration = 0.7, ease: readonly number[] = EASE.smooth): Transition => ({
  duration,
  ease: ease as any,
});

export const PRESETS: Record<CinematicPreset, PresetVariants> = {
  "cinematic-reveal": {
    stagger: 0.08,
    container: {
      hidden: {},
      show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
    },
    item: {
      hidden: { opacity: 0, y: 24, filter: "blur(14px)", scale: 0.985 },
      show: { opacity: 1, y: 0, filter: "blur(0px)", scale: 1, transition: baseTransition(0.85, EASE.editorial) },
    },
  },
  "editorial-stagger": {
    stagger: 0.06,
    container: {
      hidden: {},
      show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
    },
    item: {
      hidden: { opacity: 0, y: 18 },
      show: { opacity: 1, y: 0, transition: baseTransition(0.55, EASE.smooth) },
    },
  },
  "hero-zoom": {
    stagger: 0.12,
    container: {
      hidden: {},
      show: { transition: { staggerChildren: 0.14, delayChildren: 0.1 } },
    },
    item: {
      hidden: { opacity: 0, scale: 1.06, filter: "blur(20px)" },
      show: { opacity: 1, scale: 1, filter: "blur(0px)", transition: baseTransition(1.1, EASE.editorial) },
    },
  },
  "data-build": {
    stagger: 0.05,
    container: {
      hidden: {},
      show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
    },
    item: {
      hidden: { opacity: 0, y: 14 },
      show: { opacity: 1, y: 0, transition: baseTransition(0.45, EASE.snap as any) },
    },
  },
  "quote-spotlight": {
    stagger: 0.18,
    container: {
      hidden: {},
      show: { transition: { staggerChildren: 0.2, delayChildren: 0.2 } },
    },
    item: {
      hidden: { opacity: 0, y: 30, filter: "blur(8px)" },
      show: { opacity: 1, y: 0, filter: "blur(0px)", transition: baseTransition(1.2, EASE.editorial) },
    },
  },
  "kinetic-type": {
    stagger: 0.04,
    container: {
      hidden: {},
      show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
    },
    item: {
      hidden: { opacity: 0, y: 40, rotateX: -45 },
      show: { opacity: 1, y: 0, rotateX: 0, transition: baseTransition(0.7, EASE.smooth) },
    },
  },
  "split-curtain": {
    stagger: 0.15,
    container: {
      hidden: {},
      show: { transition: { staggerChildren: 0.15, delayChildren: 0.1 } },
    },
    item: {
      hidden: { opacity: 0, clipPath: "inset(0 50% 0 50%)" },
      show: { opacity: 1, clipPath: "inset(0 0% 0 0%)", transition: baseTransition(0.95, EASE.editorial) },
    },
  },
  "fade-soft": {
    stagger: 0.05,
    container: {
      hidden: {},
      show: { transition: { staggerChildren: 0.05 } },
    },
    item: {
      hidden: { opacity: 0 },
      show: { opacity: 1, transition: baseTransition(0.5) },
    },
  },
};

/** Mapeia tipo de slide → preset cinematográfico padrão. */
export function presetForSlide(slideType: string, layoutTemplate?: string): CinematicPreset {
  if (slideType === "title_slide" || layoutTemplate === "title-only") return "hero-zoom";
  if (slideType === "quote") return "quote-spotlight";
  if (slideType === "data_chart" || layoutTemplate === "data-chart") return "data-build";
  if (layoutTemplate === "stat-highlight") return "data-build";
  if (slideType === "section_divider") return "split-curtain";
  if (slideType === "bullet_points") return "editorial-stagger";
  if (slideType === "conclusion") return "cinematic-reveal";
  return "cinematic-reveal";
}

/**
 * Mapeia animation_intent (papel narrativo, bem guiado no prompt de
 * geração — ver PASSO E em generate-presentation/index.ts) → preset.
 *
 * CORREÇÃO DE AUDITORIA: antes desta mudança, a resolução era
 * `presetFromLegacy(c.animation) ?? presetForSlide(...)`. Como `animation`
 * é campo obrigatório do schema e presetFromLegacy cobre as 10 opções
 * possíveis, o `??` nunca disparava — ou seja, o preset de entrada do slide
 * era sempre decidido pelo campo SEM descrição no schema (animation),
 * nunca pelo campo COM guidance explícita e reforço de variedade no prompt
 * (animation_intent). Esta função corrige a precedência: animation_intent
 * agora decide primeiro; animation (legado) e presetForSlide (por tipo de
 * slide) continuam como fallback, nessa ordem — nenhuma apresentação já
 * gerada perde compatibilidade (slides antigos sem animation_intent caem
 * direto no comportamento de antes).
 */
export function presetFromIntent(intent?: string): CinematicPreset | null {
  switch (intent) {
    case "hero-impact":
      return "hero-zoom";
    case "narrative-build":
      return "editorial-stagger";
    case "data-reveal":
    case "emphasis-stat":
      return "data-build";
    case "quote-spotlight":
      return "quote-spotlight";
    case "section-break":
      return "split-curtain";
    case "calm-fade":
      return "cinematic-reveal";
    default:
      return null;
  }
}

/** Mapeia animação clássica (legado) → preset novo. */
export function presetFromLegacy(legacy?: string): CinematicPreset | null {
  if (!legacy) return null;
  switch (legacy) {
    case "blur-in":
    case "fade":
      return "cinematic-reveal";
    case "stagger-up":
      return "editorial-stagger";
    case "zoom-in":
      return "hero-zoom";
    case "reveal-mask":
      return "split-curtain";
    case "rotate-in":
      // visual com rotateX 3D — usa kinetic-type
      return "kinetic-type";
    case "bounce-in":
      // firme e enérgico — usa data-build (que já usa EASE.snap)
      return "data-build";
    case "slide-left":
      // mantém cinematic-reveal (o eixo x é tratado em cameraVariants)
      return "cinematic-reveal";
    case "slide-right":
    case "slide-up":
      return "editorial-stagger";
    default:
      return null;
  }
}

/* ---------- Camera transitions entre slides ----------
   Cada slide entra/sai com pan+zoom+blur, simulando uma
   câmera virtual em vez de um corte abrupto.
-------------------------------------------------------- */

export type CameraDirection = "left" | "right" | "in" | "out" | "up" | "down";

export const cameraVariants = (direction: CameraDirection = "right") => {
  const distance = 80;
  const map: Record<CameraDirection, { from: any; to: any }> = {
    right: { from: { x: distance, scale: 1.04 }, to: { x: -distance, scale: 0.96 } },
    left: { from: { x: -distance, scale: 1.04 }, to: { x: distance, scale: 0.96 } },
    up: { from: { y: distance, scale: 1.04 }, to: { y: -distance, scale: 0.96 } },
    down: { from: { y: -distance, scale: 1.04 }, to: { y: distance, scale: 0.96 } },
    in: { from: { scale: 1.12 }, to: { scale: 0.92 } },
    out: { from: { scale: 0.92 }, to: { scale: 1.12 } },
  };
  const { from, to } = map[direction];
  return {
    initial: { opacity: 0, filter: "blur(16px)", ...from },
    animate: { opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, filter: "blur(20px)", ...to },
  };
};

export const cameraTransition: Transition = {
  duration: 0.85,
  ease: EASE.editorial as any,
};

/** Decide direção da câmera baseado no índice (alterna lados). */
export function pickCameraDirection(prevIdx: number, nextIdx: number): CameraDirection {
  if (nextIdx === prevIdx) return "in";
  if (Math.abs(nextIdx - prevIdx) > 1) return "in"; // jump → zoom
  // alternar para dar ritmo
  if (nextIdx > prevIdx) return nextIdx % 3 === 0 ? "in" : "right";
  return prevIdx % 3 === 0 ? "out" : "left";
}

/* ---------- Hook: counter animado ----------
   Detecta números em strings tipo "78%" e anima de 0 ao alvo.
--------------------------------------------- */

export function parseNumberFromString(value?: string): { num: number; prefix: string; suffix: string } | null {
  if (!value) return null;
  const match = value.match(/^([^\d-]*)(-?\d+(?:[.,]\d+)?)([^\d]*)$/);
  if (!match) return null;
  const [, prefix, numStr, suffix] = match;
  const num = parseFloat(numStr.replace(",", "."));
  if (isNaN(num)) return null;
  return { num, prefix, suffix };
}

/** Hook que anima de 0 ao valor alvo com easing inertia. */
export function useAnimatedNumber(target: number, durationMs = 1400, enabled = true) {
  const [value, setValue] = useState(enabled ? 0 : target);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!enabled || reduceMotion) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // ease-out-expo
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setValue(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, enabled, reduceMotion]);

  return value;
}

/** Formata número animado preservando casas decimais do alvo. */
export function formatAnimatedNumber(value: number, target: number): string {
  const decimals = (target.toString().split(".")[1]?.length) ?? 0;
  return value.toFixed(decimals);
}

/* ---------- Ken Burns para fundos ---------- */
export const kenBurnsVariants: Variants = {
  initial: { scale: 1.05, x: -10, y: -10 },
  animate: {
    scale: 1.12,
    x: 10,
    y: 10,
    transition: { duration: 18, ease: "linear", repeat: Infinity, repeatType: "reverse" },
  },
};
