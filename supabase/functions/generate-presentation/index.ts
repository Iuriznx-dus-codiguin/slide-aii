// Generate presentation: estrutura completa com DNA narrativo,
// Círculo Narrativo (Hook→Tensão→Jornada→Prova→Clímax), multi-apresentador
// e falas opcionais. Motor híbrido: GPT-4.1 (OpenAI) primário; Gemini 2.5 Pro fallback.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Estimativas usadas para custo real vs estimado (sincronizado com src/lib/devSettings.ts)
const COSTS = {
  pexelsImage: 0,
  aiImage: 0.039,
  slideText: 0.022,
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
  persona?: "technical-authority" | "inspirational-leader" | "salesperson" | "educator";
  depthLevel?: "high-level" | "deep-dive";
  presentersCount?: number;
  presentersNames?: string[];
  includeSpeeches?: boolean;
  image_budget_mode?: "economy" | "balanced" | "premium";
  max_budget_usd?: number;
  /** Quando true (padrão), a IA prioriza a transição "dynamic" (magic move) na maioria dos slides. */
  preferDynamic?: boolean;
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

Sua missão: gerar APRESENTAÇÕES VISUAIS RICAS, COM CONTEÚDO PROFUNDO, PESQUISA DENSA, NARRATIVA EDITORIAL e DIREÇÃO DE ARTE COESA — mesmo quando o título é curto ou a descrição é vaga.

═══════════════════════════════════════════════════
PASSO 0 — ÂNCORA TEMÁTICA (CRÍTICO)
═══════════════════════════════════════════════════
ANTES de criar qualquer slide, faça internamente:
1. Identifique o ASSUNTO CENTRAL exato do título "${req.title}".
2. Defina 5-8 SUBTEMAS específicos diretamente derivados desse assunto (não genéricos).
3. TODOS os slides devem orbitar esse assunto — proibido divagar para temas tangenciais ou genéricos.
4. Se o título for curto/ambíguo, INTERPRETE da forma mais comum/útil para o público "${req.type}" e mantenha consistência absoluta do início ao fim.
5. CADA headline deve conter palavra-chave do tema OU ser uma referência direta a um dos subtemas.
6. Se em dúvida entre dois ângulos, escolha o mais ESPECÍFICO e mantenha-o.

═══════════════════════════════════════════════════
PASSO A — DIAGNÓSTICO DE DNA
═══════════════════════════════════════════════════
PERSONA: ${persona}
PROFUNDIDADE: ${depth}
APRESENTADORES (${presenters}): ${presenterList.length ? presenterList.join(", ") : "Apresentador único"}
${presenters > 1 ? `→ Crie "ÂNCORAS DE TRANSIÇÃO" entre apresentadores. Divida fala EQUITATIVAMENTE em blocos de 2-3 slides.` : ""}

═══════════════════════════════════════════════════
PASSO B — ARCO NARRATIVO FLEXÍVEL
═══════════════════════════════════════════════════
Distribua os ${req.slidesCount} slides com LIBERDADE — o arco clássico (hook → tension → journey → proof → climax) é uma REFERÊNCIA, não uma prisão. Você pode:
  • Abrir com "hook" ou direto em "journey" quando o tema pede contexto imediato.
  • Ter MÚLTIPLOS picos de "proof" (dados/casos) em vez de UM climax único.
  • Alternar tension ↔ journey várias vezes (ex: problema→solução→problema maior→solução maior).
  • Usar "climax" só quando fizer sentido narrativo — pode não haver climax explícito.
Cada slide DEVE ter narrative_act ∈ {hook, tension, journey, proof, climax} e uma referência LÓGICA ao slide anterior (causa→efeito, problema→solução, conceito→exemplo, dado→interpretação).
VARIE a sequência de narrative_act — evite padrão rígido "hook, tension, journey×N, proof, climax".

═══════════════════════════════════════════════════
PASSO C — REGRA DE OURO: TODO SLIDE É COMPLETO
═══════════════════════════════════════════════════
NENHUM slide pode ser "magro". Cada slide DEVE combinar pelo menos 3 dos elementos:
A) Headline forte (2-6 palavras)
B) Subtitle contextualizando (8-14 palavras)
C) Body_text rico (40-90 palavras quando há espaço — NÃO deixe vazio em slides de texto)
D) Bullets densos (3-5 itens, 8-16 palavras cada, com verbo forte e dado/exemplo concreto)
E) Stat_value + stat_label (quando há número impactante real)
F) Quote_text + quote_author (real, verificável)
G) Chart com dados realistas + fonte
H) Imagem (Pexels primeiro; AI só se conceito abstrato/impossível de fotografar)
I) visual_accents (lista de elementos visuais sugeridos: "orbital-rings", "dot-grid", "floating-shapes", "diagonal-lines", "corner-brackets", "data-pattern", "wave-form", "animated-blob", "pulse-grid", "particle-field", "layered-panels", "gradient-drift", "reactive-dots", "card-stack")

