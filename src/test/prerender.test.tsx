import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { render } from "@/entry-server";
import { LANDING_FAQS } from "@/components/landing/faqContent";
import { prerenderRoutes, renderPage } from "../../scripts/prerender-routes.ts";

// As páginas públicas saem do build como HTML estático (scripts/prerender.ts).
// Estes testes renderizam todas as rotas como o build faz e conferem o que
// buscadores e prévias de redes sociais leem sem executar JavaScript.
const SITE = "https://slideai.com.br";
const routes = prerenderRoutes(process.cwd());
const template = readFileSync("index.html", "utf8");
const pages = routes.map((route) => ({ route, ...render(route.path, route.payload ?? null) }));

const titleOf = (head: string) => head.match(/<title[^>]*>([^<]*)<\/title>/)?.[1] ?? "";
const metaOf = (head: string, attr: "name" | "property", key: string) =>
  [...head.matchAll(new RegExp(`<meta data-rh="true" ${attr}="${key}" content="([^"]*)"`, "g"))].map((m) => m[1]);
const canonicalOf = (head: string) => [...head.matchAll(/<link data-rh="true" rel="canonical" href="([^"]*)"/g)].map((m) => m[1]);
const jsonLdOf = (head: string) =>
  [...head.matchAll(/<script data-rh="true" type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

describe("pré-renderização das páginas públicas", () => {
  it("cobre a home, os templates, a Central de Ajuda e as páginas institucionais", () => {
    const paths = routes.map((r) => r.path);
    for (const p of ["/", "/templates", "/templates/tcc-defesa", "/sobre", "/contato", "/termos", "/privacidade", "/ajuda", "/ajuda/como-gerar-apresentacao"]) {
      expect(paths).toContain(p);
    }
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("toda página tem título, descrição, canonical, robots index e um único h1", () => {
    for (const { route, html, head } of pages) {
      const title = titleOf(head);
      const description = decode(metaOf(head, "name", "description")[0] ?? "");
      expect(title, route.path).toMatch(/SlideAI/);
      expect(description?.length ?? 0, `${route.path}: ${description}`).toBeGreaterThanOrEqual(50);
      expect(description?.length ?? 0, `${route.path}: ${description}`).toBeLessThanOrEqual(170);
      expect(canonicalOf(head), route.path).toEqual([`${SITE}${route.path === "/" ? "/" : route.path}`]);
      expect(metaOf(head, "name", "robots")[0], route.path).toMatch(/^index, follow/);
      expect(metaOf(head, "property", "og:url"), route.path).toEqual([`${SITE}${route.path === "/" ? "/" : route.path}`]);
      expect(metaOf(head, "property", "og:image")[0], route.path).toMatch(/^https:\/\/slideai\.com\.br\//);
      expect(html.match(/<h1[\s>]/g)?.length, `${route.path}: h1`).toBe(1);
      for (const bad of ["undefined", "NaN", "[object Object]"]) {
        expect(`${head}${html}`.includes(bad), `${route.path}: ${bad}`).toBe(false);
      }
    }
  });

  it("títulos e descrições são únicos (sem páginas duplicadas para o Google)", () => {
    const titles = pages.map((p) => titleOf(p.head));
    const descriptions = pages.map((p) => metaOf(p.head, "name", "description")[0]);
    expect(titles.filter((t, i) => titles.indexOf(t) !== i)).toEqual([]);
    expect(descriptions.filter((d, i) => descriptions.indexOf(d) !== i)).toEqual([]);
  });

  it("títulos das páginas principais cabem no resultado de busca (até 60 caracteres)", () => {
    for (const { route, head } of pages.filter((p) => !p.route.path.startsWith("/ajuda/"))) {
      expect(decode(titleOf(head)).length, `${route.path}: ${titleOf(head)}`).toBeLessThanOrEqual(60);
    }
  });

  it("os blocos JSON-LD são válidos e têm @context", () => {
    for (const { route, head } of pages) {
      const blocks = jsonLdOf(head);
      expect(blocks.length, route.path).toBeGreaterThan(0);
      for (const b of blocks) expect(b["@context"], route.path).toBe("https://schema.org");
    }
  });

  it("a home tem Organization, WebSite, SoftwareApplication com preço e o FAQ igual ao da página", () => {
    const home = pages.find((p) => p.route.path === "/")!;
    const blocks = jsonLdOf(home.head);
    const graph = blocks.find((b) => b["@graph"])["@graph"] as { "@type": string; offers?: { price: string; priceCurrency: string }[] }[];
    expect(graph.map((n) => n["@type"])).toEqual(["Organization", "WebSite", "SoftwareApplication"]);
    const software = graph.find((n) => n["@type"] === "SoftwareApplication")!;
    expect(software.offers?.map((o) => `${o.price} ${o.priceCurrency}`)).toEqual(["14.90 BRL", "34.90 BRL", "147.00 BRL"]);
    const faq = blocks.find((b) => b["@type"] === "FAQPage");
    expect(faq.mainEntity.map((q: { name: string; acceptedAnswer: { text: string } }) => ({ q: q.name, a: q.acceptedAnswer.text }))).toEqual(LANDING_FAQS);
    // As respostas estão no HTML (fechadas), não só no JSON-LD.
    for (const f of LANDING_FAQS) expect(decode(home.html)).toContain(f.a);
  });

  it("o artigo da Central de Ajuda sai com o texto, a trilha e os dados embutidos", () => {
    const route = routes.find((r) => r.path === "/ajuda/como-gerar-apresentacao")!;
    const page = pages.find((p) => p.route === route)!;
    expect(page.html).toContain("Como gerar uma apresentação, passo a passo");
    expect(page.html).toContain("Passo a passo");
    expect(jsonLdOf(page.head).map((b) => b["@type"])).toEqual(["Article", "BreadcrumbList"]);
    const full = renderPage(template, route, page);
    const data = JSON.parse(full.match(/<script type="application\/json" id="prerender-data">([\s\S]*?)<\/script>/)![1]);
    expect(data.route).toBe(route.path);
    expect(data.helpArticle.article.slug).toBe("como-gerar-apresentacao");
  });

  it("a Central de Ajuda lista e linka todos os artigos no HTML", () => {
    const page = pages.find((p) => p.route.path === "/ajuda")!;
    const articles = routes.filter((r) => r.path.startsWith("/ajuda/"));
    for (const a of articles) expect(page.html, a.path).toContain(`href="${a.path}"`);
  });

  it("monta o HTML final: tags da rota no lugar das do index.html e conteúdo no #root", () => {
    const route = routes.find((r) => r.path === "/sobre")!;
    const full = renderPage(template, route, pages.find((p) => p.route === route)!);
    expect(full.match(/<title/g)?.length).toBe(1);
    expect(full.match(/property="og:title"/g)?.length).toBe(1);
    expect(full.match(/name="description"/g)?.length).toBe(1);
    expect(full).toContain('<link data-rh="true" rel="canonical" href="https://slideai.com.br/sobre"/>');
    expect(full).toContain('<div id="root" data-prerendered="/sobre"><div data-prerender>');
    expect(full).toContain('<script type="module" src="/src/main.tsx"></script>');
  });

  it("o index.html da home não leva canonical (ele também é o fallback da SPA em /slides e /u)", () => {
    const route = routes.find((r) => r.path === "/")!;
    const full = renderPage(template, route, pages.find((p) => p.route === route)!);
    expect(full).not.toContain('rel="canonical"');
    expect(full).toContain('data-spa-fallback');
    expect(full).toContain('<div id="root" data-prerendered="/">');
  });
});
