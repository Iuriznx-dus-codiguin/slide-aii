// Single source of truth for timing. Picture (TransitionSeries), narration,
// sound effects and the music generator (scripts/make-music.mjs) all read
// these numbers, so a change here keeps everything locked.
//
// 40 s at 112.5 BPM (16 frames per beat). Scenes overlap during their
// transitions; every scene *start* still lands on a beat.

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const BPM = 112.5;
export const BEAT = (FPS * 60) / BPM; // 16 frames
export const BAR = BEAT * 4; // 64 frames

export type SceneId = "hook" | "brand" | "prompt" | "demo" | "audience" | "features" | "tagline" | "endcard";

export type TransitionKind = "fadeZoom" | "fadeBlur" | "pushLeft" | "pushUp" | "fade";

type SceneSpec = {
  id: SceneId;
  duration: number;
  // Transition into the next scene (overlapping frames). Absent = hard cut
  // (the scene handles its own exit, e.g. the white iris).
  out?: { kind: TransitionKind; frames: number };
};

export const SCENES: readonly SceneSpec[] = [
  { id: "hook", duration: 140, out: { kind: "fadeZoom", frames: 12 } },
  { id: "brand", duration: 96 },
  { id: "prompt", duration: 188, out: { kind: "fadeBlur", frames: 12 } },
  { id: "demo", duration: 190, out: { kind: "pushLeft", frames: 14 } },
  { id: "audience", duration: 206, out: { kind: "pushUp", frames: 14 } },
  { id: "features", duration: 204, out: { kind: "fade", frames: 12 } },
  { id: "tagline", duration: 80 },
  { id: "endcard", duration: 160 },
];

export const SCENE_START = (() => {
  const out = {} as Record<SceneId, number>;
  let cursor = 0;
  for (const s of SCENES) {
    out[s.id] = cursor;
    cursor += s.duration - (s.out?.frames ?? 0);
  }
  return out;
})();

const last = SCENES[SCENES.length - 1];
export const DURATION_IN_FRAMES = SCENE_START[last.id] + last.duration; // 1200

export const sceneDuration = (id: SceneId): number => {
  const s = SCENES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scene ${id}`);
  return s.duration;
};

// Scene-local moments shared by picture, narration, SFX and music.
export const MOMENTS = {
  hookCuts: [0, BEAT * 4],
  brandIris: 72,
  promptTypeStart: 14,
  promptTypeEnd: 50,
  promptClick: BEAT * 5, // 80
  promptStages: [98, 114, 130],
  demoCards: 0,
  demoCardStagger: 5,
  demoShot2: BEAT * 6, // 96
  demoCallouts: [108, 120, 132, 144],
  audienceSwaps: [0, BEAT * 3, BEAT * 6, BEAT * 9],
  featureHits: [0, BEAT * 4, BEAT * 8],
  featureChatMsg: 10,
  featureChatMorph: 26,
  featureExportBurst: BEAT * 8 + 18,
  endButton: 24,
  endClick: 96,
} as const;

// Narration (male voice, VoiceStudio / OmniVoice). `text` is what is said
// (phonetic spelling for brand, acronyms and the URL); `at` is the scene-local
// start frame; `max` is the slot length in frames the clip must fit.
export const VOICE_LINES: readonly { id: string; scene: SceneId; at: number; max: number; text: string }[] = [
  { id: "vo01", scene: "hook", at: 6, max: 54, text: "Apresentação pra amanhã?" },
  { id: "vo02", scene: "hook", at: 68, max: 62, text: "Resolva em menos de um minuto." },
  { id: "vo03", scene: "brand", at: 22, max: 70, text: "Conheça o Slaid Ei Ai." },
  { id: "vo04", scene: "prompt", at: 10, max: 66, text: "Você descreve o tema." },
  { id: "vo05", scene: "prompt", at: 84, max: 88, text: "E a IA escreve, desenha e ilustra." },
  { id: "vo06", scene: "demo", at: 8, max: 88, text: "Pronto: oito slides em menos de um minuto." },
  { id: "vo07", scene: "demo", at: 100, max: 74, text: "Roteiro, design, imagens e gráficos." },
  { id: "vo08", scene: "audience", at: 4, max: 42, text: "Pra sua aula," },
  { id: "vo09", scene: "audience", at: 52, max: 42, text: "seu tê cê cê," },
  { id: "vo10", scene: "audience", at: 100, max: 42, text: "sua reunião," },
  { id: "vo11", scene: "audience", at: 148, max: 44, text: "ou seu pitch." },
  { id: "vo12", scene: "features", at: 6, max: 58, text: "Ajuste tudo conversando." },
  { id: "vo13", scene: "features", at: 70, max: 58, text: "Tenha as falas prontas." },
  { id: "vo14", scene: "features", at: 130, max: 66, text: "E exporte em pauer point, pê dê éfe ou link." },
  { id: "vo15", scene: "tagline", at: 8, max: 84, text: "Sua próxima apresentação está a um prompt de distância." },
  { id: "vo16", scene: "endcard", at: 12, max: 62, text: "Crie apresentações incríveis com IA." },
  { id: "vo17", scene: "endcard", at: 76, max: 76, text: "Slaid Ei Ai ponto com ponto bê erre." },
];

export const voiceStart = (line: (typeof VOICE_LINES)[number]): number => SCENE_START[line.scene] + line.at;
