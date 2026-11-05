import { AbsoluteFill, useCurrentFrame } from "remotion";

// The purple glow of the SlideAI landing page, rebuilt frame-exact:
// - .bg-gradient-glow: radial violet glow from the top centre;
// - AmbientBackdrop orbs: radial-gradient(closest-side, colour 0.4 → 0.16 at
//   45% → transparent), alternating primary / accent, drifting on the
//   slideai-orb-a / -b paths (22 s + 4 s per orb).
// The CSS keyframes are evaluated from the frame number so they render
// deterministically.

const PRIMARY = "108, 71, 255"; // #6C47FF, hsl(252 100% 64%)
const ACCENT = "192, 77, 249"; // hsl(280 95% 65%)

type Key = [number, number, number, number]; // t, x%, y%, scale
const ORB_A: Key[] = [
  [0, 0, 0, 1],
  [0.33, 6, -5, 1.08],
  [0.66, -4, 7, 0.96],
  [1, 0, 0, 1],
];
const ORB_B: Key[] = [
  [0, 0, 0, 1],
  [0.33, -6, 4, 0.94],
  [0.66, 5, -6, 1.06],
  [1, 0, 0, 1],
];

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

const sample = (keys: Key[], p: number) => {
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, x0, y0, s0] = keys[i];
    const [t1, x1, y1, s1] = keys[i + 1];
    if (p >= t0 && p <= t1) {
      const k = ease((p - t0) / (t1 - t0));
      return { x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k, s: s0 + (s1 - s0) * k };
    }
  }
  return { x: 0, y: 0, s: 1 };
};

// Same layout rules as AmbientBackdrop (top/left/size in %), five orbs.
const ORBS = [
  { top: -15, left: -10, size: 62, color: PRIMARY },
  { top: 48, left: 58, size: 70, color: ACCENT },
  { top: 18, left: 34, size: 54, color: PRIMARY },
  { top: 62, left: -14, size: 58, color: ACCENT },
  { top: -22, left: 66, size: 60, color: PRIMARY },
];

// Speed > 1 makes the drift visible within a short scene (the site loops in
// 22–38 s; a 4 s shot would otherwise look static).
export const Orbs = ({ intensity = 1, speed = 3, glow = true }: { intensity?: number; speed?: number; glow?: boolean }) => {
  const frame = useCurrentFrame();
  const t = (frame / 30) * speed;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {ORBS.map((o, i) => {
        const dur = 22 + i * 4;
        const p = (((t + i * 3) % dur) + dur) % dur / dur;
        const m = sample(i % 2 === 0 ? ORB_A : ORB_B, p);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: `${o.top}%`,
              left: `${o.left}%`,
              width: `${o.size}%`,
              height: `${o.size * 1.4}%`,
              background: `radial-gradient(closest-side, rgba(${o.color}, ${0.4 * intensity}) 0%, rgba(${o.color}, ${0.16 * intensity}) 45%, transparent 100%)`,
              translate: `${m.x}% ${m.y}%`,
              scale: String(m.s),
            }}
          />
        );
      })}
      {glow ? <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 0%, hsl(252 100% 70% / ${0.3 * intensity}), transparent 60%)` }} /> : null}
    </AbsoluteFill>
  );
};

// Dark canvas with the landing glow: the "clouds" scenes.
export const GlowBg = ({ intensity = 1 }: { intensity?: number }) => (
  <AbsoluteFill style={{ backgroundColor: "hsl(245 35% 7%)", overflow: "hidden" }}>
    <Orbs intensity={intensity} />
    <Grain opacity={0.06} />
  </AbsoluteFill>
);

// Subtle editorial grain (the site uses 5%).
export const Grain = ({ opacity = 0.05 }: { opacity?: number }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: "overlay", pointerEvents: "none" }}>
      <svg width="100%" height="100%">
        <filter id="slideai-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={frame % 8} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#slideai-grain)" />
      </svg>
    </AbsoluteFill>
  );
};
