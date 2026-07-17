// Sistema central de captura de erros do SlideAI.
// Insere ocorrências em `error_occurrences` respeitando RLS.
// Estratégia de sanitização: ALLOWLIST de chaves + BLOCKLIST regex.
// Nada de senhas, tokens, e-mails brutos, payloads, prompts, corpo de request.

import { supabase } from "@/integrations/supabase/client";

export type CaptureOptions = {
  code?: string;                       // Código do catálogo (ex: "UI-001"). Ausente = não catalogada.
  route?: string;                      // Rota atual. Default: window.location.pathname.
  context?: Record<string, unknown>;   // Dados extras, serão filtrados pela allowlist.
  sessionId?: string;
  requestId?: string;
};

// Chaves aceitas sem redação (uso operacional, sem PII).
const CONTEXT_ALLOWLIST = new Set([
  "message", "action", "route", "slide_id", "presentation_id", "slug",
  "template", "step", "status", "http_status", "duration_ms",
  "component", "componentStack", "boundary", "phase",
  "kind", "reason", "attempt", "provider", "plan", "feature",
]);

// Regex de bloqueio — sempre substitui por [REDACTED], mesmo se estiver na allowlist.
const SENSITIVE_KEY = /pass|token|secret|authorization|apikey|api_key|email|cpf|cnpj|prompt|payload|body|content|cookie|jwt|refresh/i;

// Padrões em valores que precisam ser mascarados mesmo quando a chave é permitida.
const SENSITIVE_VALUE_PATTERNS: Array<[RegExp, string]> = [
  [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]"],
  [/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{5,}/g, "[jwt]"],
  [/sk-[a-zA-Z0-9]{20,}/g, "[apikey]"],
  [/Bearer\s+[a-zA-Z0-9._-]+/gi, "[bearer]"],
];

function scrubString(v: string): string {
  let out = v.length > 500 ? v.slice(0, 500) + "…" : v;
  for (const [re, rep] of SENSITIVE_VALUE_PATTERNS) out = out.replace(re, rep);
  return out;
}

function sanitize(obj: unknown, depth = 0, parentKey?: string): unknown {
  if (depth > 4 || obj == null) return obj;
  if (typeof obj === "string") return scrubString(obj);
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.slice(0, 20).map((v) => sanitize(v, depth + 1, parentKey));

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(k)) { out[k] = "[REDACTED]"; continue; }
    // Top-level: exige allowlist. Níveis internos: só filtra por regex.
    if (depth === 0 && !CONTEXT_ALLOWLIST.has(k)) continue;
    out[k] = sanitize(v, depth + 1, k);
  }
  return out;
}

function shortStack(err: unknown): string | undefined {
  if (err instanceof Error && err.stack) {
    return scrubString(err.stack.split("\n").slice(0, 6).join("\n"));
  }
  return undefined;
}

const SESSION_KEY = "slideai_session_id";
export function getSessionId(): string {
  try {
    let s = sessionStorage.getItem(SESSION_KEY);
    if (!s) {
      s = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, s);
    }
    return s;
  } catch {
    return "no-session";
  }
}

/**
 * Registra uma ocorrência de erro. Retorna o id (para exibir ao usuário).
 * Falha silenciosamente — capturar erros nunca pode quebrar o app.
 */
export async function captureError(
  err: unknown,
  opts: CaptureOptions = {},
): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const message = err instanceof Error ? err.message : String(err ?? "unknown");
    const context = sanitize({
      message,
      ...(opts.context ?? {}),
    }) as Record<string, unknown>;

    const { data, error } = await supabase
      .from("error_occurrences")
      .insert({
        user_id: user?.id ?? null,
        session_id: opts.sessionId ?? getSessionId(),
        request_id: opts.requestId ?? null,
        error_code: opts.code ?? null,
        route: opts.route ?? (typeof window !== "undefined" ? window.location.pathname : null),
        context: context as any,
        stack_summary: shortStack(err),
      })
      .select("id")
      .single();

    if (error) {
      console.warn("[errorCapture] insert failed", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.warn("[errorCapture] threw", e);
    return null;
  }
}
