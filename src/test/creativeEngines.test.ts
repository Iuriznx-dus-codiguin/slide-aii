// Rede de segurança do motor criativo (Creative Director + Story Engine).
//
// Esta camada não tinha nenhum teste automatizado, apesar de mudar com
// frequência e de alimentar tanto o prompt principal quanto o Motion Director
// (narrative_act decide a transição de cada slide). Os testes abaixo cobrem
// as partes determinísticas — fallbacks e normalização —, que são exatamente
// as que rodam quando a IA auxiliar falha e ninguém percebe.

import { describe, expect, it } from "vitest";
import {
  buildDefaultBrief,
  briefToPromptSection,
  ALL_TRANSITION_NAMES,
} from "../../supabase/functions/_shared/creativeDirector.ts";
import {
  buildDefaultOutline,
  normalizeOutline,
  outlineToPromptSection,
} from "../../supabase/functions/_shared/storyEngine.ts";

const brief = (over: Partial<Parameters<typeof buildDefaultBrief>[0]> = {}) =>
  buildDefaultBrief({ title: "Fotossíntese", type: "Escolar", slidesCount: 8, ...over });

const outline = (over: Partial<Parameters<typeof buildDefaultOutline>[0]> = {}) =>
  buildDefaultOutline({ title: "Fotossíntese", type: "Escolar", slidesCount: 8, ...over });

describe("Creative Director — fallback determinístico", () => {
  it("preenche todos os campos exigidos pelo CreativeBrief", () => {
    const b = brief();
    for (const field of [
      "objective", "audience", "technical_level", "visual_style", "formality",
      "emotional_identity", "pacing", "visual_density", "narrative_type",
      "contrast", "hierarchy_strength", "spacing", "asymmetry",
      "element_density", "rationale",
    ] as const) {
      expect(b[field], `campo "${field}" vazio`).toBeTruthy();
    }
    expect(b.allowed_transitions.length).toBeGreaterThan(0);
  });

  it("não emite campos sem leitor — o brief só carrega o que é consumido", () => {
    // camera_movements / animation_speed / depth foram removidos: a IA
    // gastava tokens preenchendo, e nada no produto lia.
    const b = brief() as unknown as Record<string, unknown>;
    expect(b).not.toHaveProperty("camera_movements");
    expect(b).not.toHaveProperty("animation_speed");
    expect(b).not.toHaveProperty("depth");
  });

  it("mantém os graus normalizados entre 0 e 1", () => {
    for (const type of ["Acadêmico", "Marketing", "Criativo", "Corporativo"]) {
      const b = brief({ type });
      for (const degree of [b.minimalism_degree, b.creativity_degree, b.abstraction_degree]) {
        expect(degree).toBeGreaterThanOrEqual(0);
        expect(degree).toBeLessThanOrEqual(1);
      }
    }
  });

  it("diferencia a direção por tipo em vez de devolver sempre o mesmo brief", () => {
    const academico = brief({ type: "Acadêmico" });
    const marketing = brief({ type: "Marketing" });

    expect(academico.visual_style).not.toBe(marketing.visual_style);
    expect(academico.formality).toBe("formal");
    expect(marketing.formality).toBe("casual");
    // Trabalho acadêmico é mais contido; peça de marketing é mais expressiva.
    expect(academico.creativity_degree).toBeLessThan(marketing.creativity_degree);
    expect(academico.minimalism_degree).toBeGreaterThan(marketing.minimalism_degree);
  });

  it("restringe transições que destoam do contexto e nunca inventa nomes", () => {
    const academico = brief({ type: "Acadêmico" });
    expect(academico.forbidden_effects.length).toBeGreaterThan(0);
    expect(academico.allowed_transitions).not.toContain("shatter");
    // Um tema criativo mantém o universo completo.
    expect(brief({ type: "Criativo" }).allowed_transitions).toHaveLength(ALL_TRANSITION_NAMES.length);

    for (const type of ["Acadêmico", "Científico", "Escolar", "Corporativo", "Marketing", "Criativo", "Pitch de negócios", ""]) {
      for (const t of brief({ type }).allowed_transitions) {
        expect(ALL_TRANSITION_NAMES, `transição desconhecida: ${t}`).toContain(t);
      }
    }
  });

  it("a persona do orador ajusta a narrativa por cima do tipo", () => {
    const tecnico = brief({ type: "Corporativo", persona: "technical-authority" });
    const lider = brief({ type: "Corporativo", persona: "inspirational-leader" });

    expect(tecnico.narrative_type).toBe("data-driven");
    expect(tecnico.technical_level).toBe("expert");
    expect(lider.narrative_type).toBe("story-arc");
    expect(lider.creativity_degree).toBeGreaterThan(tecnico.creativity_degree);
  });

  it("o tamanho do deck e a profundidade alteram ritmo e densidade", () => {
    expect(brief({ slidesCount: 16 }).pacing).toBe("fast");
    expect(brief({ slidesCount: 6 }).pacing).toBe("slow");
    expect(brief({ depthLevel: "deep-dive" }).technical_level).toBe("expert");
    expect(brief({ depthLevel: "deep-dive" }).visual_density).toBe("dense");
    // Descrição detalhada também é sinal de substância para densificar.
    expect(brief({ description: "x".repeat(300) }).visual_density).toBe("dense");
  });

  it("tipo desconhecido cai num perfil neutro sem quebrar", () => {
    const b = brief({ type: "Algo Que Não Existe" });
    expect(b.visual_style).toBeTruthy();
    expect(b.allowed_transitions).toHaveLength(ALL_TRANSITION_NAMES.length);
  });

  it("briefToPromptSection inclui os campos que guiam a escrita", () => {
    const section = briefToPromptSection(brief({ type: "Marketing" }));
    expect(section).toContain("DIREÇÃO CRIATIVA");
    expect(section).toContain("vibrante");
    expect(section).not.toContain("undefined");
    expect(section).not.toContain("NaN");
  });
});

