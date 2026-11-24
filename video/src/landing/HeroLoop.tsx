import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { z } from "zod";
import { EASE, FONT } from "../theme";

// Seamless loop for the landing page hero: the same editor mockup as
// src/components/landing/Hero.tsx (browser chrome, slide sidebar, canvas
// with the hero image at 20 %, floating "Gerado em 23s" badge), animated.
// The editor steps through slides 02 → 03 → 04 → 01 → 02; the last frame
// hands over to the first, so the video can loop forever.

export const heroLoopSchema = z.object({ transparent: z.boolean() });

export const HERO_LOOP = { width: 1056, height: 704, fps: 60, durationInFrames: 720 };

// Site tokens (src/index.css, light theme)
const T = {
  card: "hsl(0 0% 100%)",
  fg: "hsl(240 20% 12%)",
  muted: "hsl(240 20% 96%)",
  mutedFg: "hsl(240 8% 46%)",
  border: "hsl(240 15% 92%)",
  primary: "hsl(252 100% 64%)",
  gradPrimary: "linear-gradient(135deg, hsl(252 100% 64%), hsl(280 95% 65%))",
  gradSubtle: "linear-gradient(180deg, hsl(252 100% 99%), hsl(252 30% 97%))",
  shadowElegant: "0 24px 80px -20px hsl(252 80% 40% / 0.3)",
  shadowGlow: "0 10px 40px -8px hsl(252 100% 64% / 0.45)",
  shadowLg: "0 20px 60px -12px hsl(252 80% 40% / 0.18)",
};

// Layout in CSS pixels (rendered at 2x for retina).
const WIN = { x: 68, y: 36, w: 920, chrome: 49 };
const SIDE_W = 230;
const PAD = 12;
const THUMB_W = SIDE_W - PAD * 2;
const THUMB_H = Math.round((THUMB_W * 9) / 16);
const GAP = 8;
const CONTENT_H = THUMB_H * 4 + GAP * 3 + PAD * 2;
const WIN_H = WIN.chrome + CONTENT_H;
const CARD_W = WIN.w - SIDE_W - 80;
const CARD_H = Math.round((CARD_W * 9) / 16);

// Loop: four steps of 3 s; 2.2 s hold, then the change.
const STEP = 180;
const EXIT = [132, 144];
const RING = [132, 162];
const BUILD = 140;
const ORDER = [1, 2, 3, 0]; // slide indexes shown in each step (02, 03, 04, 01)

const gradText: CSSProperties = { backgroundImage: T.gradPrimary, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", WebkitTextFillColor: "transparent" };

const ZapIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
  </svg>
);

const WandIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" />
    <path d="m14 7 3 3" />
    <path d="M5 6v4" />
    <path d="M19 14v4" />
    <path d="M10 2v2" />
    <path d="M7 8H3" />
    <path d="M21 16h-4" />
    <path d="M11 3H9" />
  </svg>
);

// Build progress 0..1 for element `k` of the incoming slide (staggered).
type Build = (k: number) => number;
const SETTLED: Build = () => 1;

const rise = (lin: number): CSSProperties => {
  const p = EASE.outExpo(lin);
  return { opacity: p, translate: `0 ${(1 - p) * 14}px`, filter: `blur(${(1 - p) * 6}px)` };
};

const Chip = ({ n, p }: { n: number; p: number }) => (
  <div
    style={{
      display: "inline-flex",
      width: "fit-content",
      alignItems: "center",
      gap: 6,
      padding: "4px 10px",
      borderRadius: 999,
      background: "hsl(252 100% 64% / 0.1)",
      color: T.primary,
      fontSize: 12,
      fontWeight: 600,
      marginBottom: 16,
      ...rise(p),
    }}
  >
    <ZapIcon size={12} /> Slide {String(n).padStart(2, "0")} de 08
  </div>
);

const Title = ({ children, p }: { children: ReactNode; p: number }) => (
  <div style={{ fontSize: 36, lineHeight: "40px", fontWeight: 700, color: T.fg, letterSpacing: -0.5, marginBottom: 12, ...rise(p) }}>{children}</div>
);

const Sub = ({ children, p }: { children: ReactNode; p: number }) => <div style={{ fontSize: 16, lineHeight: "24px", color: T.mutedFg, maxWidth: 480, ...rise(p) }}>{children}</div>;

const Dots = ({ p }: { p: number }) => (
  <div style={{ marginTop: 24, display: "flex", gap: 12, opacity: Math.min(1, p * 3) }}>
    {[
      [64, T.primary],
      [40, "hsl(240 8% 46% / 0.2)"],
      [24, "hsl(240 8% 46% / 0.2)"],
    ].map(([w, c], i) => (
      <div key={i} style={{ height: 8, width: Number(w), borderRadius: 999, background: String(c), transformOrigin: "0 50%", scale: `${interpolate(p, [i * 0.15, 0.7 + i * 0.1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outQuart })} 1` }} />
    ))}
  </div>
);

