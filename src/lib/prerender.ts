// Ponte entre o HTML pré-renderizado no build (scripts/prerender.ts) e o app
// no navegador.
//
// Cada página pública sai do build com o conteúdo já dentro de
// <div id="root" data-prerendered="/rota"><div data-prerender>…</div></div>,
// o que buscadores, prévias de redes sociais e assistentes de IA leem sem
// executar JavaScript. No navegador o React monta por cima (createRoot, sem
// hidratação). Duas peças evitam que a página "pisque" nesse meio-tempo:
//
//  • snapshot: enquanto o código da página (carregado sob demanda) chega, o
//    fallback do Suspense mostra o mesmo HTML pré-renderizado em vez do
//    spinner (App.tsx);
//  • dados: o build embute os dados da página (ex.: artigo da Central de
//    Ajuda) num <script type="application/json">, e a página começa com eles
//    em vez de um esqueleto de carregamento, buscando a versão atual em
//    seguida.
//
// Se o host servir o index.html (pré-renderizado para "/") numa rota que não
// foi pré-renderizada, a rota não bate e nada disso é usado; um script no
// <head> também esconde o conteúdo da home até o React montar a rota certa.
import { createContext, useContext } from "react";

export const PRERENDER_DATA_ID = "prerender-data";

export interface PrerenderPayload {
  route: string;
  [key: string]: unknown;
}

/** "/sobre/" e "/Sobre" contam como "/sobre". */
export const normalizePath = (path: string): string => (path.replace(/\/+$/, "") || "/").toLowerCase();

/** No build (renderToString), os dados chegam por contexto. */
export const PrerenderDataContext = createContext<PrerenderPayload | null>(null);

let clientPayload: PrerenderPayload | null | undefined;

function readClientPayload(): PrerenderPayload | null {
  if (clientPayload !== undefined) return clientPayload;
  clientPayload = null;
  try {
    const el = document.getElementById(PRERENDER_DATA_ID);
    if (el?.textContent) {
      const parsed = JSON.parse(el.textContent) as PrerenderPayload;
      if (parsed && typeof parsed.route === "string") clientPayload = parsed;
    }
  } catch { /* JSON inválido: segue sem dados embutidos */ }
  return clientPayload;
}

/** Dados embutidos para `pathname`, ou undefined se a página atual não for a pré-renderizada. */
export function usePrerenderData<T>(key: string, pathname: string): T | undefined {
  const ctx = useContext(PrerenderDataContext);
  const payload = ctx ?? (typeof document !== "undefined" ? readClientPayload() : null);
  if (!payload || normalizePath(payload.route) !== normalizePath(pathname)) return undefined;
  return payload[key] as T | undefined;
}

let snapshot: { route: string; html: string } | null = null;

/** Guarda o HTML pré-renderizado antes de o React assumir o #root (main.tsx). */
export function capturePrerenderedRoot(root: HTMLElement, pathname: string): void {
  const route = root.dataset.prerendered;
  const content = root.querySelector<HTMLElement>(":scope > [data-prerender]");
  snapshot = route && content && normalizePath(route) === normalizePath(pathname)
    ? { route, html: content.innerHTML }
    : null;
}

/** HTML pré-renderizado da rota atual (para o fallback do Suspense), se houver. */
export function prerenderSnapshotFor(pathname: string): string | null {
  return snapshot && normalizePath(snapshot.route) === normalizePath(pathname) ? snapshot.html : null;
}
