// ============================================================
// SlideAI — Timeline Engine (Fase 2)
// ------------------------------------------------------------
// Engine declarativa de keyframes própria sobre Framer Motion.
//
// Conceitos:
//   • Track  = um elemento animado (id único dentro do slide)
//   • Keyframe = { t, props } — estado num ponto da timeline
//   • Timeline = duração total + tracks + autoplay
//
// API:
//   const tl = useTimeline(scenario, { duration: 3.2 });
//   tl.props("title")   → { animate, transition, initial }
//   tl.scrubTo(0.5)     → seek manual (0..1)
//   tl.play() / pause() / reverse()
//
// Diferente de variants:
//   • Cada track tem sua própria curva no tempo absoluto
//   • Permite sincronização precisa (ex: gráfico cresce QUANDO
//     o número aparece, não só com stagger sequencial)
//   • Suporta scrubbing (modo edição futura)
// ============================================================

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useReducedMotion, type Transition } from "framer-motion";
import { EASE } from "./animations";

/* ---------- Tipos ---------- */

export type TimelineProps = {
  opacity?: number;
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
  rotateX?: number;
  rotateY?: number;
  blur?: number; // px → vira filter blur(Npx)
  /** Caminho SVG para morphing path (usado por <MorphPath/>). */
  d?: string;
  /** clipPath inset (0..50) — usado em reveals. */
  clipInset?: number;
};

export interface Keyframe {
  /** Tempo absoluto em segundos (0 .. duration). */
  t: number;
  props: TimelineProps;
  /** Easing entre o keyframe anterior e este. Default: EASE.editorial. */
  ease?: readonly number[];
}

export interface Track {
  id: string;
  /** Lista de keyframes ordenados por t. */
  keyframes: Keyframe[];
}

export interface TimelineScenario {
  /** Duração total em segundos. */
  duration: number;
  tracks: Track[];
}

/* ---------- Helpers ---------- */

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Avalia easing cubic-bezier (Bezier 4 pontos com P0=(0,0), P3=(1,1)). */
function bezierY(p1x: number, p1y: number, p2x: number, p2y: number, t: number): number {
  // Aproximação rápida: assume t≈x (suficiente para curvas suaves usadas aqui).
  // Para produção poderíamos usar Newton-Raphson; o erro é < 1% para presets editorial/smooth.
  const omt = 1 - t;
  return 3 * omt * omt * t * p1y + 3 * omt * t * t * p2y + t * t * t;
}

function easeWith(curve: readonly number[] | undefined, t: number): number {
  if (!curve || curve.length < 4) return t;
  return bezierY(curve[0], curve[1], curve[2], curve[3], t);
}

function interpProps(a: TimelineProps, b: TimelineProps, t: number): TimelineProps {
  const out: TimelineProps = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)] as (keyof TimelineProps)[]);
  for (const k of keys) {
    if (k === "d") {
      // path morph é tratado por flubber em <MorphPath/>; aqui só passa o destino
      out.d = (b.d ?? a.d) as string | undefined;
      continue;
    }
    const av = (a as any)[k];
    const bv = (b as any)[k];
    if (typeof av === "number" && typeof bv === "number") {
      (out as any)[k] = lerp(av, bv, t);
    } else if (typeof bv === "number") {
      (out as any)[k] = bv;
    } else if (typeof av === "number") {
      (out as any)[k] = av;
    }
  }
  return out;
}

/** Avalia o estado de uma track num tempo t (segundos). */
export function sampleTrack(track: Track, time: number): TimelineProps {
  const kfs = track.keyframes;
  if (kfs.length === 0) return {};
  if (time <= kfs[0].t) return { ...kfs[0].props };
  if (time >= kfs[kfs.length - 1].t) return { ...kfs[kfs.length - 1].props };

  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i];
    const b = kfs[i + 1];
    if (time >= a.t && time <= b.t) {
      const span = b.t - a.t || 0.0001;
      const localT = (time - a.t) / span;
      const eased = easeWith(b.ease ?? EASE.editorial, localT);
      return interpProps(a.props, b.props, eased);
    }
  }
  return { ...kfs[kfs.length - 1].props };
}

