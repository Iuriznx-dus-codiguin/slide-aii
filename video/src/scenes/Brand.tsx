import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { tw } from "../anim";
import { Backdrop } from "../components/Backdrop";
import { Sparkle } from "../components/Sparkle";
import { Logo } from "../components/ui";
import { C, EASE, FONT, GRADIENT, gradientText } from "../theme";

// 3–6s. Hard cut into a violet burst. Brand name + promise land before the
// YouTube skip button appears.

export const Brand = () => {
  const frame = useCurrentFrame();
  const logoP = tw(frame, [0, 12], [0, 1], EASE.outBack);
  const flash = tw(frame, [0, 3, 16], [0, 1, 0]);
  const burst = tw(frame, [0, 18], [0, 1], EASE.outExpo);
  const wordP = tw(frame, [8, 24], [0, 1], EASE.outExpo);
  const starP = tw(frame, [10, 26], [0, 1], EASE.outBack);
  const line1 = tw(frame, [24, 38], [0, 1], EASE.outQuart);
  const line2 = tw(frame, [32, 46], [0, 1], EASE.outQuart);
  const drift = tw(frame, [0, 90], [0, 1]);

  return (
    <AbsoluteFill>
      <Backdrop intensity={1.15} seed={7} grid={false} />
      <Img
        src={staticFile("brand/hero-slides.jpg")}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.4,
          mixBlendMode: "screen",
          scale: String(1.12 - 0.08 * drift),
        }}
      />
      {/* Burst ring */}
      <div
        style={{
          position: "absolute",
          left: 960 - 1300,
          top: 540 - 1300,
          width: 2600,
          height: 2600,
          borderRadius: "50%",
          background: "radial-gradient(circle, hsl(262 100% 72% / 0.0) 38%, hsl(262 100% 72% / 0.55) 48%, transparent 58%)",
          scale: String(0.1 + burst * 0.9),
          opacity: 1 - burst,
        }}
      />
      <AbsoluteFill style={{ background: GRADIENT.hero, opacity: flash * 0.85 }} />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 56,
          scale: String(1 + drift * 0.04),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          <div style={{ position: "relative", scale: String(2.4 - 1.4 * logoP), opacity: tw(frame, [0, 2], [0, 1]) }}>
            <Logo size={220} />
            <Sparkle
              size={74}
              color="hsl(262 100% 80%)"
              style={{
                position: "absolute",
                right: -46,
                top: -46,
                scale: String(starP),
                rotate: `${(1 - starP) * 180 + frame * 1.2}deg`,
              }}
            />
          </div>
          <div
            style={{
              fontFamily: FONT.sans,
              fontWeight: 800,
              fontSize: 200,
              letterSpacing: -6,
              color: C.fg,
              clipPath: `inset(-20% ${(1 - wordP) * 100}% -20% 0)`,
              translate: `${(1 - wordP) * -60}px 0`,
            }}
          >
            SlideAI
          </div>
        </div>

        <div style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: 68, color: C.fg, letterSpacing: -1, display: "flex", gap: 22 }}>
          <span style={{ opacity: line1, translate: `0 ${(1 - line1) * 40}px` }}>Descreva o tema.</span>
          <span style={{ opacity: line2, translate: `0 ${(1 - line2) * 40}px`, ...gradientText() }}>A IA cria os slides.</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
