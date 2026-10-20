import { describe, expect, it } from "vitest";
import { placeAtPositions } from "../../supabase/functions/generate-presentation/contentV2.ts";

const deck = (n: number, filled: number[]) =>
  Array.from({ length: n }, (_, i) => (filled.includes(i + 1) ? { index: i + 1, headline: `orig ${i + 1}` } : undefined));

describe("retry do motor v2 — slides faltantes não contíguos", () => {
  it("índices certos vão para as posições certas", () => {
    const t = deck(8, [1, 3, 4, 5, 6, 8]);
    placeAtPositions(t, [{ index: 7, headline: "S7" }, { index: 2, headline: "S2" }], [2, 7]);
    expect(t[1]?.headline).toBe("S2");
    expect(t[6]?.headline).toBe("S7");
    expect(t[2]?.headline).toBe("orig 3");
  });

  it("índice errado (posição ocupada) ocupa a próxima faltante, sem escorregar", () => {
    const t = deck(8, [1, 3, 4, 5, 6, 8]);
    placeAtPositions(t, [{ index: 3, headline: "A" }, { index: 4, headline: "B" }], [2, 7]);
    expect(t[1]).toMatchObject({ headline: "A", index: 2 });
    expect(t[6]).toMatchObject({ headline: "B", index: 7 });
    expect(t[2]?.headline).toBe("orig 3");
  });

  it("nunca sobrescreve slide já escrito nem passa do que falta", () => {
    const t = deck(4, [1, 2, 4]);
    placeAtPositions(t, [{ headline: "X" }, { headline: "Y" }], [3]);
    expect(t.map((s) => s?.headline)).toEqual(["orig 1", "orig 2", "X", "orig 4"]);
  });
});
