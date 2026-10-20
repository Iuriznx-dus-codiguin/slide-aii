import { describe, expect, it } from "vitest";
import { mergeAiEdits, type EditableSlide } from "@/lib/aiEditMerge";

const slide = (id: string, headline: string, extra: Partial<EditableSlide> & Record<string, unknown> = {}) => ({
  id, slide_type: "content", layout_template: "title-content", animation_transition: "fade", speaker_notes: null,
  content: { headline }, ...extra,
});

describe("mergeAiEdits — resposta do chat de edição sobre o deck atual", () => {
  it("aplica só os slides alterados, pelo id, preservando o que o usuário fez enquanto a IA respondia", () => {
    const sentIds = ["a", "b", "c"];
    // Enquanto a IA respondia: o usuário editou "a", excluiu "c" e moveu "b" para o início.
    const current = [slide("b", "B original"), slide("a", "A editado pelo usuário")];
    const returned = [
      { slide_title: "A pela IA", headline: "A pela IA" },
      { slide_title: "B pela IA", headline: "B pela IA" },
      { slide_title: "C pela IA", headline: "C pela IA" },
    ];
    const out = mergeAiEdits(current, sentIds, returned, [1, 2]);
    expect(out.map((s) => s.id)).toEqual(["b", "a"]);
    expect(out[0].content.headline).toBe("B pela IA");
    expect(out[1].content.headline).toBe("A editado pelo usuário");
  });

  it("mantém falas e colunas que não vão para a IA", () => {
    const presenters = [{ id: "p1", name: "Ana", exact_speech: "fala paga" }];
    const current = [slide("a", "A", { presenters_data: presenters })];
    const out = mergeAiEdits(current, ["a"], [{ headline: "Novo" }], [0]);
    expect((out[0] as { presenters_data?: unknown }).presenters_data).toEqual(presenters);
    expect(out[0].content.headline).toBe("Novo");
  });

  it("sem changed_slides (servidor antigo) aplica todos", () => {
    const out = mergeAiEdits([slide("a", "A"), slide("b", "B")], ["a", "b"], [{ headline: "A2" }, { headline: "B2" }], undefined);
    expect(out.map((s) => s.content.headline)).toEqual(["A2", "B2"]);
  });

  it("nada alterado devolve o deck como está", () => {
    const current = [slide("a", "A")];
    expect(mergeAiEdits(current, ["a"], [{ headline: "X" }], [])).toEqual(current);
  });
});
