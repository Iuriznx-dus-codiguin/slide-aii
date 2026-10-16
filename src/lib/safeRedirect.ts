// Destino pós-login vindo da URL (?next=): só caminhos do próprio site.
//
// A checagem antiga (/^\/(?!\/)/) aceitava "/\evil.com" e "/<TAB>/evil.com":
// o navegador resolve os dois para https://evil.com/, o pushState recusa a
// outra origem e o react-router cai em window.location.assign — o usuário
// saía do site logo depois de digitar a senha. Agora o caminho é resolvido
// como URL e precisa continuar na mesma origem.
export function safeNextPath(raw: string | null | undefined, origin: string = window.location.origin): string | null {
  if (!raw || raw.length > 2048 || !raw.startsWith("/")) return null;
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    if (ch === "\\" || code < 0x20 || code === 0x7f) return null;
  }
  let url: URL;
  try {
    url = new URL(raw, origin);
  } catch {
    return null;
  }
  if (url.origin !== new URL(origin).origin) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
