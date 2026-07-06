// Chat-based slide editor. Receives the current slide JSON + user instruction,
// returns the updated slide JSON. Used in the /gerar chat panel.
//
// Segurança: esta função já autenticava o usuário, mas não verificava se ele
// tinha direito de uso segundo o plano (diferente de generate-presentation) —
// uma conta gratuita podia chamá-la indefinidamente, gerando custo real de IA
// sem controle algum. Agora reaproveita a mesma função can_user_generate do
// fluxo principal (somente leitura, não consome crédito) para negar acesso
// com uma mensagem clara quando o usuário não tem uso disponível, e aplica
// rate limit de 30 edições/hora por usuário como defesa adicional.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um editor de slides com IA. Recebe o estado atual de uma apresentação (lista de slides em JSON) e uma instrução do usuário em português. Sua tarefa é:

1. Aplicar a instrução de forma cirúrgica.
2. Devolver SEMPRE a apresentação inteira atualizada via tool call.
3. Manter a coesão narrativa.
4. Se a instrução pedir mudança em apenas um slide, modifique só ele.
5. Se pedir reformulação geral (estilo, tom, idioma), aplique a todos.
6. NUNCA invente novos campos fora do schema.
7. Se a instrução for ambígua, interprete pelo MELHOR resultado visual e textual.
8. Retorne também uma resposta curta (assistant_message) explicando em 1-2 frases o que foi feito.

