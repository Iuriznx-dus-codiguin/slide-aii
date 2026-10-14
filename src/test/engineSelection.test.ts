import { describe, expect, it } from "vitest";
import { DEFAULT_ENGINE, parseEngine, parseRolloutPercent, pickEngine } from "../../supabase/functions/_shared/engineSelection";

const base = { persistOnServer: true, rolloutPercent: 0, bucket: 0.5 };

describe("escolha do motor de geração", () => {
  it("v1 é o motor principal: sem pedido e sem rollout, todos recebem v1", () => {
    expect(DEFAULT_ENGINE).toBe(1);
    expect(pickEngine({ ...base, requested: undefined, isDev: false })).toEqual({ engine: 1, reason: "default", requested: null });
    expect(pickEngine({ ...base, requested: undefined, isDev: true })).toEqual({ engine: 1, reason: "default", requested: null });
  });

  it("desenvolvedor escolhe o motor no Dev Mode", () => {
    expect(pickEngine({ ...base, requested: 2, isDev: true })).toEqual({ engine: 2, reason: "dev_choice", requested: 2 });
    expect(pickEngine({ ...base, requested: 1, isDev: true })).toEqual({ engine: 1, reason: "dev_choice", requested: 1 });
    // Mesmo com rollout em 100%, o dev consegue forçar o v1 para comparar.
    expect(pickEngine({ ...base, rolloutPercent: 100, requested: 1, isDev: true }).engine).toBe(1);
  });

  it("pedido de motor de quem não é desenvolvedor é ignorado", () => {
    const d = pickEngine({ ...base, requested: 2, isDev: false });
    expect(d.engine).toBe(1);
    expect(d.requested).toBeNull();
  });

  it("cliente antigo (sem persistência no servidor) sempre usa v1", () => {
    expect(pickEngine({ ...base, persistOnServer: false, requested: 2, isDev: true }).reason).toBe("legacy_client");
    expect(pickEngine({ ...base, persistOnServer: false, requested: 2, isDev: true }).engine).toBe(1);
  });

  it("rollout percentual é estável pelo sorteio do usuário", () => {
    expect(pickEngine({ ...base, rolloutPercent: 10, bucket: 0.05, requested: undefined, isDev: false }).engine).toBe(2);
    expect(pickEngine({ ...base, rolloutPercent: 10, bucket: 0.5, requested: undefined, isDev: false })).toEqual({ engine: 1, reason: "rollout", requested: null });
    expect(pickEngine({ ...base, rolloutPercent: 100, bucket: 0.999, requested: undefined, isDev: false }).engine).toBe(2);
  });

  it("valores inválidos não ativam o v2", () => {
    expect(parseEngine("3")).toBeNull();
    expect(parseEngine(undefined)).toBeNull();
    expect(parseRolloutPercent("abc")).toBe(0);
    expect(parseRolloutPercent(-5)).toBe(0);
    expect(parseRolloutPercent(250)).toBe(100);
    expect(pickEngine({ ...base, requested: "v2", isDev: true }).engine).toBe(1);
  });
});
