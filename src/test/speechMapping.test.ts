// Regeneração de falas: casar a resposta da IA com os slides certos.
import { describe, expect, it } from "vitest";
import { speechesByPosition } from "../../supabase/functions/regenerate-speeches/lib.ts";

const p = (name: string) => [{ name, exact_speech: name }];

describe("speechesByPosition", () => {
  it("usa a numeração do prompt (SLIDE N, a partir de 1)", () => {
    const m = speechesByPosition([{ position: 1, presenters: p("a") }, { position: 2, presenters: p("b") }], 2);
    expect(m.get(0)).toEqual(p("a"));
    expect(m.get(1)).toEqual(p("b"));
  });

  it("slide omitido pela IA fica sem fala (não copia a do slide anterior)", () => {
    const m = speechesByPosition([{ position: 1, presenters: p("a") }, { position: 2, presenters: p("b") }, { position: 4, presenters: p("d") }], 4);
    expect(m.get(2)).toBeUndefined();
    expect(m.get(3)).toEqual(p("d"));
  });

  it("detecta resposta a partir de 0", () => {
    const m = speechesByPosition([{ position: 0, presenters: p("a") }, { position: 1, presenters: p("b") }, { position: 2, presenters: p("c") }], 3);
    expect(m.get(0)).toEqual(p("a"));
    expect(m.get(2)).toEqual(p("c"));
  });

  it("ignora posições fora do deck e itens sem falas", () => {
    const m = speechesByPosition([{ position: 9, presenters: p("x") }, { position: 1 }, { position: "2", presenters: p("b") }], 2);
    expect([...m.keys()]).toEqual([1]);
  });
});
