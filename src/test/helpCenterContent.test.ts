import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ERROR_ARTICLE_LINKS,
  HELP_CATEGORIES,
  MIGRATION_FILES,
  buildSql,
  internalLinks,
  loadArticles,
} from "../../scripts/help-center.ts";
import { HELP_CATEGORY_META } from "../lib/helpCategories";

// A Central de Ajuda é publicada por migração gerada a partir dos .md em
// docs/central-de-ajuda. Estes testes impedem que o conteúdo publicado e os
// arquivos fiquem diferentes, e que um link aponte para artigo inexistente.
const articles = loadArticles();
const slugs = new Set(articles.map((a) => a.slug));

describe("Central de Ajuda", () => {
  it("as migrações estão atualizadas com os arquivos .md", () => {
    const sql = buildSql(articles);
    for (const f of MIGRATION_FILES) expect(readFileSync(f, "utf8")).toBe(sql);
  });

  it("links internos /ajuda/<slug> apontam para artigos existentes", () => {
    const broken = articles.flatMap((a) => internalLinks(a).filter((s) => !slugs.has(s)).map((s) => `${a.slug} → ${s}`));
    expect(broken).toEqual([]);
  });

  it("o catálogo de erros só aponta para artigos existentes", () => {
    const broken = Object.entries(ERROR_ARTICLE_LINKS).flatMap(([code, xs]) => xs.filter((s) => !slugs.has(s)).map((s) => `${code} → ${s}`));
    expect(broken).toEqual([]);
  });

  it("toda categoria tem rótulo na interface e ao menos um artigo", () => {
    for (const c of HELP_CATEGORIES) {
      expect(HELP_CATEGORY_META[c]?.label, c).toBeTruthy();
      expect(articles.some((a) => a.category === c), c).toBe(true);
    }
  });

  it("valores citados nos artigos batem com as regras de cobrança", () => {
    const custo = articles.find((a) => a.slug === "custo-por-apresentacao")!.content;
    expect(custo).toContain("| 10 slides, equilibrado | 120 |");
    expect(custo).toContain("| 20 slides, longo, com falas | 280 (o máximo) |");
    const planos = articles.find((a) => a.slug === "planos-e-precos")!.content;
    expect(planos).toContain("R$ 14,90");
    expect(planos).toContain("16.000 créditos por ciclo mensal");
  });
});
