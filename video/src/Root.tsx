import { Composition } from "remotion";
import { PLAN_PRICES } from "../../src/lib/cakto";
import { Commercial, commercialSchema } from "./Commercial";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./timeline";

// Entry price comes from the app's price table (single purchase). The PRO
// discount is the figure the team publishes for the campaign ("até 64%");
// the repository's price table alone does not produce it, so it lives here
// as an editable prop.
const OFFER = {
  price: `A partir de ${PLAN_PRICES.single}`,
  discount: "PRO com até 64% OFF",
};

export const RemotionRoot = () => (
  <Composition
    id="SlideAIComercial"
    component={Commercial}
    schema={commercialSchema}
    durationInFrames={DURATION_IN_FRAMES}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
    defaultProps={{ ...OFFER, url: "slideai.com.br", withAudio: true }}
  />
);
