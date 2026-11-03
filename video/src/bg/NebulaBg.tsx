import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { rand } from "../anim";

// Black canvas with drifting purple clouds (pre-rendered textures from
// NebulaTexture), colour blobs for depth, twinkling stars and a vignette.

const STARS = Array.from({ length: 140 }, (_, i) => ({
  x: rand(i * 3 + 1) * 1920,
  y: rand(i * 3 + 2) * 1080,
  s: 1 + rand(i * 3 + 3) * 2.6,
  p: rand(i + 400) * 6.28,
}));

export const NebulaBg = ({ push = 0, intensity = 1 }: { push?: number; intensity?: number }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  return (
    <AbsoluteFill style={{ backgroundColor: "hsl(250 60% 3%)", overflow: "hidden" }}>
      <Img
        src={staticFile("textures/nebula-a.jpg")}
        style={{
          position: "absolute",
          left: -240,
          top: -160,
          width: 2400,
          height: 1400,
          opacity: 0.95 * intensity,
          scale: String(1.05 + push * 0.12 + t * 0.006),
          translate: `${Math.sin(t * 0.25) * 40 - t * 9}px ${Math.cos(t * 0.2) * 20}px`,
          rotate: `${t * 0.35}deg`,
        }}
      />
      <Img
        src={staticFile("textures/nebula-b.jpg")}
        style={{
          position: "absolute",
          left: -240,
          top: -160,
          width: 2400,
          height: 1400,
          opacity: 0.7 * intensity,
          mixBlendMode: "screen",
          scale: String(1.2 + push * 0.2 + t * 0.01),
          translate: `${t * 14}px ${Math.sin(t * 0.3) * 24}px`,
          rotate: `${180 - t * 0.5}deg`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(700px 520px at 70% 30%, hsl(262 100% 60% / 0.35), transparent 70%), radial-gradient(640px 500px at 18% 80%, hsl(295 90% 55% / 0.28), transparent 70%)",
          mixBlendMode: "screen",
        }}
      />
      {STARS.map((s, i) => {
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.6 + s.p));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: s.x,
              top: s.y,
              width: s.s,
              height: s.s,
              borderRadius: 99,
              background: "hsl(260 100% 92%)",
              opacity: tw * 0.85,
              boxShadow: s.s > 3 ? "0 0 8px hsl(262 100% 80%)" : undefined,
              translate: `${-t * (s.s * 4)}px 0`,
            }}
          />
        );
      })}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 75% at 50% 50%, transparent 50%, hsl(250 60% 2% / 0.85) 100%)" }} />
    </AbsoluteFill>
  );
};
