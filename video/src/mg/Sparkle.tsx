import type { CSSProperties } from "react";

// The 4-point star from the SlideAI logo: the "AI is acting" mnemonic.
// `draw` (0..1) traces the outline, `fill` (0..1) fades the body in.

const PATH = "M50 0 C54 30 70 46 100 50 C70 54 54 70 50 100 C46 70 30 54 0 50 C30 46 46 30 50 0 Z";
const LEN = 330;

export const Sparkle = ({
  size = 48,
  color = "hsl(262 100% 72%)",
  draw = 1,
  fill = 1,
  stroke,
  style,
}: {
  size?: number;
  color?: string;
  draw?: number;
  fill?: number;
  stroke?: string;
  style?: CSSProperties;
}) => (
  <svg width={size} height={size} viewBox="-4 -4 108 108" style={{ overflow: "visible", ...style }}>
    <path d={PATH} fill={color} fillOpacity={fill} />
    {draw < 1 || stroke ? (
      <path
        d={PATH}
        fill="none"
        stroke={stroke ?? color}
        strokeWidth={3}
        strokeLinejoin="round"
        strokeDasharray={LEN}
        strokeDashoffset={LEN * (1 - draw)}
      />
    ) : null}
  </svg>
);
