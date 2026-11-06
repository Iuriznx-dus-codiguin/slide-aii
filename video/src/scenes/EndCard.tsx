import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { beatPulse, enter, tw, useIsPortrait } from "../anim";
import { LightBg } from "../bg/LightBg";
import { Pointer } from "../components/ui";
import { Slide } from "../decks/Decks";
import { Shockwave } from "../mg/Fx";
import { Sparkle } from "../mg/Sparkle";
import { Words, type Token } from "../mg/Text";
import { C, EASE, FONT, GRADIENT, L } from "../theme";
import { MOMENTS } from "../timeline";

// 40.2–45 s, light world. Direct: promise restated, one button, URL, entry
// price and the current PRO discount, trust line from the site. Holds 4.8 s.
// 16:9: copy column left, product collage right. 9:16: everything stacked,
// full-width button (thumb-friendly) and nothing important in the bottom
// strip that the Shorts/Reels UI covers.

type Props = { price: string; discount: string; url: string };

const GEO = {
  landscape: {
    logo: { left: 140, top: 110 },
    promise: { left: 140, top: 270, size: 92 },
    lines: [["Sua", "apresentação", "pronta"], ["em", "cerca", "de", { t: "1", look: "marker" }, { t: "minuto.", look: "marker" }]] as Token[][],
    btn: { x: 140, y: 600, w: 760, h: 124 },
    url: { left: 948, top: 618, center: false },
    offer: { left: 140, top: 790 },
    trust: { left: 140, top: 900 },
    slideA: { left: 1380, top: 270, w: 440, r: 6 },
    slideB: { left: 1460, top: 580, w: 360, r: -5 },
    chip: { left: 1300, top: 830 },
    pointerFrom: [1100, 1020],
  },
  portrait: {
    logo: { left: 70, top: 240 },
    promise: { left: 70, top: 380, size: 96 },
    lines: [["Sua", "apresentação"], ["pronta", "em", "cerca"], ["de", { t: "1", look: "marker" }, { t: "minuto.", look: "marker" }]] as Token[][],
    btn: { x: 70, y: 1180, w: 940, h: 130 },
    url: { left: 0, top: 1330, center: true },
    offer: { left: 70, top: 1418 },
    trust: { left: 70, top: 1500 },
    slideA: { left: 330, top: 745, w: 620, r: 4 },
    slideB: { left: 70, top: 950, w: 360, r: -6 },
    chip: { left: 560, top: 700 },
    pointerFrom: [900, 1760],
  },
};

