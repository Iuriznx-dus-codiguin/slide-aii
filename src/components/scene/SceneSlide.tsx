// SceneSlide — compositor de camadas do motor de cenas (v2).
//
// O slide deixa de ser "texto + imagem" e vira uma CENA em quatro camadas,
// com z-order fixo:
//   0. fundo        — SceneBackground (sólido, mesh, aurora, grão, grade,
//                     duotone, spotlight), escolhido pelo resolvedor;
//   1. decoração    — no máximo UM acento de baixa intensidade quando há
//                     bloco visual, e molduras alinhadas ao grid de 12 colunas
//                     que enquadram o ponto focal;
//   2. informação   — texto + bloco visual no SLOT DE MÍDIA do layout (foto,
//                     recorte ou visual nativo);
//   3. primeiro plano — scrim/legenda sobre mídia em tela cheia.
//
// Só é usado para conteúdo com engine_version 2; decks antigos seguem o
// caminho atual do SlideRenderer, sem nenhuma mudança.
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion } from "framer-motion";
import type { ThemeColors } from "@/lib/slugify";
import { useTimeline, type TimelineController } from "@/lib/timeline";
import { buildSceneScenario } from "@/lib/scene/sceneMotion";
import { buildVisualModel, slotAspectFor } from "@/lib/scene/visualModel";
import { typeScaleFor, type TypeScale } from "@/lib/scene/typeScale";
import { rgba } from "@/lib/scene/color";
import { anchorLayoutId, ANCHOR_LAYOUT_TRANSITION } from "@/lib/morphing";
import { useChoreo } from "@/lib/slideChoreography";
import { useImageInsight } from "@/lib/imageAnalysis";
import { computeCompositionSpec, type SpacingBrief } from "@/lib/compositionEngine";
import {
  AnimatedBlob, CornerBrackets, DiagonalLines, DotGrid, FloatingShapes, OrbitalRings, ParticleField,
  PulseGrid, LayeredPanels, ReactiveDotGrid, CardStack, DataPattern, WaveForm,
} from "@/components/SlideDecorations";
import { SceneBackground } from "./SceneBackground";
import { VisualBlock } from "./VisualBlock";
import { useSceneRender } from "./SceneRenderContext";
import { scrimAlphaForAA } from "../../../supabase/functions/_shared/qualityGate.ts";
import type { SceneVisual } from "../../../supabase/functions/_shared/visualBlock.ts";

export interface SceneSlideProps {
  slide: { slide_type: string; layout_template: string; content: Record<string, any> };
  theme: ThemeColors;
  fontId: string;
  bodyFont: string;
  displayFont: string;
  index: number;
  noAnimate: boolean;
  dynamicMode: boolean;
  creativeBrief?: SpacingBrief | null;
}

/** Layouts que o compositor de cenas monta; o resto vira visual-hero. */
const SCENE_LAYOUTS = new Set(["visual-hero", "diagram-full", "image-left", "image-right", "full-image", "title-content", "two-columns"]);

export function sceneLayoutFor(layout: string | undefined, hasVisual: boolean): string {
  if (!hasVisual) return layout ?? "title-content";
  return layout && SCENE_LAYOUTS.has(layout) ? layout : "visual-hero";
}

/**
 * Parte cliente do Quality Gate: se o texto ainda estourar a caixa (fonte
 * real, largura real), reduz o corpo em passos de 10% (até 3).
 */
const FitText = ({ base, children, style, className = "" }: { base: string; children: ReactNode; style?: CSSProperties; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || step >= 3) return;
    if (el.scrollHeight > el.clientHeight + 2) setStep((s) => s + 1);
  }, [step, base]);
  return (
    <div ref={ref} className={`min-h-0 overflow-hidden ${className}`} style={{ ...style, fontSize: `calc(${base} * ${Math.pow(0.9, step).toFixed(3)})` }}>
      {children}
    </div>
  );
};

