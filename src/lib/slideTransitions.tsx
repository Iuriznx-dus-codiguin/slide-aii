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
// Reaproveita NarrativeAct (CinematicHUD) e AnimationIntent (slideChoreography)
// já existentes em vez de duplicar — mesma lição aplicada duas vezes na
// mesma implementação: a auditoria já achou "mesmo conceito, duas
// definições" no código antigo; não vamos criar um terceiro/quarto caso.
import type { NarrativeAct } from "@/components/CinematicHUD";
import type { AnimationIntent as MotionAnimationIntent } from "@/lib/slideChoreography";
import {
  CINEMATIC_TRANSITIONS,
  type SlideTransitionName,
} from "../../supabase/functions/_shared/transitionNames.ts";

// Os NOMES vêm do módulo compartilhado com as edge functions (Deno) — antes
// esta união e a lista do Creative Director eram duas cópias mantidas à mão.
// A implementação de cada efeito continua aqui; lá ficam só os nomes.
export type SlideTransition = SlideTransitionName;

// "dynamic" fica de fora deste array de propósito: ALL_TRANSITIONS alimenta o
// round-robin de pickTransition() para slides sem tipo reconhecido, e dynamic
// já é tratado como o padrão universal ali (não precisa entrar no rodízio).
// Ainda assim, um content.transition="dynamic" explícito é sempre respeitado
// (ver pickTransition), e continua 100% válido como Overlay/config abaixo.
export const ALL_TRANSITIONS: SlideTransition[] = [...CINEMATIC_TRANSITIONS];

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

// ────────────────────────────────────────────────────────────────
// Motion Director (Fase 3 da nova arquitetura de motores)
// ────────────────────────────────────────────────────────────────
// Por que determinístico e não a IA escolhendo livremente: a divergência de
// WYSIWYG que motivou a criação do SlideStage veio exatamente de decisões de
// transição tomadas de forma inconsistente entre telas. A solução não é
// devolver essa liberdade à IA (regressaria o mesmo bug) — é decidir aqui,
// em UM lugar, com uma tabela fixa, a partir de campos que a IA já emite de
// forma confiável e coesa (narrative_act, animation_intent — ver
// generate-presentation/index.ts). O backend não escolhe mais a transição;
// só sinaliza "fade" quando o usuário desativou o magic move. Este arquivo é
// a ÚNICA fonte de verdade da regra — evita duplicar a tabela no backend
// (Deno) e aqui (Vite), que seria recriar o mesmo tipo de inconsistência
// encontrado na auditoria (animation_transition x content.transition).
export interface MotionDirectorContext {
  narrativeAct?: NarrativeAct;
  animationIntent?: MotionAnimationIntent;
  /** creative_brief.allowed_transitions (Creative Director Engine), quando disponível. */
  allowed?: SlideTransition[];
  /** creative_brief.forbidden_effects (Creative Director Engine), quando disponível. */
  forbidden?: string[];
}

// Mapeamento por posição no Círculo Narrativo — usado quando não há
// animation_intent reconhecido (ou como reforço quando os dois concordam).
const ACT_TRANSITIONS: Partial<Record<NarrativeAct, SlideTransition[]>> = {
  climax: ["portal", "shatter"],
  proof: ["mosaic", "ribbon", "split"],
  tension: ["wipe", "blinds"],
  hook: ["dynamic"],
  journey: ["dynamic"],
};

// Mapeamento por intenção de animação — tem prioridade sobre narrative_act
// por ser mais específico (o mesmo ato narrativo pode conter tanto um
// slide de dado quanto uma citação, por exemplo).
const INTENT_TRANSITIONS: Partial<Record<MotionAnimationIntent, SlideTransition[]>> = {
  "quote-spotlight": ["iris", "letterbox"],
  "section-break": ["fold", "blinds"],
  "calm-fade": ["morph", "stack"],
  "data-reveal": ["mosaic", "ribbon"],
  "emphasis-stat": ["portal", "shatter"],
  "hero-impact": ["dynamic"],
  "narrative-build": ["dynamic"],
};

function candidateTransitions(context: MotionDirectorContext | undefined, excludeDynamic: boolean): SlideTransition[] {
  const byIntent = context?.animationIntent ? INTENT_TRANSITIONS[context.animationIntent] : undefined;
  const byAct = context?.narrativeAct ? ACT_TRANSITIONS[context.narrativeAct] : undefined;
  const specific = byIntent ?? byAct; // escolha ideal pela narrativa, pode ser undefined
  // allowed_transitions do Creative Brief define o UNIVERSO permitido para o
  // tema (ex.: um tema institucional pode restringir a só ["dynamic","fold","dissolve"]).
  // Sem brief, o universo é todas as 13.
  const universe: SlideTransition[] = context?.allowed?.length ? context.allowed : (["dynamic", ...ALL_TRANSITIONS] as SlideTransition[]);
  // Prioriza a interseção (a escolha certa PARA ESTE SLIDE, dentro do que o
  // tema permite). Se a narrativa pedir algo fora do universo permitido
  // (ex.: climax pede "shatter" mas o brief proíbe), cai para o universo
  // inteiro em vez de voltar para "dynamic" por acidente.
  let pool = specific ? specific.filter((t) => universe.includes(t)) : universe;
  if (pool.length === 0) pool = universe;
  if (context?.forbidden?.length) pool = pool.filter((t) => !context.forbidden!.includes(t));
  if (excludeDynamic) pool = pool.filter((t) => t !== "dynamic");
  if (pool.length === 0) pool = excludeDynamic ? ALL_TRANSITIONS : (["dynamic", ...ALL_TRANSITIONS] as SlideTransition[]);
  return pool;
}

/**
 * Decide a transição de UM slide dentro de UM dos dois modos de animação.
 *
 * SEPARAÇÃO ESTRITA (corrigido nesta rodada):
 *   • Modo MAGIC MOVE  → SEMPRE "dynamic" em todos os slides. É um modo de
 *     transformação contínua (os mesmos elementos se movem entre slides);
 *     intercalar um "shatter" ou um "portal" no meio quebra exatamente a
 *     ilusão de continuidade que o modo existe para criar.
 *   • Modo CLÁSSICO    → SEMPRE uma das 12 transições cinematográficas
 *     tradicionais, NUNCA "dynamic".
 *
 * Antes, o caminho "sem hint, mas com narrative_act/animation_intent"
 * escolhia num pool que INCLUÍA "dynamic" junto das legadas — o resultado era
 * uma apresentação com magic move em alguns slides e transição clássica em
 * outros, sem que o usuário tivesse pedido isso. Essa era a mistura relatada.
 *
 * Precedência:
 * 1) hint === "dynamic" → magic move (o gerador grava isso quando o switch
 *    "Slide Dinâmico" está ligado).
 * 2) hint === "fade" → modo clássico; o Motion Director escolhe entre as 12
 *    legadas por narrative_act/animation_intent (nunca "dynamic").
 * 3) hint é uma das 12 legadas → respeitado literalmente (escolha manual no
 *    Editor e compatibilidade com decks antigos).
 * 4) Sem hint → magic move ("dynamic"), o padrão histórico do produto.
 */
export function pickTransition(
  index: number,
  _slideType?: string,
  hint?: SlideTransition | string,
  context?: MotionDirectorContext,
): SlideTransition {
  if (hint === "dynamic") return "dynamic";
  if (hint && (ALL_TRANSITIONS as string[]).includes(hint)) return hint as SlideTransition;
  if (hint === "fade" || hint === "classic") {
    const pool = candidateTransitions(context, true);
    return pool[index % pool.length];
  }
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
