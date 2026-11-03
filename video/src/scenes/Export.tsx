import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { tw } from "../anim";
import { Backdrop } from "../components/Backdrop";
import { ScaledSlide } from "../components/DeckSlide";
import { C, EASE, FONT, GRADIENT, gradientText } from "../theme";
import { MOMENTS } from "../timeline";

// Fast hits on the beat: the formats the deck leaves in.

const Icon = ({ children }: { children: ReactNode }) => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const FileIcon = () => (
  <Icon>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </Icon>
);

const TILES: { title: string; detail: string; icon: ReactNode }[] = [
  { title: "PowerPoint", detail: ".pptx editável", icon: <FileIcon /> },
  { title: "PDF", detail: "pronto para enviar", icon: <FileIcon /> },
  {
    title: "Imagens",
    detail: ".png por slide",
    icon: (
      <Icon>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="2" />
        <path d="M21 17l-5-5-9 8" />
      </Icon>
    ),
  },
  {
    title: "Link público",
    detail: "modo apresentação",
    icon: (
      <Icon>
        <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
        <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
      </Icon>
    ),
  },
];

const TILE_W = 383;
const TILE_GAP = 36;

export const Export = () => {
  const frame = useCurrentFrame();
  const head = tw(frame, [0, 14], [0, 1], EASE.outExpo);
  const fan = tw(frame, [4, 26], [0, 1], EASE.outBack);

  return (
    <AbsoluteFill>
      <Backdrop intensity={1} seed={31} />

      <div
        style={{
          position: "absolute",
          left: 140,
          top: 130,
          fontFamily: FONT.sans,
          fontWeight: 800,
          fontSize: 116,
          lineHeight: 1,
          letterSpacing: -4,
          color: C.fg,
          opacity: head,
          translate: `0 ${(1 - head) * 50}px`,
        }}
      >
        Exporte e apresente
        <br />
        <span style={gradientText()}>onde quiser.</span>
      </div>

      {/* Deck fanned out, top right */}
      <div style={{ position: "absolute", right: 150, top: 110, width: 420, height: 260 }}>
        {[2, 1, 0].map((idx, k) => (
          <div
            key={idx}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 24px 60px -18px rgba(0,0,0,0.8)",
              rotate: `${(k - 1) * -9 * fan}deg`,
              translate: `${(k - 1) * -46 * fan}px ${(k - 1) * 10 * fan}px`,
              opacity: tw(frame, [2 + k * 2, 8 + k * 2], [0, 1]),
            }}
          >
            <ScaledSlide index={idx} width={360} />
          </div>
        ))}
      </div>

      <div style={{ position: "absolute", left: 140, top: 520, display: "flex", gap: TILE_GAP }}>
        {TILES.map((t, i) => {
          const at = MOMENTS.exportTiles[i];
          const p = tw(frame, [at, at + 12], [0, 1], EASE.outBack);
          const bob = Math.sin((frame - at) / 14) * 5 * p;
          return (
            <div
              key={t.title}
              style={{
                width: TILE_W,
                height: 330,
                borderRadius: 28,
                padding: 36,
                background: i === 3 ? GRADIENT.hero : C.surface,
                border: `2px solid ${i === 3 ? "transparent" : C.line}`,
                boxShadow: i === 3 ? "0 30px 80px -20px hsl(262 100% 60% / 0.7)" : "0 30px 70px -30px rgba(0,0,0,0.8)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                opacity: tw(frame, [at, at + 3], [0, 1]),
                translate: `0 ${(1 - p) * 140 + bob}px`,
                scale: String(0.85 + 0.15 * p),
              }}
            >
              <div
                style={{
                  width: 104,
                  height: 104,
                  borderRadius: 26,
                  background: i === 3 ? "hsl(0 0% 100% / 0.18)" : GRADIENT.primary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {t.icon}
              </div>
              <div>
                <div style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 50, color: C.fg, letterSpacing: -1 }}>{t.title}</div>
                <div style={{ height: 8 }} />
                <div style={{ fontFamily: FONT.sans, fontSize: 30, color: i === 3 ? "hsl(0 0% 100% / 0.85)" : C.fgMuted }}>{t.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
