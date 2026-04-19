const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateRequest {
  title: string;
  description?: string;
  slidesCount: number;
  type: string;
  language: string;
  theme: string;
  fontStyle: string;
  includeCharts: boolean;
  includeImages: boolean;
}

const SYSTEM_PROMPT = `Você é um especialista em criar apresentações profissionais. Gere apresentações estruturadas em JSON válido seguindo exatamente o schema definido pela ferramenta. Crie conteúdo rico, claro e bem estruturado em PORTUGUÊS BRASILEIRO (a menos que o idioma solicitado seja diferente). Cada slide deve ter conteúdo substancial e útil — não use placeholders.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: GenerateRequest = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const slidesCount = Math.max(3, Math.min(10, body.slidesCount || 8));

    const userPrompt = `Crie uma apresentação completa sobre:
TÍTULO: ${body.title}
DESCRIÇÃO: ${body.description || "(não fornecida)"}
TIPO: ${body.type}
IDIOMA: ${body.language}
NÚMERO DE SLIDES: exatamente ${slidesCount}
INCLUIR GRÁFICOS: ${body.includeCharts ? "sim" : "não"}
INCLUIR SUGESTÕES DE IMAGEM: ${body.includeImages ? "sim" : "não"}

Estrutura sugerida: slide 1 = capa (title_slide), slide 2 = introdução, slides intermediários = conteúdo/dados, slide final = conclusão.`;

    const tools = [{
      type: "function",
      function: {
        name: "create_presentation",
        description: "Cria a estrutura completa de uma apresentação",
        parameters: {
          type: "object",
          properties: {
            slides: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  slide_title: { type: "string" },
                  slide_type: { type: "string", enum: ["title_slide", "content", "bullet_points", "quote", "image_text", "data_chart", "section_divider", "conclusion"] },
                  layout_template: { type: "string", enum: ["title-only", "title-content", "two-columns", "image-right", "image-left", "full-image", "quote", "data-chart"] },
                  headline: { type: "string", description: "Título principal exibido" },
                  subtitle: { type: "string", description: "Subtítulo opcional" },
                  body_text: { type: "string", description: "Texto descritivo (pode ser vazio)" },
                  bullets: { type: "array", items: { type: "string" }, description: "Lista de bullets se aplicável" },
                  quote_text: { type: "string", description: "Para slides de citação" },
                  quote_author: { type: "string" },
                  speaker_notes: { type: "string", description: "Notas do apresentador" },
                  suggested_image_query: { type: "string", description: "Query para buscar imagem" },
                  chart: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["bar", "line", "pie", "donut", "area"] },
                      labels: { type: "array", items: { type: "string" } },
                      values: { type: "array", items: { type: "number" } },
                      title: { type: "string" }
                    }
                  }
                },
                required: ["slide_title", "slide_type", "layout_template", "headline", "speaker_notes"],
                additionalProperties: false
              }
            }
          },
          required: ["slides"],
          additionalProperties: false
        }
      }
    }];

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "create_presentation" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, t);
      return new Response(JSON.stringify({ error: "Erro ao gerar apresentação." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResponse.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI did not return tool call");
    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ slides: parsed.slides }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-presentation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
