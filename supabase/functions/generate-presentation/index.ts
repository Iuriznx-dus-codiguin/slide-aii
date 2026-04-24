// Generate presentation: estrutura completa com DNA narrativo,
// Círculo Narrativo (Hook→Tensão→Jornada→Prova→Clímax), multi-apresentador
// e falas opcionais. Motor híbrido: GPT-5.2 (OpenAI) primário; Gemini 2.5 Pro fallback.
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
  // Fase 2.5+: DNA da apresentação
  persona?: "technical-authority" | "inspirational-leader" | "salesperson" | "educator";
  depthLevel?: "high-level" | "deep-dive";
  presentersCount?: number;
  presentersNames?: string[];
  includeSpeeches?: boolean;
}

const personaGuide = (p?: string) => {
  switch (p) {
    case "technical-authority":
      return "AUTORIDADE TÉCNICA — vocabulário preciso, dados, fatos, números, gráficos, cite fontes, foque em precisão e profundidade.";
    case "inspirational-leader":
      return "LÍDER INSPIRACIONAL — metáforas, visão, narrativa de propósito, perguntas provocativas, tom elevador.";
    case "salesperson":
      return "VENDEDOR — apresente DOR concreta do cliente, mostre o custo do problema, ofereça SOLUÇÃO clara, prove com casos, termine com CTA forte.";
    case "educator":
      return "EDUCADOR — explique conceitos do simples ao complexo, use analogias, repita pontos-chave, encerre com revisão.";
    default:
      return "EQUILIBRADO — mistura dados, narrativa e clareza didática.";
  }
};

