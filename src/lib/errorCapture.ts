// Sistema central de captura de erros do SlideAI.
// Insere ocorrências em `error_occurrences` respeitando RLS.
// NUNCA registra dados sensíveis (senhas, tokens, emails brutos, payloads).

import { supabase } from "@/integrations/supabase/client";

export type CaptureOptions = {
  code?: string;                  // Código do catálogo (ex: "UI-001"). Ausente = ocorrência não catalogada.
  route?: string;                 // Rota atual. Default: window.location.pathname.
  context?: Record<string, unknown>;
  sessionId?: string;
};

const SENSITIVE_KEYS = /pass|token|secret|authorization|apikey|api_key|email|cpf|cnpj/i;

function sanitize(obj: unknown, depth = 0): unknown {
  if (depth > 4 || obj == null) return obj;
  if (typeof obj === "string") return obj.length > 500 ? obj.slice(0, 500) + "…" : obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.slice(0, 20).map((v) => sanitize(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.test(k)) { out[k] = "[REDACTED]"; continue; }
    out[k] = sanitize(v, depth + 1);
  }
  return out;
}

function shortStack(err: unknown): string | undefined {
  if (err instanceof Error && err.stack) {
    return err.stack.split("\n").slice(0, 6).join("\n");
  }
  return undefined;
}

function getSessionId(): string {
  const KEY = "slideai_session_id";
  let s = sessionStorage.getItem(KEY);
  if (!s) {
    s = crypto.randomUUID();
    sessionStorage.setItem(KEY, s);
  }
  return s;
}

/**
 * Registra uma ocorrência de erro. Retorna o id da ocorrência (para exibir ao usuário).
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
    });

    const { data, error } = await supabase
      .from("error_occurrences")
      .insert({
        user_id: user?.id ?? null,
        session_id: opts.sessionId ?? getSessionId(),
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
