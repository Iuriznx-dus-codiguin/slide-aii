// Quality Gate determinístico do motor v2 (sem IA): contraste AA, texto que
// cabe na caixa do layout (o excedente vai para as notas do orador, nunca é
// apagado), ritmo do deck (teto de slides só de texto) e a geometria dos
// diagramas nativos, compartilhada entre a tela e o PPTX.

import { describe, expect, it } from "vitest";
import {
  AA_TEXT,
  assessRhythm,
  contrastRatio,
  ensureReadableTheme,
  fitTextToLayout,
  scrimAlphaForAA,
  type FitInput,
  TEXT_ONLY_MAX_RUN,
  TEXT_ONLY_SHARE_CAP,
} from "../../supabase/functions/_shared/qualityGate.ts";
import { capacityFor, densityScore, trimToWords, wordCount } from "../../supabase/functions/_shared/textMetrics.ts";
import { densityScore as clientDensityScore } from "@/lib/compositionEngine";
import * as G from "@/lib/scene/diagramLayout";

const words = (n: number, w = "palavra") => Array.from({ length: n }, (_, i) => `${w}${i}`).join(" ");

describe("contraste", () => {
  it("razão WCAG conhecida", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(contrastRatio("xyz", "#fff")).toBeNull();
  });

  it("tema ilegível tem só a cor do texto corrigida; tema bom fica intacto", () => {
    const bad = { bg: "#1A1A2E", text: "#2A2A3E", accent: "#FF5A5F" };
    const r = ensureReadableTheme(bad);
    expect(r.fixed).toBe(true);
    expect(r.theme!.accent).toBe(bad.accent);
    expect(r.theme!.bg).toBe(bad.bg);
    expect(contrastRatio(r.theme!.text!, bad.bg)!).toBeGreaterThanOrEqual(AA_TEXT);

    const good = { bg: "#0A0A12", text: "#FFFFFF" };
    expect(ensureReadableTheme(good)).toEqual({ theme: good, fixed: false });
    expect(ensureReadableTheme(null)).toEqual({ theme: null, fixed: false });
  });

  it("scrim sobre foto garante AA para texto claro em imagem clara", () => {
    const alpha = scrimAlphaForAA("#FFFFFF", "#000000", 0.9);
    expect(alpha).toBeGreaterThan(0.35);
    expect(alpha).toBeLessThanOrEqual(1);
    expect(scrimAlphaForAA("#FFFFFF", "#000000", 0.05)).toBeLessThanOrEqual(alpha);
  });
});

describe("texto que cabe no layout", () => {
  it("excedente do corpo, bullets e detalhes vai para as notas do orador", () => {
    const body = words(400);
    const { value, trims } = fitTextToLayout(
      { headline: "Título", body_text: body, bullets: ["a", "b", "c", "d", "e", "f"], speaker_notes: "Notas originais." },
      "visual-hero",
      true,
    );
    const cap = capacityFor("visual-hero", true);
    expect(trims).toBeGreaterThan(0);
    expect(wordCount(value.body_text)).toBeLessThanOrEqual(cap.bodyWords + 1);
    expect(value.bullets!.length).toBeLessThanOrEqual(cap.bullets);
    expect(value.speaker_notes).toContain("Notas originais.");
    expect(value.speaker_notes).toContain("Detalhes adicionais:");
    // O corpo continua nas notas de onde o slide parou…
    expect(value.speaker_notes).toContain(`palavra${cap.bodyWords} `);
    // …e os bullets cortados são sempre preservados, mesmo com corpo enorme.
    for (const b of ["a", "b", "c", "d", "e", "f"].slice(cap.bullets)) expect(value.speaker_notes).toContain(`• ${b}`);
  });

  it("detalhe de item longo vai inteiro para as notas", () => {
    const detail = words(60, "detalhe");
    const { value } = fitTextToLayout<FitInput>({ headline: "T", items: [{ label: "Rotor", detail }] }, "diagram-full", true);
    expect(wordCount(value.items![0].detail)).toBeLessThanOrEqual(capacityFor("diagram-full", true, 1).itemDetailWords + 1);
    expect(value.speaker_notes).toContain(`• Rotor: ${detail}`);
  });

  it("texto que já cabe não é tocado", () => {
    const input = { headline: "Curto", body_text: words(20), bullets: ["um", "dois"] };
    const { value, trims } = fitTextToLayout(input, undefined, false);
    expect(trims).toBe(0);
    expect(value).toEqual(input);
  });

  it("profundidade de texto do usuário continua valendo (long > balanced > short)", () => {
    const s = capacityFor("visual-hero", true, 0, "short").bodyWords;
    const b = capacityFor("visual-hero", true, 0, "balanced").bodyWords;
    const l = capacityFor("visual-hero", true, 0, "long").bodyWords;
    expect(s).toBeLessThan(b);
    expect(b).toBeLessThan(l);
  });

  it("trimToWords prefere fim de frase e devolve o resto", () => {
    const t = trimToWords("Primeira frase curta aqui. Segunda frase que passa do limite", 6);
    expect(t.kept).toBe("Primeira frase curta aqui.");
    expect(t.overflow).toBe("Segunda frase que passa do limite");
    expect(trimToWords("a b c", 10)).toEqual({ kept: "a b c", overflow: "" });
  });

  it("densityScore tem uma implementação só (servidor e cliente)", () => {
    expect(clientDensityScore).toBe(densityScore);
  });
});

