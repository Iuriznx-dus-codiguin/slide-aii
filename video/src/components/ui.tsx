import { C, FONT } from "../theme";

// Honesty tag for the product demo (product-proof-saas: never fake speed
// without saying so).
// In 9:16 the bottom and right edges sit under the Shorts/Reels UI, so the
// tag moves to the top-left there.
export const SimTag = ({ opacity = 1, tone = "dark", portrait = false }: { opacity?: number; tone?: "dark" | "light"; portrait?: boolean }) => (
  <div
    style={{
      position: "absolute",
      ...(portrait ? { left: 70, top: 232 } : { right: 64, bottom: 48 }),
      display: "flex",
      alignItems: "center",
      gap: 12,
      fontFamily: FONT.mono,
      fontSize: 22,
      color: tone === "dark" ? C.fgMuted : "hsl(240 8% 40%)",
      opacity: opacity * 0.9,
      letterSpacing: 1,
    }}
  >
    <div style={{ width: 10, height: 10, borderRadius: 99, background: tone === "dark" ? C.primaryGlow : C.primary }} />
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
