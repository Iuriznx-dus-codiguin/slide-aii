import { AbsoluteFill, useCurrentFrame } from "remotion";
import { tw } from "../anim";
import { Backdrop } from "../components/Backdrop";
import { C, EASE, FONT } from "../theme";
import { MOMENTS } from "../timeline";

// 0–3s. The problem the viewer recognises: deck due tomorrow, nothing done.
// Words STAMP in, the clock TICKS, the camera pushes in. Hard cut out.

const Word = ({ text, at, style }: { text: string; at: number; style?: React.CSSProperties }) => {
  const frame = useCurrentFrame();
  const p = tw(frame, [at, at + 7], [0, 1], EASE.outExpo);
  return (
    <span
      style={{
        display: "inline-block",
        opacity: tw(frame, [at, at + 3], [0, 1]),
        scale: String(1.35 - 0.35 * p),
        filter: `blur(${(1 - p) * 14}px)`,
        marginRight: "0.25em",
        ...style,
      }}
    >
      {text}
    </span>
  );
};

export const Hook = () => {
  const frame = useCurrentFrame();
  const seconds = 8 + MOMENTS.hookTicks.filter((t) => frame >= t).length - 1;
  const push = tw(frame, [0, 90], [1, 1.06], EASE.inQuad);
  const cursorOn = Math.floor(frame / 12) % 2 === 0;
  const slideIn = tw(frame, [0, 22], [0, 1], EASE.outQuart);
  const zeroP = tw(frame, [42, 50], [0, 1], EASE.outBack);

  return (
    <AbsoluteFill>
      <Backdrop intensity={0.32} seed={3} />

      {/* Ghost clock bleeding off the bottom edge */}
      <div
        style={{
          position: "absolute",
          left: -40,
          bottom: -170,
          fontFamily: FONT.mono,
          fontWeight: 700,
          fontSize: 520,
          color: C.fg,
          opacity: 0.08,
          letterSpacing: -20,
          translate: `${frame * 0.6}px 0`,
        }}
      >
        23:47
      </div>

      <AbsoluteFill style={{ scale: String(push) }}>
        {/* Clock pill, top right */}
        <div
          style={{
            position: "absolute",
            right: 120,
            top: 100,
            display: "flex",
            alignItems: "center",
            gap: 18,
            padding: "16px 28px",
            borderRadius: 999,
            background: "hsl(245 30% 12% / 0.9)",
            border: `2px solid ${C.line}`,
            opacity: tw(frame, [0, 8], [0, 1]),
          }}
        >
          <div style={{ width: 16, height: 16, borderRadius: 99, background: C.danger, opacity: cursorOn ? 1 : 0.35 }} />
          <div style={{ fontFamily: FONT.mono, fontSize: 42, color: C.fg, fontWeight: 500 }}>
            23:47<span style={{ color: C.fgMuted }}>:{String(seconds).padStart(2, "0")}</span>
          </div>
        </div>

        {/* Headline block, anchored left */}
        <div
          style={{
            position: "absolute",
            left: 140,
            top: 0,
            bottom: 0,
            width: 980,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 40,
          }}
        >
          <div style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 136, lineHeight: 1.02, color: C.fg, letterSpacing: -3 }}>
            <Word text="Apresentação" at={2} />
            <br />
            <Word text="amanhã," at={8} />
            <Word text="8h." at={13} style={{ color: C.primaryGlow }} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 26 }}>
            <div
              style={{
                fontFamily: FONT.sans,
                fontWeight: 600,
                fontSize: 64,
                color: C.fgMuted,
                opacity: tw(frame, [30, 38], [0, 1]),
                translate: `${tw(frame, [30, 42], [-60, 0], EASE.outExpo)}px 0`,
              }}
            >
              Slides prontos:
            </div>
            <div
              style={{
                fontFamily: FONT.mono,
                fontWeight: 700,
                fontSize: 150,
                lineHeight: 0.8,
                color: C.danger,
                opacity: tw(frame, [42, 45], [0, 1]),
                scale: String(1.8 - 0.8 * zeroP),
              }}
            >
              0
            </div>
          </div>
        </div>

        {/* The blank slide, in perspective on the right */}
        <div
          style={{
            position: "absolute",
            right: 120,
            top: 290,
            width: 700,
            height: 394,
            perspective: 1600,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "hsl(240 20% 97%)",
              borderRadius: 18,
              boxShadow: "0 50px 120px -30px rgba(0,0,0,0.8)",
              rotate: `y ${tw(slideIn, [0, 1], [-38, -16])}deg`,
              translate: `${(1 - slideIn) * 160}px 0`,
              opacity: slideIn,
              padding: 46,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 26,
            }}
          >
            <div
              style={{
                border: "3px dashed hsl(240 10% 75%)",
                borderRadius: 10,
                padding: "26px 24px",
                fontFamily: FONT.sans,
                fontSize: 33,
                fontWeight: 600,
                color: "hsl(240 8% 55%)",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
              }}
            >
              <div style={{ width: 4, height: 44, background: C.uiFg, marginRight: 10, opacity: cursorOn ? 1 : 0 }} />
              Clique para adicionar um título
            </div>
            <div
              style={{
                border: "3px dashed hsl(240 10% 82%)",
                borderRadius: 10,
                padding: "18px 24px",
                fontFamily: FONT.sans,
                fontSize: 26,
                color: "hsl(240 8% 62%)",
              }}
            >
              Clique para adicionar um subtítulo
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
