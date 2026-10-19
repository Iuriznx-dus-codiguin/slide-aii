import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safeRedirect";

describe("safeNextPath — destino depois do login", () => {
  it("aceita caminhos do próprio site, com busca e âncora", () => {
    expect(safeNextPath("/gerar?planos=1")).toBe("/gerar?planos=1");
    expect(safeNextPath("/.lovable/oauth/consent?x=1#a")).toBe("/.lovable/oauth/consent?x=1#a");
  });

  it("recusa outro domínio, inclusive pelos atalhos do navegador", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "/\\/evil.com", "/\t/evil.com", "https://evil.com", "javascript:alert(1)", "evil.com", ""]) {
      expect(safeNextPath(bad), bad).toBeNull();
    }
    expect(safeNextPath(null)).toBeNull();
  });
});
