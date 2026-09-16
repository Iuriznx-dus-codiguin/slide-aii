/**
 * Normalizes a value into plain JSON for `structuredContent`, which the MCP
 * SDK types as a JSON tree (Supabase rows come back loosely typed).
 */
export function asJson<T>(value: T): any {
  return JSON.parse(JSON.stringify(value ?? null));
}
