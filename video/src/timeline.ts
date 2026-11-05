// Single source of truth for timing. Scenes are laid end to end (no overlap)
// and every boundary falls on a beat of the 100 BPM track, so the video, the
// sound effects and the music generator (scripts/make-music.mjs) stay locked.
//
// Pacing rule for this cut: every line of copy stays on screen, fully
// settled, for at least one second before anything replaces it.

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const BPM = 100;
export const BEAT = (FPS * 60) / BPM; // 18 frames
export const BAR = BEAT * 4; // 72 frames

export type SceneId = "hook" | "brand" | "prompt" | "demo" | "audience" | "features" | "tagline" | "endcard";

export const SCENES: readonly { id: SceneId; duration: number }[] = [
  { id: "hook", duration: BEAT * 8 }, // 4.8 s
  { id: "brand", duration: BEAT * 7 }, // 4.2 s
  { id: "prompt", duration: BEAT * 11 }, // 6.6 s
  { id: "demo", duration: BEAT * 12 }, // 7.2 s
  { id: "audience", duration: BEAT * 12 }, // 7.2 s
  { id: "features", duration: BEAT * 12 }, // 7.2 s
  { id: "tagline", duration: BEAT * 5 }, // 3.0 s
  { id: "endcard", duration: BEAT * 8 }, // 4.8 s
];

export const SCENE_START = (() => {
  const out = {} as Record<SceneId, number>;
  let cursor = 0;
  for (const s of SCENES) {
    out[s.id] = cursor;
    cursor += s.duration;
  }
  return out;
})();

export const DURATION_IN_FRAMES = SCENES.reduce((acc, s) => acc + s.duration, 0);

export const sceneDuration = (id: SceneId): number => {
  const s = SCENES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scene ${id}`);
  return s.duration;
};

// Scene-local moments shared by picture, SFX and music.
export const MOMENTS = {
  hookCuts: [0, BEAT * 4],
  brandIris: BEAT * 6 - 6,
  promptTypeStart: 24,
  promptTypeEnd: 78,
  promptClick: BEAT * 5, // 90
  promptStages: [112, 134, 156],
  promptBurst: 180,
  demoCards: 0,
  demoCardStagger: 6,
  demoShot2: BEAT * 6, // 108
  demoCallouts: [124, 138, 152, 166],
  audienceSwaps: [0, BEAT * 3, BEAT * 6, BEAT * 9],
  featureHits: [0, BEAT * 4, BEAT * 8],
  featureChatMsg: 14,
  featureChatMorph: 34,
  featureExportBurst: BEAT * 8 + 26,
  endButton: 30,
  endClick: 96,
} as const;
