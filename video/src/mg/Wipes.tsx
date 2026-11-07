import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { tw } from "../anim";
import { EASE } from "../theme";

// Transition overlays for TransitionSeries.Overlay. The cut sits in the middle
// of the overlay, so each one fully covers the frame around that point.

// Circle that opens from (x, y) in `color`, then fades once the next scene
// (same colour) is underneath.
export const IrisWipe = ({ color, x, y }: { color: string; x: number; y: number }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const mid = Math.floor(durationInFrames / 2);
  const r = tw(frame, [0, mid], [0, 2300], EASE.inOut);
  const o = tw(frame, [mid, durationInFrames], [1, 0]);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: o }}>
      <div style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: "50%", background: color }} />
    </AbsoluteFill>
  );
};
