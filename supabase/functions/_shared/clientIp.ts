// IP do cliente para limites de uso e telemetria.
//
// O primeiro item de `x-forwarded-for` é o que o próprio cliente mandar:
// usá-lo como chave de rate limit deixava um script trocar de "IP" a cada
// pedido. `cf-connecting-ip` é preenchido pela Cloudflare na borda do
// Supabase e não vem do cliente — a mesma ordem de request_client_info() no
// banco. O `x-forwarded-for` fica só como último recurso.
export function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf.slice(0, 64);
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  return (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown").slice(0, 64);
}

/**
 * Chave de rate limit sem o IP em claro (a Política de Privacidade diz que o
 * IP de espectadores não é guardado). HMAC com um segredo do servidor: o hash
 * simples de um IPv4 se reverte por força bruta.
 */
export async function clientIpKey(req: Request): Promise<string> {
  const env = (globalThis as { Deno?: { env: { get(name: string): string | undefined } } }).Deno?.env;
  const secret = env?.get("RATE_LIMIT_PEPPER") || env?.get("SUPABASE_SERVICE_ROLE_KEY") || "slideai";
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(clientIp(req)));
  return Array.from(new Uint8Array(sig)).slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}