const SlideBody = ({ index, b }: { index: number; b: Build }) => {
  switch (index) {
    case 0:
      return (
        <>
          <Chip n={1} p={b(0)} />
          <Title p={b(1)}>
            Inteligência <span style={gradText}>Artificial</span>
          </Title>
          <Sub p={b(2)}>Um panorama de como a IA está mudando o trabalho, a escola e os negócios.</Sub>
          <Dots p={b(3)} />
        </>
      );
    case 1:
      return (
        <>
          <Chip n={2} p={b(0)} />
          <Title p={b(1)}>
            O futuro das <span style={gradText}>apresentações</span>
          </Title>
          <Sub p={b(2)}>Conteúdo gerado por IA em menos de um minuto, com gráficos, imagens e narrativa coerente.</Sub>
          <Dots p={b(3)} />
        </>
      );
    case 2: {
      const bars = [0.32, 0.48, 0.62, 0.8, 1];
      return (
        <>
          <Chip n={3} p={b(0)} />
          <Title p={b(1)}>
            Adoção de IA <span style={gradText}>cresce</span>
          </Title>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 110, marginTop: 6 }}>
            {bars.map((h, i) => {
              const g = interpolate(b(2), [i * 0.1, 0.55 + i * 0.1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outQuart });
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ width: "100%", height: 88 * h * g, borderRadius: "6px 6px 3px 3px", background: i === bars.length - 1 ? T.gradPrimary : "hsl(252 100% 64% / 0.22)" }} />
                  <div style={{ fontSize: 11, color: T.mutedFg, opacity: Math.min(1, b(2) * 3) }}>{2022 + i}</div>
                </div>
              );
            })}
          </div>
        </>
      );
    }
    default: {
      const items = [
        { label: "Pesquisa", d: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3" },
        { label: "Escrita", d: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" },
        { label: "Design", d: "M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.6 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4-4-7.4-9-7.4zM7.5 10.5h.01M10.5 7.5h.01M15 7.5h.01" },
      ];
      return (
        <>
          <Chip n={4} p={b(0)} />
          <Title p={b(1)}>
            Onde a IA <span style={gradText}>ajuda</span>
          </Title>
          <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
            {items.map((it, i) => {
              const p = interpolate(b(2), [i * 0.15, 0.6 + i * 0.15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <div key={it.label} style={{ flex: 1, borderRadius: 14, border: `1px solid ${T.border}`, background: "hsl(252 100% 99%)", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 10, ...rise(p) }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: T.gradPrimary, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d={it.d} />
                    </svg>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.fg }}>{it.label}</div>
                </div>
              );
            })}
          </div>
        </>
      );
    }
  }
};

// The slide card content, laid out at full card size.
const SlideContent = ({ index, b }: { index: number; b: Build }) => (
  <div style={{ position: "absolute", inset: 0, padding: 40, display: "flex", flexDirection: "column", justifyContent: "center", fontFamily: FONT.sans }}>
    <SlideBody index={index} b={b} />
  </div>
);

const Thumb = ({ index, top }: { index: number; top: number }) => {
  const s = (THUMB_W - 2) / CARD_W;
  return (
    <div style={{ position: "absolute", left: PAD, top, width: THUMB_W, height: THUMB_H, borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: CARD_W, height: CARD_H, scale: String(s), transformOrigin: "0 0" }}>
        <SlideContent index={index} b={SETTLED} />
      </div>
    </div>
  );
};

