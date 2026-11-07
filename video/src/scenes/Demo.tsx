import { AbsoluteFill, useCurrentFrame } from "remotion";
import { enter, tw, useIsPortrait } from "../anim";
import { LightBg } from "../bg/LightBg";
import { SimTag } from "../components/ui";
import { Scaled, Slide, SolarChart, SolarRoof } from "../decks/Decks";
import { Callout } from "../mg/Fx";
import { Words } from "../mg/Text";
import { EASE, FONT, L } from "../theme";
import { MOMENTS } from "../timeline";

// 13.3–19.2 s, light world. Shot 1: the 8 generated slides drop onto an
// isometric canvas while the camera drifts. Shot 2: one slide up close with
// callouts that draw themselves to each thing the AI made.

const GAP = 56;

// 16:9: 4 x 2 slides. 9:16: 2 x 4 slides, a tall canvas above the headline.
const PLANE = {
  landscape: { cw: 700, cols: 4, cx: 960, cy: 500, from: [260, -120, -60], to: [80, -60, 30], rot: "rotateX(46deg) rotateZ(-22deg)" },
  portrait: { cw: 560, cols: 2, cx: 540, cy: 700, from: [120, -160, -80], to: [40, -60, 20], rot: "rotateX(42deg) rotateZ(-18deg)" },
};

const Plane = ({ portrait }: { portrait: boolean }) => {
  const frame = useCurrentFrame();
  const P = portrait ? PLANE.portrait : PLANE.landscape;
  const CW = P.cw;
  const CH = Math.round((CW * 9) / 16);
  const rows = 8 / P.cols;
  const W = CW * P.cols + GAP * (P.cols - 1);
  const H = CH * rows + GAP * (rows - 1);
  const pan = tw(frame, [0, 104], [0, 1], EASE.outQuart);
  const [x0, y0, z0] = P.from;
  const [x1, y1, z1] = P.to;
  return (
    <AbsoluteFill style={{ perspective: 2200, perspectiveOrigin: "50% 40%" }}>
      <div
        style={{
          position: "absolute",
          left: P.cx - W / 2,
          top: P.cy - H / 2,
          width: W,
          height: H,
          transformStyle: "preserve-3d",
          transform: `translate3d(${x0 + (x1 - x0) * pan}px, ${y0 + (y1 - y0) * pan}px, ${z0 + (z1 - z0) * pan}px) ${P.rot}`,
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => {
          const col = i % P.cols;
          const row = Math.floor(i / P.cols);
          const at = MOMENTS.demoCards + i * MOMENTS.demoCardStagger;
          const p = enter(frame, at, 18, EASE.outExpo);
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

const Shot1 = ({ portrait }: { portrait: boolean }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <LightBg shapes={false} />
      <Plane portrait={portrait} />
      <AbsoluteFill
        style={{
          background: portrait
            ? "linear-gradient(to top, #fff 28%, rgba(255,255,255,0.88) 40%, transparent 56%)"
            : "linear-gradient(10deg, #fff 22%, rgba(255,255,255,0.85) 34%, transparent 55%)",
        }}
      />
      <div style={{ position: "absolute", left: portrait ? 70 : 140, bottom: portrait ? 400 : 120 }}>
        <Words
          tokens={portrait ? [{ t: "8", look: "gradientInk" }, { t: "slides", look: "gradientInk" }, "\n", "prontos."] : [{ t: "8", look: "gradientInk" }, { t: "slides", look: "gradientInk" }, "prontos."]}
          at={16}
          stagger={4}
          dur={16}
          mode="rise"
          style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 150, letterSpacing: -5, color: L.ink, lineHeight: 1 }}
        />
        <Words
          tokens={["Em", "menos", "de", { t: "1", look: "marker" }, { t: "minuto.", look: "marker" }]}
          at={28}
          stagger={3}
          dur={16}
          mode="rise"
          style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: 64, letterSpacing: -1.5, color: L.ink, marginTop: 10 }}
        />
      </div>
      <SimTag tone="light" portrait={portrait} opacity={tw(frame, [0, 8], [0, 1])} />
    </AbsoluteFill>
  );
};

