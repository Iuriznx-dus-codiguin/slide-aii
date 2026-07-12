// ============================================================
// SlideAI — 6 layouts de capa cinematográficos (Fase 1)
// ------------------------------------------------------------
// IA escolhe um cover_variant; SlideRenderer redireciona para
// o componente correspondente. Tudo usa as variants da engine.
// ============================================================

import { motion } from "framer-motion";
import { PRESETS, kenBurnsVariants, EASE } from "@/lib/animations";
import { anchorLayoutId } from "@/lib/morphing";
import type { ThemeColors } from "@/lib/slugify";

interface CoverProps {
  headline?: string;
  subtitle?: string;
  imageUrl?: string | null;
  theme: ThemeColors;
  fontFamily: string;
  /** Bloco 7: kicker opcional (substitui textos hardcoded). */
  kicker?: string;
  /** Bloco 7: rodapé opcional (substitui textos hardcoded). */
  footer?: string;
  /**
   * Antes, os 6 covers ignoravam noAnimate por completo — mesmo em
   * miniaturas/exportação PDF, a entrada animada (até 1.2s) sempre rodava.
   * Isso podia fazer o export de PDF capturar a capa NO MEIO da animação
   * (semi-transparente), já que a rotina de rasterização só espera alguns
   * frames antes de tirar o "print". Agora os covers pulam direto para o
   * estado final quando noAnimate=true, como todo o resto do SlideRenderer.
   */
  noAnimate?: boolean;
  /** true quando a transição ativa é "dynamic" — habilita magic move do título. */
  dynamicMode?: boolean;
}

const hexToRgba = (hex: string, alpha: number) => {
  const h = hex.replace("#", "");
  const big = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(big >> 16) & 255}, ${(big >> 8) & 255}, ${big & 255}, ${alpha})`;
};

/* ---------- 1. SPLIT HERO ---------- */
const SplitHero = ({ headline, subtitle, imageUrl, theme, fontFamily, noAnimate, dynamicMode }: CoverProps) => {
  const preset = PRESETS["hero-zoom"];
  const titleActive = !!dynamicMode && !noAnimate;
  return (
    <div className="w-full h-full grid grid-cols-2 overflow-hidden" style={{ background: theme.bg, color: theme.text, fontFamily }}>
      <motion.div initial={noAnimate ? false : "hidden"} animate="show" variants={preset.container} className="flex flex-col justify-center p-[6%] relative z-10">
        <motion.div variants={preset.item} className="h-1.5 w-20 mb-8" style={{ background: theme.accent }} />
        <motion.h1 variants={preset.item} layoutId={anchorLayoutId("title", titleActive)} className="text-[4.2vw] font-extrabold leading-[1.02] tracking-tighter">{headline}</motion.h1>
        {subtitle && <motion.p variants={preset.item} className="mt-6 text-[1.6vw] opacity-80 leading-snug">{subtitle}</motion.p>}
      </motion.div>
      <div className="relative overflow-hidden">
        {imageUrl ? (
          <motion.img src={imageUrl} alt="" layoutId={anchorLayoutId("hero-media", titleActive)} className="absolute inset-0 w-full h-full object-cover" variants={kenBurnsVariants} initial="initial" animate="animate" />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2 || theme.accent})` }} />
        )}
        <div className="absolute inset-y-0 left-0 w-32" style={{ background: `linear-gradient(90deg, ${theme.bg}, transparent)` }} />
      </div>
    </div>
  );
};

