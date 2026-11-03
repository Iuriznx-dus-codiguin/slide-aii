import type { CSSProperties, ReactNode } from "react";
import { Img, staticFile } from "remotion";
import { C, FONT, GRADIENT, SHADOW } from "../theme";

// Browser window in the light product theme, like the hero mockup on the site.
export const AppWindow = ({
  url,
  width,
  height,
  children,
  style,
}: {
  url: string;
  width: number;
  height: number;
  children: ReactNode;
  style?: CSSProperties;
}) => (
  <div
    style={{
      width,
      height,
      borderRadius: 28,
      background: C.ui,
      boxShadow: `${SHADOW.elegant}, 0 0 0 2px hsl(252 60% 85% / 0.35)`,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      ...style,
    }}
  >
    <div
      style={{
        height: 64,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 26px",
        background: C.uiMutedBg,
        borderBottom: `2px solid ${C.uiBorder}`,
      }}
    >
      <Dot color="hsl(0 84% 60% / 0.65)" />
      <Dot color="hsl(280 95% 65% / 0.65)" />
      <Dot color="hsl(152 70% 45% / 0.65)" />
      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            padding: "8px 22px",
            borderRadius: 10,
            background: C.ui,
            fontFamily: FONT.sans,
            fontSize: 22,
            color: C.uiMuted,
            fontWeight: 500,
          }}
        >
          {url}
        </div>
      </div>
      <div style={{ width: 84 }} />
    </div>
    <div style={{ flex: 1, position: "relative" }}>{children}</div>
  </div>
);

const Dot = ({ color }: { color: string }) => (
  <div style={{ width: 18, height: 18, borderRadius: 99, background: color }} />
);

export const Logo = ({ size = 96, tile = true }: { size?: number; tile?: boolean }) =>
  tile ? (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.24,
        background: C.ui,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 18px 50px -12px hsl(252 100% 40% / 0.6)",
        flexShrink: 0,
      }}
    >
      <Img src={staticFile("brand/logo.png")} style={{ width: size * 0.86, height: size * 0.86 }} />
    </div>
  ) : (
    <Img src={staticFile("brand/logo.png")} style={{ width: size, height: size }} />
  );

// "01 · Descreva o tema" label used across the demo scenes.
export const StepLabel = ({ n, children, style }: { n: string; children: ReactNode; style?: CSSProperties }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 18, ...style }}>
    <div
      style={{
        fontFamily: FONT.mono,
        fontWeight: 700,
        fontSize: 28,
        color: C.ui,
        background: GRADIENT.primary,
        borderRadius: 12,
        padding: "8px 14px",
        boxShadow: SHADOW.glow,
      }}
    >
      {n}
    </div>
    <div
      style={{
        fontFamily: FONT.mono,
        fontSize: 26,
        letterSpacing: 4,
        textTransform: "uppercase",
        color: C.primaryGlow,
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  </div>
);

// Honesty tag for the product demo (product-proof-saas: never fake speed
// without saying so).
export const SimTag = ({ opacity = 1 }: { opacity?: number }) => (
  <div
    style={{
      position: "absolute",
      right: 64,
      bottom: 48,
      display: "flex",
      alignItems: "center",
      gap: 12,
      fontFamily: FONT.mono,
      fontSize: 22,
      color: C.fgMuted,
      opacity: opacity * 0.85,
      letterSpacing: 1,
    }}
  >
    <div style={{ width: 10, height: 10, borderRadius: 99, background: C.primaryGlow }} />
    Simulação de uso · tempo acelerado
  </div>
);

// Mouse pointer.
export const Pointer = ({ x, y, pressed = 0 }: { x: number; y: number; pressed?: number }) => (
  <div style={{ position: "absolute", left: x, top: y, scale: String(1 - pressed * 0.15), transformOrigin: "0 0" }}>
    <svg width="44" height="54" viewBox="0 0 22 27" style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.35))" }}>
      <path d="M1 1 L1 21 L6.5 16 L10 25 L13.5 23.5 L10 15 L18 15 Z" fill="#fff" stroke="#111" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  </div>
);

export const Chip = ({ children, active = false, style }: { children: ReactNode; active?: boolean; style?: CSSProperties }) => (
  <div
    style={{
      padding: "10px 20px",
      borderRadius: 999,
      fontFamily: FONT.sans,
      fontSize: 22,
      fontWeight: 600,
      color: active ? C.primary : C.uiSecondaryFg,
      background: active ? "hsl(252 100% 64% / 0.1)" : C.uiSecondary,
      border: `2px solid ${active ? "hsl(252 100% 64% / 0.35)" : C.uiBorder}`,
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {children}
  </div>
);
