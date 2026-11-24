import { TransitionSeries } from "@remotion/transitions";
import { Fragment, type ReactNode } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { z } from "zod";
import { IrisWipe } from "./mg/Wipes";
import { Audience } from "./scenes/Audience";
import { Brand } from "./scenes/Brand";
import { Demo } from "./scenes/Demo";
import { EndCard } from "./scenes/EndCard";
import { Features } from "./scenes/Features";
import { Hook } from "./scenes/Hook";
import { Prompt } from "./scenes/Prompt";
import { Tagline } from "./scenes/Tagline";
import { SoundTrack } from "./SoundTrack";
import { SCENES, type SceneId } from "./timeline";
import { presentationFor, timingFor } from "./transitions";

export const commercialSchema = z.object({
  price: z.string(),
  discount: z.string(),
  url: z.string(),
  withAudio: z.boolean(),
  withVoice: z.boolean(),
});

export type CommercialProps = z.infer<typeof commercialSchema>;

const NAMES: Record<SceneId, string> = {
  hook: "1 Hook (grade)",
  brand: "2 Marca (brilho roxo)",
  prompt: "3 Prompt (claro)",
  demo: "4 Slides prontos (claro)",
  audience: "5 Públicos",
  features: "6 Recursos (grade)",
  tagline: "7 Assinatura (brilho roxo)",
  endcard: "8 Cartela final (claro)",
};

// One component for both formats: every scene reads the composition size and
// lays itself out for 16:9 or 9:16; timing, narration, music and effects are
// shared.
export const Commercial = ({ price, discount, url, withAudio, withVoice }: CommercialProps) => {
  const { width, height } = useVideoConfig();
  const scene = (id: SceneId): ReactNode => {
    switch (id) {
      case "hook":
        return <Hook />;
      case "brand":
        return <Brand />;
      case "prompt":
        return <Prompt />;
      case "demo":
        return <Demo />;
      case "audience":
        return <Audience />;
      case "features":
        return <Features />;
      case "tagline":
        return <Tagline />;
      case "endcard":
        return <EndCard price={price} discount={discount} url={url} />;
    }
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <TransitionSeries>
        {SCENES.map((s) => (
          <Fragment key={s.id}>
            <TransitionSeries.Sequence name={NAMES[s.id]} durationInFrames={s.duration}>
              {scene(s.id)}
            </TransitionSeries.Sequence>
            {s.out ? <TransitionSeries.Transition presentation={presentationFor(s.out.kind)} timing={timingFor(s.out.kind, s.out.frames)} /> : null}
            {s.id === "tagline" ? (
              <TransitionSeries.Overlay durationInFrames={20}>
                <IrisWipe color="#fff" x={width / 2} y={height / 2} />
              </TransitionSeries.Overlay>
            ) : null}
          </Fragment>
        ))}
      </TransitionSeries>
      {withAudio ? <SoundTrack withVoice={withVoice} /> : null}
    </AbsoluteFill>
  );
};
