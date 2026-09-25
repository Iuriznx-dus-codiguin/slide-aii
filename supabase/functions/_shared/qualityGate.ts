// Quality Gate determinístico do motor de cenas (v2).
//
// Faz o papel do "validar → refinar" da biblioteca visual SEM chamada extra de
// IA. Parte roda na resolução (servidor, antes de gravar) e parte no cliente
// (medição real do texto renderizado e contraste sobre a imagem, que só
// existem depois do layout/da imagem carregada):
//
//   servidor (aqui)                    cliente
//   ───────────────                    ───────
//   capacidade de texto por caixa      ajuste fino de fonte se ainda estourar
//   contraste AA do tema (texto × bg)  scrim AA sobre imagem (imageAnalysis)
//   equilíbrio texto × visual          ativo que falhou → fallback nativo
//   ritmo do deck (≤30% só texto,
//   ≤2 seguidos)
//
// Nada aqui apaga informação: texto que não cabe vai para as notas do orador.

import { capacityFor, trimChars, trimToWords, wordCount, type TextDepth } from "./textMetrics.ts";

// ────────────────────────────────────────────────────────────────
// Contraste (WCAG)
// ────────────────────────────────────────────────────────────────

export function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}

export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export const AA_TEXT = 4.5;

/**
 * Garante contraste AA entre texto e fundo do tema dinâmico. Quando a IA
 * devolve um par ilegível, troca SÓ a cor do texto pela opção (quase preto ou
 * quase branco) de maior contraste — a paleta de acento escolhida continua.
 */
export function ensureReadableTheme<T extends { bg?: string; text?: string }>(theme: T | null | undefined): { theme: T | null | undefined; fixed: boolean } {
  if (!theme?.bg || !theme.text) return { theme, fixed: false };
  const ratio = contrastRatio(theme.text, theme.bg);
  if (ratio === null || ratio >= AA_TEXT) return { theme, fixed: false };
  const dark = "#0B0B12";
  const light = "#F8FAFC";
  const best = (contrastRatio(dark, theme.bg) ?? 0) >= (contrastRatio(light, theme.bg) ?? 0) ? dark : light;
  return { theme: { ...theme, text: best }, fixed: true };
}

// ────────────────────────────────────────────────────────────────
// Capacidade de texto por caixa
// ────────────────────────────────────────────────────────────────

export interface FitInput {
  headline?: string;
  subtitle?: string;
  body_text?: string;
  bullets?: string[];
  speaker_notes?: string;
  items?: { label: string; detail?: string }[];
}

export interface FitResult<T extends FitInput> {
  value: T;
  /** Quantos cortes foram feitos (métrica do painel). */
  trims: number;
}

/**
 * Faz o texto caber na capacidade do layout. O que sobra do corpo, dos
 * bullets e dos detalhes dos itens vai para as notas do orador — o
 * apresentador não perde a informação, o slide não estoura.
 */
export function fitTextToLayout<T extends FitInput>(
  input: T,
  layout: string | undefined,
  hasVisual: boolean,
  depth: TextDepth = "balanced",
): FitResult<T> {
  const cap = capacityFor(layout, hasVisual, input.items?.length ?? 0, depth);
  const out: T = { ...input };
  // Prosa (subtítulo/corpo) e pontos (bullets e detalhes de itens) separados:
  // os pontos são curtos e sempre preservados; o teto vale só para a prosa.
  const overflow: string[] = [];
  const points: string[] = [];
  let trims = 0;

  if (out.headline && out.headline.length > cap.headlineChars) {
    out.headline = trimChars(out.headline, cap.headlineChars);
    trims++;
  }
  if (out.subtitle && wordCount(out.subtitle) > cap.subtitleWords) {
    const t = trimToWords(out.subtitle, cap.subtitleWords);
    out.subtitle = t.kept;
    if (t.overflow) overflow.push(t.overflow);
    trims++;
  }
  if (out.body_text && wordCount(out.body_text) > cap.bodyWords) {
    const t = trimToWords(out.body_text, cap.bodyWords);
    out.body_text = t.kept || undefined;
    if (t.overflow) overflow.push(t.overflow);
    trims++;
  }
  if (Array.isArray(out.bullets) && out.bullets.length) {
    const kept = out.bullets.slice(0, cap.bullets).map((b) => {
      if (wordCount(b) <= cap.bulletWords) return b;
      trims++;
      const t = trimToWords(b, cap.bulletWords);
      if (t.overflow) points.push(`${t.kept.replace(/…$/, "")} ${t.overflow}`);
      return t.kept;
    });
    const dropped = out.bullets.slice(cap.bullets);
    if (dropped.length) {
      points.push(...dropped);
      trims++;
    }
    out.bullets = kept.length ? kept : undefined;
  }
  if (Array.isArray(out.items) && out.items.length && cap.itemDetailWords > 0) {
    out.items = out.items.map((it) => {
      let next = it;
      if (it.label && it.label.length > cap.itemLabelChars) {
        next = { ...next, label: trimChars(it.label, cap.itemLabelChars) };
        trims++;
      }
      if (it.detail && wordCount(it.detail) > cap.itemDetailWords) {
        const t = trimToWords(it.detail, cap.itemDetailWords);
        next = { ...next, detail: t.kept };
        if (t.overflow) points.push(`${it.label}: ${it.detail}`);
        trims++;
      }
      return next;
    });
  }
  if (overflow.length || points.length) {
    const parts: string[] = [];
    if (overflow.length) parts.push(`Detalhes adicionais: ${trimChars(overflow.join(" "), 1500)}`);
    if (points.length) parts.push(points.map((p) => `• ${p}`).join("\n"));
    const extra = parts.join("\n");
    out.speaker_notes = out.speaker_notes ? `${out.speaker_notes}\n\n${extra}` : extra;
  }
  return { value: out, trims };
}

