// Chat-based slide editor. Receives the current slide JSON + user instruction,
// returns the updated slide JSON. Used in the /gerar chat panel.
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
8. Retorne também uma resposta curta (assistant_message) explicando em 1-2 frases o que foi feito.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userPrompt = `ESTADO ATUAL DA APRESENTAÇÃO (JSON):
${JSON.stringify({ dynamic_theme, slides }, null, 2)}

INSTRUÇÃO DO USUÁRIO:
${instruction}

Aplique a instrução e devolva a apresentação inteira atualizada.`;

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
                },
                required: ["slide_title", "slide_type", "layout_template", "animation", "headline"],
              },
            },
          },
          required: ["slides", "assistant_message"],
        },
      },
    }];

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "update_presentation" } },
        max_completion_tokens: 16384,
      }),
    });

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
