// Texto curto vindo do banco ou do corpo da requisição dentro de um prompt.

/**
 * Campo curto (título, tipo, idioma, nome, campos do brief) dentro do prompt.
 * O dono do deck escreve esses campos: sem teto, um título de megabytes virava
 * ~1M de tokens por chamada. Quebras de linha viram espaço.
 */
export function promptField(value: unknown, max: number): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}
