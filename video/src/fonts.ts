import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Fonts are bundled (public/fonts, SIL Open Font License) instead of fetched
// from Google at render time, so renders work offline and stay identical.
// Variable files: one file covers the whole weight range.

export const FAMILY = {
  sans: "Plus Jakarta Sans",
  mono: "JetBrains Mono",
  serif: "Fraunces",
};

const fonts = [
  { family: FAMILY.sans, file: "fonts/PlusJakartaSans-latin-var.woff2", weight: "400 800" },
  { family: FAMILY.mono, file: "fonts/JetBrainsMono-latin-var.woff2", weight: "400 700" },
  { family: FAMILY.serif, file: "fonts/Fraunces-latin-var.woff2", weight: "400 900" },
];

for (const f of fonts) {
  loadFont({ family: f.family, url: staticFile(f.file), weight: f.weight, format: "woff2" });
}
