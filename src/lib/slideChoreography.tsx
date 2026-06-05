// ============================================================
// SlideAI — Per-Element Choreography Engine
// ------------------------------------------------------------
// Em vez de o slide trocar como um bloco, cada ELEMENTO (título,
// subtítulo, body, bullet, stat, imagem, chart, decoração, etc.)
// tem sua própria saída coreografada. O conjunto cria a sensação
// de que os elementos "vivem": pulam, somem, explodem, contraem
// e os novos aparecem, expandem, deslizam, giram no lugar.
//
// API:
//   const choreo = useChoreo();
//   <motion.h2 exit={choreo.exitFor("title")} ... />
//
// `exitFor` devolve um objeto pronto p/ Framer Motion (com transition
// embutida no target) — assim cada elemento pode ter duração/easing
// diferente sem conflitar com o `transition` da entrada.
// ============================================================

import { createContext, useContext, useMemo, type ReactNode } from "react";

export type ElementRole =
  | "title" | "subtitle" | "body" | "bullet" | "kicker" | "label"
  | "mark" | "quote" | "author" | "stat" | "image" | "chart"
  | "decoration" | "accent-line" | "card";

export type ChoreographyName =
  | "scatter"      // tudo voa em direções aleatórias + rotação
  | "implode"      // colapsa pro centro com blur
  | "liftoff"      // sobe + fade com stagger pesado
  | "peel-3d"      // rotateY 3D + fade
  | "dissolve"     // blur + scale + fade longo
  | "stagger-up"   // cascata para cima por papel
  | "swirl"        // rotaciona em espiral
  | "elastic-snap" // bounce inverso
  | "vacuum"       // suga pro topo direito
  | "shutter"      // clipPath inset fecha
  | "typewriter"   // colapsa horizontal
  | "drift-fade"   // drift sutil + fade
  | "explode";     // tudo voa para fora com rotação grande

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const EASE_SHARP = [0.7, 0, 0.84, 0] as const;
const EASE_ANTICIPATE = [0.68, -0.55, 0.27, 1.55] as const;

export type ExitTarget = any;

export interface SlideChoreography {
  name: ChoreographyName;
  /** Devolve um objeto pronto para spread em `exit={...}` do Framer Motion. */
  exitFor: (role: ElementRole, index?: number) => ExitTarget;
}

// ---------- Helpers de variação ----------
const roleStaggerOrder: Record<ElementRole, number> = {
  kicker: 0, mark: 0, "accent-line": 0, decoration: 0,
  title: 1, subtitle: 2, body: 3, label: 3, quote: 1, author: 4,
  bullet: 4, stat: 1, image: 2, chart: 2, card: 3,
};

const pseudo = (seed: number, max: number) => {
  // hash simples determinístico
  const s = Math.sin(seed * 9301 + 49297) * 233280;
  return Math.abs(s - Math.floor(s)) * max;
};

// ---------- Factory ----------
function makeChoreography(name: ChoreographyName, seed: number): SlideChoreography {
  const D = 0.55; // duração base de saída

  const baseDelay = (role: ElementRole, i: number) =>
    Math.min(0.18, roleStaggerOrder[role] * 0.04 + i * 0.025);

  const exitFor = (role: ElementRole, index = 0): ExitTarget => {
    const t = { duration: D, ease: EASE_OUT, delay: baseDelay(role, index) };
    const s = seed + index + (role === "bullet" ? index * 7 : 0);

    switch (name) {
      case "scatter": {
        const angle = pseudo(s, Math.PI * 2);
        const dist = 220 + pseudo(s + 11, 180);
        return {
          opacity: 0,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          rotate: (pseudo(s + 3, 60) - 30),
          scale: 0.6,
          filter: "blur(6px)",
          transition: { ...t, duration: 0.7 },
        };
      }
      case "implode":
        return {
          opacity: 0, scale: 0.2, filter: "blur(20px)",
          transition: { ...t, duration: 0.65, ease: EASE_SHARP },
        };
      case "liftoff":
        return {
          opacity: 0, y: -120 - index * 18, scale: 0.96, filter: "blur(8px)",
          transition: { ...t, duration: 0.65 },
        };
      case "peel-3d": {
        const dir = index % 2 === 0 ? -1 : 1;
        return {
          opacity: 0, rotateY: 80 * dir, x: 120 * dir, filter: "blur(6px)",
          transition: { ...t, duration: 0.75 },
        };
      }
      case "dissolve":
        return {
          opacity: 0, scale: 1.08, filter: "blur(18px) saturate(1.4)",
          transition: { ...t, duration: 0.8 },
        };
      case "stagger-up":
        return {
          opacity: 0, y: -70, filter: "blur(4px)",
          transition: { ...t, duration: 0.55 },
        };
      case "swirl": {
        const dir = role === "title" || role === "stat" ? 1 : -1;
        return {
          opacity: 0, rotate: 180 * dir, scale: 0.4, x: 80 * dir, y: -60 * dir,
          filter: "blur(8px)",
          transition: { ...t, duration: 0.8 },
        };
      }
      case "elastic-snap":
        return {
          opacity: 0, scale: 1.4, y: 40, filter: "blur(10px)",
          transition: { ...t, duration: 0.6, ease: EASE_ANTICIPATE },
        };
      case "vacuum":
        return {
          opacity: 0, x: "60vw", y: "-50vh", scale: 0.1, rotate: 35,
          filter: "blur(12px)",
          transition: { ...t, duration: 0.75, ease: EASE_SHARP },
        };
      case "shutter": {
        const horiz = index % 2 === 0;
        return {
          opacity: 0,
          clipPath: horiz ? "inset(0 50% 0 50%)" : "inset(50% 0 50% 0)",
          scale: 0.95,
          transition: { ...t, duration: 0.6, ease: EASE_SHARP },
        };
      }
      case "typewriter":
        return {
          opacity: 0, scaleX: 0, x: -30, filter: "blur(4px)",
          transition: { ...t, duration: 0.5 },
        } as ExitTarget;
      case "drift-fade": {
        const dir = index % 2 === 0 ? 1 : -1;
        return {
          opacity: 0, x: 60 * dir, y: 20, filter: "blur(8px)",
          transition: { ...t, duration: 0.65 },
        };
      }
      case "explode": {
        const angle = pseudo(s + 17, Math.PI * 2);
        const dist = 420 + pseudo(s + 23, 260);
        return {
          opacity: 0,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          rotate: (pseudo(s + 31, 240) - 120),
          scale: 0.3,
          filter: "blur(14px)",
          transition: { duration: 0.85, ease: EASE_SHARP, delay: baseDelay(role, index) * 0.5 },
        };
      }
    }
  };

  return { name, exitFor };
}

