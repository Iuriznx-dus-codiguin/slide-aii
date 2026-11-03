import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { enter, tw } from "../anim";
import { NebulaBg } from "../bg/NebulaBg";
import { Burst, Flash, Rays, Shockwave } from "../mg/Fx";
import { Sparkle } from "../mg/Sparkle";
import { Words } from "../mg/Text";
import { C, EASE, FONT } from "../theme";
import { MOMENTS } from "../timeline";

// 4–7s, nebula world. The drop: flash + shockwave, the logo's star draws
// itself and lands in the tile, letters cascade, then a white iris opens the
// light world from the tile.

const TILE = { x: 618, y: 430, s: 210 };

export const Brand = () => {
  const frame = useCurrentFrame();
  const draw = enter(frame, 2, 16, EASE.outQuart);
  const fillP = enter(frame, 13, 8);
  const fly = enter(frame, 20, 12, EASE.inOut);
  const tile = enter(frame, 26, 12, EASE.outBack);
  const starX = 960 + (TILE.x + TILE.s * 0.36 - 960) * fly;
  const starY = 430 + (TILE.y - TILE.s * 0.36 - 430) * fly;
  const starS = 300 - 240 * fly;
  const irisR = tw(frame, [MOMENTS.brandIris, 90], [0, 2400], EASE.inExpo);
  const push = tw(frame, [0, 90], [0, 1]);
  const exitText = tw(frame, [MOMENTS.brandIris - 4, MOMENTS.brandIris + 4], [1, 0]);

  return (
    <AbsoluteFill>
      <NebulaBg push={push} />
      <Rays x={960} y={450} opacity={0.22 + 0.2 * tile} />
      <AbsoluteFill style={{ scale: String(1 + push * 0.05) }}>
        {/* Star draws, fills, flies into the logo tile */}
        <div
          style={{
            position: "absolute",
            left: starX - starS / 2,
            top: starY - starS / 2,
            rotate: `${(1 - draw) * -90 + frame * 1.5}deg`,
            opacity: 1 - tile * 0.999,
            filter: "drop-shadow(0 0 30px hsl(262 100% 70%))",
          }}
        >
          <Sparkle size={starS} color="hsl(262 100% 82%)" draw={draw} fill={fillP} stroke="#fff" />
        </div>

        <div style={{ position: "absolute", left: TILE.x - TILE.s / 2, top: TILE.y - TILE.s / 2, height: TILE.s, display: "flex", alignItems: "center", gap: 46, opacity: exitText }}>
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
            }}
          >
            <Img src={staticFile("brand/logo.png")} style={{ width: TILE.s * 0.86, height: TILE.s * 0.86 }} />
          </div>
          <div style={{ display: "flex", fontFamily: FONT.sans, fontWeight: 800, fontSize: 196, letterSpacing: -7, color: C.fg }}>
            {"SlideAI".split("").map((ch, i) => {
              const p = enter(frame, 30 + i * 2, 12, EASE.outExpo);
              return (
                <span key={i} style={{ display: "inline-block", opacity: p, translate: `0 ${(1 - p) * 80}px`, filter: `blur(${(1 - p) * 12}px)` }}>
                  {ch}
                </span>
              );
            })}
          </div>
        </div>

        <div style={{ position: "absolute", left: 0, right: 0, top: 600, display: "flex", justifyContent: "center", opacity: exitText }}>
          <Words
            tokens={["Apresentações", "prontas", { t: "com", look: "gradient" }, { t: "IA.", look: "gradient" }]}
            at={42}
            stagger={3}
            mode="rise"
            style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: 70, color: C.fg, letterSpacing: -1.5 }}
          />
        </div>
      </AbsoluteFill>

      <Shockwave at={0} x={960} y={450} size={2200} rings={3} />
      <Shockwave at={27} x={TILE.x} y={TILE.y} size={700} rings={2} width={8} color="hsl(262 100% 85%)" />
      <Burst at={0} x={960} y={450} count={34} dist={900} />
      <Flash at={0} dur={12} />

      {/* White iris opening from the logo tile into the light world */}
      <div style={{ position: "absolute", left: TILE.x - irisR, top: TILE.y - irisR, width: irisR * 2, height: irisR * 2, borderRadius: "50%", background: "#fff" }} />
    </AbsoluteFill>
  );
};
