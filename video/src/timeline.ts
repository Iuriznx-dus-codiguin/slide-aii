// Single source of truth for timing. Scenes are laid end to end (no overlap)
// and every boundary falls on a beat of the 120 BPM track, so the video, the
// sound effects and the music generator (scripts/make-music.mjs) stay locked.

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const BPM = 120;
export const BEAT = (FPS * 60) / BPM; // 15 frames
export const BAR = BEAT * 4; // 60 frames

export type SceneId = "hook" | "brand" | "prompt" | "demo" | "audience" | "features" | "tagline" | "endcard";

export const SCENES: readonly { id: SceneId; duration: number }[] = [
  { id: "hook", duration: 120 },
  { id: "brand", duration: 90 },
  { id: "prompt", duration: 120 },
  { id: "demo", duration: 120 },
  { id: "audience", duration: 120 },
  { id: "features", duration: 150 },
  { id: "tagline", duration: 60 },
  { id: "endcard", duration: 120 },
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
  hookCuts: [0, 30, 60, 90],
  brandHit: 0,
  brandIris: 74,
  promptTypeStart: 16,
  promptTypeEnd: 52,
  promptClick: 60,
  promptStages: [70, 82, 94],
  promptBurst: 108,
  demoCards: 0,
  demoCardStagger: 4,
  demoShot2: 60,
  demoCallouts: [66, 74, 82, 90],
  audienceSwaps: [0, 30, 60, 90],
  featureHits: [0, 45, 90],
  featureChatMsg: 8,
  featureChatMorph: 22,
  featureExportBurst: 104,
  taglineIris: 48,
  endButton: 24,
  endClick: 72,
} as const;
