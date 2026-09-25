// Escala tipográfica FIXA do motor de cenas, por par de fontes.
//
// Direção de arte como regra: todo slide v2 usa a mesma escala (em unidades
// do container do slide, `cqw`, para que Editor, Viewer e export mostrem as
// mesmas proporções independentemente da janela). Cada par de fontes ajusta
// só o multiplicador do título — displays largos (Unbounded, Archivo Black)
// ocupam mais, serifadas de exibição (Fraunces, Instrument Serif) menos.

export interface TypeScale {
  kicker: string;
  headline: string;
  headlineHero: string;
  subtitle: string;
  body: string;
  itemLabel: string;
  itemDetail: string;
  value: string;
  caption: string;
}

const DISPLAY_FACTOR: Record<string, number> = {
  "unbounded-pop": 0.86,
  "neo-futurist": 0.88,
  "archivo-poster": 0.9,
  "kinetic-brutal": 0.9,
  "fraunces-warm": 1.06,
  "instrument-luxe": 1.08,
  "classic-serif": 1.04,
  "editorial": 1.06,
  "dm-editorial": 1.04,
  "mono-technical": 0.92,
};

const cqw = (n: number) => `${Math.round(n * 100) / 100}cqw`;

export function typeScaleFor(fontId: string | undefined): TypeScale {
  const f = DISPLAY_FACTOR[fontId ?? ""] ?? 1;
  return {
    kicker: cqw(0.82),
    headline: cqw(3.15 * f),
    headlineHero: cqw(3.6 * f),
    subtitle: cqw(1.42),
    body: cqw(1.2),
    itemLabel: cqw(1.12),
    itemDetail: cqw(0.9),
    value: cqw(2.4 * f),
    caption: cqw(0.8),
  };
}
