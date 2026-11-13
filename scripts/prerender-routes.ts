// Rotas pré-renderizadas e montagem do HTML de cada uma (sem depender do
// Vite, para os testes usarem o mesmo código do build). O plugin que roda no
// build fica em scripts/prerender.ts.
import { execFileSync } from "node:child_process";
import { loadArticles, type HelpArticleSource } from "./help-center.ts";
import { TEMPLATES } from "../src/lib/templates.ts";

export interface PrerenderPayload {
  route: string;
  [key: string]: unknown;
}

export interface PrerenderRoute {
  path: string;
  payload?: PrerenderPayload;
}

const SEO_START = "<!--seo:start-->";
const SEO_END = "<!--seo:end-->";
const ROOT_TAG = '<div id="root"></div>';

/** Datas de alteração dos artigos pelo git (nada em clone raso: a data seria a do último commit para todos). */
function gitDates(root: string, files: string[]): Map<string, string> {
  const dates = new Map<string, string>();
  try {
    const shallow = execFileSync("git", ["rev-parse", "--is-shallow-repository"], { cwd: root, encoding: "utf8" }).trim();
    if (shallow !== "false") return dates;
    for (const file of files) {
      const iso = execFileSync("git", ["log", "-1", "--format=%cI", "--", file], { cwd: root, encoding: "utf8" }).trim();
      if (iso) dates.set(file, iso);
    }
  } catch { /* sem git no ambiente de build: segue sem datas */ }
  return dates;
}

const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title, "pt-BR");

/** Rotas públicas pré-renderizadas, com os dados que cada página usa na primeira pintura. */
export function prerenderRoutes(root: string): PrerenderRoute[] {
  const articles = loadArticles();
  const dates = gitDates(root, articles.map((a) => a.file));
  const toArticle = (a: HelpArticleSource, content = a.content) => ({
    id: a.slug,
    slug: a.slug,
    title: a.title,
    category: a.category,
    content_md: content,
    keywords: a.keywords,
    updated_at: dates.get(a.file) ?? null,
  });
  return [
    { path: "/" },
    { path: "/templates" },
    ...TEMPLATES.map((t) => ({ path: `/templates/${t.id}` })),
    { path: "/sobre" },
    { path: "/contato" },
    { path: "/termos" },
    { path: "/privacidade" },
    {
      path: "/ajuda",
      // Só o começo do texto (para os resumos dos cards); a busca usa o texto completo do banco.
      payload: { route: "/ajuda", helpCenter: { articles: [...articles].sort((a, b) => a.category.localeCompare(b.category) || byTitle(a, b)).map((a) => toArticle(a, a.content.slice(0, 400))) } },
    },
    ...articles.map((a) => {
      const route = `/ajuda/${a.slug}`;
      const related = articles.filter((r) => r.category === a.category && r.slug !== a.slug).sort(byTitle).slice(0, 5);
      return { path: route, payload: { route, helpArticle: { article: toArticle(a), related: related.map((r) => toArticle(r, r.content.slice(0, 400))) } } };
    }),
  ];
}

const jsonForScript = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

/** Monta o HTML final de uma rota a partir do index.html do build. */
export function renderPage(template: string, route: PrerenderRoute, rendered: { html: string; head: string }): string {
  const start = template.indexOf(SEO_START);
  const end = template.indexOf(SEO_END);
  if (start < 0 || end < start) throw new Error("index.html sem os marcadores <!--seo:start--> / <!--seo:end-->");
  if (!template.includes(ROOT_TAG)) throw new Error(`index.html sem ${ROOT_TAG}`);
  let head = rendered.head;
  // O index.html também é servido como fallback da SPA em rotas que não foram
  // pré-renderizadas (/slides/…, /u/…): um canonical apontando para a home
  // ali faria o Google tratá-las como cópia da home. Na home, o canonical
  // entra pelo JavaScript (o mesmo <Seo>).
  if (route.path === "/") head = head.replace(/<link data-rh="true" rel="canonical"[^>]*\/>\s*/g, "");
  if (!/<title[^>]*>[^<]+<\/title>/.test(head)) throw new Error(`${route.path}: a página não declarou <Seo>`);
  const routeJson = JSON.stringify(route.path);
  // Se o host servir este arquivo em outra URL (fallback da SPA), esconde o
  // conteúdo pré-renderizado até o React montar a rota certa.
  const guard = `<script>(function(){var p=location.pathname.replace(/\\/+$/,"").toLowerCase()||"/";if(p!==${routeJson})document.documentElement.setAttribute("data-spa-fallback","")})()</script>\n    <style>[data-spa-fallback] #root>[data-prerender]{display:none}</style>`;
  const data = route.payload ? `\n    <script type="application/json" id="prerender-data">${jsonForScript(route.payload)}</script>` : "";
  return (
    template.slice(0, start) +
    `${SEO_START}\n    ${head}\n    ${guard}\n    ${SEO_END}` +
    template.slice(end + SEO_END.length)
  ).replace(ROOT_TAG, `<div id="root" data-prerendered="${route.path}"><div data-prerender>${rendered.html}</div></div>${data}`);
}

