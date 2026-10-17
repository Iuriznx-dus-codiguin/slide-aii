// Saída HTML montada no servidor (og-preview).

/**
 * JSON seguro dentro de <script>: JSON.stringify não escapa `<`, então um
 * título com `</script><script>…` fechava o bloco e virava script na página.
 * Os escapes \u003c etc. continuam sendo o mesmo JSON para quem o lê.
 */
export const jsonForScript = (v: unknown): string =>
  JSON.stringify(v)
    .replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
