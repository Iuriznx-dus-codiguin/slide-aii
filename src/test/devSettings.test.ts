import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_DEV_SETTINGS, ENGINE_OPTIONS, engineOption, loadDevSettings, saveDevSettings } from "@/lib/devSettings";

const KEY = "slideai.devSettings";

describe("Dev Mode: seletor de motor", () => {
  beforeEach(() => localStorage.clear());

  it("padrão é o v1 (motor principal)", () => {
    expect(DEFAULT_DEV_SETTINGS.engine).toBe(1);
    expect(loadDevSettings().engine).toBe(1);
  });

  it("migra o antigo interruptor engineV2", () => {
    localStorage.setItem(KEY, JSON.stringify({ maxBudgetUsd: 0.5, engineV2: true }));
    const s = loadDevSettings();
    expect(s.engine).toBe(2);
    expect(s.maxBudgetUsd).toBe(0.5);
    expect("engineV2" in s).toBe(false);

    localStorage.setItem(KEY, JSON.stringify({ engineV2: false }));
    expect(loadDevSettings().engine).toBe(1);
  });

  it("guarda a escolha e ignora valores inválidos", () => {
    saveDevSettings({ ...DEFAULT_DEV_SETTINGS, engine: 2 });
    expect(loadDevSettings().engine).toBe(2);
    localStorage.setItem(KEY, JSON.stringify({ engine: 7 }));
    expect(loadDevSettings().engine).toBe(1);
  });

  it("opções do seletor: v1 produção e v2 teste", () => {
    expect(ENGINE_OPTIONS.map((o) => [o.value, o.badge])).toEqual([[1, "produção"], [2, "teste"]]);
    expect(engineOption(2).label).toContain("v2");
  });
});
