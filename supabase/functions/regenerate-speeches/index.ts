// ============================================================
// SlideAI — Regeneração de falas do apresentador
// ------------------------------------------------------------
// Regenera exact_speech / transition_anchor de UM slide ou de
// TODOS os slides de uma apresentação, com limite por
// apresentação (presentations.speech_regen_count).
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { AI_ENDPOINTS, TEXT_STAGES } from "../_shared/modelRegistry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const MAX_SPEECH_REGENS = 5;
const MAX_REGENS_PER_HOUR = 20;
/** Teto de slides no prompt (a geração vai até 20; o editor pode somar alguns). */
const MAX_DECK_SLIDES = 40;
const LIMIT_MESSAGE = "Limite de regenerações de falas atingido para esta apresentação.";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Não autenticado." }, 401);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Sessão inválida." }, 401);
  const userId = userData.user.id;

  // Teto por hora além da cota por apresentação: decks são baratos de criar,
  // então a cota sozinha não limitava o volume total de chamadas de IA.
  const { data: withinLimit } = await admin.rpc("check_rate_limit", {
    _key: `user:${userId}`, _fn: "regenerate-speeches", _max_per_hour: MAX_REGENS_PER_HOUR,
  });
  if (withinLimit === false) return json({ error: "Muitas regenerações em pouco tempo. Aguarde alguns minutos." }, 429);

  let body: { presentationId?: string; scope?: "slide" | "all"; slideIndex?: number };
  try {
    const text = await req.text();
    if (text.length > 4096) return json({ error: "Requisição inválida." }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ error: "Requisição inválida." }, 400);
  }
  const presentationId = String(body.presentationId ?? "");
  const scope = body.scope === "all" ? "all" : "slide";
  const slideIndex = Number.isInteger(body.slideIndex) ? Number(body.slideIndex) : 0;
  if (!presentationId) return json({ error: "Apresentação não informada." }, 400);

  // Elegibilidade (não consome geração — função somente-leitura)
  const { data: entitle } = await admin.rpc("can_user_generate", { _uid: userId, _credits_cost: 0 });
  const allowed = typeof entitle === "object" && entitle !== null
    ? (entitle as any).allowed !== false
    : entitle !== false;
  if (!allowed) return json({ error: "Seu plano não permite uso de IA no momento." }, 403);

  const { data: pres, error: presErr } = await admin
    .from("presentations")
    // Só colunas que existem: `topic` e `tone` (inexistentes) faziam esta
    // consulta falhar sempre e a regeneração responder 404 em produção.
    .select("id,user_id,title,include_speeches,presenters_names,presenters_count,speech_regen_count")
    .eq("id", presentationId)
    .maybeSingle();
  if (presErr || !pres) return json({ error: "Apresentação não encontrada." }, 404);
  if (pres.user_id !== userId) return json({ error: "Acesso negado." }, 403);
  // As falas são um recurso pago na geração (+50 créditos). Regenerar só vale
  // para apresentações que incluíram as falas — senão viravam falas grátis.
  if (!(pres as any).include_speeches) {
    return json({
      error: "Esta apresentação foi gerada sem as falas dos apresentadores (opção paga na geração).",
      reason: "speeches_not_included",
    }, 402);
  }

  const used = Number((pres as any).speech_regen_count ?? 0);
  if (used >= MAX_SPEECH_REGENS) return json({ error: LIMIT_MESSAGE, limitReached: true }, 429);

  const { data: slideRows, error: slidesErr } = await admin
    .from("slides")
    .select("id,position,content,speaker_notes,presenters_data")
    .eq("presentation_id", presentationId)
    .order("position");
  if (slidesErr || !slideRows?.length) return json({ error: "Slides não encontrados." }, 404);
  if (slideRows.length > MAX_DECK_SLIDES) return json({ error: "Apresentação grande demais para regenerar as falas." }, 400);

  const names: string[] = Array.isArray((pres as any).presenters_names) && (pres as any).presenters_names.length
    ? ((pres as any).presenters_names as string[])
    : ["Apresentador 1"];

  const targets = scope === "all"
    ? slideRows
    : slideRows.filter((s) => s.position === slideIndex);
  if (!targets.length) return json({ error: "Slide não encontrado." }, 404);

  const deckMap = slideRows
    .map((s: any) => `${s.position + 1}. ${s.content?.headline ?? "(sem título)"}`)
    .join("\n");

  const prompt = `Você é diretor de roteiro de apresentações. Escreva as FALAS EXATAS (script literal, português do Brasil) para os slides abaixo da apresentação "${(pres as any).title}".

MAPA DO DECK:
${deckMap}

APRESENTADORES (nesta ordem): ${names.join(" → ")}

REGRAS:
- Para CADA slide alvo, devolva um array presenters com UM objeto por apresentador, NA ORDEM EXATA acima.
- Apenas UM apresentador fala por slide (os outros ficam com exact_speech vazio) — distribua em blocos de 2-3 slides.
- exact_speech: 40-80 palavras, natural, falado, com abertura curta → ponto principal → gancho para o próximo slide.
- transition_anchor: só quando houver troca de apresentador; caso contrário string vazia.
- Nunca invente dados que não estejam no slide.

SLIDES ALVO:
${targets.map((s: any) => `--- SLIDE ${s.position + 1} ---\n${JSON.stringify(s.content ?? {}).slice(0, 1200)}`).join("\n")}`;

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return json({ error: "IA não configurada." }, 500);

  const tool = {
    type: "function",
    function: {
      name: "set_speeches",
      description: "Define as falas por slide",
      parameters: {
        type: "object",
        properties: {
          slides: {
            type: "array",
            items: {
              type: "object",
              properties: {
                position: { type: "number" },
                presenters: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      exact_speech: { type: "string" },
                      transition_anchor: { type: "string" },
                    },
                    required: ["name", "exact_speech"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["position", "presenters"],
              additionalProperties: false,
            },
          },
        },
        required: ["slides"],
        additionalProperties: false,
      },
    },
  };

  // Reserva a vaga ANTES da chamada de IA, de forma atômica no banco: ler o
  // contador, chamar a IA e só então gravar deixava pedidos em paralelo
  // passarem do teto. Se a IA falhar, a vaga é devolvida.
  const { data: reservedCount, error: reserveErr } = await admin.rpc("reserve_speech_regen", {
    _presentation_id: presentationId, _uid: userId, _max: MAX_SPEECH_REGENS,
  });
  // Migração 0010 ainda não aplicada: segue com o contador antigo.
  const legacyCounter = !!reserveErr && (reserveErr.code === "PGRST202" || reserveErr.code === "42883");
  if (reserveErr && !legacyCounter) {
    console.error("regenerate-speeches: reserva falhou", reserveErr.message);
    return json({ error: "Falha ao gerar falas. Tente novamente." }, 500);
  }
  if (!legacyCounter && (reservedCount === null || reservedCount === undefined)) {
    return json({ error: LIMIT_MESSAGE, limitReached: true }, 429);
  }
  const usedNow = legacyCounter ? used + 1 : Number(reservedCount);
  const fail = async (payload: Record<string, unknown>, status: number) => {
    if (!legacyCounter) {
      await admin.rpc("release_speech_regen", { _presentation_id: presentationId, _uid: userId });
    }
    return json(payload, status);
  };

  // Modelo da etapa vem do registro único (_shared/modelRegistry.ts).
  let resp: Response;
  try {
    resp = await fetch(AI_ENDPOINTS.gateway, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: TEXT_STAGES.speeches.gateway,
        messages: [{ role: "user", content: prompt }],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "set_speeches" } },
      }),
    });
  } catch (e) {
    console.error("regenerate-speeches: AI request failed", e instanceof Error ? e.message : e);
    return await fail({ error: "Falha ao gerar falas. Tente novamente." }, 502);
  }

  if (resp.status === 429) return await fail({ error: "Muitas requisições de IA. Tente em instantes." }, 429);
  if (resp.status === 402) return await fail({ error: "Créditos de IA insuficientes." }, 402);
  if (!resp.ok) {
    console.error("regenerate-speeches: AI error", resp.status, await resp.text());
    return await fail({ error: "Falha ao gerar falas. Tente novamente." }, 500);
  }

  let parsed: any = {};
  try {
    const aiJson = await resp.json();
    const call = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    parsed = JSON.parse(call?.function?.arguments ?? "{}");
  } catch {
    return await fail({ error: "Resposta da IA inválida." }, 500);
  }
  const bySlide = new Map<number, any[]>();
  for (const s of parsed.slides ?? []) {
    if (Array.isArray(s?.presenters)) bySlide.set(Number(s.position), s.presenters);
  }

  const updated: Array<{ position: number; presenters_data: any[] }> = [];
  for (const s of targets as any[]) {
    const fromAi = bySlide.get(s.position + 1) ?? bySlide.get(s.position);
    if (!fromAi) continue;
    const presenters_data = names.map((name, i) => {
      const src = fromAi.find((p: any) => p?.name === name) ?? fromAi[i] ?? {};
      return {
        id: crypto.randomUUID(),
        name,
        exact_speech: String(src.exact_speech ?? "").trim(),
        transition_anchor: String(src.transition_anchor ?? "").trim(),
      };
    });
    const { error: upErr } = await admin
      .from("slides")
      .update({ presenters_data })
      .eq("id", s.id);
    if (upErr) console.error("regenerate-speeches: update err", upErr);
    else updated.push({ position: s.position, presenters_data });
  }

  if (!updated.length) return await fail({ error: "A IA não retornou falas. Tente novamente." }, 500);

  if (legacyCounter) {
    await admin
      .from("presentations")
      .update({ speech_regen_count: usedNow })
      .eq("id", presentationId);
  }
  const remaining = Math.max(0, MAX_SPEECH_REGENS - usedNow);

  return json({ updated, used: usedNow, remaining, max: MAX_SPEECH_REGENS });
});
