// Movimento em JSON do motor de cenas (v2) → TimelineScenario.
//
// Cada slide v2 guarda só `motion: { preset, params }`. Este módulo PURO
// (sem React) gera as trilhas sobre o Timeline Engine que já existe
// (src/lib/timeline.ts) — sem dependência nova. Mesmo motion + mesmas
// contagens → exatamente o mesmo cenário (serializável em JSON).
//
// Regras de direção:
//   • um único momento orquestrado por slide: o texto entra rápido e curto,
//     o visual faz o gesto principal (desenhar, empilhar, contar…);
//   • entrada separada de uma camada ambiente sutil em loop (scenario.ambient);
//   • reduced motion e noAnimate renderizam o frame final (o próprio
//     useTimeline já pula para o fim nesses casos).
//
// Semântica espelhada do Remotion — interpolate com clamp, curvas bezier e
// sequências por offset —, para que o mesmo JSON possa alimentar uma
// composição Remotion num futuro export em MP4 sem reinterpretação.

import type { AmbientTrack, Keyframe, TimelineProps, TimelineScenario, Track } from "@/lib/timeline";
import { EASE } from "@/lib/easing";
import type { MotionPresetId, MotionSpec } from "../../../supabase/functions/_shared/motionPresets.ts";

export interface SceneMotionInput {
  motion?: MotionSpec | null;
  /** Nós/itens do bloco visual. */
  itemCount: number;
  /** Conectores/arestas. */
  edgeCount: number;
  /** Formas estruturais (faixas, placas, eixo). */
  shapeCount: number;
  bullets: number;
  hasSubtitle: boolean;
  hasBody: boolean;
  hasMedia: boolean;
}

