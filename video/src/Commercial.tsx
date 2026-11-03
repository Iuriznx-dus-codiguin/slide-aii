import { TransitionSeries } from "@remotion/transitions";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { BlockWipe, IrisWipe } from "./mg/Wipes";
import { Audience } from "./scenes/Audience";
import { Brand } from "./scenes/Brand";
import { Demo } from "./scenes/Demo";
import { EndCard } from "./scenes/EndCard";
import { Features } from "./scenes/Features";
import { Hook } from "./scenes/Hook";
import { Prompt } from "./scenes/Prompt";
import { Tagline } from "./scenes/Tagline";
import { SoundTrack } from "./SoundTrack";
import { sceneDuration } from "./timeline";

export const commercialSchema = z.object({
  price: z.string(),
  discount: z.string(),
  url: z.string(),
  withAudio: z.boolean(),
});

export type CommercialProps = z.infer<typeof commercialSchema>;

const PURPLE_WIPE = ["hsl(290 90% 65%)", "hsl(270 95% 60%)", "hsl(252 100% 64%)"];
const DARK_WIPE = ["hsl(252 100% 64%)", "hsl(255 70% 25%)", "hsl(250 50% 3%)"];

export const Commercial = ({ price, discount, url, withAudio }: CommercialProps) => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <TransitionSeries>
      <TransitionSeries.Sequence name="1 Hook (grade)" durationInFrames={sceneDuration("hook")}>
        <Hook />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="2 Marca (nebulosa)" durationInFrames={sceneDuration("brand")}>
        <Brand />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="3 Prompt (claro)" durationInFrames={sceneDuration("prompt")}>
        <Prompt />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="4 Slides prontos (claro)" durationInFrames={sceneDuration("demo")}>
        <Demo />
      </TransitionSeries.Sequence>
      <TransitionSeries.Overlay durationInFrames={20}>
        <BlockWipe colors={PURPLE_WIPE} />
      </TransitionSeries.Overlay>
      <TransitionSeries.Sequence name="5 Públicos" durationInFrames={sceneDuration("audience")}>
        <Audience />
      </TransitionSeries.Sequence>
      <TransitionSeries.Overlay durationInFrames={20}>
        <BlockWipe colors={DARK_WIPE} />
      </TransitionSeries.Overlay>
      <TransitionSeries.Sequence name="6 Recursos (grade)" durationInFrames={sceneDuration("features")}>
        <Features />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="7 Assinatura (nebulosa)" durationInFrames={sceneDuration("tagline")}>
        <Tagline />
      </TransitionSeries.Sequence>
      <TransitionSeries.Overlay durationInFrames={20}>
        <IrisWipe color="#fff" x={960} y={560} />
      </TransitionSeries.Overlay>
      <TransitionSeries.Sequence name="8 Cartela final (claro)" durationInFrames={sceneDuration("endcard")}>
        <EndCard price={price} discount={discount} url={url} />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    {withAudio ? <SoundTrack /> : null}
  </AbsoluteFill>
);
