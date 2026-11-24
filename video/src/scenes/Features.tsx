import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { beatPulse, enter, tw, useIsPortrait } from "../anim";
import { GridBg } from "../bg/GridBg";
import { RevenueSlide } from "../components/DeckSlide";
import { Scaled, Slide, SolarRoof } from "../decks/Decks";
import { Words, type Token } from "../mg/Text";
import { C, EASE, FONT, GRADIENT } from "../theme";
import { MOMENTS } from "../timeline";

// 25.6–32 s, grid world. Three features, one per bar, each sliding in
// from the right: chat edits, speaker notes, export. 16:9 puts copy left and
// the visual right; 9:16 stacks copy on top and the visual below it.

const Hit = ({ at, end, n, title, sub, children }: { at: number; end: number; n: string; title: Token[]; sub: string; children: ReactNode }) => {
  const frame = useCurrentFrame();
  const portrait = useIsPortrait();
  if (frame < at || frame >= end) return null;
  const inP = tw(frame, [at, at + 12], [0, 1], EASE.outExpo);
  const outP = tw(frame, [end - 8, end], [0, 1], EASE.inExpo);
  const x = (1 - inP) * 700 - outP * 900;
  const blur = (1 - inP) * 24 + outP * 24;
  return (
    <AbsoluteFill style={{ translate: `${x}px 0`, filter: `blur(${blur}px)` }}>
      <div style={{ position: "absolute", left: portrait ? 70 : 140, top: portrait ? 260 : 250, width: portrait ? 940 : 820 }}>
        <div style={{ fontFamily: FONT.mono, fontSize: 30, fontWeight: 700, letterSpacing: 4, color: C.primaryGlow, opacity: enter(frame, at + 2, 8) }}>{n} / 03</div>
        <div style={{ height: 24 }} />
        <Words tokens={title} at={at + 3} stagger={3} dur={16} mode="rise" style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: portrait ? 120 : 112, letterSpacing: -4, color: C.fg, lineHeight: 1.02 }} />
        <div style={{ height: portrait ? 24 : 30 }} />
        <div style={{ fontFamily: FONT.sans, fontSize: portrait ? 46 : 42, color: C.fgMuted, opacity: enter(frame, at + 12, 12), translate: `0 ${(1 - enter(frame, at + 12, 12, EASE.outExpo)) * 20}px` }}>{sub}</div>
      </div>
      {children}
    </AbsoluteFill>
  );
};

const ChatEdit = ({ at }: { at: number }) => {
  const frame = useCurrentFrame();
  const portrait = useIsPortrait();
  const msg = enter(frame, at + MOMENTS.featureChatMsg, 12, EASE.outQuart);
  const morph = at + MOMENTS.featureChatMorph;
  const bullets = 1 - tw(frame, [morph, morph + 8], [0, 1]);
  const chartO = tw(frame, [morph + 3, morph + 9], [0, 1]);
  const chartP = tw(frame, [morph + 3, morph + 30], [0, 1], EASE.outQuart);
  const ring = tw(frame, [morph - 2, morph + 6, morph + 28], [0, 1, 0]);
  return (
    <div style={{ position: "absolute", left: portrait ? 70 : 1000, top: portrait ? 770 : 230 }}>
      <div style={{ borderRadius: 22, overflow: "hidden", boxShadow: `0 40px 100px -20px rgba(0,0,0,0.85), 0 0 0 ${2 + ring * 4}px hsl(262 100% 72% / ${0.35 + ring * 0.4}), 0 0 ${ring * 50}px hsl(262 100% 70% / 0.6)` }}>
        <Scaled width={portrait ? 900 : 780}>
          <RevenueSlide bulletsOpacity={bullets} chartOpacity={chartO} chartProgress={chartP} />
        </Scaled>
      </div>
      <div
        style={{
          position: "absolute",
          right: portrait ? 30 : -40,
          bottom: portrait ? -100 : -70,
          maxWidth: portrait ? 600 : 520,
          padding: "22px 28px",
          borderRadius: "28px 28px 8px 28px",
          background: GRADIENT.primary,
          color: "#fff",
          fontFamily: FONT.sans,
          fontSize: portrait ? 40 : 34,
          fontWeight: 700,
          lineHeight: 1.25,
          boxShadow: "0 24px 50px -16px hsl(252 100% 40% / 0.8)",
          opacity: msg,
          translate: `0 ${(1 - msg) * 24}px`,
        }}
      >
        Transforme a lista em um gráfico
      </div>
    </div>
  );
};

