import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { enter, tw } from "../anim";
import { GridBg } from "../bg/GridBg";
import { Burst, glitchStyle } from "../mg/Fx";
import { Sparkle } from "../mg/Sparkle";
import { Counter, Words, type Token } from "../mg/Text";
import { C, EASE, FONT } from "../theme";
import { MOMENTS } from "../timeline";

// 0–4s, grid world. Problem → agitation → curiosity, one hard cut per two
// beats with a chromatic split on each cut.

const HEAD = { fontFamily: FONT.sans, fontWeight: 800, fontSize: 150, lineHeight: 1.0, letterSpacing: -5, color: C.fg };

const Beat = ({ at, tokens, art }: { at: number; tokens: Token[]; art: ReactNode }) => {
  const frame = useCurrentFrame();
  if (frame < at || frame >= at + 30) return null;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 140, top: 0, bottom: 120, display: "flex", alignItems: "center" }}>
        <Words tokens={tokens} at={at} stagger={3} dur={9} mode="slam" style={HEAD} />
      </div>
      {art}
    </AbsoluteFill>
  );
};

const Clock = ({ at }: { at: number }) => {
  const frame = useCurrentFrame();
  const p = enter(frame, at, 10, EASE.outBack);
  const f = frame - at;
  return (
    <div style={{ position: "absolute", left: 1290, top: 200, scale: String(p), rotate: `${(1 - p) * -30}deg` }}>
      <svg width="420" height="420" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="92" fill="hsl(250 40% 8%)" stroke="hsl(262 100% 72%)" strokeWidth="5" />
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={i} x1="100" y1="16" x2="100" y2={i % 3 === 0 ? 34 : 26} stroke="hsl(262 100% 85%)" strokeWidth={i % 3 === 0 ? 5 : 3} strokeLinecap="round" transform={`rotate(${i * 30} 100 100)`} />
        ))}
        <line x1="100" y1="100" x2="100" y2="52" stroke="#fff" strokeWidth="8" strokeLinecap="round" transform={`rotate(${330 + f * 3} 100 100)`} />
        <line x1="100" y1="100" x2="100" y2="30" stroke="hsl(330 100% 65%)" strokeWidth="5" strokeLinecap="round" transform={`rotate(${f * 36} 100 100)`} />
        <circle cx="100" cy="100" r="8" fill="#fff" />
      </svg>
      <div style={{ textAlign: "center", fontFamily: FONT.mono, fontSize: 44, color: C.fg, marginTop: 6 }}>23:47</div>
    </div>
  );
};

