// Escolha do motor de geração (v1 = motor principal, v2 = motor de cenas).
//
// Módulo puro (sem Deno/env): generate-presentation lê o rollout e calcula o
// sorteio do usuário; aqui fica só a regra, para ser testada e para que o
// painel de desenvolvedor saiba POR QUE um motor foi usado.
//
// Ordem de decisão:
//   1. Cliente antigo (sem persist:"server") → v1. Ele grava o deck sozinho e
//      não conhece o bloco visual do v2.
//   2. Desenvolvedor que escolheu o motor no Dev Mode → a escolha dele.
//   3. Rollout (ENGINE_V2_ROLLOUT_PERCENT, 0–100, estável por usuário).
//   4. Sem rollout → v1, o motor principal.
// Um pedido de motor vindo de quem não é desenvolvedor é ignorado.

export type EngineVersion = 1 | 2;

/** Motor principal da plataforma (o que todo usuário recebe por padrão). */
export const DEFAULT_ENGINE: EngineVersion = 1;

export type EngineReason = "legacy_client" | "dev_choice" | "rollout" | "default";

export interface EngineDecision {
  engine: EngineVersion;
  reason: EngineReason;
  /** Motor pedido pelo cliente (só conta para desenvolvedores). */
  requested: EngineVersion | null;
}

export function parseEngine(v: unknown): EngineVersion | null {
  if (v === 1 || v === "1") return 1;
  if (v === 2 || v === "2") return 2;
  return null;
}

/** Percentual do rollout limitado a 0–100; qualquer valor inválido vira 0. */
export function parseRolloutPercent(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

export function pickEngine(opts: {
  requested: unknown;
  isDev: boolean;
  persistOnServer: boolean;
  rolloutPercent: number;
  /** Sorteio estável do usuário em [0, 1). */
  bucket: number;
}): EngineDecision {
  const requested = opts.isDev ? parseEngine(opts.requested) : null;
  if (!opts.persistOnServer) return { engine: 1, reason: "legacy_client", requested };
  if (requested) return { engine: requested, reason: "dev_choice", requested };
  const rollout = parseRolloutPercent(opts.rolloutPercent);
  if (rollout > 0 && opts.bucket * 100 < rollout) return { engine: 2, reason: "rollout", requested };
  return { engine: DEFAULT_ENGINE, reason: rollout > 0 ? "rollout" : "default", requested };
}

export const ENGINE_REASON_LABEL: Record<EngineReason, string> = {
  legacy_client: "cliente antigo (sem persistência no servidor)",
  dev_choice: "escolha no Dev Mode",
  rollout: "rollout percentual",
  default: "motor principal (padrão)",
};
