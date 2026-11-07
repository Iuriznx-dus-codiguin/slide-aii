import { Composition, Folder } from "remotion";
import { PLAN_PRICES } from "../../src/lib/cakto";
import { Commercial, commercialSchema } from "./Commercial";
import { HERO_LOOP, HeroLoop, heroLoopSchema } from "./landing/HeroLoop";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./timeline";

// Entry price comes from the app's price table (single purchase). The PRO
// discount is the figure the team publishes for the campaign ("até 64%");
// the repository's price table alone does not produce it, so it lives here
// as an editable prop.
const OFFER = {
  price: `A partir de ${PLAN_PRICES.single}`,
  discount: "PRO com até 64% OFF",
};

const PROPS = { ...OFFER, url: "slideai.com.br", withAudio: true, withVoice: true };

export const RemotionRoot = () => (
  <>
    {/* 16:9 for YouTube in-stream */}
    <Composition
      id="SlideAIComercial"
      component={Commercial}
      schema={commercialSchema}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={PROPS}
    />
    {/* 9:16 for Shorts, Reels and TikTok: same timeline, mobile layouts */}
    <Composition
      id="SlideAIComercialVertical"
      component={Commercial}
      schema={commercialSchema}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={HEIGHT}
      height={WIDTH}
      defaultProps={PROPS}
    />
    {/* Seamless loop for the landing page hero mockup */}
    <Folder name="Landing">
      <Composition id="LandingHeroLoop" component={HeroLoop} schema={heroLoopSchema} {...HERO_LOOP} defaultProps={{ transparent: false }} />
    </Folder>
  </>
);
