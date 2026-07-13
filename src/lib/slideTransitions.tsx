// ============================================================
// SlideAI — Slide-to-Slide Cinematic Transitions
// ------------------------------------------------------------
// Em vez de slides "deslizarem" como padrão, o slide que sai
// se DESMONTA (tiles, ribbons, shatter, blinds, iris, fold,
// portal, wipe, split, morph, stack, letterbox) e o slide que
// entra se RECONSTRÓI no lugar com overlays sincronizados.
//
// Cada transição expõe:
//   - enter / exit  → variantes Framer Motion p/ a camada do slide
//   - Overlay       → camada extra (tiles/ribbons/iris/etc) que
//                     toca durante a troca, animada pelo accent.
//   - duration      → janela total da transição (s)
// ============================================================

import type { Transition, Variants } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

export type SlideTransition =
  | "dynamic"     // NOVO PADRÃO: container fica neutro; título/imagem-hero em
                  // âncora fazem magic move real (mesmo objeto reposicionando),
                  // o resto sai/entra coordenado como uma onda única (ver
                  // dynamicMode em SlideRenderer + useChoreo)
  | "mosaic"      // grade de tiles que viram e revelam
  | "iris"        // máscara circular abre/fecha do centro
  | "shatter"     // clip-path triangular: estilhaça e reagrupa
  | "ribbon"      // 5 faixas horizontais varrem em sequência
  | "blinds"      // 8 venezianas verticais giram em 3D
  | "fold"        // dobra editorial 3D (perspective rotateY)
  | "portal"      // zoom+rotate+blur, "entra em portal"
  | "wipe"        // diagonal wipe com clip-path polygon
  | "split"       // metades superior/inferior se afastam
  | "morph"       // crossfade com scale e color-shift líquido
  | "stack"       // empilha e dispara em camadas
  | "letterbox";  // barras pretas fecham/abrem como cinema

// "dynamic" fica de fora deste array de propósito: ALL_TRANSITIONS alimenta o
// round-robin de pickTransition() para slides sem tipo reconhecido, e dynamic
// já é tratado como o padrão universal ali (não precisa entrar no rodízio).
// Ainda assim, um content.transition="dynamic" explícito é sempre respeitado
// (ver pickTransition), e continua 100% válido como Overlay/config abaixo.
export const ALL_TRANSITIONS: SlideTransition[] = [
  "mosaic", "iris", "shatter", "ribbon", "blinds",
  "fold", "portal", "wipe", "split", "morph", "stack", "letterbox",
];

const EASE_EDITORIAL = [0.16, 1, 0.3, 1] as const;
const EASE_SMOOTH = [0.22, 1, 0.36, 1] as const;
const EASE_INERTIA = [0.05, 0.7, 0.1, 1] as const;

export interface TransitionConfig {
  duration: number;
  enter: { initial: any; animate: any; transition: Transition };
  exit: { animate?: any; exit: any; transition: Transition };
  /** Overlay opcional posicionado absolute inset-0 acima dos slides. */
  Overlay?: (props: { accent: string; direction: 1 | -1 }) => ReactNode;
  /** Permitir os dois layers no mesmo tempo (sync vs wait). */
  mode?: "sync" | "wait";
}

/**
 * Decide transição por contexto. Aceita hint manual via content.transition.
 * "dynamic" é o padrão universal quando NENHUMA transição foi explicitamente
 * escolhida (nem pela IA na geração, nem manualmente no editor) — antes desta
 * mudança, o fallback sem hint fazia um rodízio determinístico pelas 12
 * transições legadas por slide_type. Uma vez que um slide já tem
 * content.transition preenchido (incluindo apresentações já existentes antes
 * desta mudança), esse valor continua sendo respeitado sem alteração —
 * nenhuma apresentação existente muda de transição por causa disto.
 */
export function pickTransition(
  _index: number,
  _slideType?: string,
  hint?: SlideTransition,
): SlideTransition {
  if (hint === "dynamic") return "dynamic";
  if (hint && ALL_TRANSITIONS.includes(hint)) return hint;
  return "dynamic";
}

/* ---------- helpers ---------- */
const T = (duration: number, ease: readonly number[] = EASE_EDITORIAL): Transition => ({
  duration, ease: ease as any,
});

const fadeBase = {
  enter: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: T(0.6),
  },
  exit: {
    exit: { opacity: 0 },
    transition: T(0.45),
  },
};

