import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { Brand } from "./scenes/Brand";
import { Chat } from "./scenes/Chat";
import { Cta } from "./scenes/Cta";
import { Export } from "./scenes/Export";
import { Hook } from "./scenes/Hook";
import { Prompt } from "./scenes/Prompt";
import { Reveal } from "./scenes/Reveal";
import { SoundTrack } from "./SoundTrack";
import { C } from "./theme";
import { SCENES, sceneDuration } from "./timeline";
import { iris, whip, zoomThrough } from "./transitions";

export const adSchema = z.object({
  price: z.string(),
  url: z.string(),
  withAudio: z.boolean(),
});

export type AdProps = z.infer<typeof adSchema>;

const t = (id: (typeof SCENES)[number]["id"]) => {
  const s = SCENES.find((x) => x.id === id);
  return linearTiming({ durationInFrames: s ? s.transitionOut : 1 });
};

export const SlideAIAd = ({ price, url, withAudio }: AdProps) => (
  <AbsoluteFill style={{ backgroundColor: C.bg }}>
    <TransitionSeries>
      <TransitionSeries.Sequence name="1 Hook" durationInFrames={sceneDuration("hook")}>
        <Hook />
      </TransitionSeries.Sequence>
      {/* hard cut */}
      <TransitionSeries.Sequence name="2 Marca" durationInFrames={sceneDuration("brand")}>
        <Brand />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={zoomThrough()} timing={t("brand")} />
      <TransitionSeries.Sequence name="3 Prompt e geração" durationInFrames={sceneDuration("prompt")}>
        <Prompt />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={zoomThrough()} timing={t("prompt")} />
      <TransitionSeries.Sequence name="4 Slides prontos" durationInFrames={sceneDuration("reveal")}>
        <Reveal />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={whip()} timing={t("reveal")} />
      <TransitionSeries.Sequence name="5 Ajuste por chat" durationInFrames={sceneDuration("chat")}>
        <Chat />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={whip()} timing={t("chat")} />
      <TransitionSeries.Sequence name="6 Exportação" durationInFrames={sceneDuration("export")}>
        <Export />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={iris()} timing={t("export")} />
      <TransitionSeries.Sequence name="7 CTA" durationInFrames={sceneDuration("cta")}>
        <Cta price={price} url={url} />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    {withAudio ? <SoundTrack /> : null}
  </AbsoluteFill>
);
