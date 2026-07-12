import { describe, it, expect } from "vitest";
import { anchorLayoutId, sharedId, ANCHOR_LAYOUT_TRANSITION } from "./morphing";

describe("anchorLayoutId", () => {
  it("retorna undefined quando active=false — elemento não participa do magic move", () => {
    expect(anchorLayoutId("title", false)).toBeUndefined();
    expect(anchorLayoutId("hero-media", false)).toBeUndefined();
    expect(anchorLayoutId("stat", false)).toBeUndefined();
  });

  it("retorna um id estável baseado só no papel quando active=true", () => {
    expect(anchorLayoutId("title", true)).toBe("slideai-anchor-title");
    expect(anchorLayoutId("hero-media", true)).toBe("slideai-anchor-hero-media");
    expect(anchorLayoutId("stat", true)).toBe("slideai-anchor-stat");
  });

  it("o id NÃO varia com conteúdo — é isso que corrige o bug original", () => {
    // Regressão: a versão anterior (sharedId com key de conteúdo) gerava um
    // id diferente para cada headline/valor de stat, então o mesmo papel em
    // dois slides consecutivos NUNCA tinha o mesmo layoutId — o magic move
    // nunca encontrava um par para animar. anchorLayoutId deve ser
    // determinístico e depender só do papel, nunca do conteúdo do slide.
    const idSlideA = anchorLayoutId("title", true);
    const idSlideB = anchorLayoutId("title", true);
    expect(idSlideA).toBe(idSlideB);
  });
});

describe("sharedId (legado, ainda usado por outras features)", () => {
  it("sem key, se comporta de forma equivalente a um id só de papel", () => {
    expect(sharedId("title")).toBe("slide-shared-title");
  });

  it("com key, mantém o comportamento antigo (para quem ainda depender de conteúdo)", () => {
    expect(sharedId("title", "abc")).toBe("slide-shared-title-abc");
  });
});

describe("ANCHOR_LAYOUT_TRANSITION", () => {
  it("define uma duração e easing explícitos (não usa o spring padrão do Framer Motion)", () => {
    expect(ANCHOR_LAYOUT_TRANSITION.duration).toBeGreaterThan(0);
    expect(Array.isArray(ANCHOR_LAYOUT_TRANSITION.ease)).toBe(true);
  });
});