// ---------- Seleção determinística ----------
export const ALL_CHOREOGRAPHIES: ChoreographyName[] = [
  "scatter", "implode", "liftoff", "peel-3d", "dissolve", "stagger-up",
  "swirl", "elastic-snap", "vacuum", "shutter", "typewriter", "drift-fade", "explode",
];

export type AnimationIntent =
  | "hero-impact" | "narrative-build" | "data-reveal" | "emphasis-stat"
  | "quote-spotlight" | "section-break" | "calm-fade";

const INTENT_TO_CHOREOGRAPHY: Record<AnimationIntent, ChoreographyName> = {
  "hero-impact": "explode",
  "narrative-build": "liftoff",
  "data-reveal": "stagger-up",
  "emphasis-stat": "elastic-snap",
  "quote-spotlight": "dissolve",
  "section-break": "shutter",
  "calm-fade": "drift-fade",
};

export function pickChoreography(
  index: number,
  slideType?: string,
  hint?: ChoreographyName,
  animationIntent?: AnimationIntent,
): SlideChoreography {
  if (hint && ALL_CHOREOGRAPHIES.includes(hint)) {
    return makeChoreography(hint, index * 13);
  }
  // animation_intent tem prioridade sobre slide_type
  if (animationIntent && INTENT_TO_CHOREOGRAPHY[animationIntent]) {
    return makeChoreography(INTENT_TO_CHOREOGRAPHY[animationIntent], index * 13);
  }
  let name: ChoreographyName;
  switch (slideType) {
    case "title_slide": name = "implode"; break;
    case "quote": name = "dissolve"; break;
    case "section_divider": name = "shutter"; break;
    case "data_chart": name = "stagger-up"; break;
    case "stat": name = "explode"; break;
    case "conclusion": name = "vacuum"; break;
    case "bullet_points": name = "drift-fade"; break;
    case "comparison": name = "peel-3d"; break;
    case "team": name = "scatter"; break;
    case "timeline": name = "typewriter"; break;
    case "image_full": name = "swirl"; break;
    case "image_split": name = "elastic-snap"; break;
    default: name = ALL_CHOREOGRAPHIES[index % ALL_CHOREOGRAPHIES.length];
  }
  return makeChoreography(name, index * 13);
}

// ---------- Context ----------
const defaultChoreo = makeChoreography("liftoff", 0);
const ChoreographyContext = createContext<SlideChoreography>(defaultChoreo);

export const ChoreographyProvider = ({
  value, children,
}: { value: SlideChoreography; children: ReactNode }) => (
  <ChoreographyContext.Provider value={value}>{children}</ChoreographyContext.Provider>
);

export const useChoreo = () => useContext(ChoreographyContext);

/** Helper imperativo para obter o objeto exit para um papel (não-hook). */
export function exitOf(choreo: SlideChoreography, role: ElementRole, i = 0) {
  return choreo.exitFor(role, i);
}

/** Memoiza escolha por slide. */
export function useSlideChoreography(
  index: number,
  slideType?: string,
  hint?: ChoreographyName,
  animationIntent?: AnimationIntent,
) {
  return useMemo(
    () => pickChoreography(index, slideType, hint, animationIntent),
    [index, slideType, hint, animationIntent],
  );
}
