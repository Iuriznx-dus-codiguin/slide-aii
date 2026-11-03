import { Audio } from "@remotion/media";
import { Sequence, interpolate, staticFile } from "remotion";
import { DURATION_IN_FRAMES, MOMENTS, SCENE_START } from "./timeline";

// Music bed (synthesised by scripts/make-music.mjs, which also carries the
// impacts, risers and whooshes on every cut) + UI sound effects, all placed on
// absolute frames from the shared timeline.

type Cue = { at: number; src: string; volume: number; name: string };

const S = SCENE_START;
const M = MOMENTS;

const cues: Cue[] = [
  // Prompt: typing, click, stage checks
  ...Array.from({ length: Math.floor((M.promptTypeEnd - M.promptTypeStart) / 3) }, (_, i) => ({
    at: S.prompt + M.promptTypeStart + i * 3,
    src: "sfx/key.wav",
    volume: 0.45,
    name: `tecla ${i + 1}`,
  })),
  { at: S.prompt + M.promptClick - 1, src: "sfx/button.wav", volume: 0.85, name: "clique gerar" },
  ...M.promptStages.map((t, i) => ({ at: S.prompt + t, src: "sfx/check.wav", volume: 0.6, name: `etapa ${i + 1}` })),

  // Demo: slides land, callouts pop
  { at: S.demo + M.demoCards, src: "sfx/deck-fan.wav", volume: 0.9, name: "slides" },
  { at: S.demo + M.demoCards + 7 * M.demoCardStagger + 10, src: "sfx/card-place.wav", volume: 0.7, name: "último slide" },
  ...M.demoCallouts.map((t, i) => ({ at: S.demo + t + 11, src: "sfx/check.wav", volume: 0.45, name: `chamada ${i + 1}` })),

  // Audience: word rolls
  ...M.audienceSwaps.slice(1).map((t, i) => ({ at: S.audience + t - 2, src: "sfx/tile.wav", volume: 0.35, name: `troca ${i + 1}` })),

  // Features
  { at: S.features + M.featureHits[0] + M.featureChatMsg, src: "sfx/send.wav", volume: 0.7, name: "mensagem" },
  { at: S.features + M.featureHits[0] + M.featureChatMorph, src: "sfx/morph.wav", volume: 0.6, name: "lista vira gráfico" },
  { at: S.features + M.featureExportBurst, src: "sfx/card-slide-a.wav", volume: 0.7, name: "formatos" },

  // End card
  { at: S.endcard + M.endButton, src: "sfx/button.wav", volume: 0.45, name: "botão aparece" },
  { at: S.endcard + M.endClick - 1, src: "sfx/button.wav", volume: 0.85, name: "clique cta" },
  { at: S.endcard + M.endClick + 3, src: "sfx/reply.wav", volume: 0.5, name: "confirmação" },
];

export const SoundTrack = () => (
  <>
    <Audio
      src={staticFile("audio/music.mp3")}
      volume={(f) => interpolate(f, [0, 3, DURATION_IN_FRAMES - 12, DURATION_IN_FRAMES], [0, 0.68, 0.68, 0], { extrapolateRight: "clamp" })}
    />
    {cues.map((c) => (
      <Sequence key={c.name} from={c.at} durationInFrames={45} name={c.name} layout="none">
        <Audio src={staticFile(c.src)} volume={c.volume} />
      </Sequence>
    ))}
  </>
);
