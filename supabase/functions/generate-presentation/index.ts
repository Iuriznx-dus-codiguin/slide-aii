// Generate presentation: structured JSON output with dynamic theme + per-slide
// animation suggestions + image queries (resolved by /fetch-image afterwards).
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
  theme: string; // preset id OR "auto"
  fontStyle: string;
  includeCharts: boolean;
  includeImages: boolean;
}

const SYSTEM_PROMPT = `Você é um especialista em design de apresentações de altíssimo nível, com experiência equivalente a um diretor criativo da Apple, Stripe ou Pitch.com.

Sua missão: gerar APRESENTAÇÕES VISUAIS RICAS, com conteúdo profundo, bem pesquisado, narrativa clara e direção de arte coesa.

REGRAS CRÍTICAS:
1. ESCREVA EM PORTUGUÊS BRASILEIRO de forma natural, profissional e fluida (a menos que o idioma solicitado seja outro).
2. Cada slide tem PROPÓSITO NARRATIVO claro — nada de placeholders ou texto genérico.
3. Use dados, estatísticas, comparações, números reais sempre que fizer sentido.
4. Varie os layouts. NUNCA repita o mesmo layout em slides consecutivos.
5. Varie animações entre slides para criar ritmo (fade, slide-up, slide-left, slide-right, zoom-in, blur-in, stagger-up, reveal-mask, rotate-in, bounce-in).
6. Para CADA slide, sugira uma image_query MUITO ESPECÍFICA em INGLÊS (vai ser usada no Pexels). Para conteúdo extremamente específico (logos, símbolos próprios, diagramas), marque image_strategy="ai" para gerar com IA.
7. Tema dinâmico (dynamic_theme): se o usuário pediu tema "auto", você DEVE devolver no campo dynamic_theme do PRIMEIRO slide um objeto com cores em hex (bg, text, accent, accent2) que reflitam o assunto. Ex: tema sobre Espanha → cores da bandeira (#AA151B vermelho, #F1BF00 amarelo) com bg escuro elegante. Tema sobre oceano → tons de azul profundo. Tema sobre tecnologia → dark com accent neon. As cores devem ter ALTO CONTRASTE entre bg e text.
8. Bullets devem ser curtos (no máximo 12 palavras), começar por verbo ou substantivo forte, sem emojis.
9. Conclusão sempre tem call-to-action ou síntese poderosa, nunca é vazia.
10. quote slides citam pessoas reais relevantes ao tema, com autor verificável.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: GenerateRequest = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const slidesCount = Math.max(3, Math.min(10, body.slidesCount || 8));
    const isAutoTheme = body.theme === "auto";

    const userPrompt = `Crie uma apresentação completa, rica e visualmente impressionante.

TÍTULO: ${body.title}
DESCRIÇÃO: ${body.description || "(o usuário não detalhou — você decide o que abordar de forma clara e útil)"}
TIPO: ${body.type}
IDIOMA: ${body.language}
NÚMERO DE SLIDES: exatamente ${slidesCount}
INCLUIR GRÁFICOS: ${body.includeCharts ? "sim — use ao menos 1 gráfico relevante (bar, line, pie, donut ou area) com dados realistas" : "não"}
INCLUIR IMAGENS: ${body.includeImages ? "sim — TODOS os slides de conteúdo devem ter image_query específica" : "apenas se essencial"}
${isAutoTheme ? `TEMA DINÂMICO: o usuário pediu paleta exclusiva. Você DEVE devolver dynamic_theme no primeiro slide com cores em hex que reflitam visualmente o assunto "${body.title}".` : `TEMA: paleta pré-definida pelo usuário (não preencher dynamic_theme).`}

ESTRUTURA RECOMENDADA (${slidesCount} slides):
- Slide 1: title_slide (capa impactante com headline poderoso e subtítulo)
- Slide 2: introdução / contexto
- Slides intermediários: alternar entre content, bullet_points, data_chart, image_text, quote
- Slide final: conclusion (síntese + call-to-action)