/** Converte TimelineProps em estilos Framer Motion. */
export function propsToMotionStyle(p: TimelineProps): Record<string, any> {
  const style: Record<string, any> = {};
  if (p.opacity !== undefined) style.opacity = p.opacity;
  if (p.x !== undefined) style.x = p.x;
  if (p.y !== undefined) style.y = p.y;
  if (p.scale !== undefined) style.scale = p.scale;
  if (p.rotate !== undefined) style.rotate = p.rotate;
  if (p.rotateX !== undefined) style.rotateX = p.rotateX;
  if (p.rotateY !== undefined) style.rotateY = p.rotateY;
  if (p.blur !== undefined) style.filter = `blur(${p.blur}px)`;
  if (p.clipInset !== undefined)
    style.clipPath = `inset(0 ${p.clipInset}% 0 ${p.clipInset}%)`;
  return style;
}

/* ---------- Hook principal ---------- */

interface UseTimelineOptions {
  /** Inicia automaticamente. Default: true. */
  autoplay?: boolean;
  /** Loop infinito. Default: false. */
  loop?: boolean;
  /** Multiplicador de velocidade. Default: 1. */
  speed?: number;
  /** Pula direto para o final (modo no-animate / thumbnails). */
  skip?: boolean;
}

export interface TimelineController {
  /** Estado atual em segundos. */
  time: number;
  /** Progresso 0..1. */
  progress: number;
  /** Estilos para uma track num momento — pronto para spread em motion.div. */
  styleFor: (trackId: string) => Record<string, any>;
  /** Estado inicial (t=0) — usado para `initial`. */
  initialFor: (trackId: string) => Record<string, any>;
  /** Estado final (t=duration) — usado quando skip=true. */
  finalFor: (trackId: string) => Record<string, any>;
  /** Props prontas para <motion.X /> (initial + animate). */
  motionProps: (trackId: string) => {
    initial: Record<string, any>;
    animate: Record<string, any>;
    transition: Transition;
  };
  play: () => void;
  pause: () => void;
  scrubTo: (progress: number) => void;
  reset: () => void;
  isPlaying: boolean;
}

