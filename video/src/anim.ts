import { interpolate, type EasingFunction } from "remotion";
import { BEAT } from "./timeline";

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

// Deterministic pseudo-random in [0, 1) from an integer seed.
export const rand = (seed: number): number => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// 1 on each beat, decaying to 0 before the next one. Scene starts sit on the
// beat grid, so scene-local frames work.
export const beatPulse = (frame: number, decay = 4, every = BEAT): number => {
  if (frame < 0) return 0;
  const local = frame % every;
  return Math.exp(-local / decay);
};

// Progress 0..1 of an entrance that starts at `at` and lasts `dur` frames.
export const enter = (frame: number, at: number, dur: number, easing?: EasingFunction): number =>
  tw(frame, [at, at + dur], [0, 1], easing);
