import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { enter, tw, useIsPortrait } from "../anim";
import { LightBg } from "../bg/LightBg";
import { Pointer } from "../components/ui";
import { Slide } from "../decks/Decks";
import { Shockwave } from "../mg/Fx";
import { Sparkle } from "../mg/Sparkle";
import { Words, type Token } from "../mg/Text";
import { EASE, FONT, GRADIENT, L } from "../theme";
import { MOMENTS } from "../timeline";

// 34.7–40 s, light world. Direct: the landing page's headline ("Crie
// apresentações incríveis com IA"), one button, URL, entry price, the PRO
// discount and the site's trust line. 16:9: copy column left, product collage
// right. 9:16: stacked, full-width button, nothing important in the bottom
// strip that the Shorts/Reels UI covers.

type Props = { price: string; discount: string; url: string };

const INCRIVEIS: Token = { t: "incríveis", look: "gradientInk" };

const GEO = {
  landscape: {
    logo: { left: 140, top: 110 },
    promise: { left: 140, top: 270, size: 100 },
    lines: [["Crie", "apresentações"], [INCRIVEIS, "com", "IA"]] as Token[][],
    btn: { x: 140, y: 600, w: 760, h: 124 },
    url: { left: 948, top: 618, center: false },
    offer: { left: 140, top: 790 },
    trust: { left: 140, top: 900 },
    slideA: { left: 1360, top: 300, w: 460, r: 5 },
    slideB: { left: 1440, top: 610, w: 360, r: -5 },
    pointerFrom: [1100, 1020],
  },
  portrait: {
    logo: { left: 70, top: 240 },
    promise: { left: 70, top: 380, size: 100 },
    lines: [["Crie"], ["apresentações"], [INCRIVEIS, "com", "IA"]] as Token[][],
    btn: { x: 70, y: 1180, w: 940, h: 130 },
    url: { left: 0, top: 1330, center: true },
    offer: { left: 70, top: 1418 },
    trust: { left: 70, top: 1500 },
    slideA: { left: 330, top: 760, w: 620, r: 4 },
    slideB: { left: 60, top: 990, w: 320, r: -6 },
    pointerFrom: [900, 1760],
  },
};

export const EndCard = ({ price, discount, url }: Props) => {
  const frame = useCurrentFrame();
  const portrait = useIsPortrait();
  const G = portrait ? GEO.portrait : GEO.landscape;
  const BTN = G.btn;
  const logo = enter(frame, 0, 16, EASE.outExpo);
  const btn = enter(frame, MOMENTS.endButton, 16, EASE.outExpo);
  const urlP = enter(frame, MOMENTS.endButton + 6, 16, EASE.outExpo);
  const offer = enter(frame, MOMENTS.endButton + 14, 16, EASE.outExpo);
  const trust = enter(frame, MOMENTS.endButton + 22, 16, EASE.outExpo);
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
  const collage = enter(frame, 8, 22, EASE.outExpo);
  const t = frame / 30;
  const headStyle = { fontFamily: FONT.sans, fontWeight: 800, fontSize: G.promise.size, letterSpacing: -3.5, color: L.ink, lineHeight: 1.06 };

  return (
    <AbsoluteFill>
      <LightBg glow={1.2} shapes={false} />

      {/* Product collage */}
      <div style={{ position: "absolute", left: G.slideA.left, top: G.slideA.top, opacity: collage, translate: `${(1 - collage) * 80}px ${Math.sin(t * 1.2) * 6}px`, rotate: `${G.slideA.r}deg` }}>
        <div style={{ borderRadius: 18, boxShadow: "0 40px 90px -30px hsl(252 80% 30% / 0.45), 0 0 0 2px #fff" }}>
          <Slide deck="aula" index={0} width={G.slideA.w} radius={18} />
        </div>
      </div>
      <div style={{ position: "absolute", left: G.slideB.left, top: G.slideB.top, opacity: collage, translate: `${(1 - collage) * (portrait ? -80 : 110)}px ${Math.sin(t * 1.2 + 1.5) * 7}px`, rotate: `${G.slideB.r}deg` }}>
        <div style={{ borderRadius: 14, boxShadow: "0 30px 70px -24px hsl(252 80% 30% / 0.45), 0 0 0 2px #fff" }}>
          <Slide deck="pitch" index={0} width={G.slideB.w} radius={14} />
        </div>
      </div>

      {/* Logo */}
      <div style={{ position: "absolute", ...G.logo, display: "flex", alignItems: "center", gap: 22, opacity: logo, translate: `0 ${(1 - logo) * -20}px` }}>
        <div style={{ width: 100, height: 100, borderRadius: 26, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 14px 34px -12px hsl(252 100% 50% / 0.45), 0 0 0 2px hsl(252 100% 93%)" }}>
          <Img src={staticFile("brand/logo.png")} style={{ width: 86, height: 86 }} />
        </div>
        <div style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 66, color: L.ink, letterSpacing: -2 }}>SlideAI</div>
      </div>

      {/* Landing headline */}
      <div style={{ position: "absolute", left: G.promise.left, top: G.promise.top }}>
        {G.lines.map((line, i) => (
          <Words key={i} tokens={line} at={4 + i * 6} stagger={3} dur={16} mode="rise" style={headStyle} />
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
          boxShadow: "0 26px 60px -20px hsl(252 100% 45% / 0.6)",
          opacity: btn,
          translate: `0 ${(1 - btn) * 24}px`,
          scale: String(1 - pressed * 0.04),
        }}
      >
        <Sparkle size={42} color="#fff" />
        Criar minha apresentação
        <div style={{ position: "absolute", top: -20, bottom: -20, left: `${shine}%`, width: 140, background: "linear-gradient(100deg, transparent, hsl(0 0% 100% / 0.5), transparent)", rotate: "14deg" }} />
      </div>
      <div
        style={{
          position: "absolute",
          left: G.url.center ? 0 : G.url.left,
          right: G.url.center ? 0 : undefined,
          top: G.url.top,
          textAlign: G.url.center ? "center" : "left",
          opacity: urlP,
          translate: G.url.center ? `0 ${(1 - urlP) * 20}px` : `${(1 - urlP) * 30}px 0`,
        }}
      >
        <div style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 64, color: L.ink, letterSpacing: -1.5 }}>{url}</div>
      </div>

      {/* Offer */}
      <div style={{ position: "absolute", ...G.offer, display: "flex", alignItems: "center", gap: portrait ? 20 : 26, opacity: offer, translate: `0 ${(1 - offer) * 20}px` }}>
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
            boxShadow: "0 12px 26px -10px hsl(270 100% 50% / 0.55)",
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
      <Shockwave at={click} x={tx} y={ty} size={380} rings={1} dur={20} color="hsl(252 100% 64% / 0.5)" width={4} />
    </AbsoluteFill>
  );
};
