// Pares tipográficos e escolha automática de fonte — fonte única para o
// schema de conteúdo (Deno), a persistência no servidor (Deno) e o front
// (src/lib/slugify.ts, que guarda só as famílias CSS de cada id).
//
// Antes, os 15 ids estavam escritos no enum de create_presentation e, de novo,
// como chaves de FONTS no front; e a escolha automática (autoFontForContext)
// só existia no cliente — que era quem gravava a apresentação. Com a
// persistência indo para o servidor, a mesma regra precisa rodar lá.

export const FONT_PAIRING_IDS = [
  "modern-sans", "classic-serif", "bold-display", "minimal-clean", "editorial",
  "kinetic-brutal", "neo-futurist", "syne-editorial", "instrument-luxe",
  "mono-technical", "dm-editorial", "unbounded-pop", "space-editorial",
  "fraunces-warm", "archivo-poster",
] as const;
export type FontPairingId = (typeof FONT_PAIRING_IDS)[number];

export const isFontPairing = (v: unknown): v is FontPairingId =>
  typeof v === "string" && (FONT_PAIRING_IDS as readonly string[]).includes(v);

/**
 * Escolha automática de fonte com base no tipo + título. Usada quando a IA
 * não devolve `font_pairing` válido (o formulário não expõe fonte: a
 * plataforma decide pelo assunto).
 */
export function autoFontForContext(type: string, _theme: string, title: string): FontPairingId {
  const t = (type || "").toLowerCase();
  const s = `${title || ""} ${type || ""}`.toLowerCase();
  // Sinais temáticos no título têm prioridade — é o que mais diferencia.
  if (/hist[óo]ria|cultura|literatura|arte|filosof/.test(s)) return "fraunces-warm";
  if (/esporte|futebol|treino|performance|atlet/.test(s)) return "archivo-poster";
  if (/startup|produto|saas|app|software|dados|ia\b|intelig/.test(s)) return "space-editorial";
  if (/marca|marketing|vendas|social|campanha|tend[êe]ncia/.test(s)) return "unbounded-pop";
  if (/ci[êe]ncia|qu[íi]mica|f[íi]sica|matem[áa]tica|estat[íi]stic/.test(s)) return "mono-technical";
  if (/luxo|moda|design|arquitetura/.test(s)) return "instrument-luxe";
  // Palette por tipo
  if (t.includes("acad") || t.includes("escolar") || t.includes("cient")) return "dm-editorial";
  if (t.includes("pitch")) return "neo-futurist";
  if (t.includes("marketing") || t.includes("criativo")) return "kinetic-brutal";
  if (t.includes("corp")) return "modern-sans";
  // Fallback determinístico pelo hash do título para variedade
  const pool: FontPairingId[] = ["neo-futurist", "syne-editorial", "kinetic-brutal", "instrument-luxe", "bold-display", "unbounded-pop", "space-editorial"];
  const h = (title || "x").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return pool[h % pool.length];
}

/** Valida o par sugerido pela IA, com fallback contextual. */
export function resolveFontPairingId(aiPairing: unknown, fallback: string): FontPairingId {
  if (isFontPairing(aiPairing)) return aiPairing;
  return isFontPairing(fallback) ? fallback : "modern-sans";
}
