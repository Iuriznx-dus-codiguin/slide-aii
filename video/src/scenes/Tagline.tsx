import { AbsoluteFill, useCurrentFrame } from "remotion";
import { tw } from "../anim";
import { GlowBg } from "../bg/Orbs";
import { Underline, Words } from "../mg/Text";
import { C, EASE, FONT } from "../theme";

// 37.2–40.2 s, glow world. The music opens up; the brand line lands alone
// and holds.

export const Tagline = () => {
  const frame = useCurrentFrame();
  const push = tw(frame, [0, 90], [0, 1], EASE.inOut);
  const head = { fontFamily: FONT.sans, fontWeight: 800, fontSize: 118, letterSpacing: -4, color: C.fg, lineHeight: 1.05 };
  return (
    <AbsoluteFill>
      <GlowBg intensity={1.2} />
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", scale: String(1 + push * 0.05) }}>
        <Words tokens={["Sua", "próxima", "apresentação"]} at={4} stagger={5} dur={20} mode="rise" style={head} />
        <Words tokens={["está", "a", { t: "um", look: "gradient" }, { t: "prompt", look: "gradient" }, "de", "distância."]} at={18} stagger={4} dur={20} mode="rise" style={head} />
        <div style={{ marginTop: 6, marginLeft: -470 }}>
          <Underline at={44} width={470} color="hsl(270 100% 72%)" stroke={12} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
