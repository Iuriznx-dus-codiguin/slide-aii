import type { CSSProperties } from "react";

// The 4-point star from the SlideAI logo. Used as the "AI is acting" mnemonic.
export const Sparkle = ({
  size = 48,
  color = "hsl(262 100% 72%)",
  style,
}: {
  size?: number;
  color?: string;
  style?: CSSProperties;
}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <path
      d="M50 0 C54 30 70 46 100 50 C70 54 54 70 50 100 C46 70 30 54 0 50 C30 46 46 30 50 0 Z"
      fill={color}
    />
  </svg>
);
