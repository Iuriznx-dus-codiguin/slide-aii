// Stage cinematográfico compartilhado — combina:
//   • transição do slide inteiro (slideTransitions.tsx)
//   • coreografia per-element (slideChoreography.tsx)
//   • magic move de âncoras no modo "dynamic" (SlideRenderer + morphing.ts)
//   • overlay sincronizado (mosaic, ribbon, iris…)
//   • prefers-reduced-motion (substitui qualquer transição por fade simples)
//
// ESTE é o motivo de existir deste arquivo: antes, o SlideViewer (visualização
// final/pública), o Editor (canvas de edição) e o Generate (preview de
// geração) tinham cada um sua PRÓPRIA lógica de "como mostrar um slide" —
// o Editor não animava nada, o Generate usava um fade genérico desconectado,
// e só o SlideViewer usava o sistema completo. Um usuário nunca via, durante
// a criação, a transição real que a apresentação teria no final. Centralizar
// essa lógica aqui garante que as 3 telas mostrem exatamente a mesma coisa —
// e que uma futura mudança no motor de transição não precise ser replicada
// em 3 lugares (que é exatamente como o bug anterior aconteceu).
import { useEffect } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { SlideRenderer, type SlideData } from "@/components/SlideRenderer";
import { ChoreographyProvider, useSlideChoreography, type ChoreographyName, type AnimationIntent } from "@/lib/slideChoreography";
import { pickTransition, getTransitionConfig, REDUCED_MOTION_TRANSITION_CONFIG, type SlideTransition, type NarrativeAct } from "@/lib/slideTransitions";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { CreativeBrief } from "@/lib/creativeBrief";

export interface SlideStageProps {
  /** Identificador estável do slide (id do banco, ou um id de rascunho local) — usado como key do AnimatePresence. Cai para `idx` se ausente. */
  slideId?: string;
  slide?: SlideData;
  themeId: string;
  fontId: string;
  dynamicTheme?: any;
  idx: number;
  /** Ref mutável mantida pelo caller para saber a direção da navegação (avançar/voltar). */
  prevIdxRef: React.MutableRefObject<number>;
  /**
   * Ativa o backdrop em vídeo do AmbientBackdrop. Fica desligado por padrão
   * (Editor/Generate — contexto de criação, onde vídeo só adicionaria custo
   * de rede/decodificação sem benefício); o SlideViewer liga explicitamente.
   */
  enableVideo?: boolean;
  /** Escopo do LayoutGroup do magic move — normalmente o id da apresentação (ou "draft" antes de salvar). */
  layoutGroupId: string;
  /** Acento de cor para o glow de transição e Overlays; cai para um roxo padrão. */
  accent?: string;
  /**
   * Documento do Creative Director Engine (Fase 1), quando disponível
   * (presentations.creative_brief). Usado pelo Motion Director para
   * restringir a escolha de transição a allowed_transitions/forbidden_effects.
   * Opcional — apresentações geradas antes desta feature simplesmente não têm.
   */
  creativeBrief?: CreativeBrief | null;
}

export const SlideStage = ({
  slideId, slide, themeId, fontId, dynamicTheme, idx, prevIdxRef, enableVideo = false, layoutGroupId, accent: accentProp, creativeBrief,
}: SlideStageProps) => {
  const accent = accentProp ?? dynamicTheme?.accent ?? "#A855F7";
  const transitionHint = slide?.content?.transition as SlideTransition | undefined;
  const choreoHint = slide?.content?.choreography as ChoreographyName | undefined;
  const animationIntent = slide?.content?.animation_intent as AnimationIntent | undefined;
  const narrativeAct = slide?.content?.narrative_act as NarrativeAct | undefined;

  // Fase 3 (Motion Director): decide a transição a partir de narrative_act/
  // animation_intent (sempre presentes em conteúdo gerado por IA) e, quando
  // disponível, das restrições do Creative Brief. Ver src/lib/slideTransitions.tsx.
  const slideTransition = pickTransition(idx, slide?.slide_type, transitionHint, {
    narrativeAct,
    animationIntent,
    allowed: creativeBrief?.allowed_transitions as SlideTransition[] | undefined,
    forbidden: creativeBrief?.forbidden_effects,
  });
  const prefersReducedMotion = usePrefersReducedMotion();
  const cfg = prefersReducedMotion ? REDUCED_MOTION_TRANSITION_CONFIG : getTransitionConfig(slideTransition, accent);
  const choreo = useSlideChoreography(idx, slide?.slide_type, choreoHint, animationIntent);
  const dynamicMode = slideTransition === "dynamic" && !prefersReducedMotion;

  const direction: 1 | -1 = idx >= prevIdxRef.current ? 1 : -1;
  const Overlay = cfg.Overlay;
  useEffect(() => { prevIdxRef.current = idx; }, [idx, prevIdxRef]);
  const key = slideId ?? idx;
  const overlayKey = `${key}-${slideTransition}`;

  return (
    <LayoutGroup id={`stage-${layoutGroupId}`}>
      <AnimatePresence mode={cfg.mode ?? "sync"} initial={false}>
        <motion.div
          key={key}
          initial={cfg.enter.initial}
          animate={cfg.enter.animate}
          exit={cfg.exit.exit}
          transition={cfg.enter.transition}
          className="absolute inset-0"
          style={{ willChange: "opacity, transform, filter, clip-path", perspective: 1600, transformStyle: "preserve-3d" }}
        >
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.35, 0], transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } }}
            exit={{ opacity: 0 }}
            style={{
              background: `radial-gradient(circle at 50% 50%, ${accent}33 0%, transparent 65%)`,
              mixBlendMode: "screen",
            }}
          />
          <ChoreographyProvider value={choreo}>
            {slide && (
              <SlideRenderer
                slide={slide}
                themeId={themeId}
                fontId={fontId}
                dynamicTheme={dynamicTheme}
                index={idx}
                dynamicMode={dynamicMode}
                enableVideo={enableVideo}
                creativeBrief={creativeBrief}
              />
            )}
          </ChoreographyProvider>
        </motion.div>
      </AnimatePresence>
      {Overlay && (
        <motion.div
          key={overlayKey}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: cfg.duration, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 z-20 pointer-events-none"
          style={{ animationDuration: `${cfg.duration}s` }}
        >
          <Overlay accent={accent} direction={direction} />
        </motion.div>
      )}
    </LayoutGroup>
  );
};
