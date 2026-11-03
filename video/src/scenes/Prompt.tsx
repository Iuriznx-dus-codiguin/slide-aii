import { AbsoluteFill, useCurrentFrame } from "remotion";
import { tw } from "../anim";
import { Backdrop } from "../components/Backdrop";
import { ScaledSlide } from "../components/DeckSlide";
import { Sparkle } from "../components/Sparkle";
import { AppWindow, Chip, Pointer, SimTag, StepLabel } from "../components/ui";
import { C, EASE, FONT, GRADIENT, gradientText } from "../theme";
import { MOMENTS } from "../timeline";

// 01 Describe the topic -> 02 the AI writes, lays out and illustrates.
// Product UI is the proof: typing, one click, explicit generation states.

export const PROMPT_TEXT = "Pitch para investidores da Café Raiz, uma cafeteria sustentável";

const STEPS = ["Escrevendo o roteiro", "Montando os layouts", "Escolhendo as imagens", "Criando os gráficos"];

const WIN = { x: 790, y: 180, w: 1000, h: 700 };
const BUTTON = { x: 48, y: 510, w: 904, h: 84 }; // relative to window body

export const Prompt = () => {
  const frame = useCurrentFrame();
  const { promptTypeStart, promptTypeEnd, promptClick, promptSteps } = MOMENTS;

  const typed = Math.round(tw(frame, [promptTypeStart, promptTypeEnd], [0, PROMPT_TEXT.length]));
  const caretOn = Math.floor(frame / 10) % 2 === 0 || (frame > promptTypeStart && frame < promptTypeEnd);

  const winIn = tw(frame, [0, 22], [0, 1], EASE.outExpo);
  const phaseA = 1 - tw(frame, [promptClick + 4, promptClick + 14], [0, 1], EASE.inQuad);
  const phaseB = tw(frame, [promptClick + 10, promptClick + 24], [0, 1], EASE.outExpo);

  // Pointer path: drifts in, lands on the button, clicks.
  const btnCx = WIN.x + BUTTON.x + BUTTON.w * 0.62;
  const btnCy = WIN.y + 64 + BUTTON.y + BUTTON.h * 0.5;
  const pMove = tw(frame, [promptTypeEnd - 4, promptClick - 2], [0, 1], EASE.inOut);
  const px = 1500 + (btnCx - 1500) * pMove;
  const py = 1010 + (btnCy - 1010) * pMove;
  const pressed = tw(frame, [promptClick - 2, promptClick, promptClick + 5], [0, 1, 0]);
  const pointerOpacity = tw(frame, [promptTypeEnd - 8, promptTypeEnd], [0, 1]) * phaseA;

  const progress = tw(frame, [promptClick + 12, promptSteps[3] + 10], [0, 100]);
  const clickFlash = tw(frame, [promptClick, promptClick + 3, promptClick + 16], [0, 1, 0]);

  return (
    <AbsoluteFill>
      <Backdrop intensity={0.85} seed={11} />

      {/* Left column copy, swaps at the click */}
      <div style={{ position: "absolute", left: 140, top: 0, bottom: 0, width: 580 }}>
        <div
          style={{
            position: "absolute",
            top: 300,
            opacity: phaseA * tw(frame, [4, 16], [0, 1]),
            translate: `${tw(frame, [4, 22], [-50, 0], EASE.outExpo)}px ${(1 - phaseA) * -30}px`,
          }}
        >
          <StepLabel n="01">Você</StepLabel>
          <div style={{ height: 36 }} />
          <div style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 104, lineHeight: 1.0, color: C.fg, letterSpacing: -3 }}>
            Descreva
            <br />o tema.
          </div>
          <div style={{ height: 30 }} />
          <div style={{ fontFamily: FONT.sans, fontSize: 40, color: C.fgMuted, lineHeight: 1.3 }}>
            Em poucas palavras.
            <br />
            Quanto mais contexto, melhor.
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            top: 300,
            opacity: phaseB,
            translate: `0 ${(1 - phaseB) * 40}px`,
          }}
        >
          <StepLabel n="02">SlideAI</StepLabel>
          <div style={{ height: 36 }} />
          <div style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 96, lineHeight: 1.02, color: C.fg, letterSpacing: -3 }}>
            A IA escreve,
            <br />
            monta e <span style={gradientText()}>ilustra.</span>
          </div>
          <div style={{ height: 30 }} />
          <div style={{ fontFamily: FONT.sans, fontSize: 40, color: C.fgMuted, lineHeight: 1.3 }}>
            Roteiro, layout, imagens
            <br />e gráficos no mesmo passo.
          </div>
        </div>
      </div>

      {/* Product window */}
      <div
        style={{
          position: "absolute",
          left: WIN.x,
          top: WIN.y,
          opacity: winIn,
          translate: `${(1 - winIn) * 120}px 0`,
          scale: String(0.94 + 0.06 * winIn),
        }}
      >
        <AppWindow url="slideai.com.br/gerar" width={WIN.w} height={WIN.h}>
          {/* Phase A: prompt form */}
          <div style={{ position: "absolute", inset: 0, padding: 48, opacity: phaseA }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Sparkle size={40} color={C.primary} />
              <div style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 44, color: C.uiFg, letterSpacing: -1 }}>
                Nova apresentação
              </div>
            </div>
            <div style={{ height: 28 }} />
            <div style={{ fontFamily: FONT.sans, fontSize: 26, color: C.uiMuted, fontWeight: 500 }}>
              Sobre o que é a sua apresentação?
            </div>
            <div style={{ height: 14 }} />
            <div
              style={{
                height: 210,
                borderRadius: 18,
                border: `3px solid ${frame > promptTypeStart - 6 ? C.primary : C.uiBorder}`,
                boxShadow: frame > promptTypeStart - 6 ? "0 0 0 6px hsl(252 100% 64% / 0.15)" : "none",
                padding: "24px 28px",
                fontFamily: FONT.sans,
                fontSize: 38,
                lineHeight: 1.35,
                color: C.uiFg,
                fontWeight: 500,
              }}
            >
              {PROMPT_TEXT.slice(0, typed)}
              <span
                style={{
                  display: "inline-block",
                  width: 4,
                  height: 44,
                  marginLeft: 3,
                  translate: "0 8px",
                  background: C.primary,
                  opacity: caretOn ? 1 : 0,
                }}
              />
            </div>
            <div style={{ height: 26 }} />
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {["8 slides", "Tom profissional", "Com imagens", "Português"].map((c, i) => (
                <Chip
                  key={c}
                  active={i === 0}
                  style={{
                    opacity: tw(frame, [30 + i * 4, 40 + i * 4], [0, 1]),
                    translate: `0 ${tw(frame, [30 + i * 4, 44 + i * 4], [16, 0], EASE.outBack)}px`,
                  }}
                >
                  {c}
                </Chip>
              ))}
            </div>
          </div>

          {/* The button stays put across the phase switch so the click reads */}
          <div
            style={{
              position: "absolute",
              left: BUTTON.x,
              top: BUTTON.y,
              width: BUTTON.w,
              height: BUTTON.h,
              borderRadius: 20,
              background: GRADIENT.primary,
              boxShadow: `0 18px 40px -12px hsl(252 100% 50% / ${0.55 + clickFlash * 0.4})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              scale: String(1 - pressed * 0.04),
              opacity: phaseA,
            }}
          >
            <Sparkle size={30} color="#fff" style={{ rotate: `${frame * 2}deg` }} />
            <div style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: 34, color: "#fff" }}>Gerar apresentação</div>
          </div>

          {/* Phase B: generation states */}
          <div style={{ position: "absolute", inset: 0, padding: 48, opacity: phaseB, translate: `0 ${(1 - phaseB) * 30}px` }}>
            <div
              style={{
                padding: "18px 24px",
                borderRadius: 16,
                background: C.uiSecondary,
                fontFamily: FONT.sans,
                fontSize: 24,
                color: C.uiSecondaryFg,
                fontWeight: 500,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              “{PROMPT_TEXT}”
            </div>
            <div style={{ height: 30 }} />
            {STEPS.map((s, i) => {
              const done = frame >= promptSteps[i];
              const active = !done && (i === 0 ? frame >= promptClick + 10 : frame >= promptSteps[i - 1]);
              const checkP = tw(frame, [promptSteps[i], promptSteps[i] + 8], [0, 1], EASE.outBack);
              return (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 22, height: 72 }}>
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 99,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: done ? C.success : "transparent",
                      border: done ? "none" : `4px solid ${active ? C.primary : C.uiBorder}`,
                      borderTopColor: active ? "transparent" : undefined,
                      rotate: active ? `${frame * 14}deg` : "0deg",
                      scale: done ? String(0.6 + 0.4 * checkP) : "1",
                    }}
                  >
                    {done ? (
                      <svg width="26" height="26" viewBox="0 0 24 24">
                        <path d="M5 12.5 L10 17 L19 7" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </div>
                  <div
                    style={{
                      fontFamily: FONT.sans,
                      fontSize: 34,
                      fontWeight: done || active ? 700 : 500,
                      color: done || active ? C.uiFg : C.uiMuted,
                    }}
                  >
                    {s}
                  </div>
                </div>
              );
            })}
            <div style={{ height: 26 }} />
            <div style={{ display: "flex", gap: 10 }}>
              {Array.from({ length: 8 }).map((_, i) => {
                const at = promptSteps[1] + i * 5;
                const show = tw(frame, [at, at + 8], [0, 1], EASE.outQuart);
                return (
                  <div
                    key={i}
                    style={{
                      width: 98,
                      height: 55,
                      borderRadius: 8,
                      background: C.uiMutedBg,
                      border: `2px solid ${C.uiBorder}`,
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <div style={{ position: "absolute", inset: 0, opacity: show, scale: String(0.8 + 0.2 * show) }}>
                      <ScaledSlide index={i} width={98} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ height: 30 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ flex: 1, height: 14, borderRadius: 99, background: C.uiMutedBg, overflow: "hidden" }}>
                <div style={{ width: `${progress}%`, height: "100%", background: GRADIENT.primary, borderRadius: 99 }} />
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 26, fontWeight: 700, color: C.primary, width: 90, textAlign: "right" }}>
                {Math.round(progress)}%
              </div>
            </div>
          </div>
        </AppWindow>
      </div>

      <AbsoluteFill style={{ opacity: pointerOpacity }}>
        <Pointer x={px} y={py} pressed={pressed} />
      </AbsoluteFill>
      <SimTag opacity={tw(frame, [promptClick, promptClick + 12], [0, 1])} />
    </AbsoluteFill>
  );
};