→ Slide com APENAS headline+subtitle = PROIBIDO. Encha com body_text + bullets ou stat ou quote.
→ Varie a combinação a cada slide — não repita o mesmo "preset" 2x seguidas.

═══════════════════════════════════════════════════
PASSO D — DENSIDADE DE TEXTO E TIPOGRAFIA
═══════════════════════════════════════════════════
- Headline: 2-6 palavras, máximo 40 caracteres. Letra GRANDE no design.
- Subtitle: 8-14 palavras, complementa o headline com ângulo específico.
- Body_text: parágrafo de 40-90 palavras quando o layout pede texto longo (centered, content, image-right/left). Use frases curtas e ritmo claro.
- Bullets: 3-5 itens densos. Cada item começa com verbo ou substantivo concreto + dado/contexto.
- APROVEITE O ESPAÇO: slides de texto puro (sem imagem) DEVEM ter body_text robusto + bullets — não deixe vazio o lado direito/esquerdo.
- Slides com imagem podem ter texto mais enxuto (subtitle + 3 bullets).

═══════════════════════════════════════════════════
PASSO E — VARIAÇÃO INTENCIONAL DE MODELOS DE PÁGINA, ACENTOS E ANIMAÇÕES
═══════════════════════════════════════════════════
- O QUE MAIS IMPORTA É A VARIEDADE DE MODELO DE PÁGINA (não de transição).
- Alterne o MODELO a cada slide. NUNCA repita o mesmo layout_template em slides consecutivos.
- Repertório de modelos e quando usar:
  * "quote" → citação em destaque, tipografia gigante, fundo imersivo (use 1-2 por apresentação).
  * "full-image" → imagem/fundo em tela cheia com texto sobreposto (momentos de impacto).
  * "image-right" / "image-left" → conceito + imagem lateral (o cavalo de batalha; alterne o lado).
  * "stat-highlight" → um número gigante + contexto curto.
  * "data-chart" → gráfico com dados e fonte.
  * "two-columns" → comparação, antes/depois, prós/contras.
  * "title-content" / "centered" → texto denso, definição, virada de seção.
  * "split-hero" → capa/abertura de bloco.
- Em uma apresentação de ${req.slidesCount} slides, use AO MENOS 5 modelos DIFERENTES e distribua-os de forma NÃO previsível (não siga um ciclo fixo A-B-C-A-B-C).
- visual_accents (1-3 itens). Use os 14 tipos disponíveis combinando com o conteúdo:
  * stat / emphasis-stat → "animated-blob", "pulse-grid", "reactive-dots"
  * data_chart / data-reveal → "dot-grid", "wave-form", "pulse-grid"
  * quote → "particle-field", "orbital-rings", "corner-brackets"
  * section_divider → "diagonal-lines"
  * conclusion → "animated-blob", "particle-field"
  * texto puro → "floating-shapes", "diagonal-lines"
  * imagem → "corner-brackets"
  * comparison / múltiplos itens → "card-stack"
  * arquitetura / estrutura em camadas → "layered-panels"
  * capa ou slide de impacto que pede fundo imersivo → "gradient-drift" (camada única de fundo)
