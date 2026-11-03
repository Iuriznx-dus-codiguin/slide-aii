import { interpolate, type EasingFunction } from "remotion";

// Clamped interpolate with an easing. Keeps scene code short.
export const tw = (
  frame: number,
  input: readonly number[],
  output: readonly number[],
  easing?: EasingFunction,
): number =>
  interpolate(frame, [...input], [...output], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

// Multi-stop clamped interpolate.
export const tws = (frame: number, input: number[], output: number[], easing?: EasingFunction): number =>
  interpolate(frame, input, output, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

// Deterministic pseudo-random in [0, 1) from an integer seed.
export const rand = (seed: number): number => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
