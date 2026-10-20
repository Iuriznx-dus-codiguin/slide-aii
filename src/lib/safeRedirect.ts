/**
 * Destino pós-login: só caminhos do próprio site. A checagem anterior
 * (começa com "/" e não com "//") aceitava "/\\evil.com", que o navegador
 * trata como "//evil.com" — outro domínio.
 */
export const safeNextPath = (raw: string | null): string | null => {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  try {
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin ? url.pathname + url.search + url.hash : null;
  } catch {
    return null;
  }
};