const ACCENTS: Record<string, (p: { theme: ThemeColors; noAnimate: boolean; intensity: number }) => ReactNode> = {
  "orbital-rings": (p) => <OrbitalRings {...p} position="right" />,
  "dot-grid": (p) => <DotGrid {...p} />,
  "floating-shapes": (p) => <FloatingShapes {...p} />,
  "diagonal-lines": (p) => <DiagonalLines {...p} />,
  "corner-brackets": (p) => <CornerBrackets {...p} />,
  "data-pattern": (p) => <DataPattern {...p} />,
  "wave-form": (p) => <WaveForm {...p} />,
  "animated-blob": (p) => <AnimatedBlob {...p} position="right" />,
  "pulse-grid": (p) => <PulseGrid {...p} />,
  "particle-field": (p) => <ParticleField {...p} />,
  "layered-panels": (p) => <LayeredPanels {...p} position="right" />,
  "reactive-dots": (p) => <ReactiveDotGrid {...p} />,
  "card-stack": (p) => <CardStack {...p} position="right" />,
};

/** Camada 1: com bloco visual, no máximo um acento e em baixa intensidade. */
const SceneDecoration = ({ accents, theme, noAnimate, hasVisual }: { accents?: string[]; theme: ThemeColors; noAnimate: boolean; hasVisual: boolean }) => {
  const list = (accents ?? []).filter((a) => a in ACCENTS && a !== "gradient-drift").slice(0, hasVisual ? 1 : 2);
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }} aria-hidden>
      {list.map((a, i) => <div key={a}>{ACCENTS[a]({ theme, noAnimate, intensity: hasVisual ? 0.35 : 0.55 + i * 0.1 })}</div>)}
    </div>
  );
};

/** Moldura geométrica: colchetes que enquadram o ponto focal (o visual). */
const FocalFrame = ({ theme }: { theme: ThemeColors }) => {
  const c = rgba(theme.accent, 0.4);
  const arm = "1.6cqw";
  const s: CSSProperties = { position: "absolute", width: arm, height: arm, borderColor: c, pointerEvents: "none" };
  return (
    <>
      <span style={{ ...s, left: "-1.1cqw", top: "-1.1cqw", borderLeft: "2px solid", borderTop: "2px solid" }} />
      <span style={{ ...s, right: "-1.1cqw", bottom: "-1.1cqw", borderRight: "2px solid", borderBottom: "2px solid" }} />
    </>
  );
};

interface TextProps {
  c: Record<string, any>;
  type: TypeScale;
  theme: ThemeColors;
  displayFont: string;
  ctrl: TimelineController;
  anchorsOn: boolean;
  hero?: boolean;
  showBullets?: boolean;
  bodyLines?: number;
  color?: string;
}

const SceneText = ({ c, type, theme, displayFont, ctrl, anchorsOn, hero, showBullets = true, color }: TextProps) => {
  const choreo = useChoreo();
  const title = ctrl.motionProps("title");
  const bullets: string[] = Array.isArray(c.bullets) ? c.bullets : [];
  return (
    <div className="flex flex-col min-h-0 h-full justify-center" data-scene-text="" style={{ gap: "0.9cqw", color: color ?? theme.text }}>
      <div className="h-[0.3cqw] w-[3.2cqw] rounded-full shrink-0" style={{ background: theme.accent }} />
      <motion.h2
        {...title}
        exit={choreo.exitFor("title")}
        layoutId={anchorLayoutId("title", anchorsOn)}
        transition={anchorsOn ? { ...title.transition, layout: ANCHOR_LAYOUT_TRANSITION } : title.transition}
        className="font-extrabold shrink-0"
        style={{ fontFamily: displayFont, fontSize: hero ? type.headlineHero : type.headline, lineHeight: 1.04, letterSpacing: "-0.02em" }}
      >
        {c.headline}
      </motion.h2>
      {c.subtitle && (
        <motion.p {...ctrl.motionProps("subtitle")} exit={choreo.exitFor("subtitle")} className="shrink-0 leading-snug" style={{ fontSize: type.subtitle, opacity: 0.75 }}>
          {c.subtitle}
        </motion.p>
      )}
      {(c.body_text || (showBullets && bullets.length > 0)) && (
        <FitText key={`${c.body_text ?? ""}|${bullets.join("|")}`} base={type.body} className="flex flex-col" style={{ gap: "0.7cqw", lineHeight: 1.45 }}>
          {c.body_text && <motion.p {...ctrl.motionProps("body")} exit={choreo.exitFor("body")} style={{ opacity: 0.9 }}>{c.body_text}</motion.p>}
          {showBullets && bullets.length > 0 && (
            <ul className="flex flex-col" style={{ gap: "0.55cqw" }}>
              {bullets.map((b, i) => (
                <motion.li key={i} {...ctrl.motionProps(`bullet-${i}`)} exit={choreo.exitFor("bullet", i)} className="flex items-start" style={{ gap: "0.7cqw" }}>
                  <span className="shrink-0 rounded-full" style={{ width: "0.5cqw", height: "0.5cqw", marginTop: "0.55em", background: theme.accent }} />
                  <span>{b}</span>
                </motion.li>
              ))}
            </ul>
          )}
        </FitText>
      )}
    </div>
  );
};