const BlankSlide = ({ at }: { at: number }) => {
  const frame = useCurrentFrame();
  const p = enter(frame, at, 12, EASE.outExpo);
  const caret = Math.floor((frame - at) / 6) % 2 === 0;
  return (
    <div style={{ position: "absolute", left: 1120, top: 250, perspective: 1400 }}>
      <div
        style={{
          width: 660,
          height: 372,
          borderRadius: 18,
          background: "hsl(240 20% 97%)",
          boxShadow: "0 40px 100px -20px rgba(0,0,0,0.85), 0 0 0 3px hsl(262 100% 72% / 0.4)",
          rotate: `y ${-24 + p * 8}deg`,
          translate: `${(1 - p) * 200}px 0`,
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
    </div>
  );
};

const Mess = ({ at }: { at: number }) => {
  const frame = useCurrentFrame();
  const f = frame - at;
  const p = enter(frame, at, 10, EASE.outExpo);
  const j = (k: number) => Math.sin(f * 1.7 + k * 2) * 10;
  const boxes = [
    { x: 0, y: 0, w: 420, h: 70, c: "hsl(240 20% 92%)" },
    { x: 30, y: 110, w: 300, h: 40, c: "hsl(240 15% 70%)" },
    { x: -14, y: 170, w: 360, h: 40, c: "hsl(240 15% 70%)" },
    { x: 380, y: 120, w: 220, h: 220, c: "hsl(262 60% 60%)" },
  ];
  return (
    <div style={{ position: "absolute", left: 1150, top: 220, opacity: p, scale: String(0.9 + 0.1 * p) }}>
      <div style={{ position: "relative", width: 640, height: 400, borderRadius: 18, background: "hsl(240 20% 97%)", boxShadow: "0 40px 100px -20px rgba(0,0,0,0.85)" }}>
        {boxes.map((b, i) => (
          <div key={i} style={{ position: "absolute", left: 40 + b.x + j(i), top: 40 + b.y + j(i + 3) * 0.6, width: b.w, height: b.h, borderRadius: 8, background: b.c, rotate: `${j(i) * 0.3}deg` }} />
        ))}
        <div style={{ position: "absolute", left: 0, right: 0, top: 150 + j(9), height: 3, background: "hsl(330 100% 60%)", opacity: f % 6 < 3 ? 1 : 0.3 }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: 330 + j(5), width: 3, background: "hsl(330 100% 60%)", opacity: f % 6 < 3 ? 0.3 : 1 }} />
        <svg width="44" height="54" viewBox="0 0 22 27" style={{ position: "absolute", left: 470 + j(2) * 2, top: 260 + j(4) * 2 }}>
          <path d="M1 1 L1 21 L6.5 16 L10 25 L13.5 23.5 L10 15 L18 15 Z" fill="#fff" stroke="#111" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </div>
      <div style={{ marginTop: 28, fontFamily: FONT.mono, fontSize: 56, color: "hsl(330 100% 70%)", textAlign: "center" }}>
        <Counter from={0} to={3 * 3600 + 12 * 60 + 47} at={at} dur={28} format={(n) => {
          const s = Math.floor(n);
          return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
        }} />
      </div>
    </div>
  );
};

const Stopwatch = ({ at }: { at: number }) => {
  const frame = useCurrentFrame();
  const p = enter(frame, at, 10, EASE.outBack);
  const fill = tw(frame, [at + 4, at + 22], [0, 1], EASE.inOut);
  const R = 150;
  const len = 2 * Math.PI * R;
  return (
    <div style={{ position: "absolute", left: 1300, top: 190, scale: String(p) }}>
      <svg width="400" height="400" viewBox="0 0 400 400">
        <circle cx="200" cy="200" r={R} fill="hsl(250 40% 8%)" stroke="hsl(262 60% 30%)" strokeWidth="22" />
        <circle
          cx="200"
          cy="200"
          r={R}
          fill="none"
          stroke="url(#sw)"
          strokeWidth="22"
          strokeLinecap="round"
          strokeDasharray={len}
          strokeDashoffset={len * (1 - fill)}
          transform="rotate(-90 200 200)"
        />
        <defs>
          <linearGradient id="sw" x1="0" x2="1">
            <stop offset="0" stopColor="hsl(252 100% 70%)" />
            <stop offset="1" stopColor="hsl(290 90% 70%)" />
          </linearGradient>
        </defs>
        <rect x="180" y="18" width="40" height="22" rx="6" fill="hsl(262 100% 72%)" />
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: 150, textAlign: "center", fontFamily: FONT.mono, fontWeight: 700, fontSize: 84, color: C.fg }}>
        <Counter from={0} to={60} at={at + 4} dur={18} format={(n) => `00:${String(Math.round(n)).padStart(2, "0")}`} />
      </div>
      <div style={{ position: "absolute", left: 152, top: 120, opacity: tw(frame, [at + 21, at + 23], [0, 1]), scale: String(enter(frame, at + 21, 8, EASE.outBack)) }}>
        <Sparkle size={96} color="hsl(262 100% 82%)" />
      </div>
    </div>
  );
};

export const Hook = () => {
  const frame = useCurrentFrame();
  const [b1, b2, b3, b4] = MOMENTS.hookCuts;
  const build = tw(frame, [100, 120], [0, 1], EASE.inExpo);
  return (
    <AbsoluteFill style={{ scale: String(1 + build * 0.12), filter: `brightness(${1 + build * 0.6})` }}>
      <GridBg speed={1 + build * 4} glow={1 + build} />
      <AbsoluteFill style={glitchStyle(frame, MOMENTS.hookCuts.slice(1), 5)}>
        <Beat at={b1} tokens={["Apresentação", "\n", "pra", "amanhã?"]} art={<Clock at={b1} />} />
        <Beat at={b2} tokens={["Página", "\n", "em", "branco."]} art={<BlankSlide at={b2} />} />
        <Beat at={b3} tokens={["Horas", "\n", "formatando."]} art={<Mess at={b3} />} />
        <Beat
          at={b4}
          tokens={["E", "se", "levasse", "\n", { t: "1", look: "gradient" }, { t: "minuto?", look: "gradient" }]}
          art={<Stopwatch at={b4} />}
        />
      </AbsoluteFill>
      <Burst at={b4 + 22} x={1500} y={390} count={22} dist={360} />
    </AbsoluteFill>
  );
};
