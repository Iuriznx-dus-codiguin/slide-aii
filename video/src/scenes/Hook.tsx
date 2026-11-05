import { AbsoluteFill, useCurrentFrame } from "remotion";
import { enter, tw } from "../anim";
import { GridBg } from "../bg/GridBg";
import { Burst, glitchStyle } from "../mg/Fx";
import { Sparkle } from "../mg/Sparkle";
import { Counter, Words } from "../mg/Text";
import { C, EASE, FONT } from "../theme";
import { MOMENTS } from "../timeline";

// 0–4.8 s, grid world. Two lines, one bar each: the problem the viewer
// recognises, then the question that sets up the promise. The brand lands
// right after (before YouTube's skip button).

const HEAD = { fontFamily: FONT.sans, fontWeight: 800, fontSize: 124, lineHeight: 1.04, letterSpacing: -4, color: C.fg };

// Blank slide with a clock badge: deadline + empty deck in one image.
const BlankDeck = ({ at }: { at: number }) => {
  const frame = useCurrentFrame();
  const p = enter(frame, at + 4, 22, EASE.outExpo);
  const badge = enter(frame, at + 16, 16, EASE.outBack);
  const caret = Math.floor((frame - at) / 9) % 2 === 0;
  const f = frame - at;
  return (
    <div style={{ position: "absolute", left: 1120, top: 270, perspective: 1600 }}>
      <div
        style={{
          width: 660,
          height: 372,
          borderRadius: 20,
          background: "hsl(240 20% 97%)",
          boxShadow: "0 50px 110px -20px rgba(0,0,0,0.85), 0 0 0 3px hsl(262 100% 72% / 0.45)",
          rotate: `y ${-26 + p * 12}deg`,
          translate: `${(1 - p) * 160}px ${Math.sin(f / 20) * 6}px`,
          opacity: p,
          padding: 44,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 22,
        }}
      >
        <div style={{ border: "3px dashed hsl(240 10% 72%)", borderRadius: 10, padding: "22px 20px", display: "flex", alignItems: "center", fontFamily: FONT.sans, fontSize: 32, fontWeight: 600, color: "hsl(240 8% 55%)", whiteSpace: "nowrap" }}>
          <div style={{ width: 4, height: 40, background: "hsl(240 20% 12%)", marginRight: 10, opacity: caret ? 1 : 0 }} />
          Clique para adicionar um título
        </div>
        <div style={{ border: "3px dashed hsl(240 10% 80%)", borderRadius: 10, padding: "16px 20px", fontFamily: FONT.sans, fontSize: 22, color: "hsl(240 8% 62%)" }}>Clique para adicionar um subtítulo</div>
      </div>
      <div
        style={{
          position: "absolute",
          right: -40,
          top: -56,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "16px 26px",
          borderRadius: 999,
          background: "hsl(250 40% 10%)",
          border: "3px solid hsl(262 100% 72% / 0.6)",
          boxShadow: "0 20px 40px -12px rgba(0,0,0,0.8)",
          scale: String(badge),
          fontFamily: FONT.mono,
          fontSize: 44,
          color: C.fg,
        }}
      >
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="hsl(330 100% 68%)" strokeWidth="2.4" strokeLinecap="round">
          <circle cx="12" cy="12" r="9.5" />
          <path d={`M12 12 L12 ${12 - 6}`} transform={`rotate(${f * 6} 12 12)`} />
          <path d="M12 12 L16 12" />
        </svg>
        23:47
      </div>
    </div>
  );
};

const Stopwatch = ({ at }: { at: number }) => {
  const frame = useCurrentFrame();
  const p = enter(frame, at + 6, 18, EASE.outBack);
  const fill = tw(frame, [at + 14, at + 50], [0, 1], EASE.inOut);
  const done = enter(frame, at + 50, 12, EASE.outBack);
  const R = 140;
  const len = 2 * Math.PI * R;
  return (
    <div style={{ position: "absolute", left: 1400, top: 230, scale: String(p) }}>
      <svg width="380" height="380" viewBox="0 0 380 380">
        <circle cx="190" cy="190" r={R} fill="hsl(250 40% 8%)" stroke="hsl(262 60% 26%)" strokeWidth="22" />
        <circle cx="190" cy="190" r={R} fill="none" stroke="url(#sw)" strokeWidth="22" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - fill)} transform="rotate(-90 190 190)" />
        <defs>
          <linearGradient id="sw" x1="0" x2="1">
            <stop offset="0" stopColor="hsl(252 100% 70%)" />
            <stop offset="1" stopColor="hsl(290 90% 70%)" />
          </linearGradient>
        </defs>
        <rect x="170" y="12" width="40" height="22" rx="6" fill="hsl(262 100% 72%)" />
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: 146, textAlign: "center", fontFamily: FONT.mono, fontWeight: 700, fontSize: 78, color: C.fg }}>
        <Counter
          from={0}
          to={60}
          at={at + 14}
          dur={36}
          format={(n) => {
            const s = Math.round(n);
            return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
          }}
        />
      </div>
      <div style={{ position: "absolute", left: 140, top: 92, opacity: Math.min(1, done * 2), scale: String(done), rotate: `${frame * 2}deg` }}>
        <Sparkle size={100} color="hsl(262 100% 82%)" />
      </div>
    </div>
  );
};

export const Hook = () => {
  const frame = useCurrentFrame();
  const [b1, b2] = MOMENTS.hookCuts;
  const build = tw(frame, [128, 144], [0, 1], EASE.inExpo);
  const showA = frame < b2;
  return (
    <AbsoluteFill style={{ scale: String(1 + build * 0.08), filter: `brightness(${1 + build * 0.7})` }}>
      <GridBg />
      <AbsoluteFill style={glitchStyle(frame, [b2], 4)}>
        {showA ? (
          <>
            <div style={{ position: "absolute", left: 140, top: 0, bottom: 80, display: "flex", alignItems: "center" }}>
              <Words tokens={["Apresentação", "\n", "pra", { t: "amanhã?", look: "gradient" }]} at={b1 + 2} stagger={5} dur={18} mode="rise" style={HEAD} />
            </div>
            <BlankDeck at={b1} />
          </>
        ) : (
          <>
            <div style={{ position: "absolute", left: 140, top: 0, bottom: 80, display: "flex", alignItems: "center" }}>
              <Words
                tokens={["E", "se", "ficasse", "pronta", "\n", "em", { t: "1", look: "gradient" }, { t: "minuto?", look: "gradient" }]}
                at={b2 + 2}
                stagger={4}
                dur={18}
                mode="rise"
                style={HEAD}
              />
            </div>
            <Stopwatch at={b2} />
          </>
        )}
      </AbsoluteFill>
      <Burst at={b2 + 50} x={1590} y={420} count={22} dist={320} />
    </AbsoluteFill>
  );
};
