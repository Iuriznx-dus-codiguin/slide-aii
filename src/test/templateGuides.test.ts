import { describe, expect, it } from "vitest";
import { TEMPLATES } from "@/lib/templates";
import { TEMPLATE_GUIDES } from "@/lib/templateGuides";

// Guias dos templates (/templates/<id>): páginas de entrada pela busca. As
// regras seguem os limites usuais de exibição no Google e as da Central de
// Ajuda (nada de recurso inexistente, números conferidos).
describe("guias dos templates", () => {
  it("todo template tem guia e todo guia tem template", () => {
    expect(TEMPLATE_GUIDES.map((g) => g.id).sort()).toEqual(TEMPLATES.map((t) => t.id).sort());
  });

  it("a estrutura tem um item por slide do template", () => {
    for (const t of TEMPLATES) {
      const g = TEMPLATE_GUIDES.find((x) => x.id === t.id)!;
      expect(g.outline.length, t.id).toBe(t.seed.slidesCount);
    }
  });

  it("título até 60 caracteres e descrição entre 120 e 160, únicos", () => {
    for (const g of TEMPLATE_GUIDES) {
      expect(g.seoTitle.length, g.seoTitle).toBeLessThanOrEqual(60);
      expect(g.metaDescription.length, g.metaDescription).toBeGreaterThanOrEqual(120);
      expect(g.metaDescription.length, g.metaDescription).toBeLessThanOrEqual(160);
    }
    const titles = TEMPLATE_GUIDES.map((g) => g.seoTitle);
    const descriptions = TEMPLATE_GUIDES.map((g) => g.metaDescription);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it("cada guia tem conteúdo próprio suficiente (sem página rasa)", () => {
    const words = (g: (typeof TEMPLATE_GUIDES)[number]) =>
      [g.h1, ...g.intro, g.audience, ...g.outline.flatMap((s) => [s.title, s.text]), ...g.tips, ...g.mistakes, ...g.faq.flatMap((f) => [f.q, f.a])]
        .join(" ").split(/\s+/).length;
    expect(TEMPLATE_GUIDES.map((g) => [g.id, words(g)]).filter(([, n]) => (n as number) < 450)).toEqual([]);
    for (const g of TEMPLATE_GUIDES) {
      expect(g.tips.length, g.id).toBeGreaterThanOrEqual(4);
      expect(g.faq.length, g.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("número de slides citado bate com a escolha do formulário (5 a 20)", () => {
    for (const g of TEMPLATE_GUIDES) {
      for (const f of g.faq) {
        // "No SlideAI você escolhe de 5 a 20 slides": o limite real do formulário.
        const range = f.a.match(/escolhe de (\d+) a (\d+) slides/);
        if (range) expect([range[1], range[2]], g.id).toEqual(["5", "20"]);
      }
    }
  });
});
