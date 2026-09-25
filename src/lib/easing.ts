// Curvas de easing do produto — módulo puro (sem React/framer), para que
// construtores de cena determinísticos (src/lib/scene/sceneMotion.ts) e
// testes possam usá-las. src/lib/animations.ts reexporta.
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
