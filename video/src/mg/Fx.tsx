import type { CSSProperties } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { enter, rand, tw } from "../anim";
import { EASE, FONT } from "../theme";

// Shockwave: rings expanding from (x, y).
export const Shockwave = ({
  at,
  x,
  y,
  color = "hsl(262 100% 75%)",
  size = 1400,
  rings = 3,
  dur = 26,
  width = 10,
}: {
  at: number;
  x: number;
  y: number;
  color?: string;
  size?: number;
  rings?: number;
  dur?: number;
  width?: number;
}) => {
  const frame = useCurrentFrame();
  return (
    <>
      {Array.from({ length: rings }).map((_, i) => {
        const p = enter(frame, at + i * 4, dur, EASE.outQuart);
        if (p <= 0 || p >= 1) return null;
        const s = size * p;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - s / 2,
              top: y - s / 2,
              width: s,
              height: s,
              borderRadius: "50%",
              border: `${width * (1 - p) + 1}px solid ${color}`,
              opacity: 1 - p,
            }}
          />
        );
      })}
    </>
  );
};

// Radial particle burst.
export const Burst = ({
  at,
  x,
  y,
  count = 26,
  dist = 520,
  color = "hsl(262 100% 80%)",
  dur = 30,
  seed = 1,
}: {
  at: number;
  x: number;
  y: number;
  count?: number;
  dist?: number;
  color?: string;
  dur?: number;
  seed?: number;
}) => {
  const frame = useCurrentFrame();
  const p = enter(frame, at, dur, EASE.outQuart);
  if (p <= 0 || p >= 1) return null;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const a = (i / count) * Math.PI * 2 + rand(seed * 100 + i) * 0.4;
        const d = dist * (0.5 + rand(seed * 200 + i) * 0.6) * p;
        const s = 4 + rand(seed * 300 + i) * 10;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x + Math.cos(a) * d - s / 2,
              top: y + Math.sin(a) * d - s / 2,
              width: s,
              height: s,
              borderRadius: i % 3 === 0 ? 2 : 99,
              rotate: `${a}rad`,
              background: color,
              opacity: 1 - p,
              boxShadow: `0 0 12px ${color}`,
            }}
          />
        );
      })}
    </>
  );
};

// Full-frame flash.
export const Flash = ({ at, color = "#fff", dur = 10, peak = 1 }: { at: number; color?: string; dur?: number; peak?: number }) => {
  const frame = useCurrentFrame();
  const o = tw(frame, [at, at + 1, at + dur], [0, peak, 0]);
  if (o <= 0) return null;
  return <AbsoluteFill style={{ backgroundColor: color, opacity: o, pointerEvents: "none" }} />;
};

// Chromatic split + jitter for a few frames after a cut.
export const glitchStyle = (frame: number, cuts: readonly number[], len = 5): CSSProperties => {
  const c = cuts.find((x) => frame >= x && frame < x + len);
  if (c === undefined) return {};
  const k = 1 - (frame - c) / len;
  const j = (rand(frame * 7) - 0.5) * 30 * k;
  return {
    translate: `${j}px 0`,
    filter: `drop-shadow(${10 * k}px 0 0 hsl(330 100% 60% / 0.75)) drop-shadow(${-10 * k}px 0 0 hsl(190 100% 60% / 0.75))`,
  };
};

// Callout: anchor dot + elbow leader line that draws, then a label pill.
export const Callout = ({
  at,
  ax,
  ay,
  lx,
  ly,
  label,
  side = "right",
}: {
  at: number;
  ax: number;
  ay: number;
  lx: number;
  ly: number;
  label: string;
  side?: "left" | "right";
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const dot = enter(frame, at, 8, EASE.outBack);
  const line = enter(frame, at + 3, 12, EASE.outQuart);
  const pill = enter(frame, at + 11, 10, EASE.outBack);
  const midX = lx;
  const d = `M ${ax} ${ay} L ${midX} ${ay} L ${lx} ${ly}`;
  const len = Math.abs(midX - ax) + Math.abs(ly - ay) + 2;
  const ring = tw(frame, [at, at + 24], [0, 1]);
  return (
    <>
      <svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <path d={d} fill="none" stroke="hsl(252 100% 64%)" strokeWidth={4} strokeDasharray={len} strokeDashoffset={len * (1 - line)} strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", left: ax - 12, top: ay - 12, width: 24, height: 24, borderRadius: 99, background: "hsl(252 100% 64%)", border: "5px solid #fff", boxShadow: "0 4px 14px hsl(252 100% 40% / 0.5)", scale: String(dot) }} />
      <div
        style={{
          position: "absolute",
          left: ax - 30 * ring - 12,
          top: ay - 30 * ring - 12,
          width: 24 + 60 * ring,
          height: 24 + 60 * ring,
          borderRadius: 99,
          border: "3px solid hsl(252 100% 64%)",
          opacity: (1 - ring) * (ring > 0 ? 1 : 0),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: side === "right" ? lx - 8 : undefined,
          right: side === "left" ? width - lx - 8 : undefined,
          top: ly - 34,
          padding: "12px 26px",
          borderRadius: 999,
          background: "hsl(252 100% 64%)",
          color: "#fff",
          fontFamily: FONT.sans,
          fontWeight: 700,
          fontSize: 34,
          whiteSpace: "nowrap",
          boxShadow: "0 16px 30px -10px hsl(252 100% 40% / 0.6)",
          scale: String(pill),
          transformOrigin: side === "right" ? "0% 50%" : "100% 50%",
          opacity: Math.min(1, pill * 2),
        }}
      >
        {label}
      </div>
    </>
  );
};
