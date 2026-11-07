import { Easing } from "remotion";
import { FAMILY } from "./fonts";

// Brand tokens copied from the SlideAI site (src/index.css, dark + light
// themes). Values stay as HSL so they can be compared with the site 1:1.

export const FONT = {
  sans: `"${FAMILY.sans}", system-ui, sans-serif`,
  mono: `"${FAMILY.mono}", ui-monospace, monospace`,
  serif: `"${FAMILY.serif}", Georgia, serif`,
};

export const C = {
  // Dark canvas (site .dark theme and og-image)
  bg: "hsl(245 35% 7%)",
  bgDeep: "hsl(246 40% 4%)",
  surface: "hsl(245 30% 10%)",
  surfaceHi: "hsl(245 25% 14%)",
  line: "hsl(245 25% 18%)",
  fg: "hsl(240 20% 96%)",
  fgMuted: "hsl(240 10% 68%)",

  // Brand
  primary: "hsl(252 100% 64%)", // #6C47FF
  primaryBright: "hsl(252 100% 70%)",
  primaryGlow: "hsl(262 100% 72%)",
  primaryDeep: "hsl(250 80% 50%)",
  accent: "hsl(280 95% 65%)",
  magenta: "hsl(290 90% 65%)",
  success: "hsl(152 70% 45%)",
  danger: "hsl(0 84% 60%)",

  // Light product UI (site :root theme)
  ui: "hsl(0 0% 100%)",
  uiFg: "hsl(240 20% 12%)",
  uiMuted: "hsl(240 8% 46%)",
  uiMutedBg: "hsl(240 20% 96%)",
  uiBorder: "hsl(240 15% 92%)",
  uiSecondary: "hsl(252 30% 96%)",
  uiSecondaryFg: "hsl(250 40% 25%)",
};

// Light world: the site's main theme (white canvas, violet elements).
export const L = {
  bg: "hsl(0 0% 100%)",
  bgSoft: "hsl(252 100% 99%)",
  ink: "hsl(240 20% 12%)",
  muted: "hsl(240 8% 46%)",
  line: "hsl(240 15% 90%)",
  soft: "hsl(252 30% 96%)",
  softInk: "hsl(250 40% 25%)",
  lavender: "hsl(252 100% 94%)",
};

export const GRADIENT = {
  primary: "linear-gradient(135deg, hsl(252 100% 64%), hsl(280 95% 65%))",
  primaryBright: "linear-gradient(135deg, hsl(252 100% 72%), hsl(280 95% 72%))",
  hero: "linear-gradient(135deg, hsl(252 100% 64%) 0%, hsl(270 95% 60%) 50%, hsl(290 90% 65%) 100%)",
  ink: "linear-gradient(135deg, hsl(252 100% 58%), hsl(280 90% 56%))",
};

export const SHADOW = {
  elegant: "0 40px 120px -30px hsl(252 80% 30% / 0.55)",
  glow: "0 20px 80px -12px hsl(252 100% 64% / 0.55)",
  card: "0 24px 60px -18px hsl(246 60% 3% / 0.7)",
};

export const RADIUS = 14;

// Text in the brand gradient, same recipe as .text-gradient on the site.
export const gradientText = (gradient = GRADIENT.primaryBright) => ({
  backgroundImage: gradient,
  WebkitBackgroundClip: "text" as const,
  backgroundClip: "text" as const,
  color: "transparent",
  WebkitTextFillColor: "transparent",
});

export const EASE = {
  // --ease-out-expo from the site
  outExpo: Easing.bezier(0.19, 1, 0.22, 1),
  outBack: Easing.bezier(0.34, 1.56, 0.64, 1),
  outQuart: Easing.bezier(0.25, 1, 0.5, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  inQuad: Easing.bezier(0.55, 0.085, 0.68, 0.53),
  inExpo: Easing.bezier(0.7, 0, 0.84, 0),
};
