// Generate presentation: structured JSON output with dynamic theme + per-slide
// animation suggestions + cover variant + image queries.
// FASE 1: gemini-2.5-pro + prompt reforçado + 6 cover variants.
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

const SYSTEM_PROMPT = `Você é um diretor criativo sênior + pesquisador de conteúdo, com experiência equivalente à equipe de design da Apple, Stripe, Pitch.com ou Tome.

Sua missão: gerar APRESENTAÇÕES VISUAIS RICAS, COM CONTEÚDO PROFUNDO, BEM PESQUISADO, NARRATIVA EDITORIAL e DIREÇÃO DE ARTE COESA.

REGRAS CRÍTICAS DE CONTEÚDO:
1. ESCREVA EM PORTUGUÊS BRASILEIRO de forma natural, profissional e fluida (a menos que o idioma solicitado seja outro).
2. Cada slide tem PROPÓSITO NARRATIVO claro — nada de placeholders, "Lorem", "exemplo aqui", ou texto genérico.
3. **Use SEMPRE dados reais, estatísticas verificáveis, números concretos, anos, nomes de empresas, exemplos de mercado.** Quando citar uma estatística, mencione brevemente a fonte ou o ano (ex: "78% segundo McKinsey 2024", "USD 2,3 trilhões — Statista 2023"). Se não souber dado preciso, use estimativas razoáveis sinalizadas ("aproximadamente", "estimado em").
4. Bullets devem ser CURTOS (no máximo 14 palavras), começar por verbo forte ou substantivo concreto, sem emojis. NUNCA bullets vazios ou repetitivos.
5. Cada slide deve trazer informação NOVA — proibido repetir a mesma ideia em slides diferentes.
6. Conclusão sempre traz síntese poderosa + call-to-action concreto.
7. Quote slides citam pessoas REAIS verificáveis (com cargo/contexto), relacionadas ao tema. Sem citações inventadas.

REGRAS DE DESIGN/MOTION:
8. Varie os layouts. NUNCA repita o mesmo layout em slides consecutivos.
9. Para o slide de capa (slide_type=title_slide), ESCOLHA OBRIGATORIAMENTE um cover_variant entre: split-hero, typographic-bold, full-bleed-image, minimal-centered, asymmetric-grid, gradient-mesh. A escolha deve refletir o tom do tema:
   - assuntos visuais/inspiracionais → full-bleed-image (com imagem)
   - tecnologia/dados/finance → asymmetric-grid ou typographic-bold
   - editorial/educacional → split-hero ou minimal-centered
   - branding/criativo/colorido → gradient-mesh
10. Varie animações entre slides (fade, slide-up, blur-in, zoom-in, stagger-up, reveal-mask, etc.) — cria ritmo cinematográfico.
11. Para CADA slide, defina OBRIGATORIAMENTE um animation_intent que sinaliza o "papel narrativo" da animação:
    - "hero-impact" → capas e statements fortes (entrada lenta, escala dramática)
    - "narrative-build" → conteúdo de storytelling com sequência editorial (cascata suave)
    - "data-reveal" → gráficos e estatísticas (build progressivo, físico)
    - "emphasis-stat" → números grandes que precisam impacto visual (overshoot, peso)
    - "quote-spotlight" → citações com tom contemplativo (lento, com foco)
    - "section-break" → divisores (reveal de cortina, dramático)
    - "calm-fade" → conteúdo neutro, leve (fade simples)
12. Para CADA slide, sugira uma image_query MUITO ESPECÍFICA em INGLÊS (será usada no Pexels). Para conteúdo extremamente específico (logos, símbolos próprios, diagramas), use image_strategy="ai".
13. Tema dinâmico (dynamic_theme): se o usuário pediu tema "auto", você DEVE devolver no PRIMEIRO slide um objeto dynamic_theme com cores em hex (bg, text, accent, accent2) que reflitam o assunto. Ex: tema sobre Espanha → vermelho #AA151B + amarelo #F1BF00 + bg escuro elegante. Tecnologia → dark com accent neon. Garanta ALTO CONTRASTE entre bg e text (mínimo WCAG AA).`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: GenerateRequest = await req.json();
    // Prioridade: ChatGPT externo (OPENAI_API_KEY) → fallback Lovable AI Gateway.
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const useOpenAI = !!OPENAI_API_KEY;
    if (!useOpenAI && !LOVABLE_API_KEY) throw new Error("Nenhuma chave de IA configurada");

    const slidesCount = Math.max(3, Math.min(12, body.slidesCount || 8));
    const isAutoTheme = body.theme === "auto";

    const userPrompt = `Crie uma apresentação completa, rica em conteúdo verificável e visualmente impressionante.

TÍTULO: ${body.title}
DESCRIÇÃO: ${body.description || "(o usuário não detalhou — pesquise mentalmente o assunto e decida o que abordar de forma clara, útil e densa)"}
TIPO: ${body.type}
IDIOMA: ${body.language}
NÚMERO DE SLIDES: exatamente ${slidesCount}
INCLUIR GRÁFICOS: ${body.includeCharts ? "sim — use ao menos 1 gráfico relevante (bar, line, pie, donut ou area) com dados realistas e fonte mencionada na descrição" : "não"}
INCLUIR IMAGENS: ${body.includeImages ? "sim — TODOS os slides de conteúdo devem ter image_query específica em inglês" : "apenas se essencial"}
${isAutoTheme ? `TEMA DINÂMICO: o usuário pediu paleta exclusiva. Você DEVE devolver dynamic_theme no primeiro slide com cores em hex que reflitam visualmente o assunto "${body.title}".` : `TEMA: paleta pré-definida pelo usuário (não preencher dynamic_theme).`}

ESTRUTURA RECOMENDADA (${slidesCount} slides):
- Slide 1: title_slide com cover_variant escolhido (capa impactante, headline poderoso e subtítulo)
- Slide 2: introdução / contexto com dados de mercado ou histórico
- Slides intermediários: alternar entre content denso, bullet_points, data_chart com fonte, image_text, quote real, stat_highlight com número marcante
- Slide final: conclusion (síntese + call-to-action concreto)

Mantenha narrativa coesa: cada slide flui para o próximo. Densidade > superficialidade.`;

    const tools = [{
      type: "function",
      function: {
        name: "create_presentation",
        description: "Cria a estrutura completa de uma apresentação profissional com pesquisa densa e direção de arte coesa",
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
                  cover_variant: {
                    type: "string",
                    enum: ["split-hero", "typographic-bold", "full-bleed-image", "minimal-centered", "asymmetric-grid", "gradient-mesh"],
                    description: "OBRIGATÓRIO para slides title_slide. Escolha que reflita o tom do tema.",
                  },
                  animation: { type: "string", enum: ["fade", "slide-up", "slide-left", "slide-right", "zoom-in", "blur-in", "stagger-up", "reveal-mask", "rotate-in", "bounce-in"] },
                  animation_intent: {
                    type: "string",
                    enum: ["hero-impact", "narrative-build", "data-reveal", "emphasis-stat", "quote-spotlight", "section-break", "calm-fade"],
                    description: "OBRIGATÓRIO. Papel narrativo da animação — o frontend mapeia para cenário cinematográfico.",
                  },
                  headline: { type: "string" },
                  subtitle: { type: "string" },
                  body_text: { type: "string" },
                  bullets: { type: "array", items: { type: "string" } },
                  stat_value: { type: "string", description: "Para stat-highlight: o número grande (ex: '78%', '2.3M')" },
                  stat_label: { type: "string", description: "Para stat-highlight: a descrição do número, citando fonte se possível" },
                  quote_text: { type: "string" },
                  quote_author: { type: "string" },
                  speaker_notes: { type: "string" },
                  image_query: { type: "string", description: "Query MUITO específica em INGLÊS para Pexels" },
                  image_strategy: { type: "string", enum: ["pexels", "ai", "none"], description: "pexels = buscar foto real, ai = gerar com IA, none = sem imagem" },
                  ai_image_prompt: { type: "string", description: "Se image_strategy='ai', prompt detalhado em inglês" },
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
                required: ["slide_title", "slide_type", "layout_template", "animation", "animation_intent", "headline", "speaker_notes", "image_strategy"],
                additionalProperties: false,
              },
            },
          },
          required: ["slides"],
          additionalProperties: false,
        },
      },
    }];

    // Endpoint + auth + modelo dependem do provider
    const endpoint = useOpenAI
      ? "https://api.openai.com/v1/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const authKey = useOpenAI ? OPENAI_API_KEY! : LOVABLE_API_KEY!;
    // ChatGPT 5.2 (modelo mais recente disponível) para conteúdos longos/pesquisa.
    // Fallback Gemini 2.5 PRO via Lovable AI Gateway se não houver OPENAI_API_KEY.
    const model = useOpenAI ? "gpt-5.2" : "google/gemini-2.5-pro";

    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "create_presentation" } },
        max_completion_tokens: 24000,
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

    // Garantir que o primeiro slide title_slide tenha cover_variant; se não, atribui um por hash do título
    const COVERS = ["split-hero", "typographic-bold", "full-bleed-image", "minimal-centered", "asymmetric-grid", "gradient-mesh"];
    const firstTitle = parsed.slides.find((s: any) => s.slide_type === "title_slide");
    if (firstTitle && !firstTitle.cover_variant) {
      const h = (body.title || "").split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
      firstTitle.cover_variant = COVERS[h % COVERS.length];
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
