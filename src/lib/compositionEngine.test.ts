import { describe, it, expect } from "vitest";
import { densityScore, computeCompositionSpec } from "./compositionEngine";

describe("densityScore", () => {
  it("retorna 0 para conteúdo vazio", () => {
    expect(densityScore({})).toBe(0);
  });

  it("conteúdo esparso (só headline curto) tem densidade baixa", () => {
    expect(densityScore({ headline: "Título Curto" })).toBeLessThan(0.15);
  });

  it("conteúdo denso (body rico + bullets, conforme PASSO C/D do prompt) tem densidade alta", () => {
    const denseBody = new Array(70).fill("palavra").join(" "); // ~70 palavras, dentro da faixa 40-90 pedida no prompt
    const bullets = [
      "Primeiro ponto denso com bastante contexto e dado concreto real",
      "Segundo ponto igualmente denso com verbo forte e exemplo prático",
      "Terceiro ponto fechando a lista com outra informação relevante",
    ];
    expect(densityScore({ headline: "Título", subtitle: "Subtítulo com contexto adicional", bodyText: denseBody, bullets })).toBeGreaterThan(0.6);
  });

  it("nunca sai da faixa [0,1] mesmo com conteúdo extremo", () => {
    const huge = new Array(2000).fill("palavra").join(" ");
    expect(densityScore({ bodyText: huge, bullets: [huge, huge, huge] })).toBeLessThanOrEqual(1);
    expect(densityScore({ bodyText: huge, bullets: [huge, huge, huge] })).toBeGreaterThanOrEqual(0);
  });
});

describe("computeCompositionSpec", () => {
  it("sem creative_brief, cai na faixa 'balanced' (equivalente ao padding fixo de antes desta feature)", () => {
    const spec = computeCompositionSpec({ headline: "X" });
    const value = parseFloat(spec.padding);
    expect(value).toBeGreaterThanOrEqual(4.5);
    expect(value).toBeLessThanOrEqual(6.5);
  });

  it("tema 'tight' + conteúdo denso produz padding próximo do mínimo da faixa apertada", () => {
    const denseBody = new Array(80).fill("palavra").join(" ");
    const spec = computeCompositionSpec(
      { bodyText: denseBody, bullets: ["um dois três quatro cinco seis sete oito", "um dois três quatro cinco seis sete oito"] },
      { spacing: "tight" },
    );
    const value = parseFloat(spec.padding);
    expect(value).toBeGreaterThanOrEqual(3.5);
    expect(value).toBeLessThanOrEqual(5);
  });

  it("tema 'generous' + conteúdo esparso produz padding próximo do máximo da faixa generosa", () => {
    const spec = computeCompositionSpec({ headline: "Curto" }, { spacing: "generous" });
    const value = parseFloat(spec.padding);
    expect(value).toBeGreaterThan(7.5); // densidade ~0 → perto do teto (9)
    expect(value).toBeLessThanOrEqual(9);
  });

  it("padding nunca sai da faixa declarada pelo brief, mesmo em densidade extrema", () => {
    const huge = new Array(500).fill("palavra").join(" ");
    for (const spacing of ["tight", "balanced", "generous"] as const) {
      const spec = computeCompositionSpec({ bodyText: huge, bullets: [huge] }, { spacing });
      const value = parseFloat(spec.padding);
      const [min, max] = { tight: [3.5, 5], balanced: [4.5, 6.5], generous: [6, 9] }[spacing];
      expect(value).toBeGreaterThanOrEqual(min);
      expect(value).toBeLessThanOrEqual(max);
    }
  });

  it("gap é sempre menor ou igual ao padding (grid nunca mais 'arejado' que a borda do slide)", () => {
    const spec = computeCompositionSpec({ headline: "X", bodyText: "algum corpo de texto aqui" });
    expect(parseFloat(spec.gap)).toBeLessThanOrEqual(parseFloat(spec.padding));
  });

  it("nunca lança exceção com brief nulo/indefinido", () => {
    expect(() => computeCompositionSpec({}, null)).not.toThrow();
    expect(() => computeCompositionSpec({}, undefined)).not.toThrow();
  });

  it("é determinístico: mesmo input sempre produz o mesmo resultado", () => {
    const input = { headline: "A", bodyText: "algum corpo", bullets: ["um", "dois"] };
    const a = computeCompositionSpec(input, { spacing: "balanced" });
    const b = computeCompositionSpec(input, { spacing: "balanced" });
    expect(a).toEqual(b);
  });
});
