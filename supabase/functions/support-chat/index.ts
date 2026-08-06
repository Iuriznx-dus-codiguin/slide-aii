// Assistente de suporte inteligente do SlideAI.
// Papéis: (1) guia de uso alimentado por help_articles; (2) diagnóstico via error_catalog.
// Fluxo de confirmação: <RESOLVED> marca awaiting_confirmation (não fecha).
// Escala para humano quando ai_can_resolve=false, severity=critical, pagamento/segurança, ou reopen_count>=2.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-slideai-session",
  "Access-Control-Expose-Headers": "x-request-id",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const SUPPORT_ALERT_WEBHOOK_URL = Deno.env.get("SUPPORT_ALERT_WEBHOOK_URL"); // opcional

const RATE_LIMIT_PER_HOUR = 30;
const AUTO_CLOSE_HOURS = 72;
const MAX_REOPENS_BEFORE_ESCALATION = 2;

type ChatMsg = { role: "user" | "assistant" | "system"; content: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID();
  const respHeaders = { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId };

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const sessionHeader = req.headers.get("x-slideai-session") ?? null;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "not_authenticated" }), { status: 401, headers: respHeaders });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Rate limit
    const { data: allowed } = await admin.rpc("check_rate_limit", {
      _key: user.id, _fn: "support-chat", _max_per_hour: RATE_LIMIT_PER_HOUR,
    });
    if (allowed === false) {
      return new Response(JSON.stringify({ error: "rate_limited", code: "SUP-001", request_id: requestId }), { status: 429, headers: respHeaders });
    }

    // Sweep oportunístico: fecha conversas awaiting_confirmation antigas
    admin.from("support_conversations")
      .update({ state: "resolved", closed_at: new Date().toISOString(), auto_closed: true, resolved_by_ai: true })
      .eq("state", "awaiting_confirmation")
      .lt("awaiting_confirmation_at", new Date(Date.now() - AUTO_CLOSE_HOURS * 3600_000).toISOString())
      .then(() => {}, () => {}); // fire-and-forget

    const body = await req.json().catch(() => ({}));
    const message: string = String(body.message ?? "").trim();
    const action: string | null = body.action ?? null; // "confirm_yes" | "confirm_no" | null
    let conversationId: string | null = body.conversation_id ?? null;
    const errorCodeHint: string | null = body.error_code ?? null;
    const relatedOccurrenceId: string | null = body.occurrence_id ?? null;

    if (!action && (!message || message.length > 2000)) {
      return new Response(JSON.stringify({ error: "invalid_message", request_id: requestId }), { status: 400, headers: respHeaders });
    }




    // ─────────────── AÇÃO: confirmação do usuário (sim/não)
    if (action === "confirm_yes" || action === "confirm_no") {
      if (!conversationId) {
        return new Response(JSON.stringify({ error: "conversation_required", request_id: requestId }), { status: 400, headers: respHeaders });
      }
      const { data: conv } = await admin.from("support_conversations")
        .select("id, user_id, state, reopen_count, related_error_code")
        .eq("id", conversationId).single();
      if (!conv || conv.user_id !== user.id) {
        return new Response(JSON.stringify({ error: "not_found", request_id: requestId }), { status: 404, headers: respHeaders });
      }

      if (action === "confirm_yes") {
        await admin.from("support_messages").insert({
          conversation_id: conversationId, role: "system",
          content: "Usuário confirmou que o problema foi resolvido.",
        });
        await admin.from("support_conversations").update({
          state: "resolved", resolved_by_ai: true, resolved_by_human: false,
          closed_at: new Date().toISOString(), awaiting_confirmation_at: null,
        }).eq("id", conversationId);
        return new Response(JSON.stringify({
          conversation_id: conversationId, state: "resolved",
          reply: "Que ótimo! Fico feliz em ter ajudado. Se precisar de algo mais, é só chamar. ✨",
          request_id: requestId,
        }), { headers: respHeaders });
      }

      // confirm_no → reabre para diagnosing, incrementa contador, pode escalar
      const newReopen = (conv.reopen_count ?? 0) + 1;
      const shouldEscalate = newReopen >= MAX_REOPENS_BEFORE_ESCALATION;
      await admin.from("support_messages").insert({
        conversation_id: conversationId, role: "system",
        content: `Usuário reportou que o problema NÃO foi resolvido (reopen #${newReopen}).`,
      });
      const patch: Record<string, unknown> = {
        reopen_count: newReopen,
        awaiting_confirmation_at: null,
        state: shouldEscalate ? "escalated" : "diagnosing",
      };
      if (shouldEscalate) {
        patch.escalated_at = new Date().toISOString();
        patch.escalation_reason = "repeated_unresolved";
        patch.resolved_by_ai = false;
        await sendAlert("repeated_unresolved", conversationId, conv.related_error_code, user.id);
      }
      await admin.from("support_conversations").update(patch).eq("id", conversationId);

      const reply = shouldEscalate
        ? "Entendi. Como já tentamos algumas vezes, vou encaminhar para nossa equipe humana revisar. Você receberá retorno em breve."
        : "Ok, vamos tentar outra abordagem. Me conta com mais detalhes o que aconteceu quando você seguiu os passos anteriores?";

      await admin.from("support_messages").insert({
        conversation_id: conversationId, role: "assistant", content: reply,
      });
      return new Response(JSON.stringify({
        conversation_id: conversationId, state: patch.state, reply, request_id: requestId,
      }), { headers: respHeaders });
    }

    // ─────────────── FLUXO NORMAL: mensagem de texto
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
        .select("id, ticket_id").single();
      if (convErr) throw convErr;
      conversationId = conv.id;
    }

    await admin.from("support_messages").insert({
      conversation_id: conversationId, role: "user", content: message, code_ref: errorCodeHint,
    });

    // Contexto
    const [{ data: history }, { data: catalog }, { data: recentOcc }, { data: articles }] = await Promise.all([
      admin.from("support_messages").select("role, content").eq("conversation_id", conversationId).order("created_at").limit(30),
      admin.from("error_catalog").select("code, title, user_description, resolution_steps, ai_can_resolve, severity, module"),
      admin.from("error_occurrences").select("error_code, route, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
      admin.from("help_articles").select("slug, title, category, content_md, keywords").eq("is_published", true),
    ]);

    // Busca simples por keywords do help
    const msgLower = message.toLowerCase();
    const scored = (articles ?? []).map((a: any) => {
      const kw = (a.keywords ?? []) as string[];
      let s = kw.reduce((acc, k) => acc + (msgLower.includes(k.toLowerCase()) ? 2 : 0), 0);
      if (msgLower.includes(a.title.toLowerCase().slice(0, 15))) s += 1;
      return { a, s };
    }).filter((x) => x.s > 0).sort((x, y) => y.s - x.s).slice(0, 3);

    const helpText = scored.length
      ? scored.map(({ a }) => `### ${a.title} (${a.category})\n${a.content_md}`).join("\n\n")
      : "(nenhum artigo diretamente relacionado — se for dúvida de uso, responda com base no conhecimento geral do produto listado acima)";

    const catalogText = (catalog ?? []).map((c: any) =>
      `[${c.code}] (${c.severity}/${c.module}) ${c.title} — ${c.user_description}` +
      (c.resolution_steps?.length ? ` PASSOS: ${c.resolution_steps.join(" | ")}` : "") +
      (c.ai_can_resolve ? "" : " [ESCALAR]")
    ).join("\n");

    const recentText = (recentOcc ?? []).map((o: any) =>
      `- ${o.created_at} ${o.error_code ?? "?"} em ${o.route ?? "?"}`
    ).join("\n") || "(nenhuma ocorrência recente)";

    const systemPrompt = `Você é o assistente oficial de suporte do SlideAI, plataforma de geração de apresentações com IA.
Dois papéis simultâneos:

1) GUIA DE USO — responder "como faço X no SlideAI" usando os ARTIGOS DE AJUDA abaixo.
2) DIAGNÓSTICO TÉCNICO — identificar problemas usando o CATÁLOGO DE ERROS.

ESCOPO ESTRITO:
- Você SÓ responde sobre o SlideAI (uso da plataforma, geração de slides, planos, pagamentos, erros, conta).
- Perguntas fora desse escopo (curiosidades gerais, opiniões, quem é o dono, política, outros produtos, tarefas genéricas de IA) devem ser recusadas de forma CURTA e profissional em 1 a 2 frases, redirecionando exatamente assim: "Sou o assistente de suporte do SlideAI e respondo apenas sobre o uso da plataforma, sua conta, pagamentos e erros. Como posso te ajudar com isso?" Não ofereça alternativas, links externos, nem sugira como o usuário poderia obter a resposta por outros meios. Não liste passos para investigar por conta própria.
- Nunca especule sobre propriedade, equipe, empresa ou informações internas que não estejam nos artigos.

REGRAS INVIOLÁVEIS:
- NUNCA invente códigos, causas ou passos. Se algo não está no catálogo NEM nos artigos, admita em 1 frase.
- Se o usuário der um código exato (ex: "PAY-003"), responda com título, causa e passos EXATOS do catálogo.
- Se descrever um sintoma sem código, identifique a hipótese mais provável. Se houver ambiguidade real entre 2+ códigos, faça UMA pergunta objetiva antes de responder.
- Se o código exigir escalação ([ESCALAR], severidade critical, pagamento ou segurança), diga que um humano será acionado e termine com <ESCALATE>.
- Se resolveu a dúvida ou aplicou uma solução, termine com <RESOLVED>. Isso NÃO fecha a conversa — o usuário confirmará.
- Se não achou correspondência no catálogo/artigos E a pergunta é legítima sobre SlideAI, termine com <UNCATALOGUED>.
- Tom: profissional, empático, direto, CONCISO. Português do Brasil. Passos sempre numerados. Sem preâmbulos longos.
- Nunca peça senha/token nem exponha dados sensíveis.

ARTIGOS DE AJUDA RELEVANTES:
${helpText}

CATÁLOGO DE ERROS:
${catalogText}

OCORRÊNCIAS RECENTES DESTE USUÁRIO:
${recentText}`;

    // Só o prompt do sistema construído aqui pode ter papel "system".
    // Linhas do histórico com outro papel são conteúdo de conversa e entram
    // como user/assistant — assim nenhuma mensagem gravada consegue se
    // apresentar ao modelo como regra de sistema (prompt injection).
    const safeHistory = ((history ?? []) as ChatMsg[])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: String(m.content ?? "").slice(0, 4000) }));

    const messages: ChatMsg[] = [
      { role: "system", content: systemPrompt },
      ...safeHistory,
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "openai/gpt-5.4-mini",
        service_tier: "priority",
        messages,
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text().catch(() => "");
      console.error("[support-chat]", requestId, "AI error", aiResp.status, errText.slice(0, 200));
      const code = aiResp.status === 402 ? "GEN-006" : aiResp.status === 429 ? "SUP-001" : "SUP-002";
      const fallback = "Estou com dificuldade para responder no momento. Encaminhei sua mensagem para nossa equipe.";
      await admin.from("support_messages").insert({
        conversation_id: conversationId, role: "assistant", content: fallback, code_ref: code,
      });
      await admin.from("support_conversations").update({
        state: "escalated", escalated_at: new Date().toISOString(),
        escalation_reason: `ai_gateway_${aiResp.status}`,
      }).eq("id", conversationId);
      await sendAlert(`ai_gateway_${aiResp.status}`, conversationId, code, user.id);
      return new Response(JSON.stringify({ conversation_id: conversationId, reply: fallback, state: "escalated", code, request_id: requestId }), { headers: respHeaders });
    }

    const aiJson = await aiResp.json();
    const raw: string = aiJson.choices?.[0]?.message?.content ?? "Desculpe, não consegui gerar uma resposta.";

    let newState: "diagnosing" | "awaiting_confirmation" | "escalated" = "diagnosing";
    let escalationReason: string | null = null;
    let reply = raw;

    if (raw.includes("<ESCALATE>")) {
      newState = "escalated";
      escalationReason = "ai_directive";
      reply = raw.replace(/<ESCALATE>/g, "").trim();
    } else if (raw.includes("<RESOLVED>")) {
      newState = "awaiting_confirmation";
      reply = raw.replace(/<RESOLVED>/g, "").trim();
    } else if (raw.includes("<UNCATALOGUED>")) {
      newState = "escalated";
      escalationReason = "uncatalogued";
      reply = raw.replace(/<UNCATALOGUED>/g, "").trim();
      await admin.from("error_occurrences").insert({
        user_id: user.id, error_code: "SUP-999", route: "/support-chat",
        request_id: requestId,
        context: { conversation_id: conversationId, sample_message: message.slice(0, 200) },
      });
    }

    const codeMatch = reply.match(/\b([A-Z]{2,4}-\d{3})\b/);
    const codeRef = codeMatch?.[1] ?? errorCodeHint ?? null;

    // Escalation por severidade/módulo do código citado
    if (newState !== "escalated" && codeRef) {
      const cat = (catalog ?? []).find((c: any) => c.code === codeRef);
      if (cat && (cat.severity === "critical" || cat.ai_can_resolve === false || ["payments", "security"].includes(cat.module))) {
        newState = "escalated";
        escalationReason = `auto_${cat.severity}_${cat.module}`;
      }
    }

    await admin.from("support_messages").insert({
      conversation_id: conversationId, role: "assistant", content: reply, code_ref: codeRef,
    });

    const convPatch: Record<string, unknown> = { state: newState };
    if (newState === "escalated") {
      convPatch.escalated_at = new Date().toISOString();
      convPatch.escalation_reason = escalationReason ?? "unspecified";
      convPatch.resolved_by_ai = false;
      await sendAlert(escalationReason ?? "unspecified", conversationId, codeRef, user.id);
    }
    if (newState === "awaiting_confirmation") {
      convPatch.awaiting_confirmation_at = new Date().toISOString();
    }
    await admin.from("support_conversations").update(convPatch).eq("id", conversationId);

    return new Response(JSON.stringify({
      conversation_id: conversationId, reply, state: newState, code: codeRef, request_id: requestId,
    }), { headers: respHeaders });
  } catch (e) {
    console.error("[support-chat]", requestId, "fatal", e);
    return new Response(JSON.stringify({
      error: "internal", message: e instanceof Error ? e.message : String(e), request_id: requestId,
    }), { status: 500, headers: respHeaders });
  }
});

async function sendAlert(reason: string, convId: string, codeRef: string | null, userId: string) {
  if (!SUPPORT_ALERT_WEBHOOK_URL) {
    console.log("[support-alert]", { reason, convId, codeRef, userId });
    return;
  }
  try {
    await fetch(SUPPORT_ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `🚨 Suporte SlideAI — escalação: **${reason}**`,
        embeds: [{
          title: `Conversa ${convId.slice(0, 8)}`,
          fields: [
            { name: "Motivo", value: reason, inline: true },
            { name: "Código", value: codeRef ?? "-", inline: true },
            { name: "Usuário", value: userId.slice(0, 8), inline: true },
          ],
          timestamp: new Date().toISOString(),
        }],
      }),
    });
  } catch (e) {
    console.warn("[support-alert] webhook failed", e);
  }
}
