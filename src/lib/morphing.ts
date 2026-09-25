// ============================================================
// SlideAI — Morphing System (Fase 2)
// ------------------------------------------------------------
// Combina duas técnicas:
//   1) Shared layoutId (Framer Motion) — para um elemento
//      "viajar" entre slides mantendo identidade visual
//      (posição, tamanho, cor). Ex: o número "78%" do slide
//      anterior aparece como label do gráfico no próximo.
//
//   2) Flubber path interpolation — para morph real de formas
//      SVG. Ex: silhueta de número → barra de gráfico.
//
// Uso:
//   <motion.div layoutId="hero-stat">{value}</motion.div>
//   ...em outro slide:
//   <motion.div layoutId="hero-stat">{value}</motion.div>
//
//   const d = useMorphPath(pathFrom, pathTo, progress);
//   <path d={d} />
// ============================================================

import { interpolate } from "flubber";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMotionValue, useTransform, animate, type MotionValue } from "framer-motion";

/* ---------- Hook: morph entre dois paths SVG ---------- */

/**
 * Retorna o `d` interpolado entre dois paths.
 * Use com framer's MotionValue para playback animado, ou
 * passe um número 0..1 estático para scrubbing/preview.
 */
export function useMorphPath(
  pathFrom: string,
  pathTo: string,
  progress: number | MotionValue<number>
): string {
  const interpolator = useMemo(() => {
    try {
      return interpolate(pathFrom, pathTo, { maxSegmentLength: 4 });
    } catch (e) {
      console.warn("[morphing] flubber failed, fallback to direct path", e);
      return (t: number) => (t < 0.5 ? pathFrom : pathTo);
    }
  }, [pathFrom, pathTo]);

  const [d, setD] = useState(() =>
    typeof progress === "number" ? interpolator(progress) : interpolator(0)
  );

  useEffect(() => {
    if (typeof progress === "number") {
      setD(interpolator(progress));
      return;
    }
    const unsub = progress.on("change", (v) => setD(interpolator(v)));
    setD(interpolator(progress.get()));
    return unsub;
  }, [progress, interpolator]);

  return d;
}

/* ---------- Hook: animação automática 0→1 com spring/duration ---------- */

interface MorphAnimationOptions {
  duration?: number;
  delay?: number;
  trigger?: any; // Quando muda, reinicia
  enabled?: boolean;
}

