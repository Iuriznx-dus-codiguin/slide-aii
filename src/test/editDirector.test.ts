// Edição por chat: aplicação dos patches da IA sobre o deck original.
import { describe, expect, it } from "vitest";
import { applyEdits } from "../../supabase/functions/_shared/editDirector.ts";

const deck = () => [
  { slide_type: "title_slide", headline: "Capa", narrative_act: "hook" },
  { slide_type: "content", headline: "Antigo", body_text: "texto longo", chart: { type: "bar" }, visual_accents: ["dot-grid"] },
];

describe("applyEdits", () => {
  it("soma dois patches para o mesmo slide (antes o segundo descartava o primeiro)", () => {
    const { slides, changed } = applyEdits(deck(), [
      { index: 1, body_text: "curto" },
      { index: 1, headline: "Novo", remove_chart: true },
    ], [1]);
    expect(slides[1].body_text).toBe("curto");
    expect(slides[1].headline).toBe("Novo");
    expect(slides[1].chart).toBeNull();
    expect(changed).toEqual([1]);
  });

  it("ignora índices fora do escopo e preserva o DNA visual", () => {
    const { slides, changed } = applyEdits(deck(), [
      { index: 0, headline: "Fora do escopo" },
      { index: 1, headline: "Dentro" },
    ], [1]);
    expect(slides[0].headline).toBe("Capa");
    expect(slides[1].visual_accents).toEqual(["dot-grid"]);
    expect(changed).toEqual([1]);
  });

  it("não altera o deck recebido", () => {
    const original = deck();
    applyEdits(original, [{ index: 1, headline: "Novo" }], [1]);
    expect(original[1].headline).toBe("Antigo");
  });
});
