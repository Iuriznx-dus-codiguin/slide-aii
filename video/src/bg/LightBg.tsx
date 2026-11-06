import { AbsoluteFill, useCurrentFrame } from "remotion";
import { beatPulse, enter, useIsPortrait } from "../anim";
import { Sparkle } from "../mg/Sparkle";
import { EASE, GRADIENT, L } from "../theme";

// The site's main theme: white canvas, violet glow at the top (like
// .bg-gradient-glow), a dotted grid and violet shapes that float, pop in on
// entry and bounce on the beat.

type Shape = {
  kind: "tile" | "ring" | "dot" | "spark" | "pill";
  x: number;
  y: number;
  s: number;
  r: number;
  delay: number;
  depth: number;
};

const SHAPES: Shape[] = [
  { kind: "tile", x: 110, y: 120, s: 92, r: -14, delay: 2, depth: 1.2 },
  { kind: "ring", x: 1700, y: 120, s: 120, r: 0, delay: 5, depth: 0.8 },
  { kind: "spark", x: 1560, y: 860, s: 70, r: 10, delay: 8, depth: 1.4 },
  { kind: "dot", x: 260, y: 900, s: 44, r: 0, delay: 6, depth: 0.7 },
  { kind: "pill", x: 1480, y: 1000, s: 150, r: -12, delay: 10, depth: 1 },
  { kind: "ring", x: 70, y: 560, s: 64, r: 0, delay: 12, depth: 1.5 },
  { kind: "spark", x: 420, y: 70, s: 40, r: -20, delay: 9, depth: 0.6 },
  { kind: "tile", x: 1840, y: 960, s: 60, r: 18, delay: 14, depth: 1.1 },
];

// End card: keep shapes clear of the copy column and the collage.
const SHAPES_END: Shape[] = [
  { kind: "ring", x: 1830, y: 110, s: 110, r: 0, delay: 3, depth: 0.8 },
  { kind: "spark", x: 1250, y: 120, s: 56, r: 10, delay: 6, depth: 1.3 },
  { kind: "tile", x: 1860, y: 520, s: 64, r: 16, delay: 9, depth: 1.1 },
  { kind: "dot", x: 1180, y: 1010, s: 36, r: 0, delay: 12, depth: 0.7 },
  { kind: "spark", x: 1860, y: 980, s: 64, r: -10, delay: 14, depth: 1.2 },
];

// 9:16: shapes hug the top and side edges, clear of the copy column and of
// the bottom area that the Shorts/Reels UI covers.
const SHAPES_V: Shape[] = [
  { kind: "tile", x: 110, y: 150, s: 84, r: -14, delay: 2, depth: 1.2 },
  { kind: "ring", x: 930, y: 150, s: 110, r: 0, delay: 5, depth: 0.8 },
  { kind: "spark", x: 990, y: 760, s: 60, r: 10, delay: 8, depth: 1.4 },
  { kind: "dot", x: 60, y: 1080, s: 40, r: 0, delay: 6, depth: 0.7 },
  { kind: "pill", x: 860, y: 1700, s: 140, r: -12, delay: 10, depth: 1 },
  { kind: "ring", x: 150, y: 1660, s: 70, r: 0, delay: 12, depth: 1.5 },
  { kind: "spark", x: 520, y: 110, s: 40, r: -20, delay: 9, depth: 0.6 },
];

const SHAPES_END_V: Shape[] = [
  { kind: "ring", x: 960, y: 140, s: 100, r: 0, delay: 3, depth: 0.8 },
  { kind: "spark", x: 60, y: 760, s: 50, r: 10, delay: 6, depth: 1.3 },
  { kind: "tile", x: 1020, y: 1000, s: 56, r: 16, delay: 9, depth: 1.1 },
  { kind: "spark", x: 960, y: 1700, s: 60, r: -10, delay: 14, depth: 1.2 },
];

const ShapeEl = ({ kind, s }: { kind: Shape["kind"]; s: number }) => {
  switch (kind) {
    case "tile":
      return <div style={{ width: s, height: s, borderRadius: s * 0.28, background: GRADIENT.primary, boxShadow: "0 18px 40px -12px hsl(252 100% 55% / 0.55)" }} />;
    case "ring":
      return <div style={{ width: s, height: s, borderRadius: 999, border: `${Math.max(6, s * 0.09)}px solid hsl(252 100% 64% / 0.85)` }} />;
    case "dot":
      return <div style={{ width: s, height: s, borderRadius: 999, background: "hsl(280 95% 65%)" }} />;
    case "pill":
      return <div style={{ width: s, height: s * 0.36, borderRadius: 999, background: "hsl(252 100% 92%)", border: "4px solid hsl(252 100% 80%)" }} />;
    case "spark":
      return <Sparkle size={s} color="hsl(262 100% 66%)" />;
  }
};

export const LightBg = ({
  shapes = true,
  layout = "default",
  dots = true,
  glow = 1,
  shapeOpacity = 1,
}: {
  shapes?: boolean;
  layout?: "default" | "end";
  dots?: boolean;
  glow?: number;
  shapeOpacity?: number;
}) => {
  const frame = useCurrentFrame();
  const portrait = useIsPortrait();
  const pulse = beatPulse(frame, 5);
  const t = frame / 30;
  const list = portrait ? (layout === "end" ? SHAPES_END_V : SHAPES_V) : layout === "end" ? SHAPES_END : SHAPES;
  return (
    <AbsoluteFill style={{ backgroundColor: L.bg, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(1200px 620px at 50% -8%, hsl(252 100% 64% / ${0.2 * glow}), transparent 70%), radial-gradient(700px 520px at 100% 100%, hsl(280 95% 65% / ${0.12 * glow}), transparent 70%)`,
        }}
      />
      {dots ? (
        <AbsoluteFill
          style={{
            backgroundImage: "radial-gradient(hsl(252 40% 70% / 0.5) 2.2px, transparent 2.6px)",
            backgroundSize: "44px 44px",
            backgroundPosition: `${(frame * 0.5) % 44}px ${(frame * 0.3) % 44}px`,
            maskImage: "radial-gradient(ellipse 70% 65% at 50% 45%, black 20%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse 70% 65% at 50% 45%, black 20%, transparent 80%)",
          }}
        />
      ) : null}
      {shapes
        ? list.map((sh, i) => {
            const p = enter(frame, sh.delay, 16, EASE.outBack);
            const bob = Math.sin(t * 1.4 + i) * 12 * sh.depth;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: sh.x - sh.s / 2,
                  top: sh.y - sh.s / 2,
                  opacity: shapeOpacity * Math.min(1, p * 1.5),
                  scale: String(p * (1 + pulse * 0.06 * sh.depth)),
                  rotate: `${sh.r + t * 10 * (i % 2 === 0 ? 1 : -1)}deg`,
                  translate: `0 ${bob}px`,
                }}
              >
                <ShapeEl kind={sh.kind} s={sh.s} />
              </div>
            );
          })
        : null}
    </AbsoluteFill>
  );
};
