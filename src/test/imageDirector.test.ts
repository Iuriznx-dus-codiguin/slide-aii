// Image Director: toda imagem gerada por IA sai de uma receita estruturada
// (sujeito + transformação + composição + estilo + restrições), nunca de um
// prompt livre. A regra mais importante é "nenhum texto na imagem": rótulos
// ficam na camada nativa editável (legenda numerada), porque texto
// renderizado por modelo de imagem sai ilegível, errado ou em outro idioma.

import { describe, expect, it } from "vitest";
import {
  buildImagePrompt,
  cleanFragment,
  IMAGE_CONSTRAINTS,
  sanitizeRecipe,
  type ImageRecipe,
} from "../../supabase/functions/_shared/imageDirector.ts";
import { needsMedia, VISUAL_COMMANDS } from "../../supabase/functions/_shared/visualCommands.ts";
import { aiAssetFor, photoAssetFor, recipeForVisual, type AssetContext } from "../../supabase/functions/_shared/sceneResolver.ts";
import type { SceneVisual } from "../../supabase/functions/_shared/visualBlock.ts";

const CTX: AssetContext = {
  palette: { bg: "#0A0A12", text: "#FFFFFF", accent: "#00E0A4", accent2: "#7C5CFF" },
  style: "técnico limpo, luz de estúdio",
  domain: "engineering",
  budgetMode: "balanced",
  fallbackSubject: "turbina eólica",
};

const visualFor = (command: string): SceneVisual => ({
  command,
  intent: "DECOMPOSE",
  subject: "turbina eólica de eixo horizontal",
  items: [
    { label: "Pás" }, { label: "Rotor" }, { label: "Gerador" }, { label: "Torre" },
    { label: "liga", from: "Pás", to: "Rotor" },
  ],
} as SceneVisual);

const NO_TEXT = IMAGE_CONSTRAINTS[0];
const mediaCommands = VISUAL_COMMANDS.filter((c) => needsMedia(c));

describe("receitas por comando", () => {
  it("existe pelo menos um comando de mídia de cada família", () => {
    const kinds = new Set(mediaCommands.map((c) => c.imageRecipe));
    for (const k of ["technical", "cutout", "scene"]) expect(kinds.has(k as never), k).toBe(true);
  });

  for (const spec of mediaCommands) {
    it(`${spec.id}: prompt sem texto, determinístico e com as restrições fixas`, () => {
      const recipe = recipeForVisual(spec, visualFor(spec.id), CTX);
      const a = buildImagePrompt(recipe);
      expect(buildImagePrompt(recipe)).toEqual(a);
      for (const rule of IMAGE_CONSTRAINTS) expect(a.prompt).toContain(rule);
      expect(a.prompt.length).toBeLessThanOrEqual(3000);
      // Nada entre aspas — aspas no prompt pedem texto renderizado.
      expect(a.prompt).not.toMatch(/["“”«»]/);
      // Arestas (from/to) não viram "partes" da imagem.
      expect(a.prompt).not.toContain("liga");
      expect(a.format).toBe("webp");

      const cutout = spec.imageRecipe === "technical" || spec.imageRecipe === "cutout";
      expect(a.background).toBe(cutout ? "transparent" : "opaque");
      if (cutout) expect(a.prompt).toContain("transparent background");

      // Híbrido: só marcadores numéricos discretos, nunca rótulos escritos.
      if (spec.renderMode === "hybrid") {
        expect(a.prompt).toMatch(/numbered circular markers \(1 to \d\)/);
        expect(a.prompt).toContain("no other numbers or text");
      } else {
        expect(a.prompt).not.toContain("markers");
      }
    });
  }

  it("ativos pendentes carregam a receita (IA e foto com fallback)", () => {
    const tech = mediaCommands.find((c) => c.imageRecipe === "technical")!;
    const ai = aiAssetFor(tech, visualFor(tech.id), CTX, "visual-hero");
    expect(ai.source).toBe("ai");
    expect(ai.status).toBe("pending");
    expect(ai.recipe?.command).toBe(tech.id);
    const photoSpec = mediaCommands.find((c) => c.photoEligible)!;
    const photo = photoAssetFor(photoSpec, visualFor(photoSpec.id), CTX, "wind turbine", true);
    expect(photo.source).toBe("pexels");
    expect(photo.allow_ai_fallback).toBe(true);
    expect(photoAssetFor(photoSpec, visualFor(photoSpec.id), { ...CTX, budgetMode: "economy" }, "q", true).allow_ai_fallback).toBe(false);
  });
});

describe("pedidos de texto embutidos no conteúdo são removidos", () => {
  const base: ImageRecipe = { command: "HERO_OBJECT", kind: "cutout", subject: "", aspect: "16:9", transparent: true };
  const cases: [string, string][] = [
    ['a storefront sign that says "OPEN 24h"', "OPEN 24h"],
    ["a poster with the words Welcome Home", "Welcome Home"],
    ["uma placa escrita com 'ABERTO'", "ABERTO"],
    ["um cartaz dizendo Promoção Relâmpago", "Promoção Relâmpago"],
    ["uma caneca com a legenda Bom dia", "Bom dia"],
    ["a chart with labels Revenue and Cost", "Revenue"],
  ];
  for (const [subject, leaked] of cases) {
    it(subject, () => {
      const { prompt } = buildImagePrompt({ ...base, subject });
      expect(prompt).not.toContain(leaked);
      expect(prompt).toContain(NO_TEXT);
    });
  }

  it("preserva o sujeito legítimo que menciona texto como objeto", () => {
    // "text" e "labels" como substantivos comuns não disparam o corte.
    expect(cleanFragment("antique printing press with movable type")).toBe("antique printing press with movable type");
    expect(cleanFragment("textile loom")).toBe("textile loom");
  });

  it("itens com aspas e caracteres de controle saem limpos", () => {
    const { prompt } = buildImagePrompt({ ...base, subject: "motor", items: ['"Estator"', "Rotor\u0000\u0007", "Eixo 'principal'"] });
    expect(prompt).toContain("Estator, Rotor, Eixo principal");
    // eslint-disable-next-line no-control-regex -- remove caracteres de controle de propósito
    expect(prompt).not.toMatch(/[\u0000-\u001f]/);
  });
});

describe("sanitizeRecipe — receita vinda do cliente (fetch-image)", () => {
  it("recusa entrada sem sujeito", () => {
    for (const raw of [null, 1, "x", {}, { subject: "" }, { subject: '""' }]) expect(sanitizeRecipe(raw)).toBeNull();
  });

  it("normaliza campos inválidos em vez de repassá-los ao modelo", () => {
    const r = sanitizeRecipe({
      subject: "motor", command: "rm -rf /", kind: "virus", markers: 99,
      palette: { bg: "red; drop", accent: "#00E0A4" }, domain: "astrologia", aspect: "4:3",
    })!;
    expect(r.command).toBe("PHOTO");
    expect(r.kind).toBe("illustration");
    expect(r.markers).toBe(9);
    expect(r.palette).toEqual({ accent: "#00E0A4" });
    expect(r.domain).toBeUndefined();
    expect(["16:9", "1:1"]).toContain(r.aspect);
  });

  it("sanitizar uma receita válida não muda o prompt", () => {
    const spec = mediaCommands[0];
    const recipe = recipeForVisual(spec, visualFor(spec.id), CTX);
    const again = sanitizeRecipe(JSON.parse(JSON.stringify(recipe)))!;
    expect(buildImagePrompt(again).prompt).toBe(buildImagePrompt(recipe).prompt);
  });
});
