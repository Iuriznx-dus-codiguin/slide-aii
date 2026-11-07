import { linearTiming, type TransitionPresentation, type TransitionPresentationComponentProps, type TransitionTiming } from "@remotion/transitions";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import type { TransitionKind } from "./timeline";

// Scene-to-scene transitions. Kept deliberately quiet: crossfades with a touch
// of scale/blur, and true pushes where both scenes move as one camera move.

type Empty = Record<string, never>;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const FadeZoom = ({ children, presentationDirection, presentationProgress: p }: TransitionPresentationComponentProps<Empty>) => {
  if (presentationDirection === "exiting") {
    return (
      <AbsoluteFill style={{ opacity: interpolate(p, [0, 1], [1, 0], clamp), scale: String(1 + p * 0.06), filter: `blur(${p * 10}px)` }}>
        {children}
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ opacity: interpolate(p, [0, 0.8], [0, 1], clamp), scale: String(0.94 + 0.06 * p), filter: `blur(${(1 - p) * 10}px)` }}>
      {children}
    </AbsoluteFill>
  );
};

const FadeBlur = ({ children, presentationDirection, presentationProgress: p }: TransitionPresentationComponentProps<Empty>) => {
  const o = presentationDirection === "exiting" ? 1 - p : p;
  return <AbsoluteFill style={{ opacity: o, filter: `blur(${(1 - o) * 14}px)` }}>{children}</AbsoluteFill>;
};

const Fade = ({ children, presentationDirection, presentationProgress: p }: TransitionPresentationComponentProps<Empty>) => (
  <AbsoluteFill style={{ opacity: presentationDirection === "exiting" ? 1 - p : p }}>{children}</AbsoluteFill>
);

const makePush = (axis: "x" | "y") => {
  const Push = ({ children, presentationDirection, presentationProgress: p }: TransitionPresentationComponentProps<Empty>) => {
    // Both scenes travel together; a little blur at peak speed sells the move.
    const blur = Math.sin(p * Math.PI) * 6;
    const offset = presentationDirection === "exiting" ? -p * 100 : (1 - p) * 100;
    const translate = axis === "x" ? `${offset}% 0` : `0 ${offset}%`;
    return <AbsoluteFill style={{ translate, filter: `blur(${blur}px)` }}>{children}</AbsoluteFill>;
  };
  return Push;
};

const PushLeft = makePush("x");
const PushUp = makePush("y");

const COMPONENTS = {
  fadeZoom: FadeZoom,
  fadeBlur: FadeBlur,
  pushLeft: PushLeft,
  pushUp: PushUp,
  fade: Fade,
} as const;

export const presentationFor = (kind: TransitionKind): TransitionPresentation<Empty> => ({ component: COMPONENTS[kind], props: {} });

export const timingFor = (kind: TransitionKind, frames: number): TransitionTiming =>
  linearTiming({
    durationInFrames: frames,
    easing: kind === "pushLeft" || kind === "pushUp" ? Easing.bezier(0.65, 0, 0.35, 1) : Easing.bezier(0.33, 0, 0.2, 1),
  });
