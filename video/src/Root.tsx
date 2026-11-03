import { Composition } from "remotion";
import { SlideAIAd, adSchema } from "./SlideAIAd";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./timeline";

export const RemotionRoot = () => (
  <Composition
    id="SlideAIYouTubeAd"
    component={SlideAIAd}
    schema={adSchema}
    durationInFrames={DURATION_IN_FRAMES}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
    defaultProps={{
      // Single-generation price from src/lib/cakto.ts (PLAN_AMOUNTS_CENTS.single).
      price: "A partir de R$ 14,90",
      url: "slideai.com.br",
      withAudio: true,
    }}
  />
);
