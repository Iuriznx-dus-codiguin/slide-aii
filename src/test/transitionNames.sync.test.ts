// Guarda contra dessincronia entre o Creative Director (Deno) e o Motion
// Director (Vite). Desde que os nomes passaram a vir de um módulo único
// (supabase/functions/_shared/transitionNames.ts) a divergência não deveria
// mais acontecer — este teste existe para que, se alguém reintroduzir uma
// lista local em qualquer das pontas, a suíte falhe em vez de a plataforma
// prometer um efeito que o front não sabe renderizar.

import { describe, expect, it } from "vitest";
import { ALL_TRANSITIONS } from "@/lib/slideTransitions";
import { getTransitionConfig } from "@/lib/slideTransitions";
import { ALL_TRANSITION_NAMES } from "../../supabase/functions/_shared/creativeDirector.ts";

describe("nomes de transição — Deno (Creative Director) x Vite (Motion Director)", () => {
  it("o universo do Creative Director é exatamente magic move + as 12 cinematográficas", () => {
    expect([...ALL_TRANSITION_NAMES].sort()).toEqual(["dynamic", ...ALL_TRANSITIONS].sort());
  });

  it("toda transição que o Creative Director pode autorizar tem implementação no front", () => {
    for (const name of ALL_TRANSITION_NAMES) {
      const config = getTransitionConfig(name, "#ffffff");
      expect(config, `sem config para "${name}"`).toBeTruthy();
      expect(config.duration).toBeGreaterThan(0);
    }
  });

  it("nenhum nome duplicado na lista compartilhada", () => {
    expect(new Set(ALL_TRANSITION_NAMES).size).toBe(ALL_TRANSITION_NAMES.length);
  });
});
