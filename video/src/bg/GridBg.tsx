import { AbsoluteFill, useCurrentFrame } from "remotion";
import { beatPulse } from "../anim";
import { Orbs } from "./Orbs";

// Black canvas covered edge to edge by an even purple grid. The grid drifts
// slowly and its lines brighten a little on each beat; the landing page's
// soft violet orbs glow underneath for depth.

export const GridBg = ({ cell = 88, orbs = 0.55 }: { cell?: number; orbs?: number }) => {
  const frame = useCurrentFrame();
  const pulse = beatPulse(frame, 6);
  const a = 0.2 + pulse * 0.03;
  const drift = (frame * 0.35) % cell;
  return (
    <AbsoluteFill style={{ backgroundColor: "hsl(250 45% 4%)", overflow: "hidden" }}>
      <Orbs intensity={orbs} />
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(hsl(262 100% 72% / ${a}) 2px, transparent 2px), linear-gradient(90deg, hsl(262 100% 72% / ${a}) 2px, transparent 2px)`,
          backgroundSize: `${cell}px ${cell}px`,
          backgroundPosition: `${drift}px ${drift * 0.5}px`,
        }}
      />
      {/* Brighter dots on the grid intersections */}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(hsl(262 100% 80% / ${0.32 + pulse * 0.08}) 2.5px, transparent 3px)`,
          backgroundSize: `${cell}px ${cell}px`,
          backgroundPosition: `${drift - cell / 2 + 1}px ${drift * 0.5 - cell / 2 + 1}px`,
        }}
      />
    </AbsoluteFill>
  );
};
