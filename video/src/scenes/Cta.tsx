import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { tw } from "../anim";
import { ScaledSlide } from "../components/DeckSlide";
import { Sparkle } from "../components/Sparkle";
import { Logo } from "../components/ui";
import { C, EASE, FONT, GRADIENT } from "../theme";
import { MOMENTS } from "../timeline";

// End card on the site's CTA gradient. Holds long enough to read the URL.

type Props = {
  price: string;
  url: string;
};

const LINES = ["Sua próxima apresentação", "está a um prompt", "de distância."];

export const Cta = ({ price, url }: Props) => {
  const frame = useCurrentFrame();
  const btn = tw(frame, [MOMENTS.ctaButton, MOMENTS.ctaButton + 14], [0, 1], EASE.outBack);
  const urlP = tw(frame, [MOMENTS.ctaButton + 8, MOMENTS.ctaButton + 22], [0, 1], EASE.outExpo);
  const priceP = tw(frame, [MOMENTS.ctaButton + 16, MOMENTS.ctaButton + 30], [0, 1], EASE.outExpo);
  const logoP = tw(frame, [0, 16], [0, 1], EASE.outExpo);
  const shine = tw(frame, [84, 108], [-30, 130], EASE.inOut);
  const slideP = tw(frame, [10, 40], [0, 1], EASE.outExpo);

  return (
    <AbsoluteFill style={{ background: GRADIENT.hero, overflow: "hidden" }}>
      <Img
        src={staticFile("brand/hero-slides.jpg")}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.28,
          mixBlendMode: "soft-light",
          scale: String(1.05 + frame * 0.0004),
        }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 70% at 20% 50%, hsl(250 80% 30% / 0.45), transparent 70%)" }} />

      {/* Big mnemonic star, bottom right */}
      <div style={{ position: "absolute", right: -150, bottom: -170, opacity: 0.22, rotate: `${frame * 0.4}deg` }}>
        <Sparkle size={760} color="#fff" />
      </div>

      {/* Product reminder */}
      <div
        style={{
          position: "absolute",
          right: 110,
          top: 560,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 50px 100px -30px hsl(250 80% 15% / 0.8)",
          rotate: `${tw(slideP, [0, 1], [18, 7])}deg`,
          translate: `${(1 - slideP) * 200}px ${Math.sin(frame / 22) * 8}px`,
          opacity: slideP,
        }}
      >
        <ScaledSlide index={0} width={400} />
      </div>

      <div style={{ position: "absolute", left: 140, top: 100, display: "flex", alignItems: "center", gap: 22, opacity: logoP, translate: `0 ${(1 - logoP) * -30}px` }}>
        <Logo size={96} />
        <div style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 64, color: "#fff", letterSpacing: -2 }}>SlideAI</div>
      </div>

      <div style={{ position: "absolute", left: 140, top: 290 }}>
        {LINES.map((line, i) => {
          const p = tw(frame, [6 + i * 6, 24 + i * 6], [0, 1], EASE.outExpo);
          return (
            <div key={line} style={{ overflow: "hidden", paddingBottom: 8 }}>
              <div
                style={{
                  fontFamily: FONT.sans,
                  fontWeight: 800,
                  fontSize: 112,
                  lineHeight: 1.04,
                  letterSpacing: -4,
                  color: "#fff",
                  translate: `0 ${(1 - p) * 110}%`,
                }}
              >
                {line}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ position: "absolute", left: 140, top: 730, display: "flex", alignItems: "center", gap: 48 }}>
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            padding: "30px 52px",
            borderRadius: 24,
            background: "#fff",
            color: C.primary,
            fontFamily: FONT.sans,
            fontWeight: 800,
            fontSize: 44,
            display: "flex",
            alignItems: "center",
            gap: 20,
            boxShadow: "0 30px 70px -20px hsl(250 80% 20% / 0.7)",
            opacity: tw(frame, [MOMENTS.ctaButton, MOMENTS.ctaButton + 4], [0, 1]),
            scale: String(0.7 + 0.3 * btn),
          }}
        >
          Criar minha apresentação
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${shine}%`,
              width: 120,
              background: "linear-gradient(100deg, transparent, hsl(262 100% 80% / 0.45), transparent)",
              rotate: "12deg",
            }}
          />
        </div>
        <div style={{ opacity: urlP, translate: `${(1 - urlP) * 40}px 0` }}>
          <div style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 60, color: "#fff", letterSpacing: -1 }}>{url}</div>
          <div style={{ fontFamily: FONT.sans, fontWeight: 600, fontSize: 32, color: "hsl(0 0% 100% / 0.85)", opacity: priceP, marginTop: 4 }}>
            {price}
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 140,
          bottom: 70,
          fontFamily: FONT.mono,
          fontSize: 24,
          color: "hsl(0 0% 100% / 0.8)",
          letterSpacing: 1,
          opacity: priceP,
        }}
      >
        PowerPoint · PDF · link público
      </div>
    </AbsoluteFill>
  );
};