- animation_intent ∈ {hero-impact, narrative-build, data-reveal, emphasis-stat, quote-spotlight, section-break, calm-fade} — ALTERNE: nunca repita o mesmo animation_intent em slides consecutivos.
- transition: use SEMPRE "dynamic"${req.preferDynamic === false ? ` — exceto quando o usuário desativou o magic move, aí use "fade" em todos os slides.` : ` (magic move de título/imagem-hero entre slides). Não existem outras transições — a variedade vem do MODELO da página, não do efeito de troca.`}

═══════════════════════════════════════════════════
PASSO E.1 — REGRA DE DISTRIBUIÇÃO (BALANCEAMENTO)
═══════════════════════════════════════════════════
Em uma apresentação de N slides garanta:
- AO MENOS 1 slide com layout "two-columns".
- AO MENOS 1 slide "stat-highlight" se pertinente ao tema.
- AO MENOS ${req.includeImages ? "60% dos" : "0"} slides com imagem (image-right/image-left/full-image) quando includeImages=true.
- AO MENOS 1 slide "centered" como divisória/seção.
- Pelo menos 1 capa cinematográfica com cover_variant DIFERENTE de "split-hero" e "typographic-bold".
- Varie cover_variant entre as 6 opções com base no tema/persona:
  * pitch / corporativo → split-hero ou asymmetric-grid
  * educacional / pessoal → minimal-centered ou typographic-bold
  * marketing / criativo → gradient-mesh ou full-bleed-image


═══════════════════════════════════════════════════
PASSO F — IMAGENS (PEXELS + NANO BANANA 2, TODO SLIDE COM IMAGEM)
═══════════════════════════════════════════════════
${req.includeImages ? `- REGRA DE OURO: TODO slide de conteúdo DEVE ter image_query (mesmo bullet_points, quote, data_chart) — o usuário quer variedade visual em cada tela.
- image_strategy: escolha por slide para dar VARIEDADE de estilos visuais:
  * "pexels" (~60%): foto real, para conceitos concretos/humanos/objetos.
  * "ai" (~40%): quando quiser ILUSTRAÇÃO cinematográfica, conceito abstrato, ou estilo específico (aquarela, 3D render, isometric, no-background isolate).
- image_query: query MUITO específica em INGLÊS, 3-6 palavras com substantivos visuais concretos (ex: "engineer reviewing code on dark monitor", NÃO "technology").
- ai_image_prompt: SEMPRE preencha — descrição rica em inglês com ESTILO explícito. VARIE os estilos entre slides:
  * "cinematic photo, dramatic lighting"
  * "flat vector illustration, editorial style, no background"
  * "isometric 3D render, clean background"
  * "watercolor illustration, soft palette"
  * "minimalist line art, single color accent"
  * "editorial magazine collage"
  * "3D clay render, isolated object"
  Combine estilo com o mood do slide (dados = isometric, quote = collage, hook = cinematic, conclusion = minimal).
- image_style (campo obrigatório quando image_strategy="ai"): um de {"photo","illustration","no-background","3d-render","isometric","watercolor","line-art","collage","minimal"}. VARIE — não repita o mesmo estilo em 2 slides consecutivos.
- NUNCA repita a MESMA query — varie ângulo, contexto, sujeito.
- Para títulos curtos/ambíguos: ancore a query no SUBTEMA específico do slide, não no título genérico.` : `- includeImages=false: pule image_query e compense com visual_accents mais densos.`}

