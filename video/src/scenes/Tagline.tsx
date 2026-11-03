import { AbsoluteFill, useCurrentFrame } from "remotion";
import { tw } from "../anim";
import { NebulaBg } from "../bg/NebulaBg";
import { Words, Underline } from "../mg/Text";
import { C, EASE, FONT } from "../theme";

// 24–26s, nebula world. The music opens up; the brand line lands alone.

export const Tagline = () => {
  const frame = useCurrentFrame();
  const push = tw(frame, [0, 60], [0, 1], EASE.inOut);
  return (
    <AbsoluteFill>
      <NebulaBg push={0.5 + push * 0.5} />
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", scale: String(1 + push * 0.06) }}>
        <Words tokens={["Sua", "próxima", "apresentação"]} at={2} stagger={3} mode="rise" style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 118, letterSpacing: -4, color: C.fg, lineHeight: 1.05 }} />
        <Words
          tokens={["está", "a", { t: "um", look: "gradient" }, { t: "prompt", look: "gradient" }, "de", "distância."]}
          at={12}
          stagger={3}
          mode="rise"
          style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 118, letterSpacing: -4, color: C.fg, lineHeight: 1.05 }}
        />
        <div style={{ marginTop: 8, marginLeft: -40 }}>
          <Underline at={28} width={560} color="hsl(270 100% 72%)" stroke={12} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