/** Cria um MotionValue 0..1 que anima automaticamente quando trigger muda. */
export function useMorphProgress(opts: MorphAnimationOptions = {}): MotionValue<number> {
  const { duration = 1.2, delay = 0, trigger, enabled = true } = opts;
  const mv = useMotionValue(0);

  useEffect(() => {
    if (!enabled) {
      mv.set(1);
      return;
    }
    mv.set(0);
    const controls = animate(mv, 1, {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [trigger, enabled, duration, delay, mv]);

  return mv;
}

/* ---------- Geradores de paths (números → barras → donuts) ---------- */

/**
 * Path SVG aproximado de um número (silhueta retangular do display do número).
 * Não é o glyph real — é um placeholder retangular "shape" do tamanho do texto,
 * que morfa bem para uma barra (target principal).
 */
export function rectPath(x: number, y: number, w: number, h: number, radius = 0): string {
  const r = Math.min(radius, w / 2, h / 2);
  if (r === 0) return `M${x},${y} h${w} v${h} h${-w} Z`;
  return `M${x + r},${y} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - 2 * r} a${r},${r} 0 0 1 ${-r},${r} h${-(w - 2 * r)} a${r},${r} 0 0 1 ${-r},${-r} v${-(h - 2 * r)} a${r},${r} 0 0 1 ${r},${-r} Z`;
}

/** Path de uma barra vertical num gráfico (do baixo para cima). */
export function barPath(
  x: number,
  baseY: number,
  width: number,
  height: number,
  radius = 8
): string {
  const r = Math.min(radius, width / 2, height);
  return `M${x},${baseY}
          v${-(height - r)}
          a${r},${r} 0 0 1 ${r},${-r}
          h${width - 2 * r}
          a${r},${r} 0 0 1 ${r},${r}
          v${height - r}
          Z`.replace(/\s+/g, " ");
}

/** Path de um arco (donut chart segment) — começa em start° e vai a end°. */
export function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number
): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1o = cx + rOuter * Math.cos(toRad(startAngle));
  const y1o = cy + rOuter * Math.sin(toRad(startAngle));
  const x2o = cx + rOuter * Math.cos(toRad(endAngle));
  const y2o = cy + rOuter * Math.sin(toRad(endAngle));
  const x1i = cx + rInner * Math.cos(toRad(endAngle));
  const y1i = cy + rInner * Math.sin(toRad(endAngle));
  const x2i = cx + rInner * Math.cos(toRad(startAngle));
  const y2i = cy + rInner * Math.sin(toRad(startAngle));
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M${x1o},${y1o}
          A${rOuter},${rOuter} 0 ${large} 1 ${x2o},${y2o}
          L${x1i},${y1i}
          A${rInner},${rInner} 0 ${large} 0 ${x2i},${y2i}
          Z`.replace(/\s+/g, " ");
}

/* ---------- Convenções de layoutId entre slides ----------
   Para que dois elementos "morfem" entre slides via shared
   layout, eles precisam compartilhar o mesmo layoutId dentro
   de um <LayoutGroup>. Usamos um helper para padronizar.
---------------------------------------------------------- */

/**
 * Gera um layoutId determinístico baseado no conteúdo,
 * permitindo que elementos com mesmo "papel semântico"
 * persistam entre slides.
 */
export function sharedId(role: "title" | "stat" | "accent" | "image", key?: string): string {
  return `slide-shared-${role}${key ? `-${key}` : ""}`;
}

/* ---------- Âncoras do modo "dynamic" (magic move real) ----------
   As 3 chamadas de sharedId() que já existiam no código (título em
   DefaultSlide/ChartSlide, stat em StatSlide) passavam um `key` derivado do
   PRÓPRIO CONTEÚDO (ex: sharedId("title", headline.slice(0,24))). Isso parecia
   correto mas era funcionalmente inerte: como cada slide tem um headline
   diferente, o layoutId nunca coincidia entre dois slides consecutivos — o
   "magic move" nunca tinha, na prática, um par para animar. Âncoras precisam
   de um id fixo POR PAPEL (não por conteúdo) para que o Framer Motion consiga
   reconhecer "o título do slide anterior" e "o título do slide atual" como o
   mesmo objeto visual em trânsito.
   anchorLayoutId() é essa versão corrigida: só recebe o papel e uma flag
   `active` (o chamador decide quando a âncora deve participar do magic move —
   tipicamente `dynamicMode && !noAnimate`). Quando active=false, devolve
   `undefined` (sem layoutId nenhum), deixando o elemento seguir o
   comportamento normal de entrada/saída coreografada.
------------------------------------------------------------------ */
export type AnchorRole = "title" | "hero-media" | "stat";

export function anchorLayoutId(role: AnchorRole, active: boolean): string | undefined {
  return active ? `slideai-anchor-${role}` : undefined;
}

/**
 * Transition dedicada para a projeção de layout do magic move — mais lenta e
 * suave que o spring padrão do Framer Motion (que é bom para UI mas parece
 * mecânico demais para uma transição de apresentação). Mescle isto dentro do
 * `transition` de qualquer elemento que receba anchorLayoutId, ex.:
 *   transition={{ ...ctrl.motionProps("title").transition, layout: ANCHOR_LAYOUT_TRANSITION }}
 */
export const ANCHOR_LAYOUT_TRANSITION = { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const };

/**
 * Motor v2: âncora SEMÂNTICA do magic move. Quando dois slides vizinhos
 * mostram o mesmo objeto (mesmo `anchor_key`, decidido no servidor pelo
 * resolvedor a partir dos objetos-chave do roteiro), o recorte/nó persiste e
 * dá zoom de um slide para o outro. Só no modo dinâmico — no clássico, cada
 * slide entra e sai com a sua transição, sem projeção de layout.
 */
export function semanticAnchorId(key: string | undefined | null, active: boolean): string | undefined {
  if (!active || !key) return undefined;
  return `slideai-anchor-obj-${key}`;
}
