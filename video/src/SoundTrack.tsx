import { Audio } from "@remotion/media";
import { Sequence, interpolate, staticFile } from "remotion";
import { DURATION_IN_FRAMES, MOMENTS, SCENE_START } from "./timeline";

// Music bed + sound effects, placed on absolute frames derived from the same
// timeline the picture uses.

type Cue = { at: number; src: string; volume: number; name: string };

const S = SCENE_START;

const cues: Cue[] = [
  // Demo: typing, click, generation steps
  ...Array.from({ length: Math.floor((MOMENTS.promptTypeEnd - MOMENTS.promptTypeStart) / 3) }, (_, i) => ({
    at: S.prompt + MOMENTS.promptTypeStart + i * 3,
    src: "sfx/key.wav",
    volume: 0.5,
    name: `key ${i + 1}`,
  })),
  { at: S.prompt + MOMENTS.promptClick - 1, src: "sfx/button.wav", volume: 0.8, name: "click gerar" },
  ...MOMENTS.promptSteps.map((t, i) => ({ at: S.prompt + t, src: "sfx/check.wav", volume: 0.55, name: `step ${i + 1}` })),

  // Reveal: deck fans out, last card lands
  { at: S.reveal + MOMENTS.revealCardsStart, src: "sfx/deck-fan.wav", volume: 0.9, name: "deck fan" },
  { at: S.reveal + MOMENTS.revealCardsStart + 12, src: "sfx/card-slide-a.wav", volume: 0.55, name: "card slide" },
  { at: S.reveal + MOMENTS.revealCardsStart + 7 * MOMENTS.revealCardStagger + 10, src: "sfx/card-place.wav", volume: 0.7, name: "card place" },

  // Chat edit
  { at: S.chat + MOMENTS.chatUserMsg, src: "sfx/send.wav", volume: 0.7, name: "send" },
  { at: S.chat + MOMENTS.chatReply, src: "sfx/reply.wav", volume: 0.5, name: "reply" },
  { at: S.chat + MOMENTS.chatMorph, src: "sfx/morph.wav", volume: 0.6, name: "morph" },

  // Export tiles on the beat
  ...MOMENTS.exportTiles.map((t, i) => ({ at: S.export + t, src: "sfx/tile.wav", volume: 0.35, name: `tile ${i + 1}` })),

  // CTA button
  { at: S.cta + MOMENTS.ctaButton, src: "sfx/button.wav", volume: 0.6, name: "cta button" },
];

export const SoundTrack = () => (
  <>
    <Audio
      src={staticFile("audio/music.mp3")}
      volume={(f) => interpolate(f, [0, 6, DURATION_IN_FRAMES - 20, DURATION_IN_FRAMES], [0, 0.8, 0.8, 0], { extrapolateRight: "clamp" })}
    />
    {cues.map((c) => (
      <Sequence key={c.name} from={c.at} durationInFrames={45} name={c.name} layout="none">
        <Audio src={staticFile(c.src)} volume={c.volume} />
      </Sequence>
    ))}
  </>
);