Mantenha narrativa coesa. Cada slide flui para o próximo.`;

    const tools = [{
      type: "function",
      function: {
        name: "create_presentation",
        description: "Cria a estrutura completa de uma apresentação profissional",
        parameters: {
          type: "object",
          properties: {
            dynamic_theme: {
              type: "object",
              description: "Paleta dinâmica baseada no tema (apenas se solicitado tema auto)",
              properties: {
                name: { type: "string" },
                bg: { type: "string", description: "cor de fundo em hex #RRGGBB" },
                text: { type: "string", description: "cor de texto em hex #RRGGBB" },
                accent: { type: "string", description: "cor de destaque em hex" },
                accent2: { type: "string", description: "cor secundária em hex (opcional)" },
                surface: { type: "string", description: "cor de superfície/cards em hex (opcional)" },
              },
            },
            slides: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  slide_title: { type: "string" },
                  slide_type: { type: "string", enum: ["title_slide", "content", "bullet_points", "quote", "image_text", "data_chart", "section_divider", "conclusion"] },
                  layout_template: { type: "string", enum: ["title-only", "title-content", "two-columns", "image-right", "image-left", "full-image", "quote", "data-chart", "centered", "split-hero", "stat-highlight"] },
                  animation: { type: "string", enum: ["fade", "slide-up", "slide-left", "slide-right", "zoom-in", "blur-in", "stagger-up", "reveal-mask", "rotate-in", "bounce-in"] },
                  headline: { type: "string" },
                  subtitle: { type: "string" },
                  body_text: { type: "string" },
                  bullets: { type: "array", items: { type: "string" } },
                  stat_value: { type: "string", description: "Para stat-highlight: o número grande (ex: '78%')" },
                  stat_label: { type: "string", description: "Para stat-highlight: a descrição do número" },
                  quote_text: { type: "string" },
                  quote_author: { type: "string" },
                  speaker_notes: { type: "string" },
                  image_query: { type: "string", description: "Query MUITO específica em INGLÊS para Pexels (ex: 'spanish flag waving sunset', 'modern data center server room')" },
                  image_strategy: { type: "string", enum: ["pexels", "ai", "none"], description: "pexels = buscar foto real, ai = gerar com IA, none = sem imagem" },
                  ai_image_prompt: { type: "string", description: "Se image_strategy='ai', prompt detalhado em inglês para geração de imagem (estilo, iluminação, composição)" },
                  chart: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["bar", "line", "pie", "donut", "area"] },
                      labels: { type: "array", items: { type: "string" } },
                      values: { type: "array", items: { type: "number" } },
                      title: { type: "string" },
                    },
                  },
                },
                required: ["slide_title", "slide_type", "layout_template", "animation", "headline", "speaker_notes", "image_strategy"],
                additionalProperties: false,
              },
            },
          },
          required: ["slides"],
          additionalProperties: false,
        },
      },
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
        max_completion_tokens: 16384,
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
    const finishReason = data.choices?.[0]?.finish_reason;
    if (!toolCall) {
      console.error("generate-presentation: no tool_call. finish=", finishReason, "raw=", JSON.stringify(data).slice(0, 800));
      return new Response(JSON.stringify({ error: "A IA não retornou estrutura. Tente reduzir o número de slides ou desativar imagens." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let parsed: any;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("generate-presentation: tool args JSON parse failed (likely truncation). finish=", finishReason, "len=", toolCall.function.arguments?.length);
      return new Response(JSON.stringify({ error: "Resposta da IA truncada. Reduza o número de slides ou tente novamente." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
      return new Response(JSON.stringify({ error: "A IA não gerou nenhum slide. Tente reformular o título." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      slides: parsed.slides,
      dynamic_theme: parsed.dynamic_theme ?? null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-presentation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