/* ---------- 2. TYPOGRAPHIC BOLD ---------- */
const TypographicBold = ({ headline, subtitle, theme, fontFamily, kicker, noAnimate, dynamicMode }: CoverProps) => {
  const words = (headline || "").split(" ");
  const titleActive = !!dynamicMode && !noAnimate;
  // Bloco 7.1: kicker derivado de subtitle/kicker; omite se nada real disponível
  const kickerText = (kicker?.trim())
    || (subtitle ? subtitle.split(" ").slice(0, 3).join(" ") : "");
  return (
    <div className="w-full h-full flex flex-col p-[5%] overflow-hidden relative" style={{ background: theme.bg, color: theme.text, fontFamily }}>
      <div className="absolute -bottom-[20%] -right-[10%] w-[80%] h-[80%] opacity-[0.07]" style={{ background: `radial-gradient(circle, ${theme.accent}, transparent 70%)`, filter: "blur(60px)" }} />
      <motion.div initial={noAnimate ? false : "hidden"} animate="show" variants={PRESETS["kinetic-type"].container} className="flex-1 flex flex-col justify-center relative z-10">
        {kickerText && (
          <motion.div variants={PRESETS["kinetic-type"].item} className="text-[1.1vw] uppercase tracking-[0.4em] opacity-50 mb-8">{kickerText}</motion.div>
        )}
        <h1 className="text-[8vw] font-black leading-[0.92] tracking-[-0.04em]" style={{ perspective: "1000px" }}>
          {words.map((w, i) => (
            <motion.span
              key={i}
              variants={PRESETS["kinetic-type"].item}
              layoutId={i === 0 ? anchorLayoutId("title", titleActive) : undefined}
              className="inline-block mr-[0.25em]"
            >
              {w}
            </motion.span>
          ))}
        </h1>
        {subtitle && (
          <motion.p variants={PRESETS["kinetic-type"].item} className="mt-10 text-[1.6vw] max-w-[60%] opacity-75 leading-snug">
            {subtitle}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
};

/* ---------- 3. FULL BLEED IMAGE ---------- */
const FullBleedImage = ({ headline, subtitle, imageUrl, theme, fontFamily, noAnimate, dynamicMode }: CoverProps) => {
  const titleActive = !!dynamicMode && !noAnimate;
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: theme.bg, color: theme.text, fontFamily }}>
      {imageUrl ? (
        <motion.img src={imageUrl} alt="" layoutId={anchorLayoutId("hero-media", titleActive)} className="absolute inset-0 w-full h-full object-cover" variants={kenBurnsVariants} initial="initial" animate="animate" />
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.bg})` }} />
      )}
      <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${hexToRgba(theme.bg, 0.1)} 0%, ${hexToRgba(theme.bg, 0.3)} 50%, ${hexToRgba(theme.bg, 0.92)} 100%)` }} />
      <motion.div initial={noAnimate ? false : "hidden"} animate="show" variants={PRESETS["hero-zoom"].container} className="relative h-full flex flex-col justify-end p-[6%]">
        <motion.div variants={PRESETS["hero-zoom"].item} className="h-1.5 w-28 mb-6" style={{ background: theme.accent }} />
        <motion.h1 variants={PRESETS["hero-zoom"].item} layoutId={anchorLayoutId("title", titleActive)} className="text-[5.5vw] font-extrabold leading-[1.02] tracking-tighter max-w-[85%] drop-shadow-lg">
          {headline}
        </motion.h1>
        {subtitle && <motion.p variants={PRESETS["hero-zoom"].item} className="mt-5 text-[1.8vw] opacity-90 max-w-[70%] leading-snug">{subtitle}</motion.p>}
      </motion.div>
    </div>
  );
};