export const SceneSlide = ({ slide, theme, fontId, bodyFont, displayFont, index, noAnimate, dynamicMode, creativeBrief }: SceneSlideProps) => {
  const c = slide.content ?? {};
  const { staticEffects, only } = useSceneRender();
  const visualOnly = only === "visual";
  const visual: SceneVisual | undefined = c.visual;
  const model = useMemo(() => buildVisualModel(visual), [visual]);
  const layout = sceneLayoutFor(slide.layout_template, !!model);
  const type = typeScaleFor(fontId);
  const aspect = slotAspectFor(layout);
  const bullets: string[] = Array.isArray(c.bullets) ? c.bullets : [];
  const imageUrl: string | null = c.image_url ?? null;
  const assetStatus: string | null = c.asset?.status ?? null;
  const hasMedia = !!model?.media;
  const motionKey = JSON.stringify(c.motion ?? null);

  const scenario = useMemo(
    () => buildSceneScenario({
      motion: c.motion,
      itemCount: model?.counts.items ?? 0,
      edgeCount: model?.counts.edges ?? 0,
      shapeCount: model?.counts.shapes ?? 0,
      bullets: layout === "diagram-full" || layout === "title-content" ? 0 : bullets.length,
      hasSubtitle: !!c.subtitle,
      hasBody: !!c.body_text,
      hasMedia,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [motionKey, model, bullets.length, !!c.subtitle, !!c.body_text, hasMedia, layout],
  );
  const ctrl = useTimeline(scenario, { skip: noAnimate });
  const anchorsOn = dynamicMode && !noAnimate;

  // Padding pelo Design Intelligence (densidade + spacing do brief).
  const spec = computeCompositionSpec(
    { headline: c.headline, subtitle: c.subtitle, bodyText: c.body_text, bullets, hasChart: !!model },
    creativeBrief,
  );

  // Mídia em tela cheia: contraste AA do texto sobre a foto (parte cliente do gate).
  const fullBleed = layout === "full-image" && hasMedia;
  const insight = useImageInsight(fullBleed ? imageUrl : null);
  const scrim = insight ? scrimAlphaForAA("#FFFFFF", "#000000", insight.textHalfLuminance, 0.35) : 0.55;

  const visualNode = model && visual ? (
    <VisualBlock
      model={model}
      visual={visual}
      theme={theme}
      type={type}
      displayFont={displayFont}
      aspect={aspect}
      ctrl={ctrl}
      noAnimate={noAnimate}
      staticEffects={staticEffects}
      imageUrl={imageUrl}
      assetStatus={assetStatus}
      dynamicMode={dynamicMode}
      anchorKey={c.anchor_key}
      listToFlow={c.motion?.preset === "list-to-flow"}
      bleed={fullBleed}
    />
  ) : null;

  const framed = (node: ReactNode, withFrame = true) => (
    <div className="relative w-full h-full min-h-0" data-scene-slot="visual">
      {withFrame && !hasMedia && !visualOnly && <FocalFrame theme={theme} />}
      {node}
    </div>
  );

  const textProps = { c, type, theme, displayFont, ctrl, anchorsOn };
  // Alterna o lado do visual para o deck não ficar com todo slide igual.
  const visualFirst = index % 2 === 1;
  const spotlightX = layout === "image-left" ? 30 : layout === "image-right" ? 70 : visualFirst ? 34 : 66;

  let body: ReactNode;
  switch (layout) {
    case "diagram-full":
      body = (
        <div className="h-full flex flex-col" style={{ gap: "1.4cqw" }}>
          <div className="shrink-0" style={{ maxHeight: "30%" }}>
            <SceneText {...textProps} showBullets={false} c={{ ...c, body_text: undefined }} />
          </div>
          <div className="flex-1 min-h-0">{framed(visualNode)}</div>
          {c.body_text && <p className="shrink-0" data-scene-text="" style={{ fontSize: type.itemDetail, opacity: 0.7 }}>{c.body_text}</p>}
        </div>
      );
      break;
    case "title-content":
      body = (
        <div className="h-full flex flex-col" style={{ gap: "1.4cqw" }}>
          <div className="shrink-0" style={{ maxHeight: "40%" }}>
            <SceneText {...textProps} showBullets={false} />
          </div>
          <div className="flex-1 min-h-0">{framed(visualNode)}</div>
        </div>
      );
      break;
    case "image-left":
    case "image-right": {
      const left = layout === "image-left";
      body = (
        <div className="h-full grid grid-cols-12" style={{ gap: "3cqw" }}>
          <div className={`col-span-6 min-h-0 ${left ? "order-1" : "order-2"}`}>{framed(visualNode)}</div>
          <div className={`col-span-6 min-h-0 ${left ? "order-2" : "order-1"}`}><SceneText {...textProps} /></div>
        </div>
      );
      break;
    }
    case "two-columns":
      body = (
        <div className="h-full grid grid-cols-12" style={{ gap: "3cqw" }}>
          <div className="col-span-5 min-h-0"><SceneText {...textProps} /></div>
          <div className="col-span-7 min-h-0">{framed(visualNode)}</div>
        </div>
      );
      break;
    case "full-image":
      body = fullBleed ? (
        <div className="h-full flex flex-col justify-end" style={{ maxWidth: "62%" }}>
          <SceneText {...textProps} hero color="#FFFFFF" />
        </div>
      ) : null;
      break;
    case "visual-hero":
    default:
      body = (
        <div className="h-full grid grid-cols-12" style={{ gap: "3cqw" }}>
          <div className={`col-span-4 min-h-0 ${visualFirst ? "order-2" : "order-1"}`}><SceneText {...textProps} /></div>
          <div className={`col-span-8 min-h-0 ${visualFirst ? "order-1" : "order-2"}`}>{framed(visualNode)}</div>
        </div>
      );
  }

  // Sem bloco visual renderizável (não deveria acontecer: o SlideRenderer só
  // manda para cá slides com visual), mostra só o texto.
  if (!body) body = <SceneText {...textProps} hero />;

  // Export PPTX: só o visual, sobre fundo transparente, com o texto ocupando
  // o mesmo espaço (invisível) para o layout não mudar.
  if (visualOnly) {
    return (
      <div className="relative w-full h-full overflow-hidden scene-visual-only" style={{ color: theme.text, fontFamily: bodyFont, containerType: "size" }}>
        <style>{".scene-visual-only [data-scene-text]{visibility:hidden}"}</style>
        {fullBleed
          ? <div className="absolute inset-0" data-scene-slot="visual">{visualNode}</div>
          : <div className="absolute inset-0" style={{ padding: spec.padding }}>{body}</div>}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ color: theme.text, fontFamily: bodyFont, containerType: "size", background: theme.bg }}>
      <SceneBackground spec={c.background} theme={theme} imageUrl={imageUrl} noAnimate={noAnimate} focus={{ x: spotlightX, y: 52 }} />
      <SceneDecoration accents={c.visual_accents} theme={theme} noAnimate={noAnimate} hasVisual={!!model} />
      {fullBleed && (
        <>
          <div className="absolute inset-0" style={{ zIndex: 2 }} data-scene-slot="visual">{visualNode}</div>
          <div
            className="absolute inset-0"
            style={{ zIndex: 3, background: `linear-gradient(to right, ${rgba("#000000", scrim)} 0%, ${rgba("#000000", scrim * 0.4)} 55%, transparent 90%)` }}
          />
        </>
      )}
      <div className="absolute inset-0" style={{ zIndex: 4, padding: spec.padding }}>{body}</div>
    </div>
  );
};
