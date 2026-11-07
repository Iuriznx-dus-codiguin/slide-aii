import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { enter, tw, useIsPortrait } from "../anim";
import { GlowBg } from "../bg/Orbs";
import { Sparkle } from "../mg/Sparkle";
import { Words } from "../mg/Text";
import { C, EASE, FONT } from "../theme";
import { MOMENTS } from "../timeline";

// 4.3–7.5 s, glow world (the landing page's violet orbs on the dark theme).
// The logo's star draws itself and lands in the tile, the name follows, the
// line holds, then a white iris opens the light world from the tile.
// 16:9 lays the lockup out in a row; 9:16 stacks it.

const GEO = {
  landscape: { tile: { x: 618, y: 430, s: 210 }, star: { x: 960, y: 430 }, word: 196, tagTop: 600, tagSize: 70, iris: 2300 },
  portrait: { tile: { x: 540, y: 660, s: 280 }, star: { x: 540, y: 860 }, word: 190, tagTop: 1080, tagSize: 78, iris: 2400 },
};

export const Brand = () => {
  const frame = useCurrentFrame();
  const portrait = useIsPortrait();
  const G = portrait ? GEO.portrait : GEO.landscape;
  const TILE = G.tile;
  const draw = enter(frame, 0, 20, EASE.outQuart);
  const fillP = enter(frame, 12, 10);
  const fly = enter(frame, 20, 16, EASE.inOut);
  const tile = enter(frame, 28, 16, EASE.outQuart);
  const starX = G.star.x + (TILE.x + TILE.s * 0.36 - G.star.x) * fly;
  const starY = G.star.y + (TILE.y - TILE.s * 0.36 - G.star.y) * fly;
  const starS = 260 - 200 * fly;
  const irisR = tw(frame, [MOMENTS.brandIris, MOMENTS.brandIris + 24], [0, G.iris], EASE.inOut);
  const push = tw(frame, [0, 96], [0, 1]);

  const letters = "SlideAI".split("").map((ch, i) => {
    const p = enter(frame, 34 + i * 2, 16, EASE.outExpo);
    return (
      <span key={i} style={{ display: "inline-block", opacity: p, translate: `0 ${(1 - p) * 50}px`, filter: `blur(${(1 - p) * 8}px)` }}>
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
        opacity: tile,
        scale: String(0.82 + 0.18 * tile),
        boxShadow: "0 30px 90px -10px hsl(262 100% 55% / 0.7)",
        flexShrink: 0,
      }}
    >
      <Img src={staticFile("brand/logo.png")} style={{ width: TILE.s * 0.86, height: TILE.s * 0.86 }} />
    </div>
  );
  const wordEl = <div style={{ display: "flex", fontFamily: FONT.sans, fontWeight: 800, fontSize: G.word, letterSpacing: -7, color: C.fg }}>{letters}</div>;

  return (
    <AbsoluteFill>
      <GlowBg intensity={1.1} />
      <AbsoluteFill style={{ scale: String(1 + push * 0.03) }}>
        {/* Star draws, fills, flies into the logo tile */}
        <div
          style={{
            position: "absolute",
            left: starX - starS / 2,
            top: starY - starS / 2,
            rotate: `${(1 - draw) * -60}deg`,
            opacity: 1 - tile,
            filter: "drop-shadow(0 0 24px hsl(262 100% 70%))",
          }}
        >
          <Sparkle size={starS} color="hsl(262 100% 84%)" draw={draw} fill={fillP} stroke="#fff" />
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
            at={48}
            stagger={4}
            dur={16}
            mode="rise"
            style={{ fontFamily: FONT.sans, fontWeight: 600, fontSize: G.tagSize, color: C.fg, letterSpacing: -1.5, lineHeight: 1.15 }}
          />
        </div>
      </AbsoluteFill>

      {/* White iris opening from the logo tile into the light world */}
      <div style={{ position: "absolute", left: TILE.x - irisR, top: TILE.y - irisR, width: irisR * 2, height: irisR * 2, borderRadius: "50%", background: "#fff" }} />
    </AbsoluteFill>
  );
};
