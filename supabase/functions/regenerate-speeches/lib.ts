// Lógica pura da regeneração de falas (testável fora do Deno.serve).

/**
 * Casa a resposta da IA com os slides pedidos. O contrato é a numeração do
 * prompt ("SLIDE N", a partir de 1). Só quando a resposta claramente veio a
 * partir de 0 (traz 0 e não traz N) a base é ajustada. Antes havia um
 * fallback `get(pos + 1) ?? get(pos)` que copiava a fala do slide anterior
 * quando a IA omitia um slide.
 */
export function speechesByPosition(
  returned: Array<{ position?: unknown; presenters?: unknown }>,
  total: number,
): Map<number, unknown[]> {
  const byNumber = new Map<number, unknown[]>();
  for (const s of returned ?? []) {
    const n = Number(s?.position);
    if (Number.isInteger(n) && Array.isArray(s?.presenters)) byNumber.set(n, s.presenters as unknown[]);
  }
  const zeroBased = byNumber.has(0) && !byNumber.has(total);
  const out = new Map<number, unknown[]>();
  for (const [n, presenters] of byNumber) {
    const position0 = zeroBased ? n : n - 1;
    if (position0 >= 0 && position0 < total) out.set(position0, presenters);
  }
  return out;
}
