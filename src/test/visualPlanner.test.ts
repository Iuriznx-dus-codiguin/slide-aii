// Planner visual (motor de cenas v2): decide, sem IA, quais comandos visuais
// cada slide pode usar, onde entram fotos e onde entram as vagas de imagem por
// IA. Precisa ser determinístico — o mesmo roteiro com o mesmo brief sempre
// gera o mesmo plano — para que a geração seja reproduzível e comparável.

import { describe, expect, it } from "vitest";
import {
  allowedByOptions,
  needsAi,
  PHOTO_SHARE_CAP,
  planDeck,
  planLine,
  stableHash,
  type PlannerBeat,
  type PlannerOptions,
} from "../../supabase/functions/_shared/visualPlanner.ts";
import { getCommand, MVP_COMMAND_IDS, needsMedia } from "../../supabase/functions/_shared/visualCommands.ts";
import { TEXT_ONLY_MAX_RUN } from "../../supabase/functions/_shared/qualityGate.ts";

const BEATS: PlannerBeat[] = [
  { narrative_act: "hook", visual_intent: "EMPHASIZE", key_objects: ["turbina eólica"] },
  { narrative_act: "tension", visual_intent: "SHOW_CAUSE_EFFECT", key_objects: ["emissões", "carvão"] },
  { narrative_act: "journey", visual_intent: "DECOMPOSE", key_objects: ["pás", "rotor", "gerador", "torre"] },
  { narrative_act: "journey", visual_intent: "SHOW_PROCESS", key_objects: ["vento", "rotor", "gerador", "rede"] },
  { narrative_act: "proof", visual_intent: "SHOW_DATA", key_objects: ["capacidade instalada"] },
  { narrative_act: "journey", visual_intent: "COMPARE", key_objects: ["eólica", "solar"] },
  { narrative_act: "proof", visual_intent: "SHOW_EVOLUTION", key_objects: ["1980", "2000", "2024"] },
  { narrative_act: "tension", visual_intent: "REVEAL_INTERNAL", key_objects: ["nacele", "caixa de engrenagens"] },
  { narrative_act: "journey", visual_intent: "SHOW_RELATIONSHIP", key_objects: ["rede", "armazenamento", "consumidores"] },
  { narrative_act: "proof", visual_intent: "SHOW_SCALE", key_objects: ["pá de 100 m"] },
  { narrative_act: "journey", visual_intent: "EXPLAIN", key_objects: [] },
  { narrative_act: "climax", visual_intent: "EMPHASIZE", key_objects: ["futuro"] },
];

const BRIEF = { domain: "engineering" as const, visual_density: "balanced" as const, abstraction_degree: 0.3 };

const OPTS: PlannerOptions = {
  includeImages: true,
  includeCharts: true,
  budgetMode: "balanced",
  maxAiVisuals: 4,
  seed: "Energia eólica",
};

const variants: [string, PlannerOptions][] = [
  ["equilibrado", OPTS],
  ["economia", { ...OPTS, budgetMode: "economy", maxAiVisuals: 0 }],
  ["premium", { ...OPTS, budgetMode: "premium", maxAiVisuals: 8 }],
  ["sem imagens", { ...OPTS, includeImages: false }],
  ["sem gráficos", { ...OPTS, includeCharts: false }],
  ["sem imagens nem gráficos", { ...OPTS, includeImages: false, includeCharts: false }],
];