const SYSTEM_PROMPT = (req: GenerateRequest) => {
  const presenters = Math.max(1, req.presentersCount ?? 1);
  const presenterList = (req.presentersNames ?? []).slice(0, presenters);
  const speeches = req.includeSpeeches;
  const persona = personaGuide(req.persona);
  const depth = req.depthLevel === "deep-dive"
    ? "DEEP-DIVE OPERACIONAL — vá fundo em mecânica, processos, números, exemplos detalhados."
    : "HIGH-LEVEL EXECUTIVO — síntese estratégica, sem perder densidade conceitual.";

  return `Você é um diretor criativo sênior + pesquisador + roteirista de palco, com experiência equivalente à equipe de design da Apple, Stripe, Pitch.com e à direção de TED Talks.

Sua missão: gerar APRESENTAÇÕES VISUAIS RICAS, COM CONTEÚDO PROFUNDO, PESQUISA DENSA, NARRATIVA EDITORIAL e DIREÇÃO DE ARTE COESA.

═══════════════════════════════════════════════════
PASSO A — DIAGNÓSTICO DE DNA DA APRESENTAÇÃO
═══════════════════════════════════════════════════
PERSONA DO ORADOR: ${persona}
PROFUNDIDADE: ${depth}
APRESENTADORES (${presenters}): ${presenterList.length ? presenterList.join(", ") : "Apresentador único"}
${presenters > 1 ? `→ Crie "ÂNCORAS DE TRANSIÇÃO" entre apresentadores (ex: "Agora, ${presenterList[1] ?? "[Nome]"}, explicará a parte técnica"). Divida a carga de fala de forma EQUITATIVA — alterne quem fala em cada slide.` : ""}

═══════════════════════════════════════════════════
PASSO B — ARQUITETURA DE ROTEIRO (CÍRCULO NARRATIVO)
═══════════════════════════════════════════════════
Distribua os ${req.slidesCount} slides nas 5 fases narrativas:
1. GANCHO (1-2 slides iniciais): Quebrar o padrão, prender atenção em 10s. Imagem alto impacto + frase minimalista provocativa.
2. TENSÃO (1-2 slides): Apresentar problema/oportunidade. Gráfico dinâmico ou tipografia bold em larga escala.
3. JORNADA (40-50% dos slides): Conteúdo dividido em blocos lógicos. Use section_divider como marcos.
4. PROVA (1-2 slides): Dados, depoimentos, evidências. Layouts limpos, tabelas estilizadas, bullets animados, quotes reais.
5. CLÍMAX (1 slide final): Solução + CTA concreto. Fundo escuro, texto em destaque.

Cada slide DEVE ter narrative_act ∈ {hook, tension, journey, proof, climax}.

═══════════════════════════════════════════════════
PASSO C — REFINAMENTO (PESQUISA SINTÉTICA)
═══════════════════════════════════════════════════
- ANALOGIAS VISUAIS: Tema "Cibersegurança" → "Imunidade digital", redes neurais. NÃO use clichês (cadeados).
- DADOS REAIS: Sempre cite fonte/ano (ex: "78% — McKinsey 2024"). Se não souber, sinalize ("estimado em").
- VOCABULÁRIO: ajuste pelo TIPO (${req.type}) — KPIs/EBITDA para negócios, metodologias para academia.
- MICRO-COPY: Títulos curtos (máx 5 palavras). Texto longo vai para speaker_notes ou exact_speech.
- SMART ICONS: Mantenha peso de linha consistente (não misture filled + outline).

REGRAS CRÍTICAS DE CONTEÚDO:
1. ESCREVA EM ${req.language === "en" ? "INGLÊS" : req.language === "es" ? "ESPANHOL" : "PORTUGUÊS BRASILEIRO"} natural, profissional, fluido.
2. Cada slide tem PROPÓSITO NARRATIVO claro — NUNCA placeholders ou "Lorem".
3. Use SEMPRE dados reais com fonte. Bullets ≤14 palavras, verbo forte ou substantivo concreto.
4. Cada slide traz informação NOVA — proibido repetir.
5. Quote slides citam pessoas REAIS verificáveis com cargo/contexto.

REGRAS DE DESIGN/MOTION:
6. Varie layouts. NUNCA repita layout em slides consecutivos.
7. Para title_slide, escolha cover_variant entre split-hero, typographic-bold, full-bleed-image, minimal-centered, asymmetric-grid, gradient-mesh.
8. Para CADA slide defina animation_intent: hero-impact, narrative-build, data-reveal, emphasis-stat, quote-spotlight, section-break, calm-fade.
9. Para CADA slide com imagem, sugira image_query MUITO ESPECÍFICA em INGLÊS.
10. Tema dinâmico: se tema "auto", devolva no PRIMEIRO slide um dynamic_theme com cores hex (bg, text, accent, accent2) refletindo o assunto. Mínimo WCAG AA.

${speeches ? `═══════════════════════════════════════════════════
PASSO D — FALAS E NOTAS DOS APRESENTADORES (OPCIONAL ATIVADO)
═══════════════════════════════════════════════════
Para CADA slide preencha presenters_data com UM objeto por apresentador (${presenters} no total):
- name: nome do apresentador (use a lista acima)
- technical_notes: PARÁGRAFO DENSO (60-150 palavras) com conteúdo aprofundado para o apresentador ESTUDAR sua parte. Inclua dados, contexto histórico, exemplos.
- exact_speech: SCRIPT LITERAL (40-100 palavras) — palavra por palavra do que será dito em pé. Linguagem natural, primeira pessoa, parágrafo único.
- transition_anchor: opcional. Se houver troca de apresentador a partir deste slide, escreva a frase de handoff (ex: "Agora, ${presenterList[0] ?? "[Nome]"}, vai mostrar os números").

${presenters > 1 ? `Distribua os slides EQUITATIVAMENTE entre os ${presenters} apresentadores. Cada slide pode ter apenas UM apresentador como "voz principal" — coloque os outros com fala vazia naquele slide ou repita o último apresentador para continuidade. Crie pelo menos 2 transições explícitas ao longo da apresentação.` : ""}` : ""}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: GenerateRequest = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const useOpenAI = !!OPENAI_API_KEY;
    if (!useOpenAI && !LOVABLE_API_KEY) throw new Error("Nenhuma chave de IA configurada");

    const slidesCount = Math.max(3, Math.min(12, body.slidesCount || 8));
    const isAutoTheme = body.theme === "auto";
    const presenters = Math.max(1, body.presentersCount ?? 1);
    const presenterNames = (body.presentersNames ?? []).slice(0, presenters);
    while (presenterNames.length < presenters) presenterNames.push(`Apresentador ${presenterNames.length + 1}`);

    const userPrompt = `Crie uma apresentação completa, rica em conteúdo verificável, narrativamente coesa e visualmente impressionante.

TÍTULO: ${body.title}
DESCRIÇÃO: ${body.description || "(o usuário não detalhou — pesquise mentalmente o assunto e decida o que abordar de forma clara, útil e densa)"}
TIPO: ${body.type}
IDIOMA: ${body.language}
NÚMERO DE SLIDES: exatamente ${slidesCount}
INCLUIR GRÁFICOS: ${body.includeCharts ? "sim — use ao menos 1 gráfico relevante (bar, line, pie, donut ou area) com dados realistas e fonte mencionada" : "não"}
INCLUIR IMAGENS: ${body.includeImages ? "sim — TODOS os slides de conteúdo devem ter image_query específica em inglês" : "apenas se essencial"}
${isAutoTheme ? `TEMA DINÂMICO: devolva dynamic_theme no primeiro slide com cores hex que reflitam visualmente "${body.title}".` : "TEMA: paleta pré-definida pelo usuário (não preencher dynamic_theme)."}
${body.includeSpeeches ? `FALAS: ATIVADAS. Preencha presenters_data em CADA slide para ${presenters} apresentador(es): ${presenterNames.join(", ")}.` : "FALAS: desativadas — não preencha presenters_data."}

Mantenha narrativa coesa seguindo o Círculo Narrativo (Gancho→Tensão→Jornada→Prova→Clímax). Densidade > superficialidade.`;

    const tools = [{
      type: "function",
      function: {
        name: "create_presentation",
        description: "Cria apresentação profissional com DNA narrativo, multi-apresentador opcional e direção de arte coesa",
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
                    description: "OBRIGATÓRIO para slides title_slide.",
                  },
                  animation: { type: "string", enum: ["fade", "slide-up", "slide-left", "slide-right", "zoom-in", "blur-in", "stagger-up", "reveal-mask", "rotate-in", "bounce-in"] },
                  animation_intent: {
                    type: "string",
                    enum: ["hero-impact", "narrative-build", "data-reveal", "emphasis-stat", "quote-spotlight", "section-break", "calm-fade"],
                    description: "OBRIGATÓRIO. Papel narrativo da animação.",
                  },
                  narrative_act: {
                    type: "string",
                    enum: ["hook", "tension", "journey", "proof", "climax"],
                    description: "OBRIGATÓRIO. Posição no Círculo Narrativo.",
                  },
                  headline: { type: "string", description: "Curto e impactante. Máx 5 palavras quando possível." },
                  subtitle: { type: "string" },
                  body_text: { type: "string" },
                  bullets: { type: "array", items: { type: "string" } },
                  stat_value: { type: "string" },
                  stat_label: { type: "string" },
                  quote_text: { type: "string" },
                  quote_author: { type: "string" },
                  speaker_notes: { type: "string", description: "Notas gerais do orador (resumo curto, 1-2 frases)." },
                  image_query: { type: "string", description: "Query MUITO específica em INGLÊS para Pexels" },
                  image_strategy: { type: "string", enum: ["pexels", "ai", "none"] },
                  ai_image_prompt: { type: "string" },
                  chart: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["bar", "line", "pie", "donut", "area"] },
                      labels: { type: "array", items: { type: "string" } },
                      values: { type: "array", items: { type: "number" } },
                      title: { type: "string" },
                    },
                  },
                  presenters_data: {
                    type: "array",
                    description: body.includeSpeeches
                      ? `OBRIGATÓRIO se falas estiverem ativadas. Um objeto por apresentador (${presenters} no total).`
                      : "Opcional. Só preencher se falas ativadas.",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        technical_notes: { type: "string", description: "60-150 palavras — conteúdo aprofundado para estudo." },
                        exact_speech: { type: "string", description: "40-100 palavras — script literal em primeira pessoa." },
                        transition_anchor: { type: "string", description: "Frase de handoff (ex: 'Agora, Ana mostrará...')" },
                      },
                      required: ["name"],
                    },
                  },
                },
                required: ["slide_title", "slide_type", "layout_template", "animation", "animation_intent", "narrative_act", "headline", "speaker_notes", "image_strategy"],
                additionalProperties: false,
              },
            },
          },
          required: ["slides"],
          additionalProperties: false,
        },
      },
    }];

    const endpoint = useOpenAI
      ? "https://api.openai.com/v1/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const authKey = useOpenAI ? OPENAI_API_KEY! : LOVABLE_API_KEY!;
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
          { role: "system", content: SYSTEM_PROMPT(body) },
          { role: "user", content: userPrompt },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "create_presentation" } },
        // Falas dobram o tamanho do payload — aumenta budget quando ativadas.
        max_completion_tokens: body.includeSpeeches ? 32000 : 24000,
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
      return new Response(JSON.stringify({ error: "A IA não retornou estrutura. Tente reduzir o número de slides ou desativar imagens/falas." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let parsed: any;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("generate-presentation: tool args JSON parse failed (likely truncation). finish=", finishReason, "len=", toolCall.function.arguments?.length);
      return new Response(JSON.stringify({ error: "Resposta da IA truncada. Reduza o número de slides ou desative as falas." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
      return new Response(JSON.stringify({ error: "A IA não gerou nenhum slide. Tente reformular o título." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Garante cover_variant no primeiro title_slide
    const COVERS = ["split-hero", "typographic-bold", "full-bleed-image", "minimal-centered", "asymmetric-grid", "gradient-mesh"];
    const firstTitle = parsed.slides.find((s: any) => s.slide_type === "title_slide");
    if (firstTitle && !firstTitle.cover_variant) {
      const h = (body.title || "").split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
      firstTitle.cover_variant = COVERS[h % COVERS.length];
    }

    // Garante presenters_data normalizado quando falas ativadas
    if (body.includeSpeeches) {
      parsed.slides = parsed.slides.map((s: any) => {
        const existing = Array.isArray(s.presenters_data) ? s.presenters_data : [];
        const normalized = presenterNames.map((name, i) => {
          const found = existing.find((e: any) => e?.name === name) ?? existing[i] ?? {};
          return {
            id: crypto.randomUUID(),
            name,
            technical_notes: found.technical_notes || "",
            exact_speech: found.exact_speech || "",
            transition_anchor: found.transition_anchor || "",
          };
        });
        return { ...s, presenters_data: normalized };
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