const SHOT2 = {
  landscape: {
    main: { x: 380, y: 300, w: 1000 },
    side: { x: 1310, y: 540, w: 460 },
    headTop: 80,
    headSize: 104,
    callouts: [
      { ax: 600, ay: 420, lx: 330, ly: 400, label: "Roteiro", side: "left" },
      { ax: 420, ay: 780, lx: 330, ly: 850, label: "Design", side: "left" },
      { ax: 940, ay: 760, lx: 940, ly: 950, label: "Gráficos", side: "right" },
      { ax: 1560, ay: 650, lx: 1560, ly: 470, label: "Imagens", side: "right" },
    ],
  },
  portrait: {
    main: { x: 90, y: 680, w: 900 },
    side: { x: 470, y: 1130, w: 500 },
    headTop: 270,
    headSize: 100,
    callouts: [
      { ax: 300, ay: 775, lx: 300, ly: 628, label: "Roteiro", side: "right" },
      { ax: 120, ay: 1120, lx: 120, ly: 1310, label: "Design", side: "right" },
      { ax: 650, ay: 1090, lx: 800, ly: 628, label: "Gráficos", side: "right" },
      { ax: 720, ay: 1270, lx: 720, ly: 1480, label: "Imagens", side: "right" },
    ],
  },
} as const;

const Shot2 = ({ at, portrait }: { at: number; portrait: boolean }) => {
  const frame = useCurrentFrame();
  const S2 = portrait ? SHOT2.portrait : SHOT2.landscape;
  const MAIN = S2.main;
  const SIDE = S2.side;
  const main = enter(frame, at, 18, EASE.outExpo);
  const side = enter(frame, at + 6, 16, EASE.outQuart);
  const chart = tw(frame, [at + 8, at + 50], [0, 1], EASE.outQuart);

  return (
    <AbsoluteFill>
      <LightBg shapes={false} />
      <div style={{ position: "absolute", left: 0, right: 0, top: S2.headTop, display: "flex", justifyContent: "center", textAlign: "center" }}>
        <Words
          tokens={
            portrait
              ? ["Roteiro,", "design,", "\n", "imagens", "e", "\n", { t: "gráficos.", look: "gradientInk" }]
              : ["Roteiro,", "design,", "imagens", "e", { t: "gráficos.", look: "gradientInk" }]
          }
          at={at + 2}
          stagger={3}
          dur={16}
          mode="rise"
          style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: S2.headSize, letterSpacing: -3.5, color: L.ink, lineHeight: 1.04 }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: MAIN.x,
          top: MAIN.y,
          opacity: main,
          scale: String(1.08 - 0.08 * main),
          filter: `blur(${(1 - main) * 8}px)`,
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
          translate: `${(1 - side) * 80}px 0`,
          rotate: `${6 * side}deg`,
          borderRadius: 16,
          boxShadow: "0 40px 90px -24px hsl(252 80% 30% / 0.5), 0 0 0 3px #fff",
        }}
      >
        <Scaled width={SIDE.w} radius={16}>
          <SolarRoof />
        </Scaled>
      </div>
      {S2.callouts.map((c, i) => (
        <Callout key={c.label} at={MOMENTS.demoCallouts[i]} ax={c.ax} ay={c.ay} lx={c.lx} ly={c.ly} label={c.label} side={c.side} />
      ))}
      <SimTag tone="light" portrait={portrait} />
    </AbsoluteFill>
  );
};

export const Demo = () => {
  const frame = useCurrentFrame();
  const portrait = useIsPortrait();
  const shot2 = MOMENTS.demoShot2;
  // Short crossfade between the two shots (both on white).
  const x = tw(frame, [shot2 - 2, shot2 + 8], [0, 1], EASE.inOut);
  return (
    <AbsoluteFill>
      {frame < shot2 + 8 ? (
        <AbsoluteFill style={{ opacity: 1 - x, scale: String(1 + x * 0.04) }}>
          <Shot1 portrait={portrait} />
        </AbsoluteFill>
      ) : null}
      {frame >= shot2 - 2 ? (
        <AbsoluteFill style={{ opacity: x }}>
          <Shot2 at={shot2} portrait={portrait} />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
