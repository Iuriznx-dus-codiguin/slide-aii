// Single source of truth for scene timing. The video (TransitionSeries), the
// sound-effect cues and the music generator (scripts/make-music.mjs) all read
// these numbers, so a change here keeps picture and sound in sync.

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

type SceneId = "hook" | "brand" | "prompt" | "reveal" | "chat" | "export" | "cta";

type SceneSpec = {
  id: SceneId;
  duration: number;
  // Overlap with the next scene (0 = hard cut).
  transitionOut: number;
};

export const SCENES: readonly SceneSpec[] = [
  { id: "hook", duration: 90, transitionOut: 0 },
  { id: "brand", duration: 90, transitionOut: 12 },
  { id: "prompt", duration: 186, transitionOut: 14 },
  { id: "reveal", duration: 190, transitionOut: 12 },
  { id: "chat", duration: 150, transitionOut: 10 },
  { id: "export", duration: 100, transitionOut: 14 },
  { id: "cta", duration: 156, transitionOut: 0 },
];

const starts: Record<SceneId, number> = {} as Record<SceneId, number>;
{
  let cursor = 0;
  for (const s of SCENES) {
    starts[s.id] = cursor;
    cursor += s.duration - s.transitionOut;
  }
}

export const SCENE_START = starts;

export const DURATION_IN_FRAMES = SCENES.reduce(
  (acc, s) => acc + s.duration - s.transitionOut,
  0,
);

export const sceneDuration = (id: SceneId): number => {
  const s = SCENES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scene ${id}`);
  return s.duration;
};

// Scene-local moments that other layers (SFX) need to hit.
export const MOMENTS = {
  hookTicks: [8, 38, 68],
  promptTypeStart: 20,
  promptTypeEnd: 80,
  promptClick: 94,
  promptSteps: [112, 128, 144, 160],
  revealCardsStart: 6,
  revealCardStagger: 5,
  chatUserMsg: 14,
  chatReply: 64,
  chatMorph: 70,
  exportTiles: [17, 25, 32, 40],
  ctaButton: 40,
} as const;
