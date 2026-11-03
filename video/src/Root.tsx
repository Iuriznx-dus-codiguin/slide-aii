import { Composition, Folder } from "remotion";
import { PLAN_PRICES } from "../../src/lib/cakto";
import { maximumProDiscountPct } from "../../src/lib/planDiscounts";
import { NEBULA_H, NEBULA_W, NebulaTexture, nebulaTextureSchema } from "./bg/NebulaTexture";
import { Commercial, commercialSchema } from "./Commercial";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./timeline";

// Offer copy comes from the app's pricing modules, so the ad says what the
// site says: entry price of the single purchase and the same "até X%" PRO
// discount the landing hero shows.
const OFFER = {
  price: `A partir de ${PLAN_PRICES.single}`,
  discount: `PRO com até ${maximumProDiscountPct()}% OFF`,
};

export const RemotionRoot = () => (
  <>
    <Composition
      id="SlideAIComercial30s"
      component={Commercial}
      schema={commercialSchema}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ ...OFFER, url: "slideai.com.br", withAudio: true }}
    />
    <Folder name="Ferramentas">
      <Composition
        id="NebulaTexture"
        component={NebulaTexture}
        schema={nebulaTextureSchema}
        durationInFrames={1}
        fps={FPS}
        width={NEBULA_W}
        height={NEBULA_H}
        defaultProps={{ seed: 3 }}
      />
    </Folder>
  </>
);
