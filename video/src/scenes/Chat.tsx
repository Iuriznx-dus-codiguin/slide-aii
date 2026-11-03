import { AbsoluteFill, useCurrentFrame } from "remotion";
import { tw } from "../anim";
import { Backdrop } from "../components/Backdrop";
import { RevenueSlide, SLIDE_W } from "../components/DeckSlide";
import { Sparkle } from "../components/Sparkle";
import { SimTag, StepLabel } from "../components/ui";
import { C, EASE, FONT, GRADIENT, gradientText } from "../theme";
import { MOMENTS } from "../timeline";

// 03 Edit by chatting. The user asks for a chart in plain Portuguese; the
// slide's bullet list turns into a bar chart.

const SLIDE = { x: 140, y: 330, w: 1040 };
const PANEL = { x: 1230, y: 330, w: 550, h: 585 };

const USER_MSG = "Deixe o slide 3 mais visual, com um gráfico de crescimento.";
const AI_MSG = "Pronto. Troquei a lista por um gráfico de barras.";

export const Chat = () => {
  const frame = useCurrentFrame();
  const { chatUserMsg, chatReply, chatMorph } = MOMENTS;

  const head = tw(frame, [2, 18], [0, 1], EASE.outExpo);
  const slideIn = tw(frame, [0, 18], [0, 1], EASE.outQuart);
  const panelIn = tw(frame, [4, 22], [0, 1], EASE.outExpo);
  const userP = tw(frame, [chatUserMsg, chatUserMsg + 12], [0, 1], EASE.outBack);
  const typingOn = frame >= chatUserMsg + 16 && frame < chatReply;
  const aiP = tw(frame, [chatReply, chatReply + 12], [0, 1], EASE.outBack);
  const bullets = 1 - tw(frame, [chatMorph, chatMorph + 10], [0, 1]);
  const chartO = tw(frame, [chatMorph + 4, chatMorph + 10], [0, 1]);
  const chartP = tw(frame, [chatMorph + 4, chatMorph + 40], [0, 1], EASE.outQuart);
  const ring = tw(frame, [chatMorph - 4, chatMorph + 6, chatMorph + 40], [0, 1, 0]);
  const star = tw(frame, [chatMorph - 2, chatMorph + 6, chatMorph + 22], [0, 1, 0]);
  const scale = SLIDE.w / SLIDE_W;

  return (
    <AbsoluteFill>
      <Backdrop intensity={0.9} seed={23} />

      <div style={{ position: "absolute", left: 140, top: 92, opacity: head, translate: `${(1 - head) * -50}px 0` }}>
        <StepLabel n="03">Você + IA</StepLabel>
        <div style={{ height: 20 }} />
        <div style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 96, lineHeight: 1, letterSpacing: -3, color: C.fg }}>
          Peça ajustes <span style={gradientText()}>em português.</span>
        </div>
      </div>

      {/* Slide being edited */}
      <div
        style={{
          position: "absolute",
          left: SLIDE.x,
          top: SLIDE.y,
          opacity: slideIn,
          translate: `${(1 - slideIn) * -80}px 0`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: -10,
            borderRadius: 26,
            boxShadow: `0 0 0 ${4 + ring * 6}px hsl(262 100% 72% / ${0.25 + ring * 0.6}), 0 0 ${ring * 90}px hsl(262 100% 72% / ${ring * 0.7})`,
          }}
        />
        <div style={{ width: SLIDE.w, height: SLIDE.w * 0.5625, borderRadius: 18, overflow: "hidden", boxShadow: "0 40px 90px -30px rgba(0,0,0,0.8)" }}>
          <div style={{ scale: String(scale), transformOrigin: "0 0" }}>
            <RevenueSlide bulletsOpacity={bullets} chartOpacity={chartO} chartProgress={chartP} />
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 24,
            top: -24,
            padding: "8px 18px",
            borderRadius: 999,
            background: GRADIENT.primary,
            fontFamily: FONT.mono,
            fontWeight: 700,
            fontSize: 22,
            color: "#fff",
          }}
        >
          Slide 3 de 8
        </div>
        <div style={{ position: "absolute", right: -36, top: -40, opacity: star, scale: String(0.5 + star), rotate: `${frame * 5}deg` }}>
          <Sparkle size={90} color="hsl(262 100% 82%)" />
        </div>
      </div>

      {/* Chat panel */}
      <div
        style={{
          position: "absolute",
          left: PANEL.x,
          top: PANEL.y,
          width: PANEL.w,
          height: PANEL.h,
          borderRadius: 26,
          background: C.ui,
          boxShadow: "0 40px 100px -30px rgba(0,0,0,0.8)",
          opacity: panelIn,
          translate: `${(1 - panelIn) * 80}px 0`,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "24px 28px", borderBottom: `2px solid ${C.uiBorder}` }}>
          <Sparkle size={32} color={C.primary} />
          <div style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 32, color: C.uiFg }}>Editar com IA</div>
        </div>

        <div style={{ flex: 1, padding: 26, display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              alignSelf: "flex-end",
              maxWidth: 430,
              padding: "18px 22px",
              borderRadius: "22px 22px 6px 22px",
              background: GRADIENT.primary,
              color: "#fff",
              fontFamily: FONT.sans,
              fontSize: 28,
              lineHeight: 1.3,
              fontWeight: 600,
              opacity: userP,
              scale: String(0.85 + 0.15 * userP),
              translate: `0 ${(1 - userP) * 30}px`,
              transformOrigin: "100% 100%",
            }}
          >
            {USER_MSG}
          </div>

          {typingOn ? (
            <div style={{ alignSelf: "flex-start", display: "flex", gap: 8, padding: "18px 22px", borderRadius: 20, background: C.uiSecondary }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 99,
                    background: C.primary,
                    opacity: 0.35 + 0.65 * Math.max(0, Math.sin((frame - i * 4) / 3)),
                  }}
                />
              ))}
            </div>
          ) : null}

          <div
            style={{
              alignSelf: "flex-start",
              maxWidth: 440,
              padding: "18px 22px",
              borderRadius: "22px 22px 22px 6px",
              background: C.uiSecondary,
              color: C.uiSecondaryFg,
              fontFamily: FONT.sans,
              fontSize: 28,
              lineHeight: 1.3,
              fontWeight: 600,
              opacity: aiP,
              scale: String(0.85 + 0.15 * aiP),
              translate: `0 ${(1 - aiP) * 30}px`,
              transformOrigin: "0% 100%",
              display: aiP > 0 ? "block" : "none",
            }}
          >
            {AI_MSG}
          </div>
        </div>

        <div style={{ margin: 22, padding: "18px 22px", borderRadius: 16, border: `2px solid ${C.uiBorder}`, fontFamily: FONT.sans, fontSize: 24, color: C.uiMuted }}>
          Peça uma alteração…
        </div>
      </div>
      <SimTag />
    </AbsoluteFill>
  );
};