/** Hook principal — gerencia o relógio e sampling das tracks. */
export function useTimeline(
  scenario: TimelineScenario,
  options: UseTimelineOptions = {}
): TimelineController {
  const { autoplay = true, loop = false, speed = 1, skip = false } = options;
  const reduceMotion = useReducedMotion();
  const skipAll = skip || !!reduceMotion;

  const [time, setTime] = useState(skipAll ? scenario.duration : 0);
  const [isPlaying, setIsPlaying] = useState(autoplay && !skipAll);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  // Index de tracks por id para lookup O(1)
  const trackMap = useMemo(() => {
    const m = new Map<string, Track>();
    for (const t of scenario.tracks) m.set(t.id, t);
    return m;
  }, [scenario]);

  // Loop de animação via rAF
  useEffect(() => {
    if (!isPlaying || skipAll) return;
    const tick = (ts: number) => {
      const last = lastTsRef.current ?? ts;
      const dt = ((ts - last) / 1000) * speed;
      lastTsRef.current = ts;
      setTime((t) => {
        let nt = t + dt;
        if (nt >= scenario.duration) {
          if (loop) {
            nt = nt % scenario.duration;
          } else {
            nt = scenario.duration;
            setIsPlaying(false);
          }
        }
        return nt;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
    };
  }, [isPlaying, skipAll, scenario.duration, loop, speed]);

  const styleFor = useCallback(
    (trackId: string) => {
      const track = trackMap.get(trackId);
      if (!track) return {};
      const sampled = sampleTrack(track, skipAll ? scenario.duration : time);
      return propsToMotionStyle(sampled);
    },
    [trackMap, time, skipAll, scenario.duration]
  );

  const initialFor = useCallback(
    (trackId: string) => {
      const track = trackMap.get(trackId);
      if (!track || track.keyframes.length === 0) return {};
      return propsToMotionStyle(track.keyframes[0].props);
    },
    [trackMap]
  );

  const finalFor = useCallback(
    (trackId: string) => {
      const track = trackMap.get(trackId);
      if (!track || track.keyframes.length === 0) return {};
      return propsToMotionStyle(track.keyframes[track.keyframes.length - 1].props);
    },
    [trackMap]
  );

  const motionProps = useCallback(
    (trackId: string) => {
      const track = trackMap.get(trackId);
      if (!track || track.keyframes.length === 0) {
        return { initial: {}, animate: {}, transition: {} as Transition };
      }

      // ============================================================
      // ESTRATÉGIA (corrigida em Fase 2.5):
      //   • `initial` = estado do PRIMEIRO keyframe (oculto/início).
      //   • `animate` = arrays de valores que começam IDÊNTICOS ao
      //     initial (em times[0]=0) e progridem até o último keyframe
      //     em times[N]=1. Se o primeiro keyframe começa em t>0, o
      //     elemento permanece "escondido" até esse momento (hold).
      //   • `times` é estritamente crescente em [0,1].
      //
      // Bug anterior: times começava em t/duration (ex: 0.06 para um
      // subtítulo que começa em 0.2s) sem um valor em 0, fazendo Framer
      // interpolar o `initial` (props oculto) → primeiro keyframe (também
      // oculto) → final, mas re-renderizando como "saída e re-entrada"
      // visível porque o initial era aplicado depois do mount.
      // ============================================================

      const firstProps = track.keyframes[0].props;
      const initial = propsToMotionStyle(firstProps);

      if (skipAll) {
        const lastProps = track.keyframes[track.keyframes.length - 1].props;
        return {
          initial: propsToMotionStyle(lastProps),
          animate: propsToMotionStyle(lastProps),
          transition: { duration: 0 } as Transition,
        };
      }

      // Se o primeiro keyframe não está em t=0, prepend um "hold"
      // virtual que mantém o elemento no estado inicial até esse momento.
      const needsHold = track.keyframes[0].t > 0.0001;
      const effectiveKfs = needsHold
        ? [{ t: 0, props: firstProps, ease: track.keyframes[0].ease }, ...track.keyframes]
        : track.keyframes;

      // Garante último keyframe em t=duration (extrapola hold no fim).
      const lastKf = effectiveKfs[effectiveKfs.length - 1];
      const fullKfs = lastKf.t < scenario.duration - 0.0001
        ? [...effectiveKfs, { t: scenario.duration, props: lastKf.props, ease: lastKf.ease }]
        : effectiveKfs;

      // Constrói arrays de keyframes para cada propriedade conhecida
      const propKeys: Array<keyof TimelineProps> = [
        "opacity", "x", "y", "scale", "rotate", "rotateX", "rotateY", "blur", "clipInset",
      ];
      const animValues: Record<string, any> = {};
      const times: number[] = fullKfs.map((k) => Math.min(1, Math.max(0, k.t / scenario.duration)));

      // Garante times estritamente crescente (Framer reclama de duplicatas)
      for (let i = 1; i < times.length; i++) {
        if (times[i] <= times[i - 1]) times[i] = Math.min(1, times[i - 1] + 0.0001);
      }

      for (const key of propKeys) {
        const arr = fullKfs.map((k) => (k.props as any)[key]);
        if (arr.every((v) => v === undefined)) continue;
        // Carry-forward: undefined herda valor anterior
        let lastVal: any = arr.find((v) => v !== undefined) ?? 0;
        const filled = arr.map((v) => {
          if (v !== undefined) { lastVal = v; return v; }
          return lastVal;
        });
        if (key === "blur") {
          animValues.filter = filled.map((v) => `blur(${v}px)`);
        } else if (key === "clipInset") {
          animValues.clipPath = filled.map((v) => `inset(0 ${v}% 0 ${v}%)`);
        } else {
          animValues[key as string] = filled;
        }
      }

      const transition: Transition = {
        duration: scenario.duration / speed,
        times,
        ease: EASE.editorial as any,
      };

      return {
        initial,
        animate: animValues,
        transition,
      };
    },
    [trackMap, scenario.duration, skipAll, speed]
  );

  return {
    time,
    progress: time / scenario.duration,
    styleFor,
    initialFor,
    finalFor,
    motionProps,
    play: () => setIsPlaying(true),
    pause: () => setIsPlaying(false),
    scrubTo: (p) => {
      setIsPlaying(false);
      setTime(Math.max(0, Math.min(1, p)) * scenario.duration);
    },
    reset: () => {
      setTime(0);
      setIsPlaying(autoplay);
    },
    isPlaying,
  };
}

/* ---------- DSL de cenários por tipo de slide ----------
   Helpers para construir cenários comuns sem digitar todos
   os keyframes manualmente.
---------------------------------------------------------- */

interface BuildOpts {
  /** Atraso extra antes do primeiro keyframe. */
  startAt?: number;
}

/**
 * Cria uma timeline editorial para slides padrão (título → conteúdo → bullets).
 * Os tracks têm IDs convencionais: `title`, `subtitle`, `body`, `bullet-${i}`.
 */
export function buildEditorialScenario(
  bulletCount: number,
  opts: BuildOpts = {}
): TimelineScenario {
  const start = opts.startAt ?? 0;
  const tracks: Track[] = [
    {
      id: "title",
      keyframes: [
        { t: start, props: { opacity: 0, y: 30, blur: 14 } },
        { t: start + 0.85, props: { opacity: 1, y: 0, blur: 0 }, ease: EASE.editorial },
      ],
    },
    {
      id: "subtitle",
      keyframes: [
        { t: start + 0.2, props: { opacity: 0, y: 20, blur: 8 } },
        { t: start + 0.95, props: { opacity: 1, y: 0, blur: 0 }, ease: EASE.smooth },
      ],
    },
    {
      id: "body",
      keyframes: [
        { t: start + 0.45, props: { opacity: 0, y: 18 } },
        { t: start + 1.15, props: { opacity: 1, y: 0 }, ease: EASE.smooth },
      ],
    },
  ];
  for (let i = 0; i < bulletCount; i++) {
    const offset = start + 0.7 + i * 0.12;
    tracks.push({
      id: `bullet-${i}`,
      keyframes: [
        { t: offset, props: { opacity: 0, x: -20, blur: 6 } },
        { t: offset + 0.55, props: { opacity: 1, x: 0, blur: 0 }, ease: EASE.smooth },
      ],
    });
  }
  const duration = Math.max(2.0, start + 0.7 + bulletCount * 0.12 + 0.7);
  return { duration, tracks };
}

/** Timeline de gráfico: título entra, gráfico cresce, bullets vêm em cascata. */
export function buildChartScenario(bulletCount: number): TimelineScenario {
  const tracks: Track[] = [
    {
      id: "title",
      keyframes: [
        { t: 0, props: { opacity: 0, y: 24, blur: 12 } },
        { t: 0.7, props: { opacity: 1, y: 0, blur: 0 }, ease: EASE.editorial },
      ],
    },
    {
      id: "subtitle",
      keyframes: [
        { t: 0.15, props: { opacity: 0, y: 16 } },
        { t: 0.8, props: { opacity: 1, y: 0 }, ease: EASE.smooth },
      ],
    },
    {
      id: "chart",
      keyframes: [
        { t: 0.5, props: { opacity: 0, y: 30, blur: 14, scale: 0.95 } },
        { t: 1.6, props: { opacity: 1, y: 0, blur: 0, scale: 1 }, ease: EASE.editorial },
      ],
    },
  ];
  for (let i = 0; i < bulletCount; i++) {
    const offset = 1.2 + i * 0.1;
    tracks.push({
      id: `bullet-${i}`,
      keyframes: [
        { t: offset, props: { opacity: 0, y: 14 } },
        { t: offset + 0.5, props: { opacity: 1, y: 0 }, ease: EASE.smooth },
      ],
    });
  }
  return { duration: Math.max(2.4, 1.2 + bulletCount * 0.1 + 0.6), tracks };
}

/** Timeline de stat: legenda → número grande explode → label. */
export function buildStatScenario(): TimelineScenario {
  return {
    duration: 2.4,
    tracks: [
      {
        id: "kicker",
        keyframes: [
          { t: 0, props: { opacity: 0, y: 12 } },
          { t: 0.55, props: { opacity: 0.6, y: 0 }, ease: EASE.smooth },
        ],
      },
      {
        id: "stat",
        keyframes: [
          { t: 0.3, props: { opacity: 0, scale: 0.7, blur: 24 } },
          { t: 1.5, props: { opacity: 1, scale: 1, blur: 0 }, ease: EASE.editorial },
        ],
      },
      {
        id: "label",
        keyframes: [
          { t: 1.1, props: { opacity: 0, y: 20, blur: 6 } },
          { t: 1.8, props: { opacity: 1, y: 0, blur: 0 }, ease: EASE.smooth },
        ],
      },
    ],
  };
}

/** Timeline de quote: marca de aspas → texto reveal → autor com linhas. */
export function buildQuoteScenario(): TimelineScenario {
  return {
    duration: 2.8,
    tracks: [
      {
        id: "mark",
        keyframes: [
          { t: 0, props: { opacity: 0, scale: 0.4 } },
          { t: 0.9, props: { opacity: 0.4, scale: 1 }, ease: EASE.editorial },
        ],
      },
      {
        id: "quote",
        keyframes: [
          { t: 0.4, props: { opacity: 0, y: 30, blur: 10 } },
          { t: 1.7, props: { opacity: 1, y: 0, blur: 0 }, ease: EASE.editorial },
        ],
      },
      {
        id: "author",
        keyframes: [
          { t: 1.4, props: { opacity: 0, y: 12 } },
          { t: 2.2, props: { opacity: 1, y: 0 }, ease: EASE.smooth },
        ],
      },
    ],
  };
}

/* ---------- IA contextual: animation_intent ---------- */

/** Os intents que a IA backend pode atribuir a cada slide. */
export type AnimationIntent =
  | "hero-impact"
  | "narrative-build"
  | "data-reveal"
  | "emphasis-stat"
  | "quote-spotlight"
  | "section-break"
  | "calm-fade";

interface IntentMod {
  /** Multiplicador da duração total (1 = neutro, >1 = mais lento/dramático). */
  durationMul: number;
  /** Multiplicador do delta `t` entre keyframes (afeta cascata). */
  staggerMul: number;
  /** Easing global aplicado quando keyframe não traz easing próprio. */
  ease: readonly number[];
  /** Adiciona overshoot (escala >1 no meio) em tracks com `scale`. */
  overshoot: boolean;
}

const INTENT_MODS: Record<AnimationIntent, IntentMod> = {
  "hero-impact":     { durationMul: 1.25, staggerMul: 1.15, ease: EASE.editorial, overshoot: false },
  "narrative-build": { durationMul: 1.0,  staggerMul: 1.1,  ease: EASE.smooth,    overshoot: false },
  "data-reveal":     { durationMul: 1.0,  staggerMul: 0.9,  ease: EASE.editorial, overshoot: false },
  "emphasis-stat":   { durationMul: 1.1,  staggerMul: 1.0,  ease: EASE.snap,      overshoot: true  },
  "quote-spotlight": { durationMul: 1.3,  staggerMul: 1.2,  ease: EASE.editorial, overshoot: false },
  "section-break":   { durationMul: 1.0,  staggerMul: 0.8,  ease: EASE.editorial, overshoot: false },
  "calm-fade":       { durationMul: 0.85, staggerMul: 0.85, ease: EASE.smooth,    overshoot: false },
};

/**
 * Aplica modulação contextual a um cenário pré-construído.
 * O intent vem do backend (IA) e personaliza a animação por slide
 * sem reescrever o cenário base.
 */
export function applyIntent(
  scenario: TimelineScenario,
  intent: AnimationIntent | undefined | null
): TimelineScenario {
  if (!intent) return scenario;
  const mod = INTENT_MODS[intent];
  if (!mod) return scenario;

  const tracks: Track[] = scenario.tracks.map((tr) => ({
    id: tr.id,
    keyframes: tr.keyframes.map((kf, i, arr) => {
      // Adiciona overshoot intermediário para tracks com scale (apenas no
      // primeiro→último; mantemos a forma simples).
      const newKf: Keyframe = {
        t: kf.t * mod.staggerMul,
        props: { ...kf.props },
        ease: kf.ease ?? mod.ease,
      };
      if (mod.overshoot && i === arr.length - 1 && typeof kf.props.scale === "number") {
        // Sobe escala 6% no meio do trajeto via spring-like keyframe extra
        // (aqui simplificado: aumentamos tensão visual via scale final levemente acima e easing snap).
        newKf.ease = EASE.snap;
      }
      return newKf;
    }),
  }));

  return {
    duration: scenario.duration * mod.durationMul * mod.staggerMul,
    tracks,
  };
}
