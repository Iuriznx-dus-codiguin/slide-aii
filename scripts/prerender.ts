// Pré-renderização das páginas públicas no build (plugin do Vite).
//
// Por quê: o SlideAI é uma SPA. Sem isto, toda URL devolve o mesmo index.html
// com <div id="root"></div> vazio e o título "SlideAI": o Google só vê o
// conteúdo depois de renderizar o JavaScript (numa segunda fila, com atraso),
// e buscadores de IA (ChatGPT, Perplexity, Claude) e prévias de redes sociais
// não veem nada.
//
// Como: depois do build do navegador, este plugin compila src/entry-server.tsx
// para Node, renderiza cada rota pública com React (renderToString) e grava um
// HTML por rota em dist/ — index.html para "/" e <rota>.html para as demais
// (dist/sobre.html, dist/ajuda/<slug>.html…), o formato que hosts estáticos
// servem em URLs sem extensão. Cada arquivo leva o <head> próprio da página
// (title, description, canonical, Open Graph, JSON-LD) e o conteúdo no #root;
// no navegador o React monta por cima (src/lib/prerender.ts).
//
// Falha segura: se a pré-renderização der erro, o build continua com a SPA de
// sempre e um aviso no log (SLIDEAI_PRERENDER_STRICT=1 faz o build falhar).
// src/test/prerender.test.tsx renderiza todas as rotas nos testes.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build, type Plugin, type ResolvedConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { prerenderRoutes, renderPage, type PrerenderPayload } from "./prerender-routes.ts";

const outputFile = (outDir: string, path: string) => (path === "/" ? join(outDir, "index.html") : join(outDir, `${path.slice(1)}.html`));

async function prerender(config: ResolvedConfig): Promise<number> {
  const root = config.root;
  const outDir = resolve(root, config.build.outDir);
  const template = readFileSync(join(outDir, "index.html"), "utf8");
  const ssrOutDir = join(root, "node_modules/.cache/slideai-prerender");

  // Build separado (configFile: false) para não repetir os plugins do app,
  // incluindo este, e com tudo empacotado para rodar direto no Node.
  await build({
    configFile: false,
    root,
    mode: config.mode,
    logLevel: "warn",
    plugins: [react()],
    resolve: { alias: { "@": join(root, "src") } },
    css: { postcss: { plugins: [] } },
    ssr: { noExternal: true },
    build: {
      ssr: join(root, "src/entry-server.tsx"),
      outDir: ssrOutDir,
      emptyOutDir: true,
      copyPublicDir: false,
      minify: false,
      rollupOptions: { output: { format: "es", entryFileNames: "entry-server.mjs" } },
    },
  });

  const mod = (await import(`${pathToFileURL(join(ssrOutDir, "entry-server.mjs")).href}?t=${Date.now()}`)) as {
    render: (url: string, payload?: PrerenderPayload | null) => { html: string; head: string };
  };

  const routes = prerenderRoutes(root);
  for (const route of routes) {
    const page = renderPage(template, route, mod.render(route.path, route.payload ?? null));
    const file = outputFile(outDir, route.path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, page);
  }
  return routes.length;
}

export function prerenderPlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "slideai-prerender",
    apply: "build",
    enforce: "post",
    configResolved(resolved) {
      config = resolved;
    },
    async closeBundle() {
      if (config.build.ssr || process.env.SLIDEAI_SKIP_PRERENDER) return;
      const started = Date.now();
      try {
        const count = await prerender(config);
        config.logger.info(`\n✓ pré-renderizadas ${count} páginas públicas em ${((Date.now() - started) / 1000).toFixed(1)}s`);
      } catch (err) {
        if (process.env.SLIDEAI_PRERENDER_STRICT) throw err;
        config.logger.warn(`\n⚠ pré-renderização falhou; o site segue como SPA sem HTML estático por página.\n${(err as Error)?.stack ?? err}`);
      }
    },
  };
}
