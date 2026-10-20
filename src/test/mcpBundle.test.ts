import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
});
