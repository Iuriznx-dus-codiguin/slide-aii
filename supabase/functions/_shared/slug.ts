// Slug público de uma apresentação. Vivia só no cliente (src/lib/slugify.ts),
// que era quem gravava o deck; com a persistência no servidor a mesma regra
// roda nos dois lados.
export function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "apresentacao";
  const rand = Math.random().toString(36).slice(2, 8);
  return `${base}-${rand}`;
}
