// Fontes dos temas de slide (src/lib/slugify.ts → FONT_STYLES).
//
// Antes, as 17 famílias vinham por @import no index.css e eram pedidas em
// toda página, inclusive na home, onde só Plus Jakarta Sans e Inter aparecem
// — uma requisição encadeada que atrasava a primeira pintura (Core Web
// Vitals). Agora as fontes da interface ficam no index.html e estas carregam
// quando o renderizador de slides é importado (painel, editor, visualizador
// e exportações), antes de qualquer slide aparecer.
const SLIDE_FONTS_ID = "slideai-slide-fonts";

export const SLIDE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,600;9..144,800;9..144,900&family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Space+Grotesk:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700;900&family=Cormorant+Garamond:wght@400;500;700&family=Syne:wght@500;700;800&family=Archivo+Black&family=DM+Serif+Display&family=Instrument+Serif&family=Sora:wght@400;600;700;800&family=Manrope:wght@400;500;600;700;800&family=Unbounded:wght@400;600;700;800&family=Space+Mono:wght@400;700&family=Outfit:wght@400;600;700;800&display=swap";

/** Inclui a folha de fontes dos slides uma única vez (sem efeito fora do navegador). */
export function ensureSlideFonts(): void {
  if (typeof document === "undefined" || document.getElementById(SLIDE_FONTS_ID)) return;
  const link = document.createElement("link");
  link.id = SLIDE_FONTS_ID;
  link.rel = "stylesheet";
  link.href = SLIDE_FONTS_URL;
  document.head.appendChild(link);
}