/* ---------- 4. MINIMAL CENTERED ---------- */
const MinimalCentered = ({ headline, subtitle, theme, fontFamily, noAnimate, dynamicMode }: CoverProps) => {
  const titleActive = !!dynamicMode && !noAnimate;
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-[8%] text-center overflow-hidden relative" style={{ background: theme.bg, color: theme.text, fontFamily }}>
      <motion.div initial={noAnimate ? false : { opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, ease: EASE.editorial as any }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vh] h-[120vh] rounded-full" style={{ background: `radial-gradient(circle, ${hexToRgba(theme.accent, 0.08)}, transparent 60%)` }} />
      <motion.div initial={noAnimate ? false : "hidden"} animate="show" variants={PRESETS["cinematic-reveal"].container} className="relative z-10 max-w-4xl">
        <motion.div variants={PRESETS["cinematic-reveal"].item} className="mx-auto h-[2px] w-16 mb-10" style={{ background: theme.accent }} />
        <motion.h1 variants={PRESETS["cinematic-reveal"].item} layoutId={anchorLayoutId("title", titleActive)} className="text-[5vw] font-light leading-[1.05] tracking-tight">
          {headline}
        </motion.h1>
        {subtitle && (
          <motion.p variants={PRESETS["cinematic-reveal"].item} className="mt-10 text-[1.5vw] opacity-65 max-w-2xl mx-auto leading-relaxed">
            {subtitle}
          </motion.p>
        )}
        <motion.div variants={PRESETS["cinematic-reveal"].item} className="mx-auto h-[2px] w-16 mt-12" style={{ background: theme.accent }} />
      </motion.div>
    </div>
  );
};

/* ---------- 5. ASYMMETRIC GRID ---------- */
const AsymmetricGrid = ({ headline, subtitle, theme, fontFamily, kicker, footer, noAnimate, dynamicMode }: CoverProps) => {
  // Bloco 7.2: kicker e footer dinâmicos
  const kickerText = (kicker?.trim())
    || (subtitle ? subtitle.split(" ").slice(0, 3).join(" ") : "");
  const titleActive = !!dynamicMode && !noAnimate;
  return (
    <div className="w-full h-full grid grid-cols-12 grid-rows-12 p-[3%] gap-3 overflow-hidden relative" style={{ background: theme.bg, color: theme.text, fontFamily }}>
      {/* Big number "01" */}
      <motion.div initial={noAnimate ? false : { opacity: 0, x: -100 }} animate={{ opacity: 0.12, x: 0 }} transition={{ duration: 1.2, ease: EASE.editorial as any }} className="col-span-3 row-span-12 flex items-center justify-center">
        <span className="text-[18vw] font-black leading-none tracking-tighter" style={{ color: theme.accent }}>01</span>
      </motion.div>
      {/* Accent bar */}
      <motion.div initial={noAnimate ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, delay: 0.3, ease: EASE.editorial as any }} className="col-span-9 row-span-1 origin-left h-2 mt-3" style={{ background: theme.accent }} />
      {/* Title block */}
      <motion.div initial={noAnimate ? false : "hidden"} animate="show" variants={PRESETS["editorial-stagger"].container} className="col-span-9 row-span-8 flex flex-col justify-center pl-4">
        {kickerText && (
          <motion.div variants={PRESETS["editorial-stagger"].item} className="text-[1vw] uppercase tracking-[0.4em] opacity-60 mb-4">{kickerText}</motion.div>
        )}
        <motion.h1 variants={PRESETS["editorial-stagger"].item} layoutId={anchorLayoutId("title", titleActive)} className="text-[5.5vw] font-extrabold leading-[1.02] tracking-tighter max-w-[90%]">
          {headline}
        </motion.h1>
        {subtitle && (
          <motion.p variants={PRESETS["editorial-stagger"].item} className="mt-6 text-[1.5vw] opacity-75 max-w-[75%] leading-snug">
            {subtitle}
          </motion.p>
        )}
      </motion.div>
      {/* Footer corner — apenas se fornecido */}
      {footer && (
        <motion.div initial={noAnimate ? false : { opacity: 0 }} animate={{ opacity: 0.5 }} transition={{ delay: 0.8, duration: 0.6 }} className="col-span-9 row-span-3 flex items-end justify-end text-[0.9vw] uppercase tracking-widest">
          {footer}
        </motion.div>
      )}
    </div>
  );
};

