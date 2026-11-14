import { AbsoluteFill, useCurrentFrame } from "remotion";
import { enter, tw, useIsPortrait } from "../anim";
import { GridBg } from "../bg/GridBg";
import { Sparkle } from "../mg/Sparkle";
import { Counter, Words, type Token } from "../mg/Text";
import { C, EASE, FONT } from "../theme";
import { MOMENTS } from "../timeline";

// 0–4.3 s, grid world. The problem, then the promise: two lines, two beats
// each. The first line lifts away before the second rises in its place.

const HEAD = { fontFamily: FONT.sans, fontWeight: 800, lineHeight: 1.04, letterSpacing: -4, color: C.fg };

// Blank slide with a clock badge: deadline + empty deck in one image.
const BlankDeck = ({ at, portrait, exitAt }: { at: number; portrait: boolean; exitAt: number }) => {
  const frame = useCurrentFrame();
  const p = enter(frame, at + 4, 20, EASE.outExpo);
  const out = tw(frame, [exitAt, exitAt + 8], [0, 1], EASE.inQuad);
  const badge = enter(frame, at + 14, 14, EASE.outQuart);
  const caret = Math.floor((frame - at) / 9) % 2 === 0;
  const f = frame - at;
  return (
    <div
      style={{
        position: "absolute",
        left: portrait ? 111 : 1120,
        top: portrait ? 880 : 270,
        perspective: 1600,
        scale: portrait ? "1.3" : "1",
        transformOrigin: "0 0",
        opacity: 1 - out,
        translate: `0 ${-out * 40}px`,
      }}
    >
      <div
        style={{
          width: 660,
          height: 372,
          borderRadius: 20,
          background: "hsl(240 20% 97%)",
          boxShadow: "0 50px 110px -20px rgba(0,0,0,0.85), 0 0 0 2px hsl(262 100% 72% / 0.35)",
          rotate: `y ${-24 + p * 12}deg`,
          translate: `${(1 - p) * 120}px 0`,
          opacity: p,
          padding: 44,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 22,
        }}
      >
        <div style={{ border: "3px dashed hsl(240 10% 74%)", borderRadius: 10, padding: "22px 20px", display: "flex", alignItems: "center", fontFamily: FONT.sans, fontSize: 32, fontWeight: 600, color: "hsl(240 8% 55%)", whiteSpace: "nowrap" }}>
          <div style={{ width: 4, height: 40, background: "hsl(240 20% 12%)", marginRight: 10, opacity: caret ? 1 : 0 }} />
          Clique para adicionar um título
        </div>
        <div style={{ border: "3px dashed hsl(240 10% 82%)", borderRadius: 10, padding: "16px 20px", fontFamily: FONT.sans, fontSize: 22, color: "hsl(240 8% 62%)" }}>Clique para adicionar um subtítulo</div>
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
          border: "2px solid hsl(262 100% 72% / 0.5)",
          boxShadow: "0 20px 40px -12px rgba(0,0,0,0.8)",
          opacity: badge,
          translate: `0 ${(1 - badge) * 16}px`,
          fontFamily: FONT.mono,
          fontSize: 44,
          color: C.fg,
        }}
      >
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="hsl(330 100% 70%)" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="12" cy="12" r="9.5" />
          <path d="M12 12 L12 6" transform={`rotate(${f * 6} 12 12)`} />
          <path d="M12 12 L16 12" />
        </svg>
        23:47
      </div>
    </div>
  );
};

// Stopwatch that runs and stops before the minute.
const STOP_AT = 48;
const Stopwatch = ({ at, portrait }: { at: number; portrait: boolean }) => {
  const frame = useCurrentFrame();
  const p = enter(frame, at + 4, 18, EASE.outExpo);
  const run = tw(frame, [at + 10, at + 46], [0, 1], EASE.inOut);
  const done = enter(frame, at + 46, 12, EASE.outQuart);
  const R = 140;
  const len = 2 * Math.PI * R;
  return (
    <div
      style={{
        position: "absolute",
        left: portrait ? 540 - 190 * 1.4 : 1400,
        top: portrait ? 820 : 240,
        opacity: p,
        scale: String((0.92 + 0.08 * p) * (portrait ? 1.4 : 1)),
        transformOrigin: "0 0",
      }}
    >
      <svg width="380" height="380" viewBox="0 0 380 380">
        <circle cx="190" cy="190" r={R} fill="hsl(250 40% 7%)" stroke="hsl(262 50% 22%)" strokeWidth="18" />
        <circle cx="190" cy="190" r={R} fill="none" stroke="url(#sw)" strokeWidth="18" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - run * (STOP_AT / 60))} transform="rotate(-90 190 190)" />
        <defs>
          <linearGradient id="sw" x1="0" x2="1">
            <stop offset="0" stopColor="hsl(252 100% 70%)" />
            <stop offset="1" stopColor="hsl(290 90% 70%)" />
          </linearGradient>
        </defs>
        <rect x="170" y="14" width="40" height="20" rx="6" fill="hsl(262 100% 72%)" />
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: 146, textAlign: "center", fontFamily: FONT.mono, fontWeight: 700, fontSize: 78, color: C.fg }}>
        <Counter from={0} to={STOP_AT} at={at + 10} dur={36} format={(n) => `00:${String(Math.round(n)).padStart(2, "0")}`} />
      </div>
      <div style={{ position: "absolute", left: 150, top: 96, opacity: done, scale: String(0.7 + 0.3 * done) }}>
        <Sparkle size={80} color="hsl(262 100% 82%)" />
      </div>
    </div>
  );
};

export const Hook = () => {
  const frame = useCurrentFrame();
  const portrait = useIsPortrait();
  const [b1, b2] = MOMENTS.hookCuts;
  const showA = frame < b2;
  const textBox = portrait
    ? ({ position: "absolute", left: 70, top: 300 } as const)
    : ({ position: "absolute", left: 140, top: 0, bottom: 80, display: "flex", alignItems: "center" } as const);
  const head = { ...HEAD, fontSize: portrait ? 118 : 124 };
  const lineB: Token[] = portrait
    ? ["Resolva", "em", "\n", "menos", "de", "\n", { t: "1", look: "gradient" }, { t: "minuto.", look: "gradient" }]
    : ["Resolva", "em", "menos", "\n", "de", { t: "1", look: "gradient" }, { t: "minuto.", look: "gradient" }];
  return (
    <AbsoluteFill>
      <GridBg />
      {showA ? (
        <>
          <div style={textBox}>
            <Words tokens={["Apresentação", "\n", "pra", { t: "amanhã?", look: "gradient" }]} at={b1 + 2} stagger={4} dur={16} mode="rise" exitAt={b2 - 8} exitDur={8} style={head} />
          </div>
          <BlankDeck at={b1} portrait={portrait} exitAt={b2 - 8} />
        </>
      ) : (
        <>
          <div style={textBox}>
            <Words tokens={lineB} at={b2 + 1} stagger={3} dur={16} mode="rise" style={head} />
          </div>
          <Stopwatch at={b2} portrait={portrait} />
        </>
      )}
    </AbsoluteFill>
  );
};
