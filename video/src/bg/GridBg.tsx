import { AbsoluteFill, useCurrentFrame } from "remotion";
import { beatPulse, rand } from "../anim";
import { BAR } from "../timeline";

// Black canvas with a purple perspective grid floor, a faint grid wall, a
// horizon glow and a scan beam. Line brightness pulses on every beat.

const MOTES = Array.from({ length: 40 }, (_, i) => ({
  x: rand(i + 900) * 1920,
  y0: rand(i + 950) * 1080,
  s: 2 + rand(i + 1000) * 3,
  v: 0.6 + rand(i + 1050) * 1.6,
}));

export const GridBg = ({ speed = 1, horizon = 610, glow = 1 }: { speed?: number; horizon?: number; glow?: number }) => {
  const frame = useCurrentFrame();
  const pulse = beatPulse(frame, 5);
  const lineA = 0.45 + pulse * 0.35;
  const scanY = ((frame % BAR) / BAR) * 1200 - 60;

  return (
    <AbsoluteFill style={{ backgroundColor: "hsl(250 50% 3%)", overflow: "hidden" }}>
      {/* Wall grid */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(hsl(262 100% 72% / ${0.1 + pulse * 0.06}) 2px, transparent 2px), linear-gradient(90deg, hsl(262 100% 72% / ${0.1 + pulse * 0.06}) 2px, transparent 2px)`,
          backgroundSize: "96px 96px",
          backgroundPosition: `${(frame * 0.6 * speed) % 96}px 0px`,
          maskImage: `linear-gradient(to bottom, black 0%, black ${horizon - 140}px, transparent ${horizon}px)`,
          WebkitMaskImage: `linear-gradient(to bottom, black 0%, black ${horizon - 140}px, transparent ${horizon}px)`,
          opacity: 0.9,
        }}
      />
      {/* Floor grid in perspective */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: horizon,
          bottom: 0,
          perspective: 700,
          perspectiveOrigin: "50% 0%",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: -1600,
            width: 5120,
            top: 0,
            height: 2400,
            transformOrigin: "50% 0%",
            rotate: "x 72deg",
            backgroundImage: `linear-gradient(hsl(268 100% 70% / ${lineA}) 3px, transparent 3px), linear-gradient(90deg, hsl(268 100% 70% / ${lineA}) 3px, transparent 3px)`,
            backgroundSize: "160px 160px",
            backgroundPosition: `0px ${(frame * 6 * speed) % 160}px`,
            maskImage: "linear-gradient(to bottom, transparent 0%, black 18%, black 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 18%, black 100%)",
          }}
        />
      </div>
      {/* Horizon glow */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: horizon - 160,
          height: 320,
          background: `radial-gradient(ellipse 60% 50% at 50% 50%, hsl(268 100% 62% / ${0.55 * glow + pulse * 0.15}), transparent 70%)`,
        }}
      />
      <div style={{ position: "absolute", left: 0, right: 0, top: horizon - 1, height: 3, background: `linear-gradient(90deg, transparent, hsl(270 100% 80% / ${0.8 * glow}), transparent)` }} />
      {/* Scan beam */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: scanY,
          height: 120,
          background: "linear-gradient(to bottom, transparent, hsl(262 100% 70% / 0.07), transparent)",
        }}
      />
      {/* Rising motes */}
      {MOTES.map((m, i) => {
        const y = (((m.y0 - frame * m.v * 2) % 1140) + 1140) % 1140 - 30;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: m.x,
              top: y,
              width: m.s,
              height: m.s,
              borderRadius: 99,
              background: "hsl(268 100% 78%)",
              opacity: 0.5,
              boxShadow: "0 0 10px hsl(268 100% 70%)",
            }}
          />
        );
      })}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 80% at 50% 45%, transparent 55%, hsl(250 50% 2% / 0.9) 100%)" }} />
    </AbsoluteFill>
  );
};
