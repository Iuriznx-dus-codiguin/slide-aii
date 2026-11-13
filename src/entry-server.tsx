// Entrada de renderização no servidor, usada só no build (scripts/prerender.ts)
// e nos testes: transforma cada página pública em HTML estático, com as tags
// de <head> que o componente <Seo> declara. Não entra no bundle do navegador.
//
// Apenas páginas públicas e indexáveis ficam aqui. Elas são renderizadas com o
// mínimo de provedores (sem autenticação nem Supabase em uso): o que depende
// do usuário aparece quando o app monta no navegador.
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { Route, Routes } from "react-router-dom";
import { HelmetProvider, type HelmetServerState } from "react-helmet-async";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PrerenderDataContext, type PrerenderPayload } from "@/lib/prerender";
import Index from "./pages/Index";
import Templates from "./pages/Templates";
import TemplateGuide from "./pages/TemplateGuide";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import HelpCenter from "./pages/HelpCenter";
import HelpArticle from "./pages/HelpArticle";

export interface PrerenderResult {
  /** Conteúdo do #root. */
  html: string;
  /** Tags do <head> geradas pelo <Seo> (title, meta, link, JSON-LD). */
  head: string;
}

export function render(url: string, payload: PrerenderPayload | null = null): PrerenderResult {
  // Modo servidor do Helmet (preenche o contexto em vez de mexer no document),
  // inclusive nos testes, que rodam com um DOM simulado (jsdom).
  HelmetProvider.canUseDOM = false;
  const helmetContext: { helmet?: HelmetServerState | null } = {};
  const html = renderToString(
    <HelmetProvider context={helmetContext}>
      <PrerenderDataContext.Provider value={payload}>
        <TooltipProvider>
          <StaticRouter location={url}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/templates/:id" element={<TemplateGuide />} />
              <Route path="/sobre" element={<About />} />
              <Route path="/contato" element={<Contact />} />
              <Route path="/termos" element={<Terms />} />
              <Route path="/privacidade" element={<Privacy />} />
              <Route path="/ajuda" element={<HelpCenter />} />
              <Route path="/ajuda/:slug" element={<HelpArticle />} />
            </Routes>
          </StaticRouter>
        </TooltipProvider>
      </PrerenderDataContext.Provider>
    </HelmetProvider>,
  );
  const h = helmetContext.helmet;
  const head = h ? [h.title, h.meta, h.link, h.script].map((d) => d.toString()).filter(Boolean).join("\n    ") : "";
  return { html, head };
}
