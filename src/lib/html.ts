/** Escapa texto para interpolação em HTML montado como string (document.write, e-mail). */
export const escapeHtml = (v: unknown): string =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
