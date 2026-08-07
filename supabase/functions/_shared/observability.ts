// Observabilidade compartilhada das edge functions.
//
// Dois objetivos:
//  1. LOG ESTRUTURADO — toda linha impressa é um JSON de uma linha só, com
//     `request_id`, função, evento e duração. Isso permite correlacionar a
//     mesma requisição entre generate-presentation → fetch-image → banco
//     buscando um único id, em vez de ler texto solto.
//  2. TRILHA DE ABUSO — eventos de segurança (rate limit, 401/403, webhook
//     inválido, upload rejeitado) também são gravados em `security_events`,
//     visível só para admin/developer no painel Dev. Nunca lança: telemetria
//     jamais pode derrubar a requisição que está sendo observada.
//
// Regra de privacidade: nada de e-mail, token, corpo de requisição ou prompt.
// Só metadados operacionais e, quando útil, um hash curto (fingerprint).

export type Severity = "info" | "warning" | "critical";

export type SecurityEventType =
  | "rate_limited"
  | "daily_limit"
  | "unauthorized"
  | "forbidden"
  | "webhook_invalid_secret"
  | "webhook_error"
  | "upload_rejected"
  | "invalid_input";

/** Hash curto e estável — permite comparar dois valores sem revelar nenhum. */
export async function fingerprint(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(buf)).slice(0, 6)
      .map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

/** Hash de IP para rate limit/telemetria sem armazenar o endereço. */
export async function hashIp(req: Request): Promise<string | null> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("cf-connecting-ip");
  return fingerprint(ip);
}

export interface LoggerCtx {
  fn: string;
  requestId: string;
  admin?: any;
  userId?: string | null;
  ipHash?: string | null;
}

export function createLogger(fn: string, req: Request, admin?: any) {
  // Reaproveita o id do cliente quando ele manda um (o front pode propagar),
  // senão gera um. O mesmo id volta no header `x-request-id` da resposta.
  const requestId = req.headers.get("x-request-id")?.slice(0, 64) || crypto.randomUUID();
  const startedAt = Date.now();
  const ctx: LoggerCtx = { fn, requestId, admin, userId: null, ipHash: null };

  const emit = (level: string, event: string, data?: Record<string, unknown>) => {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      fn,
      request_id: requestId,
      event,
      user_id: ctx.userId ?? undefined,
      elapsed_ms: Date.now() - startedAt,
      ...(data ?? {}),
    });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  };

  return {
    requestId,
    /** Headers que devem acompanhar TODA resposta da função. */
    headers: { "x-request-id": requestId },
    setUser(id: string | null) { ctx.userId = id; },
    setAdmin(client: any) { ctx.admin = client; },
    async setIpFrom(request: Request) { ctx.ipHash = await hashIp(request); },
    info: (event: string, data?: Record<string, unknown>) => emit("info", event, data),
    warn: (event: string, data?: Record<string, unknown>) => emit("warn", event, data),
    error: (event: string, data?: Record<string, unknown>) => emit("error", event, data),

    /**
     * Log + persistência do evento de abuso. Falha silenciosa por design.
     * `severity` "critical" é o que o painel Dev destaca como alerta.
     */
    async security(
      type: SecurityEventType,
      opts: { severity?: Severity; status?: number; detail?: Record<string, unknown> } = {},
    ) {
      const severity = opts.severity ?? (type === "webhook_invalid_secret" ? "critical" : "warning");
      emit(severity === "critical" ? "error" : "warn", `security.${type}`, {
        severity, status: opts.status, ...(opts.detail ?? {}),
      });
      try {
        await ctx.admin?.from("security_events").insert({
          request_id: requestId,
          event_type: type,
          severity,
          fn_name: fn,
          user_id: ctx.userId ?? null,
          ip_hash: ctx.ipHash ?? null,
          status_code: opts.status ?? null,
          detail: opts.detail ?? {},
        });
      } catch (_e) { /* telemetria nunca quebra a requisição */ }
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
