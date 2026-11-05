import { AbsoluteFill, useCurrentFrame } from "remotion";
import { enter, tw } from "../anim";
import { LightBg } from "../bg/LightBg";
import { SimTag } from "../components/ui";
import { Scaled, Slide, SolarChart, SolarRoof } from "../decks/Decks";
import { Callout, Flash } from "../mg/Fx";
import { Words } from "../mg/Text";
import { EASE, FONT, L } from "../theme";
import { MOMENTS } from "../timeline";

// 15.6–22.8 s, light world. Shot 1: the 8 generated slides drop onto an
// isometric canvas while the camera drifts. Shot 2: one slide up close with
// callouts that draw themselves to each thing the AI made.

const CW = 700;
const CH = Math.round((CW * 9) / 16);
const GAP = 56;

const Plane = () => {
  const frame = useCurrentFrame();
  const pan = tw(frame, [0, 108], [0, 1], EASE.outQuart);
  return (
    <AbsoluteFill style={{ perspective: 2200, perspectiveOrigin: "50% 40%" }}>
      <div
        style={{
          position: "absolute",
          left: 960 - (CW * 4 + GAP * 3) / 2,
          top: 540 - (CH * 2 + GAP) / 2 - 40,
          width: CW * 4 + GAP * 3,
          height: CH * 2 + GAP,
          transformStyle: "preserve-3d",
          transform: `translate3d(${260 - pan * 180}px, ${-120 + pan * 60}px, ${-60 + pan * 90}px) rotateX(46deg) rotateZ(-22deg)`,
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => {
          const col = i % 4;
          const row = Math.floor(i / 4);
          const at = MOMENTS.demoCards + i * MOMENTS.demoCardStagger;
          const p = enter(frame, at, 22, EASE.outExpo);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: col * (CW + GAP),
                top: row * (CH + GAP),
                transform: `translateZ(${(1 - p) * 700}px)`,
                opacity: Math.min(1, p * 2),
                borderRadius: 18,
                boxShadow: `0 ${30 * p}px ${60 * p}px -10px hsl(252 60% 30% / ${0.35 * p})`,
              }}
            >
              <Slide deck="aula" index={i} width={CW} radius={18} style={{ outline: "3px solid hsl(252 100% 88%)" }} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Shot1 = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <LightBg shapes={false} />
      <Plane />
      <AbsoluteFill style={{ background: "linear-gradient(10deg, #fff 22%, rgba(255,255,255,0.85) 34%, transparent 55%)" }} />
      <div style={{ position: "absolute", left: 140, bottom: 120 }}>
        <Words
          tokens={[{ t: "8", look: "gradientInk" }, { t: "slides", look: "gradientInk" }, "prontos."]}
          at={26}
          stagger={5}
          dur={18}
          mode="rise"
          style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 150, letterSpacing: -5, color: L.ink, lineHeight: 1 }}
        />
        <Words
          tokens={["Em", "cerca", "de", { t: "1", look: "marker" }, { t: "minuto.", look: "marker" }]}
          at={42}
          stagger={4}
          dur={18}
          mode="rise"
          style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: 64, letterSpacing: -1.5, color: L.ink, marginTop: 10 }}
        />
      </div>
      <SimTag tone="light" opacity={tw(frame, [0, 8], [0, 1])} />
    </AbsoluteFill>
  );
};

const MAIN = { x: 380, y: 300, w: 1000 };
const SIDE = { x: 1310, y: 540, w: 460 };

const Shot2 = ({ at }: { at: number }) => {
  const frame = useCurrentFrame();
  const main = enter(frame, at, 22, EASE.outExpo);
  const side = enter(frame, at + 8, 20, EASE.outBack);
  const chart = tw(frame, [at + 10, at + 60], [0, 1], EASE.outQuart);
  const [c1, c2, c3, c4] = MOMENTS.demoCallouts;
  return (
    <AbsoluteFill>
      <LightBg shapes={false} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 80, display: "flex", justifyContent: "center" }}>
        <Words
          tokens={["Roteiro,", "design,", "imagens", "e", { t: "gráficos.", look: "gradientInk" }]}
          at={at + 2}
          stagger={4}
          dur={18}
          mode="rise"
          style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 104, letterSpacing: -3.5, color: L.ink }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: MAIN.x,
          top: MAIN.y,
          opacity: main,
          scale: String(1.25 - 0.25 * main),
          filter: `blur(${(1 - main) * 14}px)`,
          borderRadius: 22,
          boxShadow: "0 50px 110px -30px hsl(252 80% 30% / 0.45), 0 0 0 3px hsl(252 100% 88%)",
        }}
      >
        <Scaled width={MAIN.w} radius={22}>
          <SolarChart progress={chart} />
        </Scaled>
      </div>
      <div
        style={{
          position: "absolute",
          left: SIDE.x,
          top: SIDE.y,
          opacity: side,
          translate: `${(1 - side) * 200}px 0`,
          rotate: `${6 * side}deg`,
          borderRadius: 16,
          boxShadow: "0 40px 90px -24px hsl(252 80% 30% / 0.5), 0 0 0 3px #fff",
        }}
      >
        <Scaled width={SIDE.w} radius={16}>
          <SolarRoof />
        </Scaled>
      </div>
      <Callout at={c1} ax={600} ay={420} lx={330} ly={400} label="Roteiro" side="left" />
      <Callout at={c2} ax={420} ay={780} lx={330} ly={850} label="Design" side="left" />
      <Callout at={c3} ax={940} ay={760} lx={940} ly={950} label="Gráficos" side="right" />
      <Callout at={c4} ax={1560} ay={650} lx={1560} ly={470} label="Imagens" side="right" />
      <SimTag tone="light" />
    </AbsoluteFill>
  );
};

export const Demo = () => {
  const frame = useCurrentFrame();
  const shot2 = MOMENTS.demoShot2;
  return (
    <AbsoluteFill>
      {frame < shot2 ? <Shot1 /> : <Shot2 at={shot2} />}
      <Flash at={shot2} color="#fff" dur={9} peak={0.7} />
    </AbsoluteFill>
  );
};
