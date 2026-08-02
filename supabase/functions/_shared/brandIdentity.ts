// Brand Identity Extraction (Fase 6 da nova arquitetura de motores).
//
// Escopo honesto: extrai cor primária/de acento, fontes (Google Fonts) e
// logo a partir do HTML ESTÁTICO de uma URL fornecida pelo usuário — via
// regex em padrões bem conhecidos (meta theme-color, hex colors em
// style="" e <style>, links de Google Fonts, og:image/favicon), NÃO via
// renderização real da página. Isso é uma decisão deliberada: adicionar um
// parser de DOM completo (ex.: deno_dom) ou um headless browser só se
// justificaria se os sinais estáticos fossem insuficientes na prática — "não
// adicionar bibliotecas apenas por adicionar" (instrução original). Os
// padrões visados aqui (meta tags, atributos href/content, hex literais) são
// suficientemente localizados para regex sem precisar de árvore DOM.
//
// LIMITAÇÃO CONHECIDA E ASSUMIDA: cor de FUNDO e de TEXTO do site não são
// extraídas — isso exigiria resolver a cascata CSS real (herança, media
// queries, CSS-in-JS renderizado em runtime), que parsing estático não
// resolve com confiança suficiente para não devolver uma cor errada. Só
// primary/accent (via theme-color ou hex mais frequentes, filtrando tons
// quase-cinza) são extraídos. bordas/raios/sombras (pedidos na visão
// original) também NÃO são tentados aqui pelo mesmo motivo — ver o "prompt
// corrido" para Lovable sobre um possível v2 com renderização real.
//
// Resultado mapeado para o MESMO formato de dynamic_theme (Partial<ThemeColors>)
// já usado em toda a pipeline de renderização (src/lib/slugify.ts,
// resolveTheme) — zero caminho de renderização novo, só uma fonte nova para
// um mecanismo que já existe.

export interface BrandIdentity {
  source_url: string;
  primary_color: string | null;
  accent_color: string | null;
  font_families: string[];
  logo_url: string | null;
  /** "high" quando <meta name="theme-color"> existe (o próprio site declara a cor); "medium"/"low" quando inferido por frequência de hex. */
  confidence: "high" | "medium" | "low";
}

function isNearGrayscaleOrExtreme(hex: string): boolean {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (full.length !== 6 || /[^0-9a-fA-F]/.test(full)) return true;
  const r = parseInt(full.slice(0, 2), 16), g = parseInt(full.slice(2, 4), 16), b = parseInt(full.slice(4, 6), 16);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return (max - min) < 24 || max > 245 || max < 12; // baixa saturação OU quase branco/preto
}

function resolveUrl(maybeRelative: string, base: string): string | null {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}

/**
 * Extrai identidade de marca de uma URL. Retorna null se a URL não for
 * fornecida, for inválida, ou se a extração falhar por qualquer motivo —
 * nunca lança exceção e nunca deve bloquear a geração da apresentação.
 */
export async function extractBrandIdentity(url: string | undefined): Promise<BrandIdentity | null> {
  if (!url) return null;
  try {
    new URL(url);
  } catch {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let res: Response;
    try {
      res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SlideAI-BrandBot/1.0; +https://slideai.app)" },
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) return null;
    const raw = await res.text();
    const html = raw.slice(0, 400_000); // teto razoável — evita páginas gigantes

    // 1) theme-color — sinal MAIS confiável quando presente (o site declara a própria cor de marca)
    const themeColor = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? null;

    // 2) hex colors em style="" e <style> — filtra quase-cinza/extremos, conta frequência
    const hexMatches = [...html.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)].map((m) => `#${m[1]}`);
    const freq = new Map<string, number>();
    for (const hex of hexMatches) {
      const norm = hex.toLowerCase();
      if (isNearGrayscaleOrExtreme(norm)) continue;
      freq.set(norm, (freq.get(norm) ?? 0) + 1);
    }
    const sortedByFreq = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);

    const primary = themeColor ?? sortedByFreq[0] ?? null;
    const accent = sortedByFreq.find((h) => h !== primary?.toLowerCase()) ?? null;

    // 3) fontes via <link> do Google Fonts
    const fontMatches = [...html.matchAll(/fonts\.googleapis\.com\/css2?\?family=([^"'&]+)/gi)];
    const fontFamilies = [...new Set(
      fontMatches.map((m) => decodeURIComponent(m[1]).split(":")[0].replace(/\+/g, " ")),
    )].slice(0, 3);

    // 4) logo: og:image primeiro (geralmente maior/mais confiável), senão favicon/apple-touch-icon
    const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
    const icon = html.match(/<link[^>]+rel=["'](?:icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["']/i)?.[1];
    const logoRaw = ogImage ?? icon ?? null;
    const logoUrl = logoRaw ? resolveUrl(logoRaw, url) : null;

    if (!primary && fontFamilies.length === 0 && !logoUrl) return null; // nada de útil extraído

    const confidence: BrandIdentity["confidence"] = themeColor ? "high" : sortedByFreq.length >= 3 ? "medium" : "low";

    return { source_url: url, primary_color: primary, accent_color: accent, font_families: fontFamilies, logo_url: logoUrl, confidence };
  } catch (e) {
    console.warn("brandIdentity: extração falhou (não bloqueia a geração) —", (e as Error).message);
    return null;
  }
}

/**
 * Mapeia BrandIdentity para o formato já usado por dynamic_theme em toda a
 * pipeline (Partial<ThemeColors> — ver src/lib/slugify.ts). Só sobrescreve
 * accent/accent2 quando a extração teve confiança >= "medium" — em "low"
 * (poucos sinais, cores inferidas por frequência crua) preferimos deixar o
 * Creative Director/IA decidir a paleta a arriscar uma cor errada extraída
 * de ruído do HTML.
 */
export function brandIdentityToThemeOverride(brand: BrandIdentity | null): { accent?: string; accent2?: string } | null {
  if (!brand || brand.confidence === "low" || !brand.primary_color) return null;
  return {
    accent: brand.primary_color,
    ...(brand.accent_color ? { accent2: brand.accent_color } : {}),
  };
}
