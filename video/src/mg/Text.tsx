import type { CSSProperties, ReactNode } from "react";
import { useCurrentFrame } from "remotion";
import { enter, tw } from "../anim";
import { EASE, GRADIENT, gradientText } from "../theme";

// Kinetic typography building blocks.

export type Token = string | { t: string; look?: "gradient" | "gradientInk" | "color" | "marker" | "markerDark"; color?: string };

type Mode = "rise" | "slam" | "blur" | "drop" | "left";

const tokenText = (tk: Token) => (typeof tk === "string" ? tk : tk.t);

// Word-by-word reveal. "\n" tokens break the line. Each word gets its own
// mask so "rise" reads like type sliding out of a slot.
export const Words = ({
  tokens,
  at = 0,
  stagger = 3,
  dur = 14,
  mode = "rise",
  style,
  exitAt,
  exitDur = 8,
}: {
  tokens: Token[];
  at?: number;
  stagger?: number;
  dur?: number;
  mode?: Mode;
  style?: CSSProperties;
  exitAt?: number;
  exitDur?: number;
}) => {
  const frame = useCurrentFrame();
  let wi = 0;
  const lines: Token[][] = [[]];
  for (const tk of tokens) {
    if (tokenText(tk) === "\n") lines.push([]);
    else lines[lines.length - 1].push(tk);
  }
  const ex = exitAt === undefined ? 0 : tw(frame, [exitAt, exitAt + exitDur], [0, 1], EASE.inExpo);

  return (
    <div style={style}>
      {lines.map((line, li) => (
        <div key={li} style={{ display: "block", whiteSpace: "nowrap" }}>
          {line.map((tk, i) => {
            const idx = wi++;
            const p = enter(frame, at + idx * stagger, dur, mode === "slam" ? EASE.outBack : EASE.outExpo);
            const text = tokenText(tk);
            const look = typeof tk === "string" ? undefined : tk.look;
            const inner: CSSProperties = {
              display: "inline-block",
              ...(look === "gradient" ? gradientText(GRADIENT.primaryBright) : {}),
              ...(look === "gradientInk" ? gradientText(GRADIENT.ink) : {}),
              ...(look === "color" && typeof tk !== "string" ? { color: tk.color } : {}),
            };
            let anim: CSSProperties = {};
            if (mode === "rise") anim = { translate: `0 ${(1 - p) * 105 - ex * 105}%` };
            if (mode === "drop") anim = { translate: `0 ${(p - 1) * 105 + ex * 105}%` };
            if (mode === "left") anim = { translate: `${(1 - p) * 60}px 0`, opacity: p * (1 - ex), filter: `blur(${(1 - p) * 10}px)` };
            if (mode === "slam")
              anim = { scale: String(1 + (1 - p) * 0.9), opacity: Math.min(1, p * 3) * (1 - ex), filter: `blur(${(1 - Math.min(1, p)) * 16}px)` };
            if (mode === "blur") anim = { opacity: p * (1 - ex), filter: `blur(${(1 - p) * 22 + ex * 22}px)`, scale: String(1.08 - 0.08 * p) };
            const masked = mode === "rise" || mode === "drop";
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  overflow: masked ? "hidden" : "visible",
                  verticalAlign: "top",
                  paddingBottom: masked ? "0.12em" : 0,
                  marginBottom: masked ? "-0.12em" : 0,
                  marginRight: "0.24em",
                  position: "relative",
                }}
              >
                {look === "marker" || look === "markerDark" ? <MarkerBand at={at + idx * stagger + dur * 0.6} dark={look === "markerDark"} /> : null}
                <span style={{ ...inner, ...anim, position: "relative" }}>{text}</span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// Highlighter band that sweeps in behind a word.
export const MarkerBand = ({ at, dark = false, color }: { at: number; dark?: boolean; color?: string }) => {
  const frame = useCurrentFrame();
  const p = enter(frame, at, 10, EASE.outQuart);
  return (
    <span
      style={{
        position: "absolute",
        left: "-0.12em",
        right: "-0.12em",
        top: "18%",
        bottom: "4%",
        borderRadius: "0.14em",
        background: color ?? (dark ? "hsl(252 100% 64%)" : "hsl(252 100% 64% / 0.22)"),
        transformOrigin: "0% 50%",
        scale: `${p} 1`,
        rotate: "-1.2deg",
      }}
    />
  );
};

// Hand-drawn underline that draws itself.
export const Underline = ({ at, width, color = "hsl(262 100% 72%)", stroke = 10 }: { at: number; width: number; color?: string; stroke?: number }) => {
  const frame = useCurrentFrame();
  const p = enter(frame, at, 14, EASE.outQuart);
  const len = width * 1.08;
  return (
    <svg width={width} height={40} viewBox={`0 0 ${width} 40`} style={{ overflow: "visible", display: "block" }}>
      <path
        d={`M4 26 C ${width * 0.3} 8, ${width * 0.6} 36, ${width - 4} 14`}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - p)}
      />
    </svg>
  );
};

// Slot-machine word: rolls to `words[index]` at each switch frame.
export const SlotWord = ({
  words,
  switches,
  lineHeight,
  style,
  render,
}: {
  words: string[];
  switches: readonly number[];
  lineHeight: number;
  style?: CSSProperties;
  render?: (w: string, i: number) => ReactNode;
}) => {
  const frame = useCurrentFrame();
  let pos = 0;
  switches.forEach((s, i) => {
    if (i === 0) return;
    pos += enter(frame, s - 3, 12, EASE.outBack);
  });
  return (
    <div style={{ height: lineHeight, overflow: "hidden", position: "relative", ...style }}>
      <div style={{ translate: `0 ${-pos * lineHeight}px`, filter: `blur(${Math.min(10, Math.abs(pos - Math.round(pos)) * 24)}px)` }}>
        {words.map((w, i) => (
          <div key={w} style={{ height: lineHeight, display: "flex", alignItems: "center" }}>
            {render ? render(w, i) : w}
          </div>
        ))}
      </div>
    </div>
  );
};

// Number that counts up.
export const Counter = ({ from, to, at, dur, format }: { from: number; to: number; at: number; dur: number; format: (n: number) => string }) => {
  const frame = useCurrentFrame();
  const v = tw(frame, [at, at + dur], [from, to], EASE.outQuart);
  return <>{format(v)}</>;
};