export const HeroLoop = ({ transparent }: z.infer<typeof heroLoopSchema>) => {
  const frame = useCurrentFrame();
  const step = Math.floor(frame / STEP) % ORDER.length;
  const local = frame % STEP;
  const current = ORDER[step];
  const next = ORDER[(step + 1) % ORDER.length];
  const changing = local >= EXIT[0];

  const exitP = interpolate(local, EXIT, [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inQuad });
  // Linear progress per element (each applies its own easing); the last one
  // (k = 3) lands exactly on the step boundary, so nothing jumps at the wrap.
  const build: Build = (k) => interpolate(local, [BUILD + k * 4, BUILD + k * 4 + 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ringP = interpolate(local, RING, [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inOut });
  const thumbTop = (i: number) => PAD + i * (THUMB_H + GAP);
  const ringTop = thumbTop(current) + (thumbTop(next) - thumbTop(current)) * ringP;
  const genP = interpolate(local, [EXIT[0], BUILD + 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inOut });
  const genO = interpolate(local, [EXIT[0], EXIT[0] + 4, BUILD + 28, BUILD + 38], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glow = Math.sin(Math.PI * interpolate(local, [EXIT[0], BUILD + 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));

  // Periodic ambient motion (divides the 12 s loop).
  const t = frame / 60;
  const floatY = -6 * ((1 - Math.cos((2 * Math.PI * t) / 4)) / 2); // site: y [0,-6,0], 4 s, ease in-out
  const drift = Math.sin((2 * Math.PI * t) / 12);

  return (
    <AbsoluteFill style={{ background: transparent ? "transparent" : "#fff", fontFamily: FONT.sans }}>
      {/* Window */}
      <div style={{ position: "absolute", left: WIN.x, top: WIN.y, width: WIN.w, height: WIN_H, borderRadius: 24, border: "1px solid hsl(240 15% 92% / 0.6)", background: T.card, boxShadow: T.shadowElegant, overflow: "hidden" }}>
        {/* Browser chrome */}
        <div style={{ height: WIN.chrome, display: "flex", alignItems: "center", gap: 8, padding: "0 16px", borderBottom: "1px solid hsl(240 15% 92% / 0.6)", background: "hsl(240 20% 96% / 0.3)" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {["hsl(0 84% 60% / 0.6)", "hsl(280 95% 65% / 0.6)", "hsl(152 70% 45% / 0.6)"].map((c) => (
              <div key={c} style={{ width: 12, height: 12, borderRadius: 99, background: c }} />
            ))}
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ display: "inline-flex", padding: "4px 12px", borderRadius: 6, background: "hsl(0 0% 100% / 0.6)", fontSize: 12, color: T.mutedFg }}>slideai.com.br/editor</div>
          </div>
          <div style={{ width: 54 }} />
        </div>

        <div style={{ position: "relative", height: CONTENT_H, display: "flex" }}>
          {/* Sidebar */}
          <div style={{ position: "relative", width: SIDE_W, height: "100%", borderRight: "1px solid hsl(240 15% 92% / 0.6)", background: "hsl(240 20% 96% / 0.2)" }}>
            {[0, 1, 2, 3].map((i) => (
              <Thumb key={i} index={i} top={thumbTop(i)} />
            ))}
            {/* Selection ring, sliding between thumbnails */}
            <div style={{ position: "absolute", left: PAD - 1, top: ringTop - 1, width: THUMB_W + 2, height: THUMB_H + 2, borderRadius: 7, border: `1px solid ${T.primary}`, boxShadow: "0 0 0 2px hsl(252 100% 64% / 0.3)" }} />
          </div>

          {/* Canvas */}
          <div style={{ position: "relative", flex: 1, background: T.gradSubtle, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <Img
              src={staticFile("brand/hero-slides.jpg")}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.2, scale: String(1.04 + drift * 0.02), translate: `${drift * 6}px 0` }}
            />
            <div
              style={{
                position: "relative",
                width: CARD_W,
                height: CARD_H,
                borderRadius: 12,
                background: T.card,
                border: "1px solid hsl(240 15% 92% / 0.6)",
                boxShadow: `${T.shadowGlow}, 0 0 0 ${glow * 3}px hsl(252 100% 64% / ${glow * 0.18})`,
                overflow: "hidden",
              }}
            >
              <div style={{ position: "absolute", inset: 0, opacity: changing ? 1 - exitP : 1, translate: `0 ${changing ? -exitP * 12 : 0}px`, filter: `blur(${changing ? exitP * 4 : 0}px)` }}>
                <SlideContent index={current} b={SETTLED} />
              </div>
              {changing ? <SlideContent index={next} b={build} /> : null}
              {/* Generation progress along the top edge of the card */}
              <div style={{ position: "absolute", left: 0, top: 0, height: 3, width: `${genP * 100}%`, background: T.gradPrimary, opacity: genO }} />
            </div>
          </div>
        </div>
      </div>

      {/* Floating badge */}
      <div
        style={{
          position: "absolute",
          left: WIN.x - 24,
          top: WIN.y + WIN_H / 3,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 16px",
          borderRadius: 16,
          background: T.card,
          border: `1px solid ${T.border}`,
          boxShadow: T.shadowLg,
          translate: `0 ${floatY}px`,
        }}
      >
        <div style={{ width: 32, height: 32, borderRadius: 8, background: T.gradPrimary, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <WandIcon />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.fg, lineHeight: "16px" }}>Gerado em 23s</div>
          <div style={{ fontSize: 10, color: T.mutedFg, lineHeight: "14px" }}>8 slides · Tema: IA</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
