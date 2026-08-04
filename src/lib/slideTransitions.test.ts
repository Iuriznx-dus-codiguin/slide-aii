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

describe("pickTransition — Motion Director (Fase 3)", () => {
  it("BUG CORRIGIDO: hint 'fade' (preferDynamic=false) nunca mais cai silenciosamente em 'dynamic'", () => {
    // Antes desta mudança: "fade" não era um SlideTransition válido, então
    // `ALL_TRANSITIONS.includes("fade")` era false e a função caía direto no
    // fallback "dynamic" — ou seja, o usuário desativava o magic move e o
    // slide continuava usando magic move mesmo assim. Este teste trava o
    // comportamento corrigido: "fade" nunca deve resultar em "dynamic".
    for (let i = 0; i < ALL_TRANSITIONS.length * 2; i++) {
      const result = pickTransition(i, "bullet_points", "fade");
      expect(result).not.toBe("dynamic");
      expect(ALL_TRANSITIONS).toContain(result);
    }
  });

  it("é determinístico: mesmo index + mesmo contexto sempre produz a mesma transição", () => {
    const a = pickTransition(3, "data_chart", "fade", { narrativeAct: "proof" });
    const b = pickTransition(3, "data_chart", "fade", { narrativeAct: "proof" });
    expect(a).toBe(b);
  });

  it("SEM MISTURA: no modo magic move (sem hint), TODO slide é 'dynamic', independente do contexto narrativo", () => {
    // Regressão da inconsistência relatada: antes, contexto narrativo sem
    // hint escolhia num pool que incluía as legadas, produzindo decks com
    // magic move em alguns slides e transição clássica em outros.
    const contexts = [
      { narrativeAct: "climax" as const },
      { narrativeAct: "proof" as const },
      { animationIntent: "quote-spotlight" as const },
      { animationIntent: "data-reveal" as const, narrativeAct: "tension" as const },
    ];
    contexts.forEach((ctx, i) => {
      expect(pickTransition(i, "content", undefined, ctx)).toBe("dynamic");
    });
  });

  it("SEM MISTURA: no modo clássico ('fade'), nenhum slide usa magic move", () => {
    const contexts = [
      { narrativeAct: "hook" as const },
      { narrativeAct: "journey" as const },
      { animationIntent: "hero-impact" as const },
      { animationIntent: "narrative-build" as const },
    ];
    contexts.forEach((ctx, i) => {
      const result = pickTransition(i, "content", "fade", ctx);
      expect(result).not.toBe("dynamic");
      expect(ALL_TRANSITIONS).toContain(result);
    });
  });

  it("no modo clássico, narrative_act='climax' escolhe entre as transições de alto impacto", () => {
    for (let i = 0; i < 4; i++) {
      const result = pickTransition(i, "content", "fade", { narrativeAct: "climax" });
      expect(["portal", "shatter"]).toContain(result);
    }
  });

  it("animation_intent tem prioridade sobre narrative_act no modo clássico", () => {
    const result = pickTransition(0, "quote", "fade", {
      narrativeAct: "journey",
      animationIntent: "quote-spotlight",
    });
    expect(["iris", "letterbox"]).toContain(result);
  });

  it("respeita allowed_transitions do Creative Brief no modo clássico", () => {
    const result = pickTransition(0, "content", "fade", {
      narrativeAct: "climax",
      allowed: ["fold"],
    });
    expect(result).toBe("fold");
  });

  it("respeita forbidden_effects no modo clássico", () => {
    for (let i = 0; i < 6; i++) {
      const result = pickTransition(i, "content", "fade", {
        narrativeAct: "climax",
        forbidden: ["shatter"],
      });
      expect(result).not.toBe("shatter");
    }
  });

  it("sem hint e sem contexto narrativo, mantém o padrão histórico 'dynamic' (compatibilidade com Editor)", () => {
    expect(pickTransition(7, "content", undefined, {})).toBe("dynamic");
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
