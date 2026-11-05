// Motor principal (v1): prompt enxuto e schema sem campos mortos, que
// obedecem ao formulário (gráficos, imagens, tema, falas e profundidade).
import { describe, expect, it } from "vitest";
import {
  buildSystemPromptV1,
  buildToolV1,
  elementTargets,
  userPromptV1,
  type ContentV1Request,
} from "../../supabase/functions/generate-presentation/contentV1.ts";
import { maxTokensFor } from "../../supabase/functions/generate-presentation/contentCall.ts";
import { V1_VISUAL_COMMANDS } from "../../supabase/functions/_shared/deckComposer.ts";
import { CHART_TYPES } from "../../supabase/functions/_shared/chartSpec.ts";
import { buildDefaultBrief } from "../../supabase/functions/_shared/creativeDirector.ts";
import { buildDefaultOutline } from "../../supabase/functions/_shared/storyEngine.ts";

const REQ: ContentV1Request = {
  title: "historia da espanha", type: "Escolar", language: "pt-BR", slidesCount: 10,
  includeCharts: true, includeImages: true, includeSpeeches: false, isAutoTheme: true,
  personaText: "EDUCADOR", depthText: "EQUILIBRADO", textDepth: "balanced", presenterNames: [],
};

const slideSchema = (req: ContentV1Request, withTheme = true) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- árvore de JSON Schema
  const params = (buildToolV1(req, withTheme) as any)[0].function.parameters;
  return { top: params, slide: params.properties.slides.items };
};

describe("schema do v1 — só o que exige julgamento da IA", () => {
  it("sem os campos que o código sobrescrevia ou nunca lia", () => {
    const { slide } = slideSchema(REQ);
    for (const dead of ["slide_title", "animation", "animation_intent", "narrative_act", "layout_template", "visual_accents", "image_strategy", "ai_image_prompt", "image_style"]) {
      expect(slide.properties, dead).not.toHaveProperty(dead);
    }
    expect(slide.required).toEqual(["index", "slide_type", "headline", "speaker_notes"]);
  });

  it("diagramas nativos do v1 e os novos tipos de gráfico", () => {
    const { slide } = slideSchema(REQ);
    expect(slide.properties.visual.properties.command.enum).toEqual([...V1_VISUAL_COMMANDS]);
    expect(slide.properties.chart.properties.type.enum).toEqual([...CHART_TYPES]);
    expect(slide.properties.chart.properties).toHaveProperty("source");
  });

  it("o formulário manda: sem gráficos não há chart; sem imagens não há image_query", () => {
    const { slide } = slideSchema({ ...REQ, includeCharts: false, includeImages: false });
    expect(slide.properties).not.toHaveProperty("chart");
    expect(slide.properties).not.toHaveProperty("image_query");
    const prompt = buildSystemPromptV1({ ...REQ, includeCharts: false, includeImages: false }, buildDefaultBrief({ title: REQ.title, type: REQ.type, slidesCount: 10 }), buildDefaultOutline({ title: REQ.title, type: REQ.type, slidesCount: 10 }));
    expect(prompt).not.toContain("image_query");
    expect(prompt).not.toContain("- chart:");
  });

  it("tema fixo: a IA não devolve paleta; falas só quando pagas", () => {
    expect(slideSchema({ ...REQ, isAutoTheme: false }).top.properties).not.toHaveProperty("dynamic_theme");
    expect(slideSchema(REQ).top.properties).toHaveProperty("dynamic_theme");
    expect(slideSchema(REQ).slide.properties).not.toHaveProperty("presenters_data");
    expect(slideSchema({ ...REQ, includeSpeeches: true, presenterNames: ["Ana"] }).slide.properties).toHaveProperty("presenters_data");
  });

  it("deck_title obrigatório só na chamada que traz os campos de topo", () => {
    expect(slideSchema(REQ, true).top.required).toContain("deck_title");
    expect(slideSchema(REQ, false).top.properties).not.toHaveProperty("deck_title");
    expect(userPromptV1(REQ, { from: 1, to: 10 }, true)).toContain("deck_title");
    expect(userPromptV1(REQ, { from: 6, to: 10 }, false)).toContain("SOMENTE os slides S6 a S10");
  });
});

describe("prompt do v1", () => {
  const brief = buildDefaultBrief({ title: REQ.title, type: REQ.type, slidesCount: 10 });
  const outline = buildDefaultOutline({ title: REQ.title, type: REQ.type, slidesCount: 10 });

  it("fidelidade ao título e capa com o símbolo literal do tema", () => {
    const p = buildSystemPromptV1(REQ, brief, outline);
    expect(p).toContain("deck_title");
    expect(p).toContain("MESMAS palavras");
    expect(p).toContain("LITERAL");
  });

  it("enxuto: bem menor que o prompt antigo (~15 mil caracteres)", () => {
    const p = buildSystemPromptV1(REQ, brief, outline);
    expect(p.length).toBeLessThan(7500);
    expect(JSON.stringify(buildToolV1(REQ, true)).length).toBeLessThan(4500);
  });

  it("metas de distribuição seguem o formulário", () => {
    expect(elementTargets({ slidesCount: 10, includeCharts: true, includeImages: true })).toMatchObject({ photos: 4, charts: 2 });
    expect(elementTargets({ slidesCount: 10, includeCharts: false, includeImages: false })).toMatchObject({ photos: 0, charts: 0 });
  });

  it("teto de saída com piso para o fallback de raciocínio e limite do modelo", () => {
    expect(maxTokensFor(5, 680, 8000)).toBe(8000);
    expect(maxTokensFor(20, 1220, 8000)).toBe(24400);
    expect(maxTokensFor(40, 1220, 8000)).toBe(32000);
  });
});
