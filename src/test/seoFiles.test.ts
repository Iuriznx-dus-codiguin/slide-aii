import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLAN_PRICES } from "@/lib/cakto";
import { TEMPLATES } from "@/lib/templates";

// Arquivos lidos por robôs: robots.txt, sitemap.xml e llms.txt.
const robots = readFileSync("public/robots.txt", "utf8");
const sitemap = readFileSync("public/sitemap.xml", "utf8");
const llms = readFileSync("public/llms.txt", "utf8");
const rules = robots.split("\n").filter((l) => !l.startsWith("#") && l.trim());

describe("robots.txt", () => {
  it("tem um único grupo (um grupo nomeado faria o robô ignorar as regras de *)", () => {
    expect(rules.filter((l) => l.startsWith("User-agent:"))).toEqual(["User-agent: *"]);
    expect(rules).toContain("Sitemap: https://slideai.com.br/sitemap.xml");
  });

  it("bloqueia as áreas logadas e libera as páginas públicas", () => {
    const disallowed = rules.filter((l) => l.startsWith("Disallow:")).map((l) => l.replace("Disallow:", "").trim());
    for (const p of ["/dashboard", "/editor/", "/gerar", "/perfil", "/suporte", "/admin/", "/__dev"]) expect(disallowed).toContain(p);
    for (const p of ["/", "/templates", "/ajuda", "/sobre", "/slides/", "/u/", "/termos", "/privacidade"]) {
      expect(disallowed.some((d) => d && p.startsWith(d)), p).toBe(false);
    }
  });
});

describe("sitemap.xml", () => {
  it("lista os guias dos templates e nenhuma rota privada", () => {
    for (const t of TEMPLATES) expect(sitemap).toContain(`<loc>https://slideai.com.br/templates/${t.id}</loc>`);
    for (const p of ["/dashboard", "/gerar", "/editor", "/auth", "/perfil"]) expect(sitemap).not.toContain(`slideai.com.br${p}<`);
  });
});

describe("llms.txt", () => {
  it("segue o formato (título, resumo e links) e cita os preços vigentes", () => {
    expect(llms.startsWith("# SlideAI\n\n> ")).toBe(true);
    expect(llms).toContain(PLAN_PRICES.single.replace("R$ ", "R$ "));
    expect(llms).toContain(`PRO a partir de ${PLAN_PRICES.mensal}`);
    expect(llms).toContain(`MAX a partir de ${PLAN_PRICES.max_mensal}`);
  });

  it("linka todos os guias de template", () => {
    for (const t of TEMPLATES) expect(llms).toContain(`(https://slideai.com.br/templates/${t.id})`);
  });
});
