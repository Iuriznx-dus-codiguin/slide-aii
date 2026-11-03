import type { CSSProperties } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../theme";

type Props = {
  // 0..1, how strong the violet atmosphere is.
  intensity?: number;
  // Seed shifts the glow drift so neighbouring scenes don't look identical.
  seed?: number;
  grid?: boolean;
  style?: CSSProperties;
};

// Dark brand canvas from the og-image: near-black violet with two drifting
// glows (violet top-right, magenta bottom-left) and a faint grid.
export const Backdrop = ({ intensity = 1, seed = 0, grid = true, style }: Props) => {
  const frame = useCurrentFrame();
  const t = (frame + seed * 40) / 30;
  const ax = 72 + Math.sin(t * 0.45) * 5;
  const ay = 18 + Math.cos(t * 0.38) * 6;
  const bx = 14 + Math.cos(t * 0.33) * 5;
  const by = 86 + Math.sin(t * 0.41) * 5;

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, overflow: "hidden", ...style }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 700px at ${ax}% ${ay}%, hsl(252 100% 64% / ${0.42 * intensity}), transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(800px 600px at ${bx}% ${by}%, hsl(290 90% 60% / ${0.3 * intensity}), transparent 70%)`,
        }}
      />
      {grid ? (
        <AbsoluteFill
          style={{
            backgroundImage:
              "linear-gradient(hsl(252 60% 80% / 0.07) 1.5px, transparent 1.5px), linear-gradient(90deg, hsl(252 60% 80% / 0.07) 1.5px, transparent 1.5px)",
            backgroundSize: "120px 120px",
            backgroundPosition: `${(frame * 0.4) % 120}px ${(frame * 0.25) % 120}px`,
            maskImage: "radial-gradient(ellipse 75% 70% at 50% 50%, black 30%, transparent 85%)",
            WebkitMaskImage: "radial-gradient(ellipse 75% 70% at 50% 50%, black 30%, transparent 85%)",
          }}
        />
      ) : null}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse 120% 90% at 50% 50%, transparent 55%, hsl(246 40% 3% / 0.75) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
