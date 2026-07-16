// Assistente de suporte inteligente do SlideAI.
// Papéis: (1) guia geral de uso; (2) diagnóstico técnico com base no error_catalog.
// Nunca inventa códigos ou passos — sempre extrai do catálogo.
// Escala para humano quando ai_can_resolve=false ou severity=critical.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

const RATE_LIMIT_PER_HOUR = 30;

type ChatMsg = { role: "user" | "assistant" | "system"; content: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Autenticação do usuário
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return json({ error: "not_authenticated" }, 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // ── Rate limit
    const { data: allowed } = await admin.rpc("check_rate_limit", {
      _key: user.id,
      _fn: "support-chat",
      _max_per_hour: RATE_LIMIT_PER_HOUR,
    });
    if (allowed === false) {
      return json({ error: "rate_limited", code: "SUP-001" }, 429);
    }

    const body = await req.json().catch(() => ({}));
    const message: string = String(body.message ?? "").trim();
    let conversationId: string | null = body.conversation_id ?? null;
    const errorCodeHint: string | null = body.error_code ?? null;
    const relatedOccurrenceId: string | null = body.occurrence_id ?? null;

    if (!message || message.length > 2000) {
      return json({ error: "invalid_message" }, 400);
    }

    // ── Cria/recupera conversa
    if (!conversationId) {
      const { data: ticket } = await admin.rpc("generate_ticket_id");
      const { data: conv, error: convErr } = await admin
        .from("support_conversations")
        .insert({
          user_id: user.id,
          ticket_id: ticket,
          state: "diagnosing",
          related_occurrence_id: relatedOccurrenceId,
          related_error_code: errorCodeHint,
          subject: message.slice(0, 80),
        })
        .select("id, ticket_id")
        .single();
      if (convErr) throw convErr;
      conversationId = conv.id;
    }

    // ── Grava mensagem do usuário
    await admin.from("support_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: message,
      code_ref: errorCodeHint,
    });

    // ── Histórico + contexto
    const [{ data: history }, { data: catalog }, { data: recentOcc }] = await Promise.all([
      admin.from("support_messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at").limit(30),
      admin.from("error_catalog")
        .select("code, title, user_description, resolution_steps, ai_can_resolve, severity, module"),
      admin.from("error_occurrences")
        .select("error_code, route, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(5),
    ]);

    // ── Catálogo compacto no system prompt
    const catalogText = (catalog ?? []).map((c: any) =>
      `[${c.code}] (${c.severity}/${c.module}) ${c.title} — ${c.user_description}` +
      (c.resolution_steps?.length ? ` PASSOS: ${c.resolution_steps.join(" | ")}` : "") +
      (c.ai_can_resolve ? "" : " [ESCALAR]")
    ).join("\n");

    const recentText = (recentOcc ?? []).map((o: any) =>
      `- ${o.created_at} ${o.error_code ?? "?"} em ${o.route ?? "?"}`
    ).join("\n") || "(nenhuma ocorrência recente)";

    const systemPrompt = `Você é o assistente oficial de suporte do SlideAI, uma plataforma de geração de apresentações com IA.
Você tem DOIS papéis simultâneos:

1) GUIA GERAL: explicar como usar funcionalidades reais do SlideAI (login com email ou Google; geração em /gerar; edição em /editor/:slug; exportação PDF/PPTX; planos Single/Mensal/Anual via Cakto).
2) DIAGNÓSTICO TÉCNICO: usar o CATÁLOGO DE ERROS abaixo para identificar o problema do usuário.

REGRAS INVIOLÁVEIS:
- NUNCA invente códigos, causas ou passos. Se algo não está no catálogo, admita honestamente e diga que abrirá uma investigação.
- Se o usuário der um código exato (ex: "PAY-003"), busque no catálogo e responda com título, causa e passos EXATOS.
- Se o usuário descrever um sintoma sem código, identifique a hipótese mais provável. Se houver ambiguidade real entre 2+ códigos, faça UMA pergunta objetiva antes de responder.
- Se o código exigir escalação ([ESCALAR] no catálogo, ou severidade critical, ou envolver pagamento/segurança), diga claramente que um humano será acionado e termine sua resposta com a marca literal <ESCALATE>.
- Se não achou correspondência, termine com a marca literal <UNCATALOGUED>.
- Se o problema foi resolvido, termine com <RESOLVED>.
- Tom: profissional, empático, direto. Sempre em português do Brasil. Passos sempre numerados.
- Nunca exponha dados sensíveis nem peça senha/token.

CATÁLOGO DE ERROS:
${catalogText}

OCORRÊNCIAS RECENTES DESTE USUÁRIO:
${recentText}
`;

    const messages: ChatMsg[] = [
      { role: "system", content: systemPrompt },
      ...((history ?? []) as ChatMsg[]),
    ];

    // ── Chama Lovable AI Gateway
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: 0.3,
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text().catch(() => "");
      console.error("support-chat AI error", aiResp.status, errText);
      const code = aiResp.status === 402 ? "GEN-006" : "SUP-002";
      const fallback = "Estou com dificuldade para responder no momento. Um humano da equipe será acionado.";
      await admin.from("support_messages").insert({
        conversation_id: conversationId, role: "assistant", content: fallback, code_ref: code,
      });
      await admin.from("support_conversations").update({
        state: "escalated", escalated_at: new Date().toISOString(),
      }).eq("id", conversationId);
      return json({ conversation_id: conversationId, reply: fallback, state: "escalated", code });
    }

    const aiJson = await aiResp.json();
    const raw = aiJson.choices?.[0]?.message?.content ?? "Desculpe, não consegui gerar uma resposta.";

    let newState: "diagnosing" | "resolved" | "escalated" = "diagnosing";
    let resolvedByAi: boolean | null = null;
    let reply = raw;

    if (raw.includes("<ESCALATE>")) {
      newState = "escalated"; resolvedByAi = false;
      reply = raw.replace(/<ESCALATE>/g, "").trim();
    } else if (raw.includes("<RESOLVED>")) {
      newState = "resolved"; resolvedByAi = true;
      reply = raw.replace(/<RESOLVED>/g, "").trim();
    } else if (raw.includes("<UNCATALOGUED>")) {
      newState = "escalated"; resolvedByAi = false;
      reply = raw.replace(/<UNCATALOGUED>/g, "").trim();
      // Registra ocorrência não catalogada
      await admin.from("error_occurrences").insert({
        user_id: user.id,
        error_code: "SUP-999",
        route: "/support-chat",
        context: { conversation_id: conversationId, sample_message: message.slice(0, 200) },
      });
    }

    // Detecta código citado (ex: "AUTH-001")
    const codeMatch = reply.match(/\b([A-Z]{2,4}-\d{3})\b/);
    const codeRef = codeMatch?.[1] ?? errorCodeHint ?? null;

    await admin.from("support_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: reply,
      code_ref: codeRef,
    });

    const convPatch: Record<string, unknown> = { state: newState };
    if (newState === "escalated") convPatch.escalated_at = new Date().toISOString();
    if (newState === "resolved") { convPatch.closed_at = new Date().toISOString(); convPatch.resolved_by_ai = true; }
    if (resolvedByAi === false) convPatch.resolved_by_ai = false;
    await admin.from("support_conversations").update(convPatch).eq("id", conversationId);

    return json({ conversation_id: conversationId, reply, state: newState, code: codeRef });
  } catch (e) {
    console.error("support-chat fatal", e);
    return json({ error: "internal", message: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
