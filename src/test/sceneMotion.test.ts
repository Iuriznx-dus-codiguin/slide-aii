// Movimento do motor v2: a IA e o Editor gravam só JSON declarativo
// (`{ preset, params }`) no slide; o cliente constrói o cenário da Timeline
// Engine a partir dele. Este teste garante que o JSON é validado na entrada,
// sobrevive ao round-trip do banco e que todo preset vira um cenário
// determinístico, finito e serializável.

import { describe, expect, it } from "vitest";
import {
  isMotionPreset,
  motionForTextSlide,
  MOTION_PRESETS,
  normalizeMotion,
  type MotionSpec,
} from "../../supabase/functions/_shared/motionPresets.ts";
import { buildSceneScenario, interpolate, type SceneMotionInput } from "@/lib/scene/sceneMotion";

const input = (motion: MotionSpec | null, over: Partial<SceneMotionInput> = {}): SceneMotionInput => ({
  motion,
  itemCount: 4,
  edgeCount: 3,
  shapeCount: 4,
  bullets: 2,
  hasSubtitle: true,
  hasBody: true,
  hasMedia: true,
  ...over,
});

/** Todo número do cenário é finito (sem NaN/Infinity, que o JSON viraria null). */
function allFinite(v: unknown): boolean {
  if (typeof v === "number") return Number.isFinite(v);
  if (Array.isArray(v)) return v.every(allFinite);
  if (v && typeof v === "object") return Object.values(v).every(allFinite);
  return true;
}

describe("normalizeMotion — validação do JSON gravado", () => {
  it("aceita todo preset do catálogo e faz round-trip exato pelo JSON", () => {
    for (const preset of MOTION_PRESETS) {
      const spec = normalizeMotion({ preset, params: { speed: 1.2, stagger: 0.1, emphasis: 2, ambient: false } })!;
      expect(spec.preset).toBe(preset);
      const back = normalizeMotion(JSON.parse(JSON.stringify(spec)));
      expect(back).toEqual(spec);
    }
  });

  it("descarta preset desconhecido e lixo", () => {
    for (const raw of [null, undefined, 3, "hero", {}, { preset: "explode" }, { preset: 1 }]) {
      expect(normalizeMotion(raw)).toBeUndefined();
    }
  });

  it("limita parâmetros aos intervalos seguros e ignora campos estranhos", () => {
    const spec = normalizeMotion({ preset: "editorial", params: { speed: 99, stagger: -1, emphasis: 3.7, ambient: "sim", evil: "x" } })!;
    expect(spec.params).toEqual({ speed: 2, stagger: 0.02, emphasis: 4 });
    expect(normalizeMotion({ preset: "calm", params: { speed: Number.NaN } })).toEqual({ preset: "calm" });
  });

  it("slides de texto recebem preset válido pelo papel de animação", () => {
    for (const intent of ["hero-impact", "narrative-build", "data-reveal", "emphasis-stat", "quote-spotlight", "section-break", "calm-fade", "desconhecido", undefined]) {
      expect(isMotionPreset(motionForTextSlide(intent).preset), String(intent)).toBe(true);
    }
    expect(motionForTextSlide("narrative-build", "title_slide").preset).toBe("hero");
  });
});

describe("buildSceneScenario — cenário da Timeline Engine", () => {
  for (const preset of MOTION_PRESETS) {
    it(preset, () => {
      const i = input({ preset, params: { emphasis: 1 } });
      const a = buildSceneScenario(i);
      // Determinístico.
      expect(buildSceneScenario(i)).toEqual(a);
      // Serializável sem perda (vai para o banco/preview como JSON puro).
      expect(allFinite(a)).toBe(true);
      expect(JSON.parse(JSON.stringify(a))).toEqual(a);
      // Duração coerente: entrada curta e todos os keyframes dentro dela.
      expect(a.duration).toBeGreaterThan(0);
      expect(a.duration).toBeLessThanOrEqual(6);
      const ids = new Set<string>();
      for (const t of a.tracks) {
        expect(ids.has(t.id), `trilha duplicada ${t.id}`).toBe(false);
        ids.add(t.id);
        expect(t.keyframes.length).toBeGreaterThanOrEqual(1);
        for (let k = 0; k < t.keyframes.length; k++) {
          const kf = t.keyframes[k];
          expect(kf.t).toBeGreaterThanOrEqual(0);
          expect(kf.t).toBeLessThanOrEqual(a.duration + 1e-9);
          if (k > 0) expect(kf.t).toBeGreaterThanOrEqual(t.keyframes[k - 1].t);
          if (kf.ease) expect(kf.ease).toHaveLength(4);
        }
      }
      // O título sempre entra.
      expect(ids.has("title")).toBe(true);
      // Ambiente: loops curtos e sutis, nunca durações absurdas.
      for (const amb of a.ambient ?? []) {
        expect(amb.duration).toBeGreaterThan(0);
        expect(amb.duration).toBeLessThanOrEqual(20);
      }
    });
  }

  it("sem motion usa o preset editorial", () => {
    expect(buildSceneScenario(input(null))).toEqual(buildSceneScenario(input({ preset: "editorial" })));
  });

  it("speed maior encurta a entrada", () => {
    const slow = buildSceneScenario(input({ preset: "step-cascade", params: { speed: 0.6 } }));
    const fast = buildSceneScenario(input({ preset: "step-cascade", params: { speed: 1.6 } }));
    expect(fast.duration).toBeLessThan(slow.duration);
  });

  it("ambient: false desliga a camada em loop", () => {
    for (const preset of MOTION_PRESETS) {
      const a = buildSceneScenario(input({ preset, params: { ambient: false } }));
      expect(a.ambient ?? [], preset).toHaveLength(0);
    }
  });

  it("uma trilha por nó e por aresta nos presets de diagrama", () => {
    const a = buildSceneScenario(input({ preset: "connect-draw" }, { itemCount: 5, edgeCount: 4 }));
    const ids = a.tracks.map((t) => t.id);
    for (let i = 0; i < 5; i++) expect(ids).toContain(`node-${i}`);
    for (let i = 0; i < 4; i++) expect(ids).toContain(`edge-${i}`);
  });

  it("interpolate tem clamp nas pontas (semântica do Remotion)", () => {
    expect(interpolate(-1, [0, 1], [0, 10])).toBe(0);
    expect(interpolate(0.5, [0, 1], [0, 10])).toBe(5);
    expect(interpolate(5, [0, 1], [0, 10])).toBe(10);
    expect(interpolate(3, [2, 2], [0, 10])).toBe(10);
  });
});