const Notes = ({ at }: { at: number }) => {
  const frame = useCurrentFrame();
  const portrait = useIsPortrait();
  const p = enter(frame, at + 6, 18, EASE.outExpo);
  const pulse = beatPulse(frame, 5);
  const lines = [
    "Repare no telhado: os painéis",
    "ficam virados para o norte",
    "para receber mais sol.",
    "Agora, pergunte à turma:",
    "o que acontece à noite?",
  ];
  const hl = Math.min(lines.length - 1, Math.floor((frame - at - 6) / 10));
  return (
    <div style={{ position: "absolute", left: portrait ? 70 : 1000, top: portrait ? 750 : 210, width: portrait ? 940 : 780, opacity: p, translate: `0 ${(1 - p) * 60}px` }}>
      <div style={{ borderRadius: 24, background: "hsl(245 30% 12%)", border: "3px solid hsl(262 60% 35%)", padding: 28, boxShadow: "0 40px 100px -20px rgba(0,0,0,0.85)" }}>
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
          <div style={{ borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
            <Scaled width={300}>
              <SolarRoof />
            </Scaled>
          </div>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 16px", borderRadius: 999, background: "hsl(262 100% 70% / 0.18)", color: C.primaryGlow, fontFamily: FONT.mono, fontSize: 20, fontWeight: 700 }}>
              FALAS DO APRESENTADOR
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 70, marginTop: 20 }}>
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} style={{ width: 10, borderRadius: 99, background: GRADIENT.primaryBright, height: 12 + (Math.abs(Math.sin(i * 1.7 + frame * 0.5)) * 40 + 10) * (0.5 + pulse * 0.5) }} />
              ))}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 8 }}>
          {lines.map((l, i) => (
            <div key={l} style={{ fontFamily: FONT.sans, fontSize: portrait ? 42 : 36, fontWeight: 600, lineHeight: 1.25, color: i === hl ? "#fff" : "hsl(240 10% 55%)", background: i === hl ? "hsl(262 100% 64% / 0.25)" : "transparent", borderRadius: 10, padding: "2px 12px" }}>
              {l}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const FORMATS = [
  { label: "PowerPoint", ext: ".pptx", dx: -1, dy: -1 },
  { label: "PDF", ext: ".pdf", dx: 1, dy: -1 },
  { label: "Imagens", ext: ".png", dx: -1, dy: 1 },
  { label: "Link público", ext: "tela cheia", dx: 1, dy: 1 },
];

const Export = ({ at }: { at: number }) => {
  const frame = useCurrentFrame();
  const portrait = useIsPortrait();
  const { width, height } = useVideoConfig();
  const cx = portrait ? 540 : 1420;
  const cy = portrait ? 1110 : 560;
  const sx = portrait ? 225 : 300;
  const syUp = portrait ? 300 : 235;
  const syDown = portrait ? 300 : 255;
  const off = (f: (typeof FORMATS)[number]) => ({ x: f.dx * sx, y: f.dy < 0 ? -syUp : syDown });
  const card = enter(frame, at + 4, 14, EASE.outExpo);
  const burstAt = MOMENTS.featureExportBurst;
  return (
    <>
      <svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
        {FORMATS.map((f, i) => {
          const p = enter(frame, burstAt + i * 3, 16, EASE.outExpo);
          const o = off(f);
          return <line key={i} x1={cx} y1={cy} x2={cx + o.x * p} y2={cy + o.y * p} stroke="hsl(262 100% 72% / 0.7)" strokeWidth={4} strokeDasharray="10 10" strokeDashoffset={-frame * 2} />;
        })}
      </svg>
      <div style={{ position: "absolute", left: cx - 230, top: cy - 130, opacity: card, scale: String(0.94 + 0.06 * card), borderRadius: 16, boxShadow: "0 40px 90px -20px rgba(0,0,0,0.85), 0 0 0 3px hsl(262 100% 72% / 0.5)" }}>
        <Slide deck="aula" index={0} width={460} radius={16} />
      </div>
      {FORMATS.map((f, i) => {
        const p = enter(frame, burstAt + i * 3, 16, EASE.outExpo);
        const o = off(f);
        return (
          <div
            key={f.label}
            style={{
              position: "absolute",
              left: cx + o.x * p - 170,
              top: cy + o.y * p - 60,
              width: 340,
              height: 120,
              borderRadius: 24,
              background: i === 3 ? GRADIENT.hero : "#fff",
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "0 22px",
              boxShadow: "0 24px 50px -16px rgba(0,0,0,0.7)",
              opacity: Math.min(1, p * 2),
              scale: String(0.9 + 0.1 * p),
            }}
          >
            <div style={{ width: 64, height: 64, borderRadius: 18, background: i === 3 ? "hsl(0 0% 100% / 0.2)" : GRADIENT.primary, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                {i === 3 ? (
                  <>
                    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
                    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
                  </>
                ) : (
                  <>
                    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                    <path d="M14 3v5h5" />
                  </>
                )}
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 30, whiteSpace: "nowrap", color: i === 3 ? "#fff" : "hsl(240 20% 12%)" }}>{f.label}</div>
              <div style={{ fontFamily: FONT.mono, fontSize: 20, color: i === 3 ? "hsl(0 0% 100% / 0.85)" : "hsl(240 8% 46%)" }}>{f.ext}</div>
            </div>
          </div>
        );
      })}
    </>
  );
};

export const Features = () => {
  const [a, b, c] = MOMENTS.featureHits;
  return (
    <AbsoluteFill>
      <GridBg />
      <Hit at={a} end={b} n="01" title={["Ajuste", "\n", { t: "conversando.", look: "gradient" }]} sub="Peça em português. A IA aplica.">
        <ChatEdit at={a} />
      </Hit>
      <Hit at={b} end={c} n="02" title={["Falas", "\n", { t: "prontas.", look: "gradient" }]} sub="Um roteiro de fala para cada slide.">
        <Notes at={b} />
      </Hit>
      <Hit at={c} end={204} n="03" title={["Exporte", "ou", "\n", { t: "apresente.", look: "gradient" }]} sub="PowerPoint, PDF, imagens ou link.">
        <Export at={c} />
      </Hit>
    </AbsoluteFill>
  );
};