REGRAS CRÍTICAS DE CONTEÚDO:
1. Idioma: ${req.language === "en" ? "INGLÊS" : req.language === "es" ? "ESPANHOL" : "PORTUGUÊS BRASILEIRO"} natural, profissional, fluido.
2. Cada slide com PROPÓSITO claro — NUNCA placeholders ou "Lorem".
3. Dados reais com fonte/ano (ex: "78% — McKinsey 2024"). Se incerto, use "estimado em".
4. Bullets ≤16 palavras, verbo forte ou substantivo concreto.
5. Quote_author = pessoa REAL verificável com cargo/contexto.
6. COESÃO: cada slide é PONTE lógica do anterior.
7. ÂNCORA TEMÁTICA: nenhum slide pode fugir do assunto central definido no Passo 0.
8. TEMA DINÂMICO E CORES (quando theme="auto"): devolva dynamic_theme com hex reais e VIVOS, derivados do assunto:
   - accent e accent2 devem ser cores SATURADAS e VIBRANTES (saturação alta, ex: #FF4D2E, #00E0A4, #FFD400, #2E7BFF, #FF2D8A), nunca pasteis lavados nem cinzas.
   - accent2 deve CONTRASTAR com accent (par complementar ou análogo distante) para permitir destaques duplos.
   - bg simples e sólido: ou muito escuro (#0A0A12 → #121826) ou muito claro (#FFFFFF → #F7F5F0). Sem fundos "meio-tom".
   - text com contraste WCAG AA mínimo 4.5:1 sobre bg.
   - Escolha a família cromática pelo SIGNIFICADO do tema (natureza=verdes vivos, finanças=azul+verde-limão, saúde=azul-ciano+coral, tecnologia=violeta+ciano elétrico, história=âmbar+vinho, esporte=laranja+azul elétrico, arte=magenta+amarelo).
9. TIPOGRAFIA: devolva font_pairing escolhendo o par tipográfico que melhor traduz o tema/persona (o usuário não escolhe fonte — a decisão é sua e deve VARIAR entre apresentações de temas diferentes).
10. Para title_slide, escolha cover_variant entre split-hero, typographic-bold, full-bleed-image, minimal-centered, asymmetric-grid, gradient-mesh.

${speeches ? `═══════════════════════════════════════════════════
PASSO G — FALAS DOS APRESENTADORES
═══════════════════════════════════════════════════
Para CADA slide preencha presenters_data com UM objeto por apresentador (${presenters}), NA ORDEM EXATA: ${presenterList.join(" → ") || "Apresentador 1"}.

- name: nome do apresentador.
- exact_speech: SCRIPT CONCISO (40-80 palavras) em primeira pessoa, 3 movimentos: (1) abertura, (2) ponto principal, (3) gancho para próximo slide. APENAS UM apresentador fala por slide; demais ficam com exact_speech="".
- transition_anchor: APENAS quando o próximo slide muda de apresentador.
- Distribua em BLOCOS de 2-3 slides — cada apresentador em ~${Math.ceil(req.slidesCount / Math.max(1, presenters))} slides.
- ${presenters > 1 ? `Crie pelo menos ${Math.min(presenters, 3)} transition_anchor explícitos.` : "Apresentador único — transition_anchor sempre vazio."}` : ""}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const t0 = Date.now();
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // ───────────── Autenticação + Entitlement (RIGOROSO) ─────────────
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

  // Verifica permissão via função SQL
  const { data: entitle, error: entErr } = await admin.rpc("can_user_generate", { _uid: userId });
  if (entErr) {
    console.error("can_user_generate err:", entErr);
    return new Response(JSON.stringify({ error: "Erro interno (E_INTERNAL_503). Tente novamente em alguns minutos." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const ent = entitle as { allowed: boolean; reason: string; plan?: string; used?: number };
  if (!ent.allowed) {
    // Bloco 9: monthly_limit_reached → 429 com mensagem explícita
    if (ent.reason === "monthly_limit_reached") {
      return new Response(JSON.stringify({
        error: "Você atingiu o limite de 20 gerações este mês. Seu limite renova no início do próximo mês.",
        reason: "monthly_limit_reached",
      }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (ent.reason === "system_error") {
      return new Response(JSON.stringify({ error: "Erro interno do sistema (E_GEN_503). Tente novamente em alguns minutos.", reason: "system_error" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (ent.reason === "no_plan") {
      return new Response(JSON.stringify({ error: "payment_required", reason: "no_plan" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Geração indisponível.", reason: ent.reason }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body: GenerateRequest = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const useOpenAI = !!OPENAI_API_KEY;
    if (!useOpenAI && !LOVABLE_API_KEY) throw new Error("Nenhuma chave de IA configurada");

    const slidesCount = Math.max(3, Math.min(15, body.slidesCount || 8));
    const isAutoTheme = body.theme === "auto";
    const presenters = Math.max(1, body.presentersCount ?? 1);
    const presenterNames = (body.presentersNames ?? []).slice(0, presenters);
    while (presenterNames.length < presenters) presenterNames.push(`Apresentador ${presenterNames.length + 1}`);

    const userPrompt = `Crie uma apresentação completa, rica em conteúdo verificável, narrativamente coesa e visualmente impressionante.

TÍTULO: ${body.title}
DESCRIÇÃO: ${body.description || "(o usuário não detalhou — interprete o título da forma mais útil para o público-alvo, defina os subtemas internamente e MANTENHA TOTAL CONSISTÊNCIA com o assunto central em TODOS os slides)"}
TIPO: ${body.type}
IDIOMA: ${body.language}
NÚMERO DE SLIDES: exatamente ${slidesCount}
INCLUIR GRÁFICOS: ${body.includeCharts ? "sim — use ao menos 1-2 gráficos (bar, line, pie, donut ou area) com dados realistas e fonte" : "não"}
INCLUIR IMAGENS: ${body.includeImages ? "sim — TODOS os slides de conteúdo devem ter image_query (Pexels primeiro) e ai_image_prompt como fallback" : "não — compense com visual_accents densos"}
${isAutoTheme ? `TEMA DINÂMICO: devolva dynamic_theme no primeiro slide refletindo "${body.title}".` : "TEMA: paleta fixa pelo usuário."}
${body.includeSpeeches ? `FALAS: ATIVADAS para ${presenters} apresentador(es): ${presenterNames.join(", ")}.` : "FALAS: desativadas."}

LEMBRETE CRÍTICO:
- TODO slide deve ser COMPLETO e DENSO (3+ elementos do checklist do Passo C).
- VARIE layout, animation_intent e visual_accents a cada slide.
- ANCORE-SE no assunto central — proibido divagar.
- Densidade de texto > superficialidade. Aproveite o espaço inteligentemente.`;

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
              description: "Paleta dinâmica baseada no tema (apenas se solicitado tema auto). Cores VIVAS e saturadas em accent/accent2.",
              properties: {
                name: { type: "string" },
                bg: { type: "string" },
                text: { type: "string" },
                accent: { type: "string" },
                accent2: { type: "string" },
                surface: { type: "string" },
              },
            },
            font_pairing: {
              type: "string",
              enum: [
                "modern-sans", "classic-serif", "bold-display", "minimal-clean", "editorial",
                "kinetic-brutal", "neo-futurist", "syne-editorial", "instrument-luxe",
                "mono-technical", "dm-editorial", "unbounded-pop", "space-editorial",
                "fraunces-warm", "archivo-poster",
              ],
              description: "OBRIGATÓRIO. Par tipográfico que traduz o tema/persona. Varie entre temas diferentes.",
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
                  visual_accents: {
                    type: "array",
                    description: "1-3 elementos decorativos/visuais. Combine com o conteúdo. Varie a cada slide.",
                    items: { type: "string", enum: ["orbital-rings", "dot-grid", "floating-shapes", "diagonal-lines", "corner-brackets", "data-pattern", "wave-form", "animated-blob", "pulse-grid", "particle-field", "layered-panels", "gradient-drift", "reactive-dots", "card-stack"] },
                  },
                  transition: {
                    type: "string",
                    enum: ["dynamic", "fade"],
                    description: "Use 'dynamic' (magic move de título/imagem-hero) por padrão; 'fade' apenas quando o usuário desativou o magic move.",
                  },
                  headline: { type: "string", description: "2-6 palavras, máx 40 chars. Contém palavra-chave do tema." },
                  subtitle: { type: "string", description: "8-14 palavras, complementa headline." },
                  body_text: { type: "string", description: "40-90 palavras quando layout pede texto longo (centered, content, columns)." },
                  bullets: { type: "array", items: { type: "string" }, description: "3-5 itens densos, 8-16 palavras cada." },
                  stat_value: { type: "string" },
                  stat_label: { type: "string" },
                  quote_text: { type: "string" },
                  quote_author: { type: "string", description: "Pessoa real verificável." },
                  speaker_notes: { type: "string", description: "Resumo curto (1-2 frases) das notas do orador." },
                  image_query: { type: "string", description: "Query MUITO específica em INGLÊS (3-6 palavras concretas) para Pexels." },
                  image_strategy: { type: "string", enum: ["pexels", "ai", "none"], description: "Default: 'pexels'. Alterne com 'ai' para variedade de estilos visuais." },
                  ai_image_prompt: { type: "string", description: "SEMPRE preencha — descrição cinematográfica com estilo explícito (fallback ou principal)." },
                  image_style: { type: "string", enum: ["photo", "illustration", "no-background", "3d-render", "isometric", "watercolor", "line-art", "collage", "minimal"], description: "Estilo visual — VARIE entre slides. Obrigatório quando image_strategy='ai'." },
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
                      ? `OBRIGATÓRIO. Um objeto por apresentador (${presenters}).`
                      : "Opcional.",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        exact_speech: { type: "string" },
                        transition_anchor: { type: "string" },
                      },
                      required: ["name"],
                    },
                  },
                },
                required: ["slide_title", "slide_type", "layout_template", "animation", "animation_intent", "narrative_act", "headline", "subtitle", "speaker_notes", "image_strategy", "visual_accents"],
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
    const model = useOpenAI ? "gpt-4.1" : "google/gemini-2.5-pro";

    const requestPayload = {
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT(body) },
        { role: "user", content: userPrompt },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "create_presentation" } },
      // gpt-4.1 aceita até 32768; mantemos abaixo do teto para evitar 400 por payload grande.
      max_completion_tokens: body.includeSpeeches ? 16384 : 12000,
    };

    let aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    if (!aiResponse.ok && useOpenAI && LOVABLE_API_KEY && ![429, 402].includes(aiResponse.status)) {
      const errBody = await aiResponse.text().catch(() => "");
      console.warn("OpenAI falhou com status", aiResponse.status, "err=", errBody.slice(0, 600), "— tentando fallback Gemini");
      aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...requestPayload, model: "google/gemini-2.5-pro" }),
      });
    }

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

    // Se veio muito menos que o pedido, tenta uma segunda passagem pelo Gemini
    // exigindo o número exato de slides. Evita cair no fallback com 1 slide só.
    if (parsed.slides.length < Math.max(3, Math.ceil(slidesCount * 0.7)) && LOVABLE_API_KEY) {
      console.warn("Contagem de slides baixa:", parsed.slides.length, "de", slidesCount, "— nova tentativa Gemini");
      try {
        const retry = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            ...requestPayload,
            model: "google/gemini-2.5-pro",
            messages: [
              { role: "system", content: SYSTEM_PROMPT(body) },
              { role: "user", content: `${userPrompt}\n\nATENÇÃO: devolva EXATAMENTE ${slidesCount} slides no array 'slides'. Nem mais, nem menos. Cada slide completo (Passo C).` },
            ],
          }),
        });
        if (retry.ok) {
          const rdata = await retry.json();
          const rcall = rdata.choices?.[0]?.message?.tool_calls?.[0];
          if (rcall) {
            try {
              const rparsed = JSON.parse(rcall.function.arguments);
              if (Array.isArray(rparsed.slides) && rparsed.slides.length > parsed.slides.length) {
                parsed = rparsed;
              }
            } catch { /* mantém parsed original */ }
          }
        }
      } catch (e) {
        console.warn("Retry Gemini falhou:", (e as Error).message);
      }
    }

    // Garante cover_variant no primeiro title_slide
    const COVERS = ["split-hero", "typographic-bold", "full-bleed-image", "minimal-centered", "asymmetric-grid", "gradient-mesh"];
    const firstTitle = parsed.slides.find((s: any) => s.slide_type === "title_slide");
    if (firstTitle && !firstTitle.cover_variant) {
      const h = (body.title || "").split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
      firstTitle.cover_variant = COVERS[h % COVERS.length];
    }

    // Garante visual_accents (fallback rotativo) e image_strategy padrão pexels.
    const ACCENT_POOL = ["floating-shapes", "diagonal-lines", "orbital-rings", "dot-grid", "corner-brackets", "wave-form", "data-pattern", "animated-blob", "pulse-grid", "particle-field", "layered-panels", "gradient-drift", "reactive-dots", "card-stack"];
    // Modo derivado do teto único quando fornecido; fallback para o enviado.
    const budgetMode = typeof body.max_budget_usd === "number"
      ? (body.max_budget_usd <= 0.15 ? "economy" : body.max_budget_usd <= 0.45 ? "balanced" : "premium")
      : (body.image_budget_mode ?? "balanced");
    const pexelsOnly = budgetMode === "economy";
    // Pool de modelos de página — usado para forçar variedade quando a IA
    // repete o mesmo layout em sequência.
    const LAYOUT_POOL = ["image-right", "two-columns", "stat-highlight", "quote", "centered", "image-left", "full-image", "title-content", "data-chart"];
    const preferDynamic = body.preferDynamic !== false;
    let lastLayout = "";
    parsed.slides = parsed.slides.map((s: any, i: number) => {
      const accents = Array.isArray(s.visual_accents) && s.visual_accents.length > 0
        ? s.visual_accents
        : [ACCENT_POOL[i % ACCENT_POOL.length], ACCENT_POOL[(i + 3) % ACCENT_POOL.length]];
      let strategy = s.image_strategy ?? (s.image_query ? "pexels" : "none");
      // Modo economia / dev override: nunca usar IA para imagens.
      if (pexelsOnly && strategy === "ai") strategy = "pexels";
      // Modelos de página: nunca dois iguais seguidos (exceto capa).
      let layout = s.layout_template || LAYOUT_POOL[i % LAYOUT_POOL.length];
      if (i > 0 && layout === lastLayout) {
        layout = LAYOUT_POOL.find((l) => l !== lastLayout && l !== layout) ?? LAYOUT_POOL[(i + 1) % LAYOUT_POOL.length];
      }
      lastLayout = layout;
      // Transições: apenas dynamic/fade — as legadas foram removidas.
      const transition = preferDynamic ? "dynamic" : "fade";
      return { ...s, visual_accents: accents, image_strategy: strategy, layout_template: layout, transition };
    });

    // Garante presenters_data normalizado quando falas ativadas
    if (body.includeSpeeches) {
      parsed.slides = parsed.slides.map((s: any) => {
        const existing = Array.isArray(s.presenters_data) ? s.presenters_data : [];
        const normalized = presenterNames.map((name, i) => {
          const found = existing.find((e: any) => e?.name === name) ?? existing[i] ?? {};
          return {
            id: crypto.randomUUID(),
            name,
            exact_speech: found.exact_speech || "",
            transition_anchor: found.transition_anchor || "",
          };
        });
        return { ...s, presenters_data: normalized };
      });
    }

    // Métricas: contar imagens reais por estratégia
    const imagesPexels = parsed.slides.filter((s: any) => s.image_strategy === "pexels").length;
    const imagesAi = parsed.slides.filter((s: any) => s.image_strategy === "ai").length;
    const textUsd = parsed.slides.length * COSTS.slideText;
    const imageUsd = imagesPexels * COSTS.pexelsImage + imagesAi * COSTS.aiImage;
    const actualCost = +(textUsd + imageUsd).toFixed(4);
    const estimatedCost = typeof body.max_budget_usd === "number" ? +body.max_budget_usd.toFixed(4) : actualCost;

    // Consome crédito single quando aplicável
    if (ent.plan === "single") {
      await admin.rpc("consume_single_credit", { _uid: userId });
    }

    // Log de sucesso para o painel de métricas Dev
    await admin.from("generation_logs").insert({
      user_id: userId,
      status: "success",
      reason: ent.reason,
      model,
      mode: budgetMode,
      slides_count: parsed.slides.length,
      images_pexels: imagesPexels,
      images_ai: imagesAi,
      estimated_cost_usd: estimatedCost,
      actual_cost_usd: actualCost,
      duration_ms: Date.now() - t0,
      metadata: { title: body.title, type: body.type, plan: ent.plan },
    });

    return new Response(JSON.stringify({
      slides: parsed.slides,
      dynamic_theme: parsed.dynamic_theme ?? null,
      font_pairing: parsed.font_pairing ?? null,
      _metrics: { actual_cost_usd: actualCost, images_pexels: imagesPexels, images_ai: imagesAi, duration_ms: Date.now() - t0 },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-presentation error:", e);
    await admin.from("generation_logs").insert({
      user_id: userId, status: "error",
      reason: e instanceof Error ? e.message.slice(0, 200) : "unknown",
      duration_ms: Date.now() - t0,
    });
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