export const EndCard = ({ price, discount, url }: Props) => {
  const frame = useCurrentFrame();
  const portrait = useIsPortrait();
  const G = portrait ? GEO.portrait : GEO.landscape;
  const BTN = G.btn;
  const pulse = beatPulse(frame, 6);
  const logo = enter(frame, 0, 18, EASE.outExpo);
  const btn = enter(frame, MOMENTS.endButton, 16, EASE.outBack);
  const urlP = enter(frame, MOMENTS.endButton + 8, 16, EASE.outExpo);
  const offer = enter(frame, MOMENTS.endButton + 18, 16, EASE.outBack);
  const trust = enter(frame, MOMENTS.endButton + 28, 16, EASE.outExpo);
  const click = MOMENTS.endClick;
  const [fx, fy] = G.pointerFrom;
  const tx = BTN.x + BTN.w * 0.7;
  const ty = BTN.y + BTN.h * 0.6;
  const pMove = tw(frame, [click - 20, click - 1], [0, 1], EASE.inOut);
  const px = fx + (tx - fx) * pMove;
  const py = fy + (ty - fy) * pMove;
  const pressed = tw(frame, [click - 2, click, click + 6], [0, 1, 0]);
  const pointerO = tw(frame, [click - 22, click - 16], [0, 1]) * (1 - tw(frame, [click + 14, click + 20], [0, 1]));
  const shine = tw(frame, [click + 2, click + 26], [-20, 120], EASE.inOut);
  const collage = enter(frame, 10, 24, EASE.outExpo);
  const t = frame / 30;
  const headStyle = { fontFamily: FONT.sans, fontWeight: 800, fontSize: G.promise.size, letterSpacing: -3.5, color: L.ink, lineHeight: 1.06 };

  return (
    <AbsoluteFill>
      <LightBg glow={1.3} layout="end" />

      {/* Product collage */}
      <div style={{ position: "absolute", left: G.slideA.left, top: G.slideA.top, opacity: collage, translate: `${(1 - collage) * 160}px ${Math.sin(t * 1.3) * 10}px`, rotate: `${G.slideA.r - 2 * collage}deg` }}>
        <div style={{ borderRadius: 18, boxShadow: "0 50px 100px -30px hsl(252 80% 30% / 0.55), 0 0 0 3px #fff" }}>
          <Slide deck="aula" index={0} width={G.slideA.w} radius={18} />
        </div>
      </div>
      <div style={{ position: "absolute", left: G.slideB.left, top: G.slideB.top, opacity: collage, translate: `${(1 - collage) * (portrait ? -160 : 220)}px ${Math.sin(t * 1.3 + 1.5) * 12}px`, rotate: `${G.slideB.r}deg` }}>
        <div style={{ borderRadius: 14, boxShadow: "0 40px 80px -24px hsl(252 80% 30% / 0.5), 0 0 0 3px #fff" }}>
          <Slide deck="pitch" index={0} width={G.slideB.w} radius={14} />
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: G.chip.left,
          top: G.chip.top,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "16px 24px",
          borderRadius: "24px 24px 24px 6px",
          background: L.soft,
          border: `3px solid hsl(252 100% 88%)`,
          fontFamily: FONT.sans,
          fontSize: portrait ? 32 : 28,
          fontWeight: 700,
          color: L.softInk,
          opacity: enter(frame, 40, 14),
          scale: String(enter(frame, 40, 16, EASE.outBack)),
          translate: `0 ${Math.sin(t * 1.6) * 8}px`,
          boxShadow: "0 16px 30px -14px hsl(252 60% 30% / 0.35)",
        }}
      >
        <Sparkle size={30} color={C.primary} />
        Deixe mais visual
      </div>

      {/* Logo */}
      <div style={{ position: "absolute", ...G.logo, display: "flex", alignItems: "center", gap: 22, opacity: logo, translate: `0 ${(1 - logo) * -30}px` }}>
        <div style={{ width: 100, height: 100, borderRadius: 26, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 16px 40px -12px hsl(252 100% 50% / 0.5), 0 0 0 2px hsl(252 100% 92%)" }}>
          <Img src={staticFile("brand/logo.png")} style={{ width: 86, height: 86 }} />
        </div>
        <div style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 66, color: L.ink, letterSpacing: -2 }}>SlideAI</div>
      </div>

      {/* Promise */}
      <div style={{ position: "absolute", left: G.promise.left, top: G.promise.top }}>
        {G.lines.map((line, i) => (
          <Words key={i} tokens={line} at={6 + i * 10} stagger={4} dur={18} mode="rise" style={headStyle} />
        ))}
      </div>

      {/* CTA button */}
      <div
        style={{
          position: "absolute",
          left: BTN.x,
          top: BTN.y,
          width: BTN.w,
          height: BTN.h,
          borderRadius: 30,
          background: GRADIENT.primary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          color: "#fff",
          fontFamily: FONT.sans,
          fontWeight: 800,
          fontSize: portrait ? 50 : 46,
          overflow: "hidden",
          boxShadow: `0 30px 70px -20px hsl(252 100% 45% / ${0.6 + pulse * 0.2})`,
          opacity: Math.min(1, btn * 2),
          scale: String((0.6 + 0.4 * btn) * (1 - pressed * 0.05)),
          transformOrigin: portrait ? "50% 50%" : "0% 50%",
        }}
      >
        <Sparkle size={44} color="#fff" style={{ rotate: `${frame * 3}deg` }} />
        Criar minha apresentação
        <div style={{ position: "absolute", top: -20, bottom: -20, left: `${shine}%`, width: 140, background: "linear-gradient(100deg, transparent, hsl(0 0% 100% / 0.55), transparent)", rotate: "14deg" }} />
      </div>
      <div
        style={{
          position: "absolute",
          left: G.url.center ? 0 : G.url.left,
          right: G.url.center ? 0 : undefined,
          top: G.url.top,
          textAlign: G.url.center ? "center" : "left",
          opacity: urlP,
          translate: G.url.center ? `0 ${(1 - urlP) * 30}px` : `${(1 - urlP) * 40}px 0`,
        }}
      >
        <div style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 64, color: L.ink, letterSpacing: -1.5 }}>{url}</div>
      </div>

      {/* Offer */}
      <div style={{ position: "absolute", ...G.offer, display: "flex", alignItems: "center", gap: portrait ? 20 : 26, opacity: Math.min(1, offer * 2), translate: `0 ${(1 - offer) * 30}px` }}>
        <div style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: portrait ? 42 : 46, color: L.ink, whiteSpace: "nowrap" }}>{price}</div>
        <div
          style={{
            padding: portrait ? "10px 22px" : "12px 26px",
            borderRadius: 999,
            background: GRADIENT.hero,
            color: "#fff",
            fontFamily: FONT.sans,
            fontWeight: 800,
            fontSize: portrait ? 32 : 36,
            whiteSpace: "nowrap",
            scale: String(1 + pulse * 0.04),
            boxShadow: "0 14px 30px -10px hsl(270 100% 50% / 0.6)",
          }}
        >
          {discount}
        </div>
      </div>
      <div style={{ position: "absolute", ...G.trust, fontFamily: FONT.mono, fontSize: portrait ? 23 : 26, color: L.muted, opacity: trust, letterSpacing: 0.5, whiteSpace: "nowrap" }}>
        Pagamento seguro · Cancele quando quiser · 7 dias para desistir
      </div>

      <AbsoluteFill style={{ opacity: pointerO }}>
        <Pointer x={px} y={py} pressed={pressed} />
      </AbsoluteFill>
      <Shockwave at={click} x={tx} y={ty} size={700} rings={2} color={C.primary} width={8} />
    </AbsoluteFill>
  );
};
