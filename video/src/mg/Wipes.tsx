import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { tw } from "../anim";
import { Sparkle } from "./Sparkle";
import { EASE } from "../theme";

// Transition overlays for TransitionSeries.Overlay. The cut sits in the middle
// of the overlay, so each one fully covers the frame around that point.

// Staggered skewed colour blocks sweeping left to right.
export const BlockWipe = ({ colors }: { colors: string[] }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const mid = Math.floor(durationInFrames / 2);
  return (
    <AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
      {colors.map((c, i) => {
        const a = tw(frame, [i * 2, i * 2 + 8], [0, 1], EASE.outExpo);
        const b = tw(frame, [mid + 1 + i * 2, mid + 10 + i * 2], [0, 1], EASE.inOut);
        const x = -2500 + a * 2300 + b * 2600;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: -100,
              bottom: -100,
              left: x,
              width: 2700,
              background: c,
              transform: "skewX(-14deg)",
            }}
          />
        );
      })}
      {/* Sparkle riding the leading edge */}
      <div
        style={{
          position: "absolute",
          left: tw(frame, [0, mid], [-200, 900], EASE.outExpo),
          top: 440,
          opacity: tw(frame, [0, 3, mid - 2, mid + 2], [0, 1, 1, 0]),
          rotate: `${frame * 12}deg`,
        }}
      >
        <Sparkle size={200} color="#fff" />
      </div>
    </AbsoluteFill>
  );
};

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
