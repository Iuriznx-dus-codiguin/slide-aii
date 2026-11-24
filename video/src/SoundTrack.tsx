import { Audio } from "@remotion/media";
import { Sequence, interpolate, staticFile } from "remotion";
import { DURATION_IN_FRAMES, FPS, MOMENTS, SCENE_START, VOICE_LINES, voiceStart } from "./timeline";
import voice from "./voice.json";

// Mix: music bed (scripts/make-music.mjs), male narration (VoiceStudio /
// OmniVoice clips listed in src/voice.json, rendered by scripts/make-voice.py)
// and UI sound effects. The music ducks under every narration line.

type Cue = { at: number; src: string; volume: number; name: string };

const S = SCENE_START;
const M = MOMENTS;
const clips = voice.clips as Record<string, number>;

const cues: Cue[] = [
  // Prompt: typing, click, stage checks
  ...Array.from({ length: Math.floor((M.promptTypeEnd - M.promptTypeStart) / 3) }, (_, i) => ({
    at: S.prompt + M.promptTypeStart + i * 3,
    src: "sfx/key.wav",
    volume: 0.3,
    name: `tecla ${i + 1}`,
  })),
  { at: S.prompt + M.promptClick - 1, src: "sfx/button.wav", volume: 0.55, name: "clique gerar" },
  ...M.promptStages.map((t, i) => ({ at: S.prompt + t, src: "sfx/check.wav", volume: 0.35, name: `etapa ${i + 1}` })),

  // Demo: slides land, callouts
  { at: S.demo + M.demoCards, src: "sfx/deck-fan.wav", volume: 0.55, name: "slides" },
  ...M.demoCallouts.map((t, i) => ({ at: S.demo + t + 11, src: "sfx/check.wav", volume: 0.25, name: `chamada ${i + 1}` })),

  // Audience: word rolls
  ...M.audienceSwaps.slice(1).map((t, i) => ({ at: S.audience + t - 2, src: "sfx/tile.wav", volume: 0.22, name: `troca ${i + 1}` })),

  // Features
  { at: S.features + M.featureHits[0] + M.featureChatMsg, src: "sfx/send.wav", volume: 0.45, name: "mensagem" },
  { at: S.features + M.featureHits[0] + M.featureChatMorph, src: "sfx/morph.wav", volume: 0.35, name: "lista vira gráfico" },
  { at: S.features + M.featureExportBurst, src: "sfx/card-slide-a.wav", volume: 0.4, name: "formatos" },

  // End card
  { at: S.endcard + M.endClick - 1, src: "sfx/button.wav", volume: 0.45, name: "clique cta" },
];

export const SoundTrack = ({ withVoice }: { withVoice: boolean }) => {
  const lines = withVoice ? VOICE_LINES.filter((l) => clips[l.id] !== undefined) : [];
  const spans = lines.map((l) => {
    const start = voiceStart(l);
    return { start, end: start + Math.ceil(clips[l.id] * FPS) };
  });
  // 0..1: how much a narration line is sounding at frame f (smooth edges).
  const voiceAt = (f: number) =>
    spans.reduce((acc, s) => Math.max(acc, interpolate(f, [s.start - 6, s.start, s.end, s.end + 12], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })), 0);
  const base = lines.length > 0 ? 0.6 : 0.68;

  return (
    <>
      <Audio
        src={staticFile("audio/music.mp3")}
        volume={(f) =>
          base *
          (1 - 0.55 * voiceAt(f)) *
          interpolate(f, [0, 3, DURATION_IN_FRAMES - 12, DURATION_IN_FRAMES], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
        }
      />
      {lines.map((l) => (
        <Sequence key={l.id} from={voiceStart(l)} durationInFrames={Math.ceil(clips[l.id] * FPS) + 6} name={`voz ${l.id}`} layout="none">
          <Audio src={staticFile(`voice/${l.id}.wav`)} volume={1} />
        </Sequence>
      ))}
      {cues.map((c) => (
        <Sequence key={c.name} from={c.at} durationInFrames={45} name={c.name} layout="none">
          <Audio src={staticFile(c.src)} volume={c.volume} />
        </Sequence>
      ))}
    </>
  );
};
