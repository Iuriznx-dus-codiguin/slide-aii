import { useEffect, useState } from "react";

/**
 * Detecta a preferência de sistema "prefers-reduced-motion" e reage a
 * mudanças em tempo real (o usuário pode alternar isso nas configurações do
 * SO sem recarregar a página). Usado por qualquer lugar que produza
 * animação de movimento — antes desta correção, nenhum dos sistemas de
 * coreografia/transição de slide verificava essa preferência.
 *
 * SSR-safe: retorna `false` até o primeiro efeito rodar no client.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mql.matches);

    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return reduced;
}