REGRA CRÍTICA DE PRESERVAÇÃO:
PRESERVE OBRIGATORIAMENTE os valores existentes de visual_accents, narrative_act,
animation_intent, cover_variant e transition de CADA slide — só altere se a
instrução do usuário pedir EXPLICITAMENTE para mudá-los. Caso contrário, copie
os valores originais para o slide retornado.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ── Autenticação ──
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Não autenticado." }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Sessão inválida." }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;

  // ── Elegibilidade + rate limit ──
  // Antes, esta função só verificava o token (usuário logado), mas nunca
  // checava se o plano/limite dele permite consumo de IA — qualquer conta
  // gratuita podia chamar o editor por chat indefinidamente, gerando custo
  // real de IA sem controle nenhum. Reaproveita a MESMA função can_user_generate
  // usada em generate-presentation (é STABLE/somente-leitura, então não
  // consome crédito nem conta como uma geração — só confirma que o usuário
  // tem direito de uso). Some-se um rate limit próprio como cinto de
  // segurança adicional, já que edição por chat pode ser chamada com maior
  // frequência que uma geração completa.
  const { data: entitle, error: entErr } = await admin.rpc("can_user_generate", { _uid: userId });
  if (entErr) {
    console.error("chat-editor: can_user_generate err:", entErr);
    return new Response(JSON.stringify({ error: "Erro interno. Tente novamente em instantes." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const ent = entitle as { allowed: boolean; reason: string };
  if (!ent.allowed) {
    return new Response(JSON.stringify({
      error: ent.reason === "monthly_limit_reached"
        ? "Você atingiu o limite de gerações este mês, o que também pausa a edição por chat até a renovação."
        : "Edição por chat indisponível para o seu plano atual.",
      reason: ent.reason,
    }), {
      status: ent.reason === "no_plan" ? 402 : 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: withinLimit } = await admin.rpc("check_rate_limit", {
    _key: `user:${userId}`, _fn: "chat-editor", _max_per_hour: 40,
  });
  if (withinLimit === false) {
    return new Response(JSON.stringify({ error: "Muitas edições em pouco tempo. Aguarde alguns minutos." }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const rawBody = await req.text();
    if (!rawBody) {
      return new Response(JSON.stringify({ error: "Corpo da requisição vazio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let parsedBody: any;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch (parseErr) {
      console.error("chat-editor: failed to parse request body", parseErr, "len=", rawBody.length);
      return new Response(JSON.stringify({ error: "JSON da requisição inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { slides, instruction, dynamic_theme } = parsedBody ?? {};
    if (!instruction || !Array.isArray(slides)) {
      return new Response(JSON.stringify({ error: "Faltam campos: slides[] e instruction" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const useOpenAI = !!OPENAI_API_KEY;
    if (!useOpenAI && !LOVABLE_API_KEY) throw new Error("Nenhuma chave de IA configurada");

    const userPrompt = `ESTADO ATUAL DA APRESENTAÇÃO (JSON):
${JSON.stringify({ dynamic_theme, slides }, null, 2)}

INSTRUÇÃO DO USUÁRIO:
${instruction}

Aplique a instrução e devolva a apresentação inteira atualizada — PRESERVANDO
visual_accents, narrative_act, animation_intent, cover_variant e transition de
cada slide a menos que a instrução peça explicitamente para alterá-los.`;

    const tools = [{
      type: "function",
      function: {
        name: "update_presentation",
        description: "Atualiza a apresentação com base na instrução",
        parameters: {
          type: "object",
          properties: {
            assistant_message: { type: "string" },
            dynamic_theme: {
              type: "object",
              properties: {
                name: { type: "string" },
                bg: { type: "string" },
                text: { type: "string" },
                accent: { type: "string" },
                accent2: { type: "string" },
                surface: { type: "string" },
              },
            },
            slides: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  slide_title: { type: "string" },
                  slide_type: { type: "string" },
                  layout_template: { type: "string" },
                  animation: { type: "string" },
                  headline: { type: "string" },
                  subtitle: { type: "string" },
                  body_text: { type: "string" },
                  bullets: { type: "array", items: { type: "string" } },
                  stat_value: { type: "string" },
                  stat_label: { type: "string" },
                  quote_text: { type: "string" },
                  quote_author: { type: "string" },
                  speaker_notes: { type: "string" },
                  image_query: { type: "string" },
                  image_strategy: { type: "string", enum: ["pexels", "ai", "none"] },
                  ai_image_prompt: { type: "string" },
                  image_url: { type: "string", description: "Mantenha image_url existente; só limpe se imagem precisa ser regerada." },
                  chart: {
                    type: "object",
                    properties: {
                      type: { type: "string" },
                      labels: { type: "array", items: { type: "string" } },
                      values: { type: "array", items: { type: "number" } },
                      title: { type: "string" },
                    },
                  },
                  visual_accents: {
                    type: "array",
                    items: { type: "string", enum: ["orbital-rings", "dot-grid", "floating-shapes", "diagonal-lines", "corner-brackets", "data-pattern", "wave-form", "animated-blob", "pulse-grid", "particle-field"] },
                    description: "PRESERVE o valor original a menos que a instrução peça mudança explícita.",
                  },
                  narrative_act: {
                    type: "string",
                    enum: ["hook", "tension", "journey", "proof", "climax"],
                    description: "PRESERVE o valor original.",
                  },
                  animation_intent: {
                    type: "string",
                    enum: ["hero-impact", "narrative-build", "data-reveal", "emphasis-stat", "quote-spotlight", "section-break", "calm-fade"],
                    description: "PRESERVE o valor original.",
                  },
                  cover_variant: {
                    type: "string",
                    enum: ["split-hero", "typographic-bold", "full-bleed-image", "minimal-centered", "asymmetric-grid", "gradient-mesh"],
                    description: "Apenas para title_slide. PRESERVE o valor original.",
                  },
                  transition: {
                    type: "string",
                    enum: ["mosaic", "iris", "shatter", "ribbon", "blinds", "fold", "portal", "wipe", "split", "morph", "stack", "letterbox"],
                    description: "PRESERVE o valor original.",
                  },
                },
                required: ["slide_title", "slide_type", "layout_template", "animation", "headline"],
              },
            },
          },
          required: ["slides", "assistant_message"],
        },
      },
    }];

    const endpoint = useOpenAI
      ? "https://api.openai.com/v1/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const authKey = useOpenAI ? OPENAI_API_KEY! : LOVABLE_API_KEY!;
    const model = useOpenAI ? "gpt-4.1-mini" : "google/gemini-2.5-flash";

    const requestPayload = {
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "update_presentation" } },
      max_completion_tokens: 16384,
    };

    let aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${authKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
    });

    if (!aiResponse.ok && useOpenAI && LOVABLE_API_KEY && ![429, 402].includes(aiResponse.status)) {
      console.warn("chat-editor: OpenAI falhou status", aiResponse.status, "— fallback Gemini");
      aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...requestPayload, model: "google/gemini-2.5-flash" }),
      });
    }

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Aguarde um momento." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResponse.text();
      console.error("chat-editor error:", aiResponse.status, t);
      return new Response(JSON.stringify({ error: "Erro ao processar edição." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResponse.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("chat-editor: no tool_call in response", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: "A IA não retornou edição estruturada. Tente reformular a instrução." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let parsed: any;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("chat-editor: tool args JSON parse failed", e, "len=", toolCall.function.arguments?.length);
      return new Response(JSON.stringify({ error: "Resposta da IA truncada — tente uma instrução menor (ex: edite poucos slides por vez)." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Guarda contra truncação silenciosa
    if (Array.isArray(parsed.slides) && parsed.slides.length < slides.length) {
      for (let i = parsed.slides.length; i < slides.length; i++) {
        parsed.slides.push(slides[i]);
      }
    }

    // Cinto-de-segurança: força preservação dos campos "DNA" caso a IA esqueça
    if (Array.isArray(parsed.slides)) {
      const KEYS = ["visual_accents", "narrative_act", "animation_intent", "cover_variant", "transition"] as const;
      parsed.slides = parsed.slides.map((s: any, i: number) => {
        const orig = slides[i] ?? {};
        const merged = { ...s };
        for (const k of KEYS) {
          if (merged[k] === undefined || merged[k] === null || (Array.isArray(merged[k]) && merged[k].length === 0)) {
            if (orig[k] !== undefined) merged[k] = orig[k];
          }
        }
        return merged;
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat-editor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
