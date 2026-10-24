import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLAN_MONTHLY_CREDITS } from "../lib/cakto";

// supabase/functions/mcp/index.ts é gerado no build com a versão INSTALADA de
// @lovable.dev/mcp-js. Se a instalação local não seguir o bun.lock, o build
// troca a versão da função MCP em silêncio (aconteceu na auditoria de 10/2026).
describe("função MCP gerada", () => {
  it("usa a mesma versão de @lovable.dev/mcp-js do bun.lock", () => {
    const locked = readFileSync("bun.lock", "utf8").match(/"@lovable\.dev\/mcp-js@([0-9][^"]*)"/)?.[1];
    const bundle = readFileSync("supabase/functions/mcp/index.ts", "utf8");
    const used = [...bundle.matchAll(/npm:@lovable\.dev\/mcp-js@([0-9][^"/]*)/g)].map((m) => m[1]);
    expect(locked).toBeTruthy();
    expect(used.length).toBeGreaterThan(0);
    expect(new Set(used)).toEqual(new Set([locked]));
  });

  it("foi regenerada depois da última mudança de cota (get_credit_balance usa a mesma tabela)", () => {
    // O bundle embute src/lib/cakto.ts: sem `npm run build`, o saldo pelo MCP
    // usaria a cota antiga.
    const bundle = readFileSync("supabase/functions/mcp/index.ts", "utf8");
    const block = bundle.match(/var PLAN_MONTHLY_CREDITS = \{([^}]*)\}/)?.[1] ?? "";
    const bundled = Object.fromEntries([...block.matchAll(/(\w+): ([\d.e]+)/g)].map((m) => [m[1], Number(m[2])]));
    expect(bundled).toEqual(PLAN_MONTHLY_CREDITS);
  });
});