// ────────────────────────────────────────────────────────────────
// Ritmo do deck
// ────────────────────────────────────────────────────────────────

/** Teto de slides só de texto (fração dos slides de conteúdo). */
export const TEXT_ONLY_SHARE_CAP = 0.3;
/** Máximo de slides só de texto em sequência. */
export const TEXT_ONLY_MAX_RUN = 2;

export interface RhythmReport {
  textOnly: number[];
  share: number;
  maxRun: number;
  /** Índices a resgatar (converter em slide com visual) para cumprir as regras. */
  violations: number[];
}

/**
 * Avalia o ritmo. `isTextOnly[i]` diz se o slide i é só texto (a capa não
 * entra na conta). Devolve, em ordem de prioridade, os slides que precisam
 * ganhar visual: primeiro os que quebram a sequência máxima, depois os que
 * excedem o teto de 30%.
 */
export function assessRhythm(isTextOnly: boolean[]): RhythmReport {
  const contentIdx = isTextOnly.map((_, i) => i).filter((i) => i > 0);
  const textOnly = contentIdx.filter((i) => isTextOnly[i]);
  const cap = Math.floor(contentIdx.length * TEXT_ONLY_SHARE_CAP);
  const flags = [...isTextOnly];
  flags[0] = false;
  const violations: number[] = [];

  // 1) Sequências: dentro de cada corrida > 2, resgata o 3º, o 6º…
  let run = 0;
  for (let i = 1; i < flags.length; i++) {
    run = flags[i] ? run + 1 : 0;
    if (run > TEXT_ONLY_MAX_RUN) {
      violations.push(i);
      flags[i] = false;
      run = 0;
    }
  }
  // 2) Teto: resgata do fim para o começo (o fechamento costuma ser o mais
  // tipográfico por escolha — preserva-se o que vem antes do clímax).
  let remaining = flags.filter((f, i) => i > 0 && f).length;
  for (let i = flags.length - 2; i >= 1 && remaining > cap; i--) {
    if (flags[i]) {
      violations.push(i);
      flags[i] = false;
      remaining--;
    }
  }
  if (remaining > cap && flags[flags.length - 1] && flags.length > 1) {
    violations.push(flags.length - 1);
    remaining--;
  }

  let maxRun = 0;
  run = 0;
  for (let i = 1; i < isTextOnly.length; i++) {
    run = isTextOnly[i] ? run + 1 : 0;
    maxRun = Math.max(maxRun, run);
  }
  return {
    textOnly,
    share: contentIdx.length ? textOnly.length / contentIdx.length : 0,
    maxRun,
    violations: Array.from(new Set(violations)),
  };
}

// ────────────────────────────────────────────────────────────────
// Contraste sobre imagem (parte cliente do gate usa a luminância medida)
// ────────────────────────────────────────────────────────────────

/**
 * Menor opacidade do scrim (cor `scrimHex`) sobre uma imagem de luminância
 * média `imageLuminance` (0..1, medida em src/lib/imageAnalysis.ts) que deixa
 * o texto `textHex` com contraste AA. Aproximação linear na luminância
 * relativa — conservadora para fotos com áreas uniformes.
 */
export function scrimAlphaForAA(textHex: string, scrimHex: string, imageLuminance: number, min = 0.35): number {
  const lt = relativeLuminance(textHex);
  const ls = relativeLuminance(scrimHex);
  if (lt === null || ls === null || !Number.isFinite(imageLuminance)) return 0.72;
  const li = Math.max(0, Math.min(1, imageLuminance));
  for (let alpha = min; alpha <= 0.951; alpha += 0.05) {
    const lb = alpha * ls + (1 - alpha) * li;
    const [hi, lo] = lt > lb ? [lt, lb] : [lb, lt];
    if ((hi + 0.05) / (lo + 0.05) >= AA_TEXT) return +alpha.toFixed(2);
  }
  return 0.92;
}
