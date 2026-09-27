// Notas do orador nunca vazias. Em produção, depois do motor v2, a IA passou
// a devolver `speaker_notes` vazio na maioria dos slides; o servidor agora
// completa a nota a partir do conteúdo real do slide, nos dois motores.

import { describe, expect, it } from "vitest";
import { fillSpeakerNotes } from "../../supabase/functions/generate-presentation/speeches.ts";

describe("fillSpeakerNotes", () => {
  it("mantém a nota da IA quando ela existe", () => {
    expect(fillSpeakerNotes("  Comece pela história da turbina.  ", { headline: "Energia" })).toBe("Comece pela história da turbina.");
  });

  it("completa nota vazia de slide com bloco visual (sem incluir arestas)", () => {
    const n = fillSpeakerNotes("", {
      headline: "Do vento à rede",
      subtitle: "Como a energia chega à sua casa",
      visual: { items: [{ label: "Vento" }, { label: "Rotor" }, { label: "Rede" }, { label: "liga", from: "Vento", to: "Rotor" }] },
    });
    expect(n).toContain("Do vento à rede");
    expect(n).toContain("Vento → Rotor → Rede");
    expect(n).not.toContain("liga");
  });

  it("usa bullets, número e citação quando existem", () => {
    expect(fillSpeakerNotes(null, { headline: "Resultados", bullets: ["a", "b"], stat_value: "42%", stat_label: "de economia" }))
      .toMatch(/Pontos a comentar: a; b\..*42% — de economia/);
    expect(fillSpeakerNotes(undefined, { headline: "Visão", quote_text: "O vento é infinito", quote_author: "Alguém" }))
      .toContain("citação de Alguém");
  });

  it("nunca devolve texto enorme e aproveita só a primeira frase do corpo", () => {
    const body = `${"palavra ".repeat(80)}. Segunda frase que não entra.`;
    const n = fillSpeakerNotes("", { headline: "T", body_text: body });
    expect(n.length).toBeLessThanOrEqual(700);
    expect(n).not.toContain("Segunda frase");
  });

  it("para qualquer slide com título, a nota não fica vazia", () => {
    for (const s of [{ headline: "A" }, { headline: "B", subtitle: "sub" }, { headline: "C", bullets: [] }]) {
      expect(fillSpeakerNotes("", s).length).toBeGreaterThan(0);
    }
  });
});
