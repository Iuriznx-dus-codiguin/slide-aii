// ============================================================
// SlideAI — Physics helpers (Fase 2.5)
// ------------------------------------------------------------
// Wraps @react-spring/web em hooks plug-and-play para os
// elementos-chave: CTAs (hover/tap com inércia), números de
// stat (entrada com elasticidade) e câmera de slides (overshoot
// natural). Mantém Framer Motion no resto.
//
// Por que react-spring aqui: springs reais (massa/tensão/fricção)
// dão "peso" físico que tweens/cubic-bezier não conseguem simular.
// ============================================================

import { useSpring, config, type SpringConfig } from "@react-spring/web";
import { useReducedMotion } from "framer-motion";

/** Presets de física calibrados para uso editorial. */
export const PHYSICS = {
  /** Botões / CTAs — resposta firme com leve overshoot. */
  cta: { mass: 1, tension: 320, friction: 22 } as SpringConfig,
  /** Números grandes — entrada com inércia (peso visual). */
  heavy: { mass: 1.4, tension: 180, friction: 26 } as SpringConfig,
  /** Câmera de slides — suave, sem oscilação. */
  camera: { mass: 1, tension: 210, friction: 30 } as SpringConfig,
  /** Microinterações sutis — quase plano. */
  subtle: config.gentle,
} as const;

/* ---------- Hook: hover/press com física ---------- */

interface UseSpringHoverOptions {
  /** Escala alvo no hover (default 1.04). */
  hoverScale?: number;
  /** Escala alvo no press (default 0.97). */
  pressScale?: number;
  /** Y offset no hover (lift). Default 0. */
  hoverY?: number;
  preset?: SpringConfig;
}

/**
 * Gera bind handlers + style animado para hover/press com spring real.
 *
 * Uso:
 *   const { bind, style } = useSpringHover();
 *   <animated.button style={style} {...bind}>Click</animated.button>
 */
export function useSpringHover(opts: UseSpringHoverOptions = {}) {
  const { hoverScale = 1.04, pressScale = 0.97, hoverY = 0, preset = PHYSICS.cta } = opts;
  const reduce = useReducedMotion();

  const [styles, api] = useSpring(() => ({
    scale: 1,
    y: 0,
    config: preset,
  }));

  if (reduce) {
    return { bind: {}, style: { scale: 1, y: 0 } };
  }

  const bind = {
    onMouseEnter: () => api.start({ scale: hoverScale, y: hoverY }),
    onMouseLeave: () => api.start({ scale: 1, y: 0 }),
    onMouseDown: () => api.start({ scale: pressScale }),
    onMouseUp: () => api.start({ scale: hoverScale, y: hoverY }),
    onTouchStart: () => api.start({ scale: pressScale }),
    onTouchEnd: () => api.start({ scale: 1, y: 0 }),
  };
  return { bind, style: styles };
}

/* ---------- Hook: número que conta com física (in/out spring) ---------- */

interface UseSpringNumberOptions {
  from?: number;
  preset?: SpringConfig;
  delay?: number;
  enabled?: boolean;
}

/**
 * Anima um número de `from` até `to` com spring físico (massa/tensão).
 * Diferente de tween: a velocidade depende da distância e há leve
 * overshoot natural. Ótimo para stats grandes.
 */
export function useSpringNumber(to: number, opts: UseSpringNumberOptions = {}) {
  const { from = 0, preset = PHYSICS.heavy, delay = 0, enabled = true } = opts;
  const reduce = useReducedMotion();

  const { value } = useSpring({
    from: { value: enabled && !reduce ? from : to },
    to: { value: to },
    config: preset,
    delay,
    immediate: !enabled || !!reduce,
  });

  return value;
}
