import { AbsoluteFill, useCurrentFrame } from "remotion";
import { tw, useIsPortrait } from "../anim";
import { GlowBg } from "../bg/Orbs";
import { Underline, Words } from "../mg/Text";
import { C, EASE, FONT } from "../theme";

// 32–34.7 s, glow world. The brand line lands alone; a white iris then opens
// the end card. 9:16 breaks the line into four short lines.

export const Tagline = () => {
  const frame = useCurrentFrame();
  const portrait = useIsPortrait();
  const push = tw(frame, [0, 80], [0, 1], EASE.inOut);
  const head = { fontFamily: FONT.sans, fontWeight: 800, fontSize: portrait ? 100 : 118, letterSpacing: -4, color: C.fg, lineHeight: 1.08, textAlign: "center" as const };
  return (
    <AbsoluteFill>
      <GlowBg intensity={1.15} />
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", scale: String(1 + push * 0.04) }}>
        {portrait ? (
          <>
            <Words tokens={["Sua", "próxima", "\n", "apresentação"]} at={2} stagger={3} dur={16} mode="rise" style={head} />
            <Words tokens={["está", "a", { t: "um", look: "gradient" }, { t: "prompt", look: "gradient" }]} at={12} stagger={3} dur={16} mode="rise" style={head} />
            <div style={{ marginTop: -10, marginLeft: 380, height: 30 }}>
              <Underline at={32} width={440} color="hsl(270 100% 72%)" stroke={10} />
            </div>
            <Words tokens={["de", "distância."]} at={22} stagger={3} dur={16} mode="rise" style={head} />
          </>
        ) : (
          <>
            <Words tokens={["Sua", "próxima", "apresentação"]} at={2} stagger={3} dur={16} mode="rise" style={head} />
            <Words tokens={["está", "a", { t: "um", look: "gradient" }, { t: "prompt", look: "gradient" }, "de", "distância."]} at={12} stagger={3} dur={16} mode="rise" style={head} />
            <div style={{ marginTop: 6, marginLeft: -470 }}>
              <Underline at={32} width={470} color="hsl(270 100% 72%)" stroke={10} />
            </div>
          </>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
