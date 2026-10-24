import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ERROR_ARTICLE_LINKS,
  HELP_CATEGORIES,
  MIGRATION_FILES,
  SITEMAP_FILE,
  buildSitemap,
  buildSql,
  internalLinks,
  loadArticles,
} from "../../scripts/help-center.ts";
import { HELP_CATEGORY_META } from "../lib/helpCategories";
import {
  MAX_USAGE_MULTIPLIER, PLAN_MONTHLY_CREDITS, PLAN_PRICES, SINGLE_PURCHASE_CREDITS, cycleDiscountPct, estimatedDecks,
  monthlyEquivalent, type PaidPlan,
} from "../lib/cakto";

const fmt = (n: number) => n.toLocaleString("pt-BR");

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

  it("o sitemap lista todos os artigos (gerado pelo mesmo script)", () => {
    expect(readFileSync(SITEMAP_FILE, "utf8")).toBe(buildSitemap(articles));
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
    expect(planos).toContain(`| Geração única | ${PLAN_PRICES.single} | ${fmt(SINGLE_PURCHASE_CREDITS)} créditos permanentes`);
    expect(planos).toContain(`## PRO — ${fmt(PLAN_MONTHLY_CREDITS.mensal)} créditos por mês`);
    const rows: [string, PaidPlan, PaidPlan][] = [["Trimestral", "trimestral", "max_trimestral"], ["Anual", "anual", "max_anual"]];
    expect(planos).toContain(`| Mensal | ${PLAN_PRICES.mensal} | — | — |`);
    expect(planos).toContain(`| Mensal | ${PLAN_PRICES.max_mensal} | — | — |`);
    for (const [label, pro, max] of rows) {
      const cycle = pro as "trimestral" | "anual";
      expect(planos).toContain(`| ${label} | ${PLAN_PRICES[pro]} | R$ ${monthlyEquivalent(pro, cycle)}/mês | ${cycleDiscountPct(pro, cycle)}% |`);
      expect(planos).toContain(`| ${label} | ${PLAN_PRICES[max]} | R$ ${monthlyEquivalent(max, cycle)}/mês | ${cycleDiscountPct(max, cycle)}% |`);
    }
    expect(planos).toContain(`${fmt(PLAN_MONTHLY_CREDITS.max_mensal)} créditos por ciclo mensal (${MAX_USAGE_MULTIPLIER} vezes o PRO, cerca de ${estimatedDecks(PLAN_MONTHLY_CREDITS.max_mensal)} apresentações`);
    expect(custo).toContain(`| PRO | ${fmt(PLAN_MONTHLY_CREDITS.mensal)} por mês | ${estimatedDecks(PLAN_MONTHLY_CREDITS.mensal)} por mês |`);
    expect(custo).toContain(`| MAX (uso justo) | ${fmt(PLAN_MONTHLY_CREDITS.max_mensal)} por mês | ${estimatedDecks(PLAN_MONTHLY_CREDITS.max_mensal)} por mês |`);
  });

  it("nenhum artigo cita valores da tabela antiga nem o bônus de ativação como vigente", () => {
    const stale = /3\.200|16\.000|49,90|127,90|397,90|147,90|377,90|1\.175|dez vezes|bônus de ativação (do|de \d|vale)/;
    const hits = articles.filter((a) => stale.test(a.content)).map((a) => `${a.slug}: ${a.content.match(stale)?.[0]}`);
    expect(hits).toEqual([]);
  });
});
