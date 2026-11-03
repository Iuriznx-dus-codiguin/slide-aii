import { AbsoluteFill, useCurrentFrame } from "remotion";
import { rand, tw } from "../anim";
import { Backdrop } from "../components/Backdrop";
import { ScaledSlide } from "../components/DeckSlide";
import { Sparkle } from "../components/Sparkle";
import { SimTag } from "../components/ui";
import { C, EASE, FONT, gradientText } from "../theme";
import { MOMENTS } from "../timeline";

// PEAK. The eight generated slides fly out of the centre and settle into a
// grid. The slides move first (they are the hero), then the headline.

const CARD_W = 383;
const CARD_H = Math.round((CARD_W * 9) / 16);
const GAP = 36;
const GRID_X = (1920 - (CARD_W * 4 + GAP * 3)) / 2;
const GRID_Y = 372;

export const Reveal = () => {
  const frame = useCurrentFrame();
  const { revealCardsStart, revealCardStagger } = MOMENTS;
  const head = tw(frame, [30, 48], [0, 1], EASE.outExpo);
  const sub = tw(frame, [40, 56], [0, 1], EASE.outExpo);
  const star = tw(frame, [0, 6, 22], [0, 1, 0]);
  const push = tw(frame, [60, 190], [1, 1.05], EASE.inOut);

  return (
    <AbsoluteFill>
      <Backdrop intensity={1.25} seed={19} />

      {/* Sparkle flash: the AI just acted */}
      <div style={{ position: "absolute", left: 960 - 160, top: 600 - 160, opacity: star, scale: String(0.4 + star * 1.2), rotate: `${frame * 6}deg` }}>
        <Sparkle size={320} color="hsl(262 100% 85%)" />
      </div>

      {/* Headline */}
      <div style={{ position: "absolute", left: GRID_X, top: 96, right: GRID_X, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <div
            style={{
              fontFamily: FONT.sans,
              fontWeight: 800,
              fontSize: 128,
              lineHeight: 1,
              letterSpacing: -4,
              color: C.fg,
              opacity: head,
              translate: `${(1 - head) * -80}px 0`,
              filter: `blur(${(1 - head) * 16}px)`,
            }}
          >
            <span style={gradientText()}>8 slides</span> prontos
          </div>
          <div
            style={{
              marginTop: 18,
              fontFamily: FONT.sans,
              fontWeight: 600,
              fontSize: 56,
              color: C.fgMuted,
              opacity: sub,
              translate: `${(1 - sub) * -60}px 0`,
            }}
          >
            em cerca de 1 minuto.
          </div>
        </div>
      </div>

      {/* Grid of slides */}
      <AbsoluteFill style={{ scale: String(push), transformOrigin: "50% 60%" }}>
        {Array.from({ length: 8 }).map((_, i) => {
          const col = i % 4;
          const row = Math.floor(i / 4);
          const tx = GRID_X + col * (CARD_W + GAP);
          const ty = GRID_Y + row * (CARD_H + GAP);
          const at = revealCardsStart + i * revealCardStagger;
          const p = tw(frame, [at, at + 22], [0, 1], EASE.outExpo);
          const r0 = (rand(i + 3) - 0.5) * 50;
          const fromX = 960 - CARD_W / 2;
          const fromY = 600 - CARD_H / 2;
          const x = fromX + (tx - fromX) * p;
          const y = fromY + (ty - fromY) * p;
          const bob = Math.sin((frame + i * 9) / 18) * 4 * p;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: y + bob,
                opacity: tw(frame, [at, at + 4], [0, 1]),
                scale: String(0.35 + 0.65 * p),
                rotate: `${r0 * (1 - p)}deg`,
                borderRadius: 14,
                overflow: "hidden",
                boxShadow: "0 30px 70px -20px rgba(0,0,0,0.75), 0 0 0 2px hsl(252 60% 85% / 0.25)",
              }}
            >
              <ScaledSlide index={i} width={CARD_W} />
            </div>
          );
        })}
      </AbsoluteFill>

      {/* What was generated */}
      <div style={{ position: "absolute", left: GRID_X, bottom: 110, display: "flex", gap: 18 }}>
        {["Roteiro", "Layout", "Imagens", "Gráficos"].map((t, i) => {
          const p = tw(frame, [58 + i * 4, 72 + i * 4], [0, 1], EASE.outBack);
          return (
            <div
              key={t}
              style={{
                padding: "12px 26px",
                borderRadius: 999,
                border: `2px solid hsl(252 100% 72% / 0.45)`,
                background: "hsl(252 100% 64% / 0.14)",
                fontFamily: FONT.sans,
                fontWeight: 600,
                fontSize: 30,
                color: C.fg,
                opacity: p,
                translate: `0 ${(1 - p) * 24}px`,
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" style={{ marginRight: 10, translate: "0 3px" }}>
                <path d="M5 12.5 L10 17 L19 7" fill="none" stroke={C.success} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t}
            </div>
          );
        })}
      </div>
      <SimTag />
    </AbsoluteFill>
  );
};
