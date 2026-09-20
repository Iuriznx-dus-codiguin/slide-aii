// Composição visual determinística: distribuição de modelos de página e
// escolha de acentos. Esta lógica decide o que o usuário vê em cada slide e
// vivia inline no handler de geração, sem teste nenhum.

import { describe, expect, it } from "vitest";
import {
  accentCountFor,
  accentsFor,
  assignLayouts,
  NON_SIDE_IMAGE_LAYOUTS,
  SIDE_IMAGE_LAYOUTS,
  SIDE_IMAGE_SHARE_CAP,
} from "../../supabase/functions/_shared/slideComposition.ts";

const sideImageCount = (layouts: string[]) =>
  layouts.slice(1).filter((l) => SIDE_IMAGE_LAYOUTS.includes(l)).length;

describe("assignLayouts — variedade de modelo de página", () => {
  it("mantém o layout da capa intacto", () => {
    const out = assignLayouts([{ layout: "split-hero" }, { layout: "centered" }]);
    expect(out[0]).toBe("split-hero");
  });

  it("nunca repete o mesmo modelo dentro de uma janela de 3 slides", () => {
    // A IA insistindo no mesmo layout é o pior caso.
    const out = assignLayouts(Array.from({ length: 12 }, () => ({ layout: "image-right" })));
    for (let i = 2; i < out.length; i++) {
      expect(out[i], `repetiu em ${i}`).not.toBe(out[i - 1]);
      expect(out[i], `repetiu com distância 2 em ${i}`).not.toBe(out[i - 2]);
    }
  });

  it("quebra a alternância A-B-A-B, que a regra antiga deixava passar", () => {
    const alternating = Array.from({ length: 10 }, (_, i) => ({
      layout: i % 2 === 0 ? "image-right" : "two-columns",
    }));
    const out = assignLayouts(alternating);
    const distinct = new Set(out.slice(1));
    expect(distinct.size).toBeGreaterThan(2);
  });

  it("respeita o teto de slides imagem + texto lateral", () => {
    for (const total of [6, 9, 12, 20]) {
      const out = assignLayouts(Array.from({ length: total }, () => ({ layout: "image-left" })));
      const budget = Math.max(1, Math.round((total - 1) * SIDE_IMAGE_SHARE_CAP));
      expect(sideImageCount(out), `total=${total}`).toBeLessThanOrEqual(budget);
    }
  });

  it("preserva escolhas válidas e variadas da IA", () => {
    const proposed = ["split-hero", "quote", "stat-highlight", "data-chart", "two-columns", "centered"];
    const out = assignLayouts(proposed.map((layout) => ({ layout })));
    expect(out).toEqual(proposed);
  });

  it("preenche layouts ausentes sem cair sempre no mesmo modelo", () => {
    const out = assignLayouts(Array.from({ length: 10 }, () => ({})));
    expect(out.slice(1).every((l) => NON_SIDE_IMAGE_LAYOUTS.includes(l))).toBe(true);
    expect(new Set(out.slice(1)).size).toBeGreaterThanOrEqual(4);
  });

  it("não quebra em decks de 1 ou 2 slides", () => {
    expect(assignLayouts([{ layout: "split-hero" }])).toHaveLength(1);
    expect(assignLayouts([{}, {}])).toHaveLength(2);
  });
});

describe("accentsFor — acentos por conteúdo, não por posição", () => {
  it("escolhe pelo papel narrativo do slide", () => {
    const stat = accentsFor({ animation_intent: "emphasis-stat" }, 0);
    const quote = accentsFor({ animation_intent: "quote-spotlight" }, 0);
    expect(stat).not.toEqual(quote);
    expect(stat[0]).toBe("animated-blob");
    expect(quote[0]).toBe("particle-field");
  });

  it("usa o tipo do slide quando não há intenção de animação", () => {
    expect(accentsFor({ slide_type: "data_chart" }, 0)[0]).toBe("dot-grid");
    expect(accentsFor({ slide_type: "title_slide" }, 0)[0]).toBe("gradient-drift");
  });

  it("dois slides do mesmo tipo não recebem exatamente os mesmos acentos", () => {
    const a = accentsFor({ slide_type: "data_chart" }, 0);
    const b = accentsFor({ slide_type: "data_chart" }, 1);
    expect(a).not.toEqual(b);
  });

  it("respeita os acentos que a IA mandou, ignorando nomes inválidos", () => {
    expect(accentsFor({ visual_accents: ["card-stack", "pulse-grid"] }, 0))
      .toEqual(["card-stack", "pulse-grid"]);
    // Nome inexistente cai no repertório por conteúdo em vez de chegar ao front.
    const out = accentsFor({ visual_accents: ["nao-existe"], slide_type: "quote" }, 0);
    expect(out).not.toContain("nao-existe");
    expect(out.length).toBeGreaterThan(0);
  });

  it("slide com imagem recebe decoração contida", () => {
    expect(accentsFor({ slide_type: "quote", hasImage: true }, 0, "rich")).toHaveLength(1);
  });

  it("a densidade de elementos do brief governa a quantidade", () => {
    expect(accentCountFor("minimal")).toBe(1);
    expect(accentCountFor("moderate")).toBe(2);
    expect(accentCountFor("rich")).toBe(3);
    expect(accentCountFor(undefined)).toBe(2);
    expect(accentsFor({ slide_type: "data_chart" }, 0, "rich")).toHaveLength(3);
    expect(accentsFor({ slide_type: "data_chart" }, 0, "minimal")).toHaveLength(1);
  });

  it("nunca devolve acentos duplicados", () => {
    for (let i = 0; i < 20; i++) {
      const out = accentsFor({ slide_type: "section_divider" }, i, "rich");
      expect(new Set(out).size).toBe(out.length);
    }
  });
});