/* ---------- 6. GRADIENT MESH ---------- */
const GradientMesh = ({ headline, subtitle, theme, fontFamily, noAnimate, dynamicMode }: CoverProps) => {
  const accent = theme.accent;
  const accent2 = theme.accent2 || theme.accent;
  const titleActive = !!dynamicMode && !noAnimate;
  // Mesmo cuidado de AmbientBackdrop: blobs com animação Infinity não devem
  // rodar para sempre em contexto estático (thumbnail/export), onde o efeito
  // é imperceptível e só desperdiça CPU/GPU.
  const skipBlobs = noAnimate;
  return (
    <div className="w-full h-full flex flex-col justify-center p-[6%] overflow-hidden relative" style={{ background: theme.bg, color: theme.text, fontFamily }}>
      {/* Animated gradient blobs */}
      <motion.div animate={skipBlobs ? undefined : { x: [0, 80, -40, 0], y: [0, -60, 40, 0] }} transition={skipBlobs ? undefined : { duration: 22, repeat: Infinity, ease: "easeInOut" }} className="absolute top-[-15%] left-[-10%] w-[60%] h-[60%] rounded-full" style={{ background: accent, filter: "blur(120px)", opacity: 0.45 }} />
      <motion.div animate={skipBlobs ? undefined : { x: [0, -60, 50, 0], y: [0, 70, -30, 0] }} transition={skipBlobs ? undefined : { duration: 26, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-[-15%] right-[-10%] w-[55%] h-[55%] rounded-full" style={{ background: accent2, filter: "blur(120px)", opacity: 0.4 }} />
      <motion.div animate={skipBlobs ? undefined : { x: [0, 40, -50, 0], y: [0, -40, 60, 0] }} transition={skipBlobs ? undefined : { duration: 30, repeat: Infinity, ease: "easeInOut" }} className="absolute top-[40%] left-[40%] w-[40%] h-[40%] rounded-full" style={{ background: accent, filter: "blur(100px)", opacity: 0.3 }} />

      <motion.div initial={noAnimate ? false : "hidden"} animate="show" variants={PRESETS["cinematic-reveal"].container} className="relative z-10 max-w-5xl">
        <motion.div variants={PRESETS["cinematic-reveal"].item} className="h-1.5 w-24 mb-8" style={{ background: theme.text, opacity: 0.9 }} />
        <motion.h1 variants={PRESETS["cinematic-reveal"].item} layoutId={anchorLayoutId("title", titleActive)} className="text-[6vw] font-extrabold leading-[1.0] tracking-tighter drop-shadow-xl">
          {headline}
        </motion.h1>
        {subtitle && (
          <motion.p variants={PRESETS["cinematic-reveal"].item} className="mt-8 text-[1.7vw] opacity-90 max-w-[70%] leading-snug">
            {subtitle}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
};

/* ---------- Dispatcher ---------- */
export type CoverVariant =
  | "split-hero"
  | "typographic-bold"
  | "full-bleed-image"
  | "minimal-centered"
  | "asymmetric-grid"
  | "gradient-mesh";

export const COVER_VARIANTS: CoverVariant[] = [
  "split-hero",
  "typographic-bold",
  "full-bleed-image",
  "minimal-centered",
  "asymmetric-grid",
  "gradient-mesh",
];

export function renderCover(variant: CoverVariant | undefined, props: CoverProps) {
  switch (variant) {
    case "split-hero":         return <SplitHero {...props} />;
    case "typographic-bold":   return <TypographicBold {...props} />;
    case "full-bleed-image":   return <FullBleedImage {...props} />;
    case "minimal-centered":   return <MinimalCentered {...props} />;
    case "asymmetric-grid":    return <AsymmetricGrid {...props} />;
    case "gradient-mesh":      return <GradientMesh {...props} />;
    default:
      // Heurística: tem imagem → full bleed, senão typographic
      return props.imageUrl ? <FullBleedImage {...props} /> : <TypographicBold {...props} />;
  }
}
