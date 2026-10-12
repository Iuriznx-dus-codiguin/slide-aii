// Normalização da entrada de generate-presentation.
//
// Tudo o que o cliente manda acaba em prompt de IA (custo por token) ou no
// banco. Título e descrição já eram limpos; `type` e `language` iam crus para
// o prompt, FORA do bloco marcado como dado do usuário, e sem limite de
// tamanho: um corpo com um `type` de megabytes multiplicava o custo de cada
// uma das chamadas de texto da geração, que é cobrada por um preço fixo.
//
// Módulo puro (sem Deno.serve) para ser testado no Vitest.
import { THEMES } from "../_shared/themes.ts";

/** Teto do corpo da requisição. O maior pedido legítimo tem poucos KB. */
export const MAX_BODY_BYTES = 64 * 1024;

export const TEXT_DEPTHS = ["short", "balanced", "long"] as const;
export type TextDepth = (typeof TEXT_DEPTHS)[number];
export const PERSONAS = ["technical-authority", "inspirational-leader", "salesperson", "educator"] as const;
export const LANGUAGES = ["pt-BR", "en", "es"] as const;

/** Texto de uma linha: sem caracteres de controle, espaços colapsados, com teto. */
export const cleanText = (v: unknown, max: number): string =>
  // eslint-disable-next-line no-control-regex -- remover caracteres de controle é o objetivo
  String(v ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);

const oneOf = <T extends string>(list: readonly T[], v: unknown): T | undefined =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : undefined;

/**
 * Devolve uma cópia do corpo com os campos que viram prompt já normalizados.
 * Campos ausentes continuam ausentes (os padrões do motor seguem valendo).
 */
export function normalizeGenerateInput(raw: unknown): Record<string, unknown> {
  const body: Record<string, unknown> = raw && typeof raw === "object" && !Array.isArray(raw) ? { ...(raw as object) } : {};
  body.title = cleanText(body.title, 200);
  body.description = cleanText(body.description, 1500);
  // Tipo é texto livre (templates antigos gravam rótulos próprios); só limpa.
  body.type = cleanText(body.type, 80);
  body.language = oneOf(LANGUAGES, body.language) ?? "pt-BR";
  body.theme = typeof body.theme === "string" && Object.prototype.hasOwnProperty.call(THEMES, body.theme)
    ? body.theme
    : "profissional-azul";
  body.fontStyle = cleanText(body.fontStyle, 60);
  body.persona = oneOf(PERSONAS, body.persona);
  body.textDepth = oneOf(TEXT_DEPTHS, body.textDepth);
  const slides = Math.round(Number(body.slidesCount));
  body.slidesCount = Number.isFinite(slides) ? slides : undefined;
  return body;
}
