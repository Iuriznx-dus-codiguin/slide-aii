import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { enter, tw, useIsPortrait } from "../anim";
import { GlowBg } from "../bg/Orbs";
import { Burst, Flash, Shockwave } from "../mg/Fx";
import { Sparkle } from "../mg/Sparkle";
import { Words } from "../mg/Text";
import { C, EASE, FONT } from "../theme";
import { MOMENTS } from "../timeline";

// 4.8–9 s, glow world (the landing page's violet orbs on the dark theme).
// The drop: soft flash + shockwave, the logo's star draws itself and lands in
// the tile, letters cascade, the line holds, then a white iris opens the
// light world from the tile. 16:9 lays the lockup out in a row; 9:16 stacks
// it in the centre of the screen.

const GEO = {
  landscape: { tile: { x: 618, y: 430, s: 210 }, star: { x: 960, y: 430 }, word: 196, tagTop: 600, tagSize: 70, center: { x: 960, y: 450 }, iris: 2300 },
  portrait: { tile: { x: 540, y: 660, s: 280 }, star: { x: 540, y: 860 }, word: 190, tagTop: 1080, tagSize: 78, center: { x: 540, y: 860 }, iris: 2400 },
};

export const Brand = () => {
  const frame = useCurrentFrame();
  const portrait = useIsPortrait();
  const G = portrait ? GEO.portrait : GEO.landscape;
  const TILE = G.tile;
  const draw = enter(frame, 2, 24, EASE.outQuart);
  const fillP = enter(frame, 18, 12);
  const fly = enter(frame, 30, 18, EASE.inOut);
  const tile = enter(frame, 40, 18, EASE.outBack);
  const starX = G.star.x + (TILE.x + TILE.s * 0.36 - G.star.x) * fly;
  const starY = G.star.y + (TILE.y - TILE.s * 0.36 - G.star.y) * fly;
  const starS = 300 - 240 * fly;
  const irisR = tw(frame, [MOMENTS.brandIris, MOMENTS.brandIris + 24], [0, G.iris], EASE.inOut);
  const push = tw(frame, [0, 126], [0, 1]);

  const letters = "SlideAI".split("").map((ch, i) => {
    const p = enter(frame, 46 + i * 3, 18, EASE.outExpo);
    return (
      <span key={i} style={{ display: "inline-block", opacity: p, translate: `0 ${(1 - p) * 80}px`, filter: `blur(${(1 - p) * 12}px)` }}>
        {ch}
      </span>
    );
  });

  const tileEl = (
    <div
      style={{
        width: TILE.s,
        height: TILE.s,
        borderRadius: TILE.s * 0.24,
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        scale: String(tile),
        boxShadow: "0 30px 90px -10px hsl(262 100% 55% / 0.8)",
        flexShrink: 0,
      }}
    >
      <Img src={staticFile("brand/logo.png")} style={{ width: TILE.s * 0.86, height: TILE.s * 0.86 }} />
    </div>
  );
  const wordEl = <div style={{ display: "flex", fontFamily: FONT.sans, fontWeight: 800, fontSize: G.word, letterSpacing: -7, color: C.fg }}>{letters}</div>;

  return (
    <AbsoluteFill>
      <GlowBg intensity={1.15} />
      <AbsoluteFill style={{ scale: String(1 + push * 0.04) }}>
        {/* Star draws, fills, flies into the logo tile */}
        <div
          style={{
            position: "absolute",
            left: starX - starS / 2,
            top: starY - starS / 2,
            rotate: `${(1 - draw) * -90 + frame * 0.8}deg`,
            opacity: 1 - tile * 0.999,
            filter: "drop-shadow(0 0 30px hsl(262 100% 70%))",
          }}
        >
          <Sparkle size={starS} color="hsl(262 100% 82%)" draw={draw} fill={fillP} stroke="#fff" />
        </div>

        {portrait ? (
          <>
            <div style={{ position: "absolute", left: TILE.x - TILE.s / 2, top: TILE.y - TILE.s / 2 }}>{tileEl}</div>
            <div style={{ position: "absolute", left: 0, right: 0, top: TILE.y + TILE.s / 2 + 30, display: "flex", justifyContent: "center" }}>{wordEl}</div>
          </>
        ) : (
          <div style={{ position: "absolute", left: TILE.x - TILE.s / 2, top: TILE.y - TILE.s / 2, height: TILE.s, display: "flex", alignItems: "center", gap: 46 }}>
            {tileEl}
            {wordEl}
          </div>
        )}

        <div style={{ position: "absolute", left: 0, right: 0, top: G.tagTop, display: "flex", justifyContent: "center", textAlign: "center" }}>
          <Words
            tokens={
              portrait
                ? ["Apresentações", "\n", "prontas", { t: "com", look: "gradient" }, { t: "IA.", look: "gradient" }]
                : ["Apresentações", "prontas", { t: "com", look: "gradient" }, { t: "IA.", look: "gradient" }]
            }
            at={66}
            stagger={5}
            dur={18}
            mode="rise"
            style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: G.tagSize, color: C.fg, letterSpacing: -1.5, lineHeight: 1.15 }}
          />
        </div>
      </AbsoluteFill>

      <Shockwave at={0} x={G.center.x} y={G.center.y} size={2200} rings={2} dur={34} />
      <Shockwave at={42} x={TILE.x} y={TILE.y} size={700} rings={2} width={8} color="hsl(262 100% 85%)" />
      <Burst at={0} x={G.center.x} y={G.center.y} count={28} dist={800} dur={40} />
      <Flash at={0} dur={16} peak={0.85} />

      {/* White iris opening from the logo tile into the light world */}
      <div style={{ position: "absolute", left: TILE.x - irisR, top: TILE.y - irisR, width: irisR * 2, height: irisR * 2, borderRadius: "50%", background: "#fff" }} />
    </AbsoluteFill>
  );
};
