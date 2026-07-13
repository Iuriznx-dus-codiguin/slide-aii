import { describe, it, expect } from "vitest";
import { pickTransition, getTransitionConfig, ALL_TRANSITIONS, REDUCED_MOTION_TRANSITION_CONFIG } from "./slideTransitions";

describe("pickTransition", () => {
  it("retorna 'dynamic' quando nenhuma transição foi escolhida (novo padrão)", () => {
    expect(pickTransition(0, "bullet_points", undefined)).toBe("dynamic");
    expect(pickTransition(5, "title_slide", undefined)).toBe("dynamic");
  });

  it("respeita um hint 'dynamic' explícito", () => {
    expect(pickTransition(2, "quote", "dynamic")).toBe("dynamic");
  });

  it("mantém 100% de compatibilidade com apresentações que já têm uma transição legada definida", () => {
    // Regressão: antes desta mudança, um slide já salvo com content.transition
    // preenchido (ex: "iris") sempre deveria continuar mostrando "iris" —
    // introduzir "dynamic" como novo padrão NÃO pode mudar isso.
    for (const legacy of ALL_TRANSITIONS) {
      expect(pickTransition(0, "bullet_points", legacy)).toBe(legacy);
    }
  });

  it("ignora um hint inválido/desconhecido e cai para o padrão dynamic", () => {
    expect(pickTransition(0, "bullet_points", "algo-que-nao-existe" as any)).toBe("dynamic");
  });
});

describe("getTransitionConfig — modo dynamic", () => {
  const cfg = getTransitionConfig("dynamic", "#A855F7");

  it("não tem Overlay — o drama do modo dynamic vem dos elementos internos (magic move + choreo), não do container", () => {
    expect(cfg.Overlay).toBeUndefined();
  });

  it("usa mode 'sync' — overlap necessário para o magic move ter de onde partir", () => {
    expect(cfg.mode).toBe("sync");
  });

  it("tem enter/exit bem formados", () => {
    expect(cfg.enter.initial).toBeTruthy();
    expect(cfg.enter.animate).toBeTruthy();
    expect(cfg.exit.exit).toBeTruthy();
  });
});

describe("getTransitionConfig — todas as transições legadas continuam válidas", () => {
  for (const t of ALL_TRANSITIONS) {
    it(`'${t}' produz uma config utilizável`, () => {
      const cfg = getTransitionConfig(t, "#A855F7");
      expect(cfg.duration).toBeGreaterThan(0);
      expect(cfg.enter.initial).toBeTruthy();
      expect(cfg.exit.exit).toBeTruthy();
    });
  }
});

describe("REDUCED_MOTION_TRANSITION_CONFIG", () => {
  it("não tem Overlay e usa sync (fade simples, sem drama de container)", () => {
    expect(REDUCED_MOTION_TRANSITION_CONFIG.Overlay).toBeUndefined();
    expect(REDUCED_MOTION_TRANSITION_CONFIG.mode).toBe("sync");
  });

  it("é curto (não deve competir em duração com as transições completas)", () => {
    expect(REDUCED_MOTION_TRANSITION_CONFIG.duration).toBeLessThanOrEqual(0.5);
  });
});
