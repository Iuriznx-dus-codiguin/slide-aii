import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { AbsoluteFill, interpolate } from "remotion";

type Empty = Record<string, never>;

// Zoom-through with blur (HyperFrames "Zoom through"): exit accelerates
// forward, entry decelerates from slightly behind the camera.
const ZoomThrough = ({ children, presentationDirection, presentationProgress: p }: TransitionPresentationComponentProps<Empty>) => {
  if (presentationDirection === "exiting") {
    return (
      <AbsoluteFill
        style={{
          scale: String(1 + p * p * 0.35),
          filter: `blur(${p * 24}px)`,
          opacity: interpolate(p, [0.4, 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        {children}
      </AbsoluteFill>
    );
  }
  const q = 1 - Math.pow(1 - p, 3);
  return (
    <AbsoluteFill style={{ scale: String(0.78 + 0.22 * q), filter: `blur(${(1 - q) * 22}px)`, opacity: interpolate(p, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }) }}>
      {children}
    </AbsoluteFill>
  );
};

export const zoomThrough = (): TransitionPresentation<Empty> => ({ component: ZoomThrough, props: {} });

// Whip pan (velocity-matched): exit with ease-in, entry with ease-out, both
// blurred so the fastest point meets at the cut.
const Whip = ({ children, presentationDirection, presentationProgress: p }: TransitionPresentationComponentProps<Empty>) => {
  if (presentationDirection === "exiting") {
    const e = p * p * p;
    return (
      <AbsoluteFill style={{ translate: `${-e * 45}% 0`, filter: `blur(${e * 26}px)`, opacity: 1 - e * 0.6 }}>{children}</AbsoluteFill>
    );
  }
  const q = 1 - Math.pow(1 - p, 3);
  return (
    <AbsoluteFill style={{ translate: `${(1 - q) * 45}% 0`, filter: `blur(${(1 - q) * 26}px)` }}>{children}</AbsoluteFill>
  );
};

export const whip = (): TransitionPresentation<Empty> => ({ component: Whip, props: {} });

// Iris: the incoming scene opens as a growing circle.
const Iris = ({ children, presentationDirection, presentationProgress: p }: TransitionPresentationComponentProps<Empty>) => {
  if (presentationDirection === "exiting") {
    return <AbsoluteFill style={{ scale: String(1 + p * 0.08), filter: `blur(${p * 8}px)` }}>{children}</AbsoluteFill>;
  }
  const q = 1 - Math.pow(1 - p, 3);
  return <AbsoluteFill style={{ clipPath: `circle(${q * 125}% at 83% 63%)` }}>{children}</AbsoluteFill>;
};

export const iris = (): TransitionPresentation<Empty> => ({ component: Iris, props: {} });