describe("ritmo do deck", () => {
  it("resgata a terceira página de texto seguida", () => {
    const r = assessRhythm([false, true, true, true, false, false, false, false, false, false, false]);
    expect(r.maxRun).toBe(3);
    expect(r.violations).toContain(3);
  });

  it("aplica o teto de slides só de texto", () => {
    const flags = [false, true, false, true, false, true, false, true, false, true, true];
    const r = assessRhythm(flags);
    const after = flags.map((f, i) => f && !r.violations.includes(i));
    const content = flags.length - 1;
    expect(after.slice(1).filter(Boolean).length).toBeLessThanOrEqual(Math.floor(content * TEXT_ONLY_SHARE_CAP));
    let run = 0;
    for (const f of after.slice(1)) {
      run = f ? run + 1 : 0;
      expect(run).toBeLessThanOrEqual(TEXT_ONLY_MAX_RUN);
    }
  });

  it("a capa nunca conta como slide de texto", () => {
    expect(assessRhythm([true, false, false]).textOnly).toEqual([]);
  });
});

describe("geometria dos diagramas (tela e PPTX)", () => {
  const aspects = [0.9, 1.3, 16 / 9, 2.8];
  const counts = [2, 3, 5, 7];
  const chain = (n: number) => Array.from({ length: n - 1 }, (_, i) => ({ from: i, to: i + 1 }));
  const builders: [string, (n: number, a: number) => G.DiagramGeometry][] = [
    ["flow", G.layoutFlow],
    ["cycle", G.layoutCycle],
    ["timeline", G.layoutTimeline],
    ["funnel", G.layoutFunnel],
    ["pyramid", G.layoutPyramid],
    ["layers", G.layoutLayers],
    ["concept", G.layoutConcept],
    ["columns", G.layoutColumns],
    ["system", (n, a) => G.layoutSystem(n, chain(n), a)],
    ["scale", (n, a) => G.layoutScale(Array.from({ length: n }, (_, i) => (i + 1) * 10), a)],
  ];

  for (const [name, build] of builders) {
    it(`${name}: caixas dentro do slot, números finitos, determinístico`, () => {
      for (const aspect of aspects) {
        for (const n of counts) {
          const g = build(n, aspect);
          expect(build(n, aspect)).toEqual(g);
          expect(JSON.stringify(g)).not.toMatch(/NaN|Infinity|null/);
          for (const b of g.nodes) {
            expect(b.w, `${name} n=${n} a=${aspect}`).toBeGreaterThan(0);
            expect(b.h).toBeGreaterThan(0);
            expect(b.x).toBeGreaterThanOrEqual(-1);
            expect(b.y).toBeGreaterThanOrEqual(-1);
            expect(b.x + b.w).toBeLessThanOrEqual(g.W + 1);
            expect(b.y + b.h).toBeLessThanOrEqual(g.H + 1);
          }
        }
      }
    });
  }

  it("fluxo: nós não se sobrepõem", () => {
    for (const aspect of aspects) {
      const g = G.layoutFlow(6, aspect);
      for (let i = 0; i < g.nodes.length; i++) {
        for (let j = i + 1; j < g.nodes.length; j++) {
          const a = g.nodes[i];
          const b = g.nodes[j];
          const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
          expect(overlap, `nós ${i} e ${j} (aspect ${aspect})`).toBe(false);
        }
      }
    }
  });

  it("sistema: camadas seguem a direção das arestas", () => {
    const edges = [{ from: 0, to: 2 }, { from: 1, to: 2 }, { from: 2, to: 3 }, { from: 2, to: 4 }];
    const layers = G.layerAssignment(5, edges);
    for (const e of edges) expect(layers[e.to]).toBeGreaterThan(layers[e.from]);
  });

  it("escala: área do círculo proporcional ao valor", () => {
    const g = G.layoutScale([10, 40], 16 / 9);
    const [a, b] = g.nodes;
    expect((b.w * b.h) / (a.w * a.h)).toBeCloseTo(4, 0);
  });
});
