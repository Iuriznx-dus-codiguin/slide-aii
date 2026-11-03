import { AbsoluteFill } from "remotion";
import { z } from "zod";

// Tool composition: renders the purple cloud texture once (npm run textures)
// so the nebula scenes only move pre-rendered images instead of running SVG
// turbulence on every frame.

export const nebulaTextureSchema = z.object({ seed: z.number() });

export const NEBULA_W = 2400;
export const NEBULA_H = 1400;

export const NebulaTexture = ({ seed }: z.infer<typeof nebulaTextureSchema>) => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <svg width={NEBULA_W} height={NEBULA_H} viewBox={`0 0 ${NEBULA_W} ${NEBULA_H}`}>
      <defs>
        <filter id="violet" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.0013 0.0021" numOctaves={6} seed={seed} />
          <feColorMatrix type="matrix" values="0 0 0 0 0.46  0 0 0 0 0.28  0 0 0 0 1  2.1 0 0 0 -0.78" />
        </filter>
        <filter id="magenta" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.0019 0.0028" numOctaves={6} seed={seed + 11} />
          <feColorMatrix type="matrix" values="0 0 0 0 0.86  0 0 0 0 0.27  0 0 0 0 0.94  2.3 0 0 0 -1.05" />
        </filter>
        <filter id="wisps" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.011" numOctaves={4} seed={seed + 23} />
          <feColorMatrix type="matrix" values="0 0 0 0 0.8  0 0 0 0 0.74  0 0 0 0 1  3.2 0 0 0 -1.9" />
        </filter>
        <radialGradient id="gA" cx="0.68" cy="0.32" r="0.62">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.55" stopColor="#888" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <radialGradient id="gB" cx="0.22" cy="0.78" r="0.55">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <mask id="mA">
          <rect width={NEBULA_W} height={NEBULA_H} fill="url(#gA)" />
        </mask>
        <mask id="mB">
          <rect width={NEBULA_W} height={NEBULA_H} fill="url(#gB)" />
        </mask>
      </defs>
      <rect width={NEBULA_W} height={NEBULA_H} fill="#000" />
      <g mask="url(#mA)">
        <rect width={NEBULA_W} height={NEBULA_H} filter="url(#violet)" />
      </g>
      <g mask="url(#mB)">
        <rect width={NEBULA_W} height={NEBULA_H} filter="url(#magenta)" />
      </g>
      <rect width={NEBULA_W} height={NEBULA_H} filter="url(#wisps)" opacity={0.35} mask="url(#mA)" />
    </svg>
  </AbsoluteFill>
);