describe("Story Engine — fallback determinístico", () => {
  it("gera exatamente um beat por slide, começando em hook e terminando em climax", () => {
    for (const slidesCount of [1, 2, 5, 8, 20]) {
      const o = outline({ slidesCount });
      expect(o.beats).toHaveLength(slidesCount);
      expect(o.beats[0].narrative_act).toBe("hook");
      if (slidesCount > 1) {
        expect(o.beats[slidesCount - 1].narrative_act).toBe("climax");
      }
      o.beats.forEach((b, i) => expect(b.index).toBe(i));
    }
  });

  it("só o primeiro beat fica sem conexão com o anterior", () => {
    const o = outline({ slidesCount: 10 });
    expect(o.beats[0].connects_to_previous).toBe("");
    for (const b of o.beats.slice(1)) {
      expect(b.connects_to_previous).toBeTruthy();
    }
  });

  it("o ritmo do arco muda conforme o tipo da apresentação", () => {
    const academico = outline({ type: "Acadêmico", slidesCount: 10 });
    const marketing = outline({ type: "Marketing", slidesCount: 10 });

    const acts = (o: ReturnType<typeof outline>) => o.beats.map((b) => b.narrative_act).join(",");
    expect(acts(academico)).not.toBe(acts(marketing));
    expect(academico.arc_shape).not.toBe(marketing.arc_shape);

    // Pesquisa se apoia em evidência; peça de venda trabalha a dor.
    const count = (o: ReturnType<typeof outline>, act: string) =>
      o.beats.filter((b) => b.narrative_act === act).length;
    expect(count(academico, "proof")).toBeGreaterThan(count(academico, "tension"));
    expect(count(marketing, "tension")).toBeGreaterThan(count(marketing, "proof"));
  });

  it("os textos de cada beat referenciam o assunto e não se repetem em bloco", () => {
    const o = outline({ title: "Energia solar no Brasil", slidesCount: 9 });
    expect(o.beats[0].key_message).toContain("Energia solar no Brasil");
    expect(o.beats[o.beats.length - 1].key_message).toContain("Energia solar no Brasil");
    // Beats de atos diferentes precisam ter função diferente.
    const distinctFunctions = new Set(o.beats.map((b) => b.function));
    expect(distinctFunctions.size).toBeGreaterThan(2);
  });
});

describe("Story Engine — normalizeOutline", () => {
  const input = { title: "Fotossíntese", type: "Escolar", slidesCount: 5 };

  it("completa beats faltantes com o fallback", () => {
    const o = normalizeOutline({ beats: [{ index: 0, narrative_act: "hook", function: "f", key_message: "k", connects_to_previous: "" }] }, input);
    expect(o.beats).toHaveLength(5);
    expect(o.beats[4].narrative_act).toBe("climax");
  });

  it("descarta beats a mais e usa a posição do array, não o index da IA", () => {
    const aiBeats = Array.from({ length: 9 }, (_, i) => ({
      index: i + 1, // 1-based por engano
      narrative_act: "proof" as const,
      function: `função ${i}`,
      key_message: `mensagem ${i}`,
      connects_to_previous: "conexão",
    }));
    const o = normalizeOutline({ beats: aiBeats }, input);
    expect(o.beats).toHaveLength(5);
    o.beats.forEach((b, i) => expect(b.index).toBe(i));
    expect(o.beats[0].connects_to_previous).toBe("");
  });

  it("ignora narrative_act inválido e mantém o do fallback", () => {
    const o = normalizeOutline({
      beats: [{ index: 0, narrative_act: "explosao" as any, function: "f", key_message: "k", connects_to_previous: "" }],
    }, input);
    expect(o.beats[0].narrative_act).toBe("hook");
  });

  it("entrada vazia ou malformada devolve o arco padrão completo", () => {
    expect(normalizeOutline({}, input).beats).toHaveLength(5);
    expect(normalizeOutline({ beats: undefined }, input).beats).toHaveLength(5);
  });

  it("outlineToPromptSection lista todos os slides sem buracos", () => {
    const section = outlineToPromptSection(buildDefaultOutline({ ...input, slidesCount: 6 }));
    for (let i = 1; i <= 6; i++) expect(section).toContain(`Slide ${i} [`);
    expect(section).not.toContain("undefined");
  });
});