/** interpolate(t, [a,b], [x,y]) com clamp — mesma semântica do Remotion. */
export function interpolate(t: number, input: [number, number], output: [number, number]): number {
  const [a, b] = input;
  const [x, y] = output;
  if (b === a) return y;
  const p = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x + (y - x) * p;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

function kf(t: number, props: TimelineProps, ease?: readonly number[]): Keyframe {
  return ease ? { t: r3(t), props, ease } : { t: r3(t), props };
}

function track(id: string, start: number, duration: number, from: TimelineProps, to: TimelineProps, ease: readonly number[] = EASE.editorial): Track {
  return { id, keyframes: [kf(start, from), kf(start + duration, to, ease)] };
}

/** Texto: título → subtítulo → corpo → bullets, curto (≤ ~0.9s até o corpo). */
function textTracks(input: SceneMotionInput, s: number, start = 0): Track[] {
  const t: Track[] = [
    track("title", start, 0.7 * s, { opacity: 0, y: 24, blur: 10 }, { opacity: 1, y: 0, blur: 0 }),
  ];
  if (input.hasSubtitle) t.push(track("subtitle", start + 0.15 * s, 0.6 * s, { opacity: 0, y: 14 }, { opacity: 1, y: 0 }, EASE.smooth));
  if (input.hasBody) t.push(track("body", start + 0.3 * s, 0.6 * s, { opacity: 0, y: 12 }, { opacity: 1, y: 0 }, EASE.smooth));
  for (let i = 0; i < input.bullets; i++) {
    t.push(track(`bullet-${i}`, start + (0.45 + i * 0.08) * s, 0.5 * s, { opacity: 0, x: -14 }, { opacity: 1, x: 0 }, EASE.smooth));
  }
  return t;
}

const LOOP_PRESETS: MotionPresetId[] = ["orbit-reveal", "hub-radiate"];

/**
 * Cenário de entrada de um slide v2. `params.speed` escala o tempo;
 * `params.stagger` o intervalo entre itens; `params.emphasis` recebe um
 * focus pull extra no fim.
 */
export function buildSceneScenario(input: SceneMotionInput): TimelineScenario {
  const preset: MotionPresetId = input.motion?.preset ?? "editorial";
  const speed = input.motion?.params?.speed ?? 1;
  const s = 1 / Math.max(0.5, Math.min(2, speed));
  const stagger = (input.motion?.params?.stagger ?? 0.12) * s;
  const n = Math.max(0, input.itemCount);
  const tracks: Track[] = textTracks(input, s);
  // O visual começa quando o título já assentou.
  const v0 = 0.35 * s;
  const push = (...t: Track[]) => tracks.push(...t);
  const nodes = (from: TimelineProps, dur = 0.55, start = v0, ease: readonly number[] = EASE.editorial) => {
    for (let i = 0; i < n; i++) push(track(`node-${i}`, start + i * stagger, dur * s, from, { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }, ease));
  };
  const edges = (start: number, dur = 0.5) => {
    for (let i = 0; i < input.edgeCount; i++) {
      push(track(`edge-${i}`, start + i * stagger, dur * s, { pathLength: 0, opacity: 0 }, { pathLength: 1, opacity: 1 }, EASE.smooth));
    }
  };
  const shapes = (from: TimelineProps, start = v0, reverse = false) => {
    for (let i = 0; i < input.shapeCount; i++) {
      const k = reverse ? input.shapeCount - 1 - i : i;
      push(track(`shape-${k}`, start + i * stagger, 0.55 * s, from, { opacity: 1, y: 0, scale: 1, pathLength: 1 }, EASE.editorial));
    }
  };
  const media = (from: TimelineProps, dur = 1.1) =>
    push(track("media", v0 * 0.5, dur * s, from, { opacity: 1, scale: 1, blur: 0 }, EASE.editorial));

  switch (preset) {
    case "hero":
      tracks.splice(0, tracks.length, ...textTracks(input, s * 1.3));
      if (input.hasMedia) media({ opacity: 0, scale: 1.06, blur: 18 }, 1.4);
      break;
    case "connect-draw":
    case "list-to-flow": {
      // list-to-flow: o componente mostra os itens como lista e os move para
      // as posições do diagrama; os conectores só desenham depois.
      const nodeStart = preset === "list-to-flow" ? v0 + 0.9 * s : v0;
      nodes({ opacity: 0, y: 16, scale: 0.96 }, 0.5, preset === "list-to-flow" ? v0 : nodeStart);
      edges(nodeStart + 0.25 * s + n * stagger * 0.5);
      if (preset === "list-to-flow") push(track("morph", v0 + 0.5 * s, 0.9 * s, { count: 0 }, { count: 1 }, EASE.smooth));
      break;
    }
    case "step-cascade":
      nodes({ opacity: 0, y: 26 }, 0.55);
      for (let i = 0; i < n; i++) {
        push({ id: `marker-${i}`, spring: { stiffness: 320, damping: 18 }, keyframes: [kf(v0 + i * stagger + 0.2 * s, { scale: 0, opacity: 0 }), kf(v0 + i * stagger + 0.7 * s, { scale: 1, opacity: 1 })] });
      }
      edges(v0 + 0.3 * s);
      break;
    case "orbit-reveal":
      nodes({ opacity: 0, scale: 0.7 }, 0.6);
      edges(v0 + 0.2 * s, 0.45);
      break;
    case "timeline-sweep":
      push(track("axis", v0, (0.5 + n * 0.12) * s, { clipX: 100 }, { clipX: 0 }, EASE.smooth));
      for (let i = 0; i < n; i++) {
        push(track(`node-${i}`, v0 + (0.15 + i * 0.12) * s, 0.5 * s, { opacity: 0, y: i % 2 === 0 ? 14 : -14 }, { opacity: 1, y: 0 }, EASE.smooth));
        push(track(`shape-${i}`, v0 + (0.1 + i * 0.12) * s, 0.3 * s, { opacity: 0, scale: 0 }, { opacity: 1, scale: 1 }, EASE.snap));
      }
      break;
    case "split-reveal":
      for (let i = 0; i < n; i++) {
        const fromLeft = i % 2 === 0;
        push(track(`node-${i}`, v0 + i * stagger * 1.4, 0.7 * s, { opacity: 0, x: fromLeft ? -28 : 28, clipX: fromLeft ? 100 : 0 }, { opacity: 1, x: 0, clipX: 0 }, EASE.editorial));
      }
      break;
    case "morph-ab":
      push(track("node-0", v0, 0.55 * s, { opacity: 0, x: -20 }, { opacity: 1, x: 0 }));
      push(track("morph", v0 + 0.45 * s, 1.0 * s, { count: 0 }, { count: 1 }, EASE.smooth));
      for (let i = 1; i < n; i++) push(track(`node-${i}`, v0 + (1.0 + (i - 1) * 0.12) * s, 0.55 * s, { opacity: 0, x: 20 }, { opacity: 1, x: 0 }));
      break;
    case "scale-grow":
      for (let i = 0; i < n; i++) {
        push({ id: `node-${i}`, spring: { stiffness: 140, damping: 16 }, keyframes: [kf(v0 + i * stagger, { scale: 0.15, opacity: 0 }), kf(v0 + i * stagger + 0.8 * s, { scale: 1, opacity: 1 })] });
        push(track(`value-${i}`, v0 + i * stagger, 1.1 * s, { count: 0 }, { count: 1 }, EASE.smooth));
      }
      break;
    case "stack-build":
      shapes({ opacity: 0, y: 26, scale: 0.98 }, v0, true);
      for (let i = 0; i < n; i++) {
        const k = n - 1 - i;
        push(track(`node-${k}`, v0 + (i * 1 + 0.4) * stagger, 0.5 * s, { opacity: 0, y: 10 }, { opacity: 1, y: 0 }, EASE.smooth));
      }
      break;
    case "data-count":
      push(track("visual", v0, 0.6 * s, { opacity: 0, y: 18 }, { opacity: 1, y: 0 }));
      for (let i = 0; i < Math.max(1, n); i++) push(track(`value-${i}`, v0 + 0.1 * s + i * stagger * 0.5, 1.2 * s, { count: 0 }, { count: 1 }, EASE.smooth));
      break;
    case "system-assemble":
      nodes({ opacity: 0, scale: 0.9, blur: 6 }, 0.5);
      edges(v0 + (0.3 + n * 0.06) * s, 0.45);
      break;
    case "hub-radiate":
      push({ id: "hub", spring: { stiffness: 220, damping: 20 }, keyframes: [kf(v0, { scale: 0.6, opacity: 0 }), kf(v0 + 0.6 * s, { scale: 1, opacity: 1 })] });
      for (let i = 0; i < n; i++) {
        push(track(`edge-${i}`, v0 + 0.25 * s + i * stagger, 0.4 * s, { pathLength: 0, opacity: 0 }, { pathLength: 1, opacity: 1 }, EASE.smooth));
        push(track(`node-${i}`, v0 + 0.4 * s + i * stagger, 0.45 * s, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1 }, EASE.editorial));
      }
      break;
    case "annotate":
      media({ opacity: 0, scale: 1.04, blur: 16 }, 1.0);
      for (let i = 0; i < n; i++) {
        push({ id: `marker-${i}`, spring: { stiffness: 300, damping: 18 }, keyframes: [kf(v0 + 0.8 * s + i * stagger, { scale: 0, opacity: 0 }), kf(v0 + 1.3 * s + i * stagger, { scale: 1, opacity: 1 })] });
        push(track(`label-${i}`, v0 + 0.9 * s + i * stagger, 0.4 * s, { opacity: 0, x: 10 }, { opacity: 1, x: 0 }, EASE.smooth));
      }
      break;
    case "focus-pull":
      media({ opacity: 0, scale: 1.05, blur: 20 }, 1.2);
      nodes({ opacity: 0, y: 10 }, 0.45, v0 + 0.6 * s, EASE.smooth);
      break;
    case "calm":
      tracks.splice(0, tracks.length, ...textTracks(input, s * 0.8).map((t) => ({
        ...t,
        keyframes: t.keyframes.map((k, i) => (i === 0 ? { ...k, props: { opacity: 0 } } : { ...k, props: { opacity: 1 } })),
      })));
      if (input.hasMedia) media({ opacity: 0 }, 0.6);
      nodes({ opacity: 0 }, 0.5, v0, EASE.smooth);
      break;
    case "editorial":
    default:
      if (input.hasMedia) media({ opacity: 0, scale: 1.03 }, 0.9);
      nodes({ opacity: 0, y: 14 }, 0.5);
      edges(v0 + 0.3 * s);
      break;
  }

  // Destaque: um único focus pull no item enfatizado, depois do gesto.
  const emphasis = input.motion?.params?.emphasis;
  if (typeof emphasis === "number" && emphasis >= 0 && emphasis < n) {
    const end = Math.max(...tracks.map((t) => t.keyframes[t.keyframes.length - 1].t));
    const id = `node-${emphasis}`;
    const existing = tracks.find((t) => t.id === id);
    if (existing && !existing.spring) {
      existing.keyframes.push(kf(end + 0.15 * s, { scale: 1.06 }, EASE.snap), kf(end + 0.5 * s, { scale: 1 }, EASE.smooth));
    }
  }

  const duration = r3(Math.max(1.2, ...tracks.map((t) => t.keyframes[t.keyframes.length - 1].t)) + 0.05);
  const ambient: AmbientTrack[] = [];
  if (input.motion?.params?.ambient !== false) {
    if (input.hasMedia) ambient.push({ id: "media-ambient", from: { scale: 1 }, to: { scale: 1.035 }, duration: 16 });
    if (LOOP_PRESETS.includes(preset)) ambient.push({ id: "orbit-ambient", from: { rotate: 0 }, to: { rotate: 2 }, duration: 12 });
    if (n > 0) ambient.push({ id: "visual-ambient", from: { y: 0 }, to: { y: -4 }, duration: 7 });
  }
  return ambient.length ? { duration, tracks, ambient } : { duration, tracks };
}