/* ---------- engine ---------- */
export function getTransitionConfig(
  t: SlideTransition,
  _accent: string,
): TransitionConfig {
  switch (t) {
    case "iris":
      return {
        duration: 1.05,
        mode: "sync",
        enter: {
          initial: { opacity: 0, scale: 1.08, clipPath: "circle(0% at 50% 50%)" },
          animate: { opacity: 1, scale: 1, clipPath: "circle(75% at 50% 50%)" },
          transition: T(1.0, EASE_EDITORIAL),
        },
        exit: {
          exit: { opacity: 0, scale: 0.94, clipPath: "circle(0% at 50% 50%)" },
          transition: T(0.85, EASE_EDITORIAL),
        },
        Overlay: ({ accent }) => (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${accent}22 0%, transparent 60%)`,
              mixBlendMode: "screen",
              animation: "slideai-iris-pulse 1s ease-out forwards",
            } as CSSProperties}
          />
        ),
      };

    case "letterbox":
      return {
        duration: 1.1,
        mode: "sync",
        enter: {
          initial: { opacity: 0, scale: 1.04 },
          animate: { opacity: 1, scale: 1 },
          transition: { ...T(0.85, EASE_EDITORIAL), delay: 0.25 },
        },
        exit: {
          exit: { opacity: 0, scale: 0.98 },
          transition: T(0.5, EASE_SMOOTH),
        },
        Overlay: () => (
          <>
            <div
              className="pointer-events-none absolute inset-x-0 top-0 bg-black"
              style={{
                height: "50%",
                transformOrigin: "top",
                animation: "slideai-letterbox-top 1.05s cubic-bezier(0.16,1,0.3,1) forwards",
              } as CSSProperties}
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 bg-black"
              style={{
                height: "50%",
                transformOrigin: "bottom",
                animation: "slideai-letterbox-bot 1.05s cubic-bezier(0.16,1,0.3,1) forwards",
              } as CSSProperties}
            />
          </>
        ),
      };

    case "ribbon":
      return {
        duration: 1.05,
        mode: "sync",
        enter: {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          transition: { ...T(0.4), delay: 0.55 },
        },
        exit: {
          exit: { opacity: 0 },
          transition: { ...T(0.3), delay: 0.1 },
        },
        Overlay: ({ accent, direction }) => (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0"
                style={{
                  top: `${i * 20}%`,
                  height: "20%",
                  background: i % 2 === 0
                    ? `linear-gradient(90deg, ${accent} 0%, ${accent}cc 100%)`
                    : `linear-gradient(90deg, #0a0a0a 0%, #1a1a1a 100%)`,
                  transformOrigin: direction === 1 ? "left" : "right",
                  animation: `slideai-ribbon 1.05s cubic-bezier(0.16,1,0.3,1) ${i * 0.07}s forwards`,
                } as CSSProperties}
              />
            ))}
          </div>
        ),
      };

    case "mosaic":
      return {
        duration: 1.1,
        mode: "sync",
        enter: {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          transition: { ...T(0.4), delay: 0.7 },
        },
        exit: {
          exit: { opacity: 0 },
          transition: { ...T(0.3), delay: 0.05 },
        },
        Overlay: ({ accent }) => {
          const cols = 8, rows = 5;
          const cells: ReactNode[] = [];
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const delay = (r + c) * 0.04;
              cells.push(
                <div
                  key={`${r}-${c}`}
                  className="absolute"
                  style={{
                    left: `${(c / cols) * 100}%`,
                    top: `${(r / rows) * 100}%`,
                    width: `${100 / cols}%`,
                    height: `${100 / rows}%`,
                    background: (r + c) % 2 === 0 ? accent : "#0a0a0a",
                    transformOrigin: "center",
                    animation: `slideai-mosaic-tile 1.05s cubic-bezier(0.22,1,0.36,1) ${delay}s forwards`,
                  } as CSSProperties}
                />
              );
            }
          }
          return <div className="pointer-events-none absolute inset-0 overflow-hidden">{cells}</div>;
        },
      };

    case "blinds":
      return {
        duration: 1.0,
        mode: "sync",
        enter: {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          transition: { ...T(0.35), delay: 0.55 },
        },
        exit: {
          exit: { opacity: 0 },
          transition: { ...T(0.25), delay: 0.05 },
        },
        Overlay: ({ accent }) => {
          const n = 8;
          return (
            <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ perspective: "1400px" } as CSSProperties}>
              {Array.from({ length: n }).map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0"
                  style={{
                    left: `${(i / n) * 100}%`,
                    width: `${100 / n}%`,
                    background: i % 2 === 0
                      ? `linear-gradient(180deg, ${accent}f0, ${accent}88)`
                      : `linear-gradient(180deg, #111 0%, #050505 100%)`,
                    transformOrigin: "center",
                    animation: `slideai-blinds 1s cubic-bezier(0.22,1,0.36,1) ${i * 0.05}s forwards`,
                  } as CSSProperties}
                />
              ))}
            </div>
          );
        },
      };

    case "shatter":
      return {
        duration: 1.15,
        mode: "sync",
        enter: {
          initial: { opacity: 0, scale: 0.92, filter: "blur(20px)" },
          animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
          transition: { ...T(0.85, EASE_EDITORIAL), delay: 0.35 },
        },
        exit: {
          exit: { opacity: 0, scale: 1.08, filter: "blur(14px)" },
          transition: T(0.55, EASE_SMOOTH),
        },
        Overlay: ({ accent }) => {
          // 8 fragmentos triangulares com clip-path que voam para fora.
          const shards = [
            "polygon(0 0, 50% 0, 0 50%)",
            "polygon(50% 0, 100% 0, 100% 50%)",
            "polygon(0 50%, 0 100%, 50% 100%)",
            "polygon(50% 100%, 100% 100%, 100% 50%)",
            "polygon(50% 0, 50% 50%, 0 50%)",
            "polygon(50% 0, 100% 0, 50% 50%)",
            "polygon(0 50%, 50% 50%, 50% 100%)",
            "polygon(50% 50%, 100% 50%, 50% 100%)",
          ];
          const dirs = [
            { x: "-40%", y: "-40%", r: -25 }, { x: "40%", y: "-40%", r: 25 },
            { x: "-40%", y: "40%", r: 25 }, { x: "40%", y: "40%", r: -25 },
            { x: "-20%", y: "-20%", r: -15 }, { x: "20%", y: "-20%", r: 15 },
            { x: "-20%", y: "20%", r: 15 }, { x: "20%", y: "20%", r: -15 },
          ];
          return (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {shards.map((clip, i) => (
                <div
                  key={i}
                  className="absolute inset-0"
                  style={{
                    clipPath: clip,
                    background: `linear-gradient(135deg, ${accent}cc, #050505)`,
                    ["--sx" as any]: dirs[i].x,
                    ["--sy" as any]: dirs[i].y,
                    ["--sr" as any]: `${dirs[i].r}deg`,
                    animation: `slideai-shatter 1.15s cubic-bezier(0.05,0.7,0.1,1) ${i * 0.03}s forwards`,
                  } as CSSProperties}
                />
              ))}
            </div>
          );
        },
      };

    case "fold":
      return {
        duration: 1.1,
        mode: "wait",
        enter: {
          initial: { opacity: 0, rotateY: -75, transformPerspective: 1400 },
          animate: { opacity: 1, rotateY: 0 },
          transition: T(0.95, EASE_EDITORIAL),
        },
        exit: {
          exit: { opacity: 0, rotateY: 75, transformPerspective: 1400 },
          transition: T(0.65, EASE_SMOOTH),
        },
      };

    case "portal":
      return {
        duration: 1.1,
        mode: "wait",
        enter: {
          initial: { opacity: 0, scale: 0.45, rotate: -8, filter: "blur(24px)" },
          animate: { opacity: 1, scale: 1, rotate: 0, filter: "blur(0px)" },
          transition: T(0.95, EASE_EDITORIAL),
        },
        exit: {
          exit: { opacity: 0, scale: 2.1, rotate: 6, filter: "blur(28px)" },
          transition: T(0.7, EASE_SMOOTH),
        },
        Overlay: ({ accent }) => (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${accent}55 0%, transparent 50%)`,
              mixBlendMode: "screen",
              animation: "slideai-portal-flash 0.9s ease-out forwards",
            } as CSSProperties}
          />
        ),
      };

    case "wipe":
      return {
        duration: 0.95,
        mode: "sync",
        enter: {
          initial: { opacity: 0, clipPath: "polygon(0 0, 0 0, 0 100%, 0 100%)" },
          animate: { opacity: 1, clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)" },
          transition: { ...T(0.8, EASE_EDITORIAL), delay: 0.15 },
        },
        exit: {
          exit: { opacity: 0, clipPath: "polygon(100% 0, 100% 0, 100% 100%, 100% 100%)" },
          transition: T(0.6, EASE_SMOOTH),
        },
        Overlay: ({ accent, direction }) => (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `linear-gradient(${direction === 1 ? "100deg" : "260deg"}, transparent 0%, ${accent}cc 48%, ${accent} 50%, ${accent}cc 52%, transparent 100%)`,
              animation: `slideai-wipe-${direction === 1 ? "r" : "l"} 0.95s cubic-bezier(0.16,1,0.3,1) forwards`,
            } as CSSProperties}
          />
        ),
      };

    case "split":
      return {
        duration: 1.05,
        mode: "sync",
        enter: {
          initial: { opacity: 0, scale: 1.06 },
          animate: { opacity: 1, scale: 1 },
          transition: { ...T(0.75, EASE_EDITORIAL), delay: 0.4 },
        },
        exit: {
          exit: { opacity: 0 },
          transition: { ...T(0.3), delay: 0.05 },
        },
        Overlay: ({ accent }) => (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="absolute inset-x-0 top-0"
              style={{
                height: "50%",
                background: `linear-gradient(180deg, ${accent}, #0a0a0a)`,
                animation: "slideai-split-top 1s cubic-bezier(0.16,1,0.3,1) forwards",
              } as CSSProperties}
            />
            <div
              className="absolute inset-x-0 bottom-0"
              style={{
                height: "50%",
                background: `linear-gradient(0deg, ${accent}, #0a0a0a)`,
                animation: "slideai-split-bot 1s cubic-bezier(0.16,1,0.3,1) forwards",
              } as CSSProperties}
            />
          </div>
        ),
      };

    case "morph":
      return {
        duration: 1.0,
        mode: "sync",
        enter: {
          initial: { opacity: 0, scale: 1.08, filter: "blur(18px) saturate(1.4)" },
          animate: { opacity: 1, scale: 1, filter: "blur(0px) saturate(1)" },
          transition: T(0.95, EASE_EDITORIAL),
        },
        exit: {
          exit: { opacity: 0, scale: 0.96, filter: "blur(18px) saturate(0.6)" },
          transition: T(0.75, EASE_SMOOTH),
        },
        Overlay: ({ accent }) => (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `conic-gradient(from 0deg at 50% 50%, ${accent}33, transparent 25%, ${accent}33 50%, transparent 75%, ${accent}33)`,
              mixBlendMode: "overlay",
              animation: "slideai-morph-spin 1s linear forwards",
            } as CSSProperties}
          />
        ),
      };

    case "stack":
      return {
        duration: 1.0,
        mode: "sync",
        enter: {
          initial: { opacity: 0, y: 80, scale: 0.94, filter: "blur(10px)" },
          animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
          transition: { ...T(0.85, EASE_EDITORIAL), delay: 0.2 },
        },
        exit: {
          exit: { opacity: 0, y: -80, scale: 0.94, filter: "blur(10px)" },
          transition: T(0.65, EASE_SMOOTH),
        },
        Overlay: ({ accent }) => (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="absolute inset-0"
                style={{
                  border: `2px solid ${accent}`,
                  borderRadius: "16px",
                  opacity: 0,
                  animation: `slideai-stack-card 1s cubic-bezier(0.22,1,0.36,1) ${i * 0.12}s forwards`,
                } as CSSProperties}
              />
            ))}
          </div>
        ),
      };

    case "dynamic":
      // O modo "dynamic" NÃO tem Overlay nem efeito de container chamativo de
      // propósito: o drama visual desta transição vem dos ELEMENTOS (título/
      // imagem-hero fazendo magic move via layoutId em SlideRenderer, e o
      // resto saindo/entrando coordenado via useChoreo), não do container.
      // Se o container também fizesse um efeito forte (blur, rotateY, clip-
      // path) ao mesmo tempo que um elemento filho tenta uma projeção de
      // layout suave, os dois movimentos brigariam visualmente. mode:"sync"
      // é essencial aqui: o slide que sai e o que entra precisam coexistir
      // por um instante para o Framer Motion conseguir medir e interpolar
      // entre as posições dos elementos-âncora (sem overlap não há "de onde"
      // fazer o magic move partir).
      return {
        duration: 0.6,
        mode: "sync",
        enter: {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          transition: T(0.5, EASE_SMOOTH),
        },
        exit: {
          exit: { opacity: 0 },
          transition: T(0.4, EASE_SMOOTH),
        },
      };

    default:
      return {
        duration: 0.8,
        mode: "sync",
        enter: { ...fadeBase.enter, initial: { opacity: 0, scale: 1.02 }, animate: { opacity: 1, scale: 1 } },
        exit: { ...fadeBase.exit, exit: { opacity: 0, scale: 0.98 } },
      };
  }
}

/**
 * Config usada quando prefers-reduced-motion está ativo, independente de
 * qual transição o slide tenha — substitui qualquer uma das 13 opções
 * (incluindo "dynamic") por um crossfade simples e curto, sem Overlay e sem
 * qualquer efeito de movimento grande (scale/rotate/blur/clip-path).
 */
export const REDUCED_MOTION_TRANSITION_CONFIG: TransitionConfig = {
  duration: 0.35,
  mode: "sync",
  enter: { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: T(0.3) },
  exit: { exit: { opacity: 0 }, transition: T(0.25) },
};

/** Variants estáticas (não usadas diretamente, exportadas p/ futuro). */
export const FALLBACK_VARIANTS: Variants = {
  initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 },
};
