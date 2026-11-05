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

describe("mergeAiEdits — remoções e exclusões pelo chat", () => {
  it("null explícito apaga (imagem, subtítulo, nota); ausente mantém", () => {
    const current = [slide("a", "A", { speaker_notes: "nota", content: { headline: "A", subtitle: "Sub", image_url: "https://x/old.jpg", image_query: "q", visual_accents: ["dot-grid"] } })];
    const returned = [{ headline: "A", subtitle: null, image_url: null, image_query: null, asset: null, speaker_notes: null } as never];
    const out = mergeAiEdits(current, ["a"], returned, [0]);
    expect(out[0].content.image_url).toBeNull();
    expect(out[0].content).not.toHaveProperty("subtitle");
    expect(out[0].content).not.toHaveProperty("image_query");
    expect(out[0].content.visual_accents).toEqual(["dot-grid"]);
    expect(out[0].speaker_notes).toBeNull();
  });

  it("ativo pendente da troca de imagem chega ao conteúdo", () => {
    const current = [slide("a", "A", { content: { headline: "A", image_url: "https://x/old.jpg" } })];
    const asset = { status: "pending", source: "pexels", kind: "photo", aspect: "16:9", query: "castle" };
    const out = mergeAiEdits(current, ["a"], [{ headline: "A", image_url: null, asset } as never], [0]);
    expect(out[0].content.image_url).toBeNull();
    expect(out[0].content.asset).toEqual(asset);
  });

  it("exclui pelo id os slides que o usuário pediu, nunca todos", () => {
    const current = [slide("a", "A"), slide("b", "B"), slide("c", "C")];
    expect(mergeAiEdits(current, ["a", "b", "c"], [], [], [1]).map((s) => s.id)).toEqual(["a", "c"]);
    expect(mergeAiEdits(current, ["a", "b", "c"], [], [], [0, 1, 2]).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
});