describe("planDeck — determinismo", () => {
  it("mesma entrada → mesmo plano, chamada após chamada", () => {
    const a = planDeck(BEATS, BRIEF, OPTS);
    for (let i = 0; i < 5; i++) expect(planDeck(BEATS, BRIEF, OPTS)).toEqual(a);
  });

  it("não depende de estado global nem muta a entrada", () => {
    const beats = JSON.parse(JSON.stringify(BEATS));
    const before = JSON.stringify(beats);
    const a = planDeck(beats, BRIEF, OPTS);
    planDeck(beats, { domain: "medical" }, { ...OPTS, seed: "outro" });
    expect(JSON.stringify(beats)).toBe(before);
    expect(planDeck(beats, BRIEF, OPTS)).toEqual(a);
  });

  it("o plano é JSON puro (sobrevive ao round-trip sem perda)", () => {
    const plan = planDeck(BEATS, BRIEF, OPTS);
    expect(JSON.parse(JSON.stringify(plan))).toEqual(plan);
  });

  it("linhas do plano (enviadas no prompt) também são estáveis", () => {
    const a = planDeck(BEATS, BRIEF, OPTS).slides.map((s) => planLine(s));
    const b = planDeck(BEATS, BRIEF, OPTS).slides.map((s) => planLine(s));
    expect(a).toEqual(b);
  });

  it("stableHash é estável, distingue sementes e fica em [0,1)", () => {
    expect(stableHash("Energia eólica")).toBe(stableHash("Energia eólica"));
    expect(stableHash("Energia eólica")).not.toBe(stableHash("Energia solar"));
    for (const s of ["", "a", "Energia eólica", "x".repeat(500)]) {
      expect(stableHash(s)).toBeGreaterThanOrEqual(0);
      expect(stableHash(s)).toBeLessThan(1);
    }
  });
});

describe("planDeck — invariantes do plano", () => {
  for (const [name, opts] of variants) {
    describe(name, () => {
      const plan = planDeck(BEATS, BRIEF, opts);
      const content = plan.slides.filter((s) => s.role === "content");

      it("um plano por beat, capa primeiro e fechamento por último", () => {
        expect(plan.slides).toHaveLength(BEATS.length);
        expect(plan.slides[0].role).toBe("cover");
        expect(plan.slides[plan.slides.length - 1].role).toBe("closing");
        plan.slides.forEach((s, i) => expect(s.index).toBe(i));
      });

      it("só candidatos do MVP, permitidos pelas opções, no máximo 3", () => {
        for (const s of plan.slides) {
          expect(s.candidates.length).toBeLessThanOrEqual(3);
          for (const id of s.candidates) {
            expect(MVP_COMMAND_IDS, `fora do MVP: ${id}`).toContain(id);
            expect(allowedByOptions(getCommand(id)!, opts), `não permitido: ${id}`).toBe(true);
          }
        }
      });

      it("sem imagens → nenhuma foto nem vaga de IA; mídia só com gêmeo nativo fiel", () => {
        if (opts.includeImages) return;
        for (const s of plan.slides) {
          expect(s.photo).toBe(false);
          expect(s.aiVisual).toBe(false);
          expect(planLine(s)).not.toContain("image_query");
          for (const id of s.candidates) {
            const spec = getCommand(id)!;
            // Camadas/corte sobrevivem sem imagem porque viram LayerStack nativo.
            if (needsMedia(spec)) expect(spec.nativeComponent, `${id} sem desenho nativo`).toBe("LayerStack");
          }
        }
      });

      it("vagas de IA respeitam o teto; economia não usa IA", () => {
        const ai = plan.slides.filter((s) => s.aiVisual).length;
        expect(ai).toBe(plan.aiSlots);
        expect(ai).toBeLessThanOrEqual(opts.maxAiVisuals);
        if (opts.budgetMode === "economy") expect(ai).toBe(0);
        for (const s of plan.slides.filter((x) => x.aiVisual)) {
          expect(s.candidates.some((id) => needsAi(getCommand(id)!))).toBe(true);
        }
      });

      it("fotos respeitam o teto de participação", () => {
        const photos = content.filter((s) => s.photo).length;
        expect(photos).toBeLessThanOrEqual(Math.ceil(content.length * PHOTO_SHARE_CAP));
      });

      it("o comando preferido nunca se repete em slides consecutivos", () => {
        for (let i = 1; i < plan.slides.length; i++) {
          const a = plan.slides[i - 1].candidates[0];
          const b = plan.slides[i].candidates[0];
          if (a && b) expect(b, `S${i} e S${i + 1}`).not.toBe(a);
        }
      });

      it("slides tipográficos marcados não formam sequência longa", () => {
        let run = 0;
        for (const s of content) {
          run = s.textFirst ? run + 1 : 0;
          expect(run).toBeLessThanOrEqual(TEXT_ONLY_MAX_RUN);
        }
      });
    });
  }
});
