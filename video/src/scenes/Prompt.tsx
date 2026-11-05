import { AbsoluteFill, useCurrentFrame } from "remotion";
import { enter, tw } from "../anim";
import { LightBg } from "../bg/LightBg";
import { Pointer, SimTag } from "../components/ui";
import { Burst, Flash, Shockwave } from "../mg/Fx";
import { Sparkle } from "../mg/Sparkle";
import { Words } from "../mg/Text";
import { C, EASE, FONT, GRADIENT, L } from "../theme";
import { MOMENTS } from "../timeline";

// 9–15.6 s, light world. Step 1: the viewer types a topic in the real form
// ("Título / Tema"); step 2: one click and the AI works through the stages
// the product shows ("Direção de arte, roteiro e ilustração").

export const TOPIC = "Energia solar para o 9º ano";
const STAGES = ["Direção de arte", "Roteiro", "Ilustração"];

const BAR = { x: 230, y: 470, w: 1460, h: 180 };
const BTN = { w: 300, h: 120 };

const KickerChip = ({ text, p }: { text: string; p: number }) => (
  <div
    style={{
      padding: "12px 26px",
      borderRadius: 999,
      background: L.lavender,
      border: "2px solid hsl(252 100% 85%)",
      fontFamily: FONT.mono,
      fontSize: 26,
      fontWeight: 700,
      letterSpacing: 3,
      color: C.primary,
      opacity: p,
      translate: `0 ${(1 - p) * 20}px`,
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </div>
);

export const Prompt = () => {
  const frame = useCurrentFrame();
  const { promptTypeStart, promptTypeEnd, promptClick, promptStages, promptBurst } = MOMENTS;

  const typed = Math.round(tw(frame, [promptTypeStart, promptTypeEnd], [0, TOPIC.length]));
  const typing = frame >= promptTypeStart && frame < promptTypeEnd;
  const caretOn = typing || Math.floor(frame / 8) % 2 === 0;
  const barIn = enter(frame, 8, 20, EASE.outExpo);
  const generating = frame >= promptClick;
  const progress = tw(frame, [promptClick + 2, promptBurst], [0, 1], EASE.inOut);
  const pressed = tw(frame, [promptClick - 2, promptClick, promptClick + 6], [0, 1, 0]);
  const burst = enter(frame, promptBurst, 12, EASE.inExpo);

  const btnCx = BAR.x + BAR.w - 30 - BTN.w / 2;
  const btnCy = BAR.y + BAR.h / 2;
  const pMove = tw(frame, [promptTypeEnd - 6, promptClick - 1], [0, 1], EASE.inOut);
  const px = 1560 + (btnCx - 20 - 1560) * pMove;
  const py = 1000 + (btnCy - 10 - 1000) * pMove;
  const pointerO = tw(frame, [promptTypeEnd - 8, promptTypeEnd - 2], [0, 1]) * (1 - tw(frame, [promptClick + 8, promptClick + 14], [0, 1]));

  const stageIdx = promptStages.filter((s) => frame >= s).length; // 0..3

  return (
    <AbsoluteFill>
      <LightBg />
      <AbsoluteFill style={{ scale: String(1 - burst * 0.04) }}>
        {/* Kicker + headline, swap at the click */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 150, display: "flex", justifyContent: "center" }}>
          {generating ? (
            <KickerChip text="PASSO 2 · A IA CRIA" p={enter(frame, promptClick + 2, 10, EASE.outExpo)} />
          ) : (
            <KickerChip text="PASSO 1 · VOCÊ DESCREVE" p={enter(frame, 2, 10, EASE.outExpo)} />
          )}
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 230, display: "flex", justifyContent: "center" }}>
          {generating ? (
            <Words
              key="b"
              tokens={["A", "IA", { t: "cria", look: "gradientInk" }, { t: "tudo.", look: "gradientInk" }]}
              at={promptClick + 2}
              stagger={4}
              dur={18}
              mode="rise"
              style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 120, letterSpacing: -4, color: L.ink }}
            />
          ) : (
            <Words
              key="a"
              tokens={["Descreva", "o", { t: "tema.", look: "marker" }]}
              at={4}
              stagger={5}
              dur={18}
              mode="rise"
              exitAt={promptClick - 4}
              exitDur={6}
              style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 130, letterSpacing: -4, color: L.ink }}
            />
          )}
        </div>

        {/* Prompt bar */}
        <div
          style={{
            position: "absolute",
            left: BAR.x,
            top: BAR.y,
            width: BAR.w,
            height: BAR.h,
            borderRadius: 44,
            background: "#fff",
            border: `4px solid ${generating ? "hsl(252 100% 70%)" : "hsl(252 100% 86%)"}`,
            boxShadow: `0 40px 90px -30px hsl(252 80% 40% / 0.45), 0 0 0 ${generating ? 10 : 0}px hsl(252 100% 64% / 0.12)`,
            opacity: barIn,
            scale: String(0.9 + 0.1 * barIn),
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", left: 30, top: 30, width: 120, height: 120, borderRadius: 32, background: GRADIENT.primary, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkle size={64} color="#fff" style={{ rotate: `${generating ? frame * 8 : 0}deg` }} />
          </div>
          <div style={{ position: "absolute", left: 186, top: 30, right: BTN.w + 60 }}>
            <div style={{ fontFamily: FONT.sans, fontSize: 26, fontWeight: 600, color: L.muted }}>{generating ? "Gerando sua apresentação" : "Título / Tema"}</div>
            <div style={{ fontFamily: FONT.sans, fontSize: 60, fontWeight: 700, color: L.ink, letterSpacing: -1.5, whiteSpace: "nowrap", marginTop: 4 }}>
              {generating ? (
                <span style={{ color: frame >= promptStages[2] ? C.success : C.primary }}>{frame >= promptStages[2] ? "Pronto!" : `${STAGES[stageIdx]}…`}</span>
              ) : (
                <>
                  {TOPIC.slice(0, typed)}
                  <span style={{ display: "inline-block", width: 5, height: 62, marginLeft: 4, translate: "0 10px", background: C.primary, opacity: caretOn ? 1 : 0 }} />
                </>
              )}
            </div>
          </div>
          {/* Generate button */}
          <div
            style={{
              position: "absolute",
              right: 30,
              top: 30,
              width: BTN.w,
              height: BTN.h,
              borderRadius: 32,
              background: GRADIENT.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              color: "#fff",
              fontFamily: FONT.sans,
              fontWeight: 800,
              fontSize: 44,
              scale: String(1 - pressed * 0.06),
              opacity: 1 - tw(frame, [promptClick + 4, promptClick + 10], [0, 1]),
            }}
          >
            Gerar
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </div>
          {/* Percent while generating */}
          <div style={{ position: "absolute", right: 60, top: 54, fontFamily: FONT.mono, fontSize: 60, fontWeight: 700, color: C.primary, opacity: tw(frame, [promptClick + 6, promptClick + 12], [0, 1]) }}>
            {Math.round(progress * 100)}%
          </div>
          {/* Progress fill along the bottom edge */}
          <div style={{ position: "absolute", left: 0, bottom: 0, height: 14, width: `${progress * 100}%`, background: GRADIENT.primary }} />
        </div>

        {/* Option chips (form) → stage chips (generation) */}
        <div style={{ position: "absolute", left: 0, right: 0, top: BAR.y + BAR.h + 50, display: "flex", justifyContent: "center", gap: 18 }}>
          {(generating ? STAGES : ["8 slides", "Português", "Imagens reais", "Gráficos & dados"]).map((c, i) => {
            const done = generating && frame >= promptStages[i];
            const p = generating ? enter(frame, promptStages[i] - 10, 14, EASE.outBack) : enter(frame, 28 + i * 6, 16, EASE.outBack);
            return (
              <div
                key={c}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "16px 30px",
                  borderRadius: 999,
                  fontFamily: FONT.sans,
                  fontSize: 32,
                  fontWeight: 700,
                  color: done ? "#fff" : L.softInk,
                  background: done ? C.success : L.soft,
                  border: `3px solid ${done ? C.success : L.line}`,
                  opacity: p,
                  scale: String(0.6 + 0.4 * p),
                }}
              >
                {done ? (
                  <svg width="30" height="30" viewBox="0 0 24 24">
                    <path d="M5 12.5 L10 17 L19 7" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
                {c}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ opacity: pointerO }}>
        <Pointer x={px} y={py} pressed={pressed} />
      </AbsoluteFill>
      <Shockwave at={promptClick} x={btnCx} y={btnCy} size={900} rings={2} color="hsl(252 100% 64% / 0.8)" width={8} />
      <Burst at={promptBurst} x={960} y={BAR.y + BAR.h / 2} count={30} dist={900} color="hsl(262 100% 66%)" />
      <Shockwave at={promptBurst} x={960} y={BAR.y + BAR.h / 2} size={2600} rings={3} color="hsl(252 100% 64% / 0.7)" />
      <Flash at={promptBurst + 8} color="#fff" dur={10} peak={0.9} />
      <SimTag tone="light" opacity={tw(frame, [promptClick, promptClick + 8], [0, 1])} />
    </AbsoluteFill>
  );
};
