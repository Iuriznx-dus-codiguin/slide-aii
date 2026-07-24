import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Loader2, ArrowLeft, Send, ChevronLeft, ChevronRight, Edit3, Save, Wand2, Image as ImageIcon, MessageSquare, FileDown } from "lucide-react";
import { exportPresentationToPdf } from "@/lib/exportPdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDeveloperRole } from "@/hooks/useDeveloperRole";
import { useEntitlement } from "@/hooks/useEntitlement";
import { estimateGenerationCost, modeFromBudget } from "@/lib/devSettings";
import { useDevSettings } from "@/hooks/useDevSettings";
import { toast } from "sonner";
import { generateSlug, THEMES, FONTS, autoFontForContext, type ThemeColors } from "@/lib/slugify";
import { TEMPLATES } from "@/lib/templates";
import { SlideRendererWithChoreo } from "@/components/SlideRendererWithChoreo";
import { SlideStage } from "@/components/SlideStage";
import { type SlideContent } from "@/components/SlideRenderer";
import { PaymentGate } from "@/components/PaymentGate";
import { reasonMessage } from "@/hooks/useEntitlement";
import { Lock, CreditCard } from "lucide-react";

// Cota gratuita (escondida do usuário pago — pagos veem o teto real do plano)
const FREE_GENERATIONS_LIMIT = 1;

const STEPS = [
  "Pesquisando o tema...",
  "Estruturando narrativa cinematográfica...",
  "Definindo direção de arte e paleta...",
  "Selecionando tipografia impactante...",
  "Buscando e gerando imagens (Nano Banana 2)...",
  "Coreografando transições e magic move...",
  "Renderizando slides finais...",
];

interface AISlide {
  slide_title: string;
  slide_type: string;
  layout_template: string;
  animation: string;
  headline?: string;
  subtitle?: string;
  body_text?: string;
  bullets?: string[];
  stat_value?: string;
  stat_label?: string;
  quote_text?: string;
  quote_author?: string;
  speaker_notes?: string;
  image_query?: string;
  image_strategy?: "pexels" | "ai" | "none";
  ai_image_prompt?: string;
  image_url?: string | null;
  chart?: { type: string; labels: string[]; values: number[]; title?: string };
  cover_variant?: "split-hero" | "typographic-bold" | "full-bleed-image" | "minimal-centered" | "asymmetric-grid" | "gradient-mesh";
  visual_accents?: ("orbital-rings" | "dot-grid" | "floating-shapes" | "diagonal-lines" | "corner-brackets" | "data-pattern" | "wave-form")[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const Generate = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDeveloper } = useDeveloperRole();
  const ent = useEntitlement();
  const [searchParams] = useSearchParams();
  const [phase, setPhase] = useState<"form" | "loading" | "preview">("form");
  const [stepIdx, setStepIdx] = useState(0);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const devSettings = useDevSettings();
  // Habilita gerar quando o usuário possui crédito/assinatura ativa ou é dev.
  const canGenerate = ent.allowed;

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slidesCount, setSlidesCount] = useState(8);
  const [type, setType] = useState("Escolar");
  const [language, setLanguage] = useState("pt-BR");
  const [theme, setTheme] = useState("auto");
  // A fonte agora é escolhida automaticamente com base em tipo+tema+título
  // (o form deixou de expor esse controle — reduz atrito e maximiza impacto
  // visual por assunto).
  const fontStyle = autoFontForContext(type, theme, title);
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeImages, setIncludeImages] = useState(true);
  const [preferDynamic, setPreferDynamic] = useState(true);
  // DNA narrativo (Fase 2.5+)
  const [persona, setPersona] = useState<string>("educator");
  // Profundidade fixada em "high-level" — deixou de ser exposta no form
  // (o produto escolhe a versão mais legível por padrão).
  const depthLevel = "high-level";
  const [presentersCount, setPresentersCount] = useState(1);
  const [presentersNames, setPresentersNames] = useState<string[]>(["Apresentador 1"]);
  const [includeSpeeches, setIncludeSpeeches] = useState(false);

  // Preview state
  const [slides, setSlides] = useState<AISlide[]>([]);
  const [dynamicTheme, setDynamicTheme] = useState<Partial<ThemeColors> | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  // Direção de navegação para o SlideStage (mesmo papel do prevIdxRef no
  // SlideViewer/Editor).
  const prevSlideIdxRef = useRef(0);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { document.title = "Criar apresentação — SlideAI"; }, []);

  // Pré-preencher a partir de ?template=ID
  useEffect(() => {
    const tplId = searchParams.get("template");
    if (!tplId) return;
    const tpl = TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    setTitle(tpl.seed.title);
    setDescription(tpl.seed.description);
    setSlidesCount(Math.min(15, tpl.seed.slidesCount));
    setType(tpl.seed.type);
    setTheme(tpl.seed.theme);
    // fontStyle é derivado do contexto — templates não sobrescrevem mais.
    setIncludeCharts(tpl.seed.includeCharts);
    setIncludeImages(tpl.seed.includeImages);
    toast.success(`Template "${tpl.title}" carregado — ajuste e gere!`);
  }, [searchParams]);

  // Steps são controlados manualmente nos pontos reais do fluxo (ver handleGenerate).

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  // Bloco 10: paralelo com concorrência máx. 5.
  const resolveImages = async (
    slidesList: AISlide[],
    onProgress?: (done: number, total: number) => void,
  ) => {
    const usedUrls = new Set<string>();
    const usedQueries = new Set<string>();
    const result: AISlide[] = new Array(slidesList.length);

    const reservedQueries: (string | null)[] = slidesList.map((s, i) => {
      if (!s.image_strategy || s.image_strategy === "none" || !s.image_query) return null;
      let q = s.image_query;
      if (usedQueries.has(q.toLowerCase())) {
        const suffixes = ["wide angle", "close up", "different perspective", "alternative", "minimal", "cinematic"];
        q = `${q} ${suffixes[i % suffixes.length]}`;
      }
      usedQueries.add(q.toLowerCase());
      return q;
    });

    let done = 0;
    const total = reservedQueries.filter(Boolean).length;
    const snapshotAvoid = () => Array.from(usedUrls);

    const fetchOne = async (i: number) => {
      const s = slidesList[i];
      const q = reservedQueries[i];
      if (!q) { result[i] = s; return; }
      try {
        const { data } = await supabase.functions.invoke("fetch-image", {
          body: { query: q, ai_prompt: s.ai_image_prompt, strategy: s.image_strategy, orientation: "landscape", avoid_urls: snapshotAvoid() },
        });
        let url = data?.url ?? null;
        if (url && usedUrls.has(url)) url = null;
        if (url) usedUrls.add(url);
        result[i] = { ...s, image_url: url };
      } catch (e) {
        console.warn("Image fetch failed", e);
        result[i] = s;
      } finally {
        done += 1;
        onProgress?.(done, total);
      }
    };

    const CONCURRENCY = 5;
    const queue = slidesList.map((_, i) => i);
    const workers: Promise<void>[] = [];
    for (let w = 0; w < Math.min(CONCURRENCY, queue.length); w++) {
      workers.push((async () => {
        while (queue.length > 0) {
          const idx = queue.shift();
          if (idx === undefined) return;
          await fetchOne(idx);
        }
      })());
    }
    await Promise.all(workers);
    return result;
  };

  const handleGenerate = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!title.trim()) { toast.error("Informe o título da apresentação"); return; }
    await ent.refresh();
    if (!ent.allowed && !isDeveloper) {
      if (ent.reason === "monthly_limit_reached") {
        toast.error(reasonMessage("monthly_limit_reached"));
        return;
      }
      if (ent.reason === "system_error") {
        toast.error(reasonMessage("system_error"));
        return;
      }
      setShowPayment(true);
      return;
    }

    setPhase("loading");
    setStepIdx(0);

    try {
      const { data, error } = await supabase.functions.invoke("generate-presentation", {
        body: {
          title, description, slidesCount, type, language, theme, fontStyle,
          includeCharts, includeImages,
          persona, depthLevel, presentersCount, presentersNames, includeSpeeches,
          preferDynamic,
          image_budget_mode: modeFromBudget(devSettings.maxBudgetUsd),
          max_budget_usd: devSettings.maxBudgetUsd,
        },
      });

      if (error) throw error;
      if (data?.error) {
        if (data.reason === "monthly_limit_reached") {
          toast.error(reasonMessage("monthly_limit_reached"));
          setPhase("form");
          return;
        }
        throw new Error(data.error);
      }
      if (!data?.slides?.length) throw new Error("Nenhum slide gerado");

      setStepIdx(2);
      const withImages = includeImages
        ? await resolveImages(data.slides, (done, total) => {
            if (total > 0) {
              // mapeia progresso de imagens para o intervalo 2..4 dos STEPS
              const pct = done / total;
              setStepIdx(2 + Math.round(pct * 2));
            }
          })
        : data.slides;
      setStepIdx(4);

      const dyn = data.dynamic_theme ?? null;
      setDynamicTheme(dyn);
      setSlides(withImages);
      setStepIdx(STEPS.length - 1);
      setCurrentSlide(0);
      // Após a geração, pula o preview com chat e vai direto pro editor manual,
      // onde o toggle "Slide Dinâmico (magic move)" e demais controles estão disponíveis.
      await persistAndOpenWith("edit", withImages, dyn);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao gerar. Tente reduzir o número de slides.");
      setPhase("form");
    }
  };

  const handleChat = async () => {
    const instruction = chatInput.trim();
    if (!instruction || isEditing) return;
    setChatInput("");
    setChat((c) => [...c, { role: "user", content: instruction }]);
    setIsEditing(true);

    try {
      const { data, error } = await supabase.functions.invoke("chat-editor", {
        body: { slides, dynamic_theme: dynamicTheme, instruction },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Detect slides whose image_query changed (or whose image_url was wiped) — re-fetch
      const newSlides: AISlide[] = data.slides;
      const merged = await Promise.all(newSlides.map(async (newS, i) => {
        const oldS = slides[i];
        const queryChanged = oldS?.image_query !== newS.image_query;
        const stratChanged = oldS?.image_strategy !== newS.image_strategy;
        const needsRefresh = (queryChanged || stratChanged) && newS.image_strategy && newS.image_strategy !== "none" && newS.image_query;
        if (needsRefresh) {
          try {
            const { data: imgData } = await supabase.functions.invoke("fetch-image", {
              body: { query: newS.image_query, ai_prompt: newS.ai_image_prompt, strategy: newS.image_strategy, orientation: "landscape" },
            });
            return { ...newS, image_url: imgData?.url ?? null };
          } catch { return newS; }
        }
        return { ...newS, image_url: newS.image_url ?? oldS?.image_url ?? null };
      }));

      setSlides(merged);
      if (data.dynamic_theme) setDynamicTheme(data.dynamic_theme);
      setChat((c) => [...c, { role: "assistant", content: data.assistant_message || "Pronto, atualizei!" }]);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao processar edição");
      setChat((c) => [...c, { role: "assistant", content: "Não consegui aplicar essa mudança. Tenta reformular?" }]);
    } finally {
      setIsEditing(false);
    }
  };

  const persistAndOpenWith = async (
    mode: "view" | "edit",
    slidesArg: AISlide[],
    dynArg: Partial<ThemeColors> | null,
  ) => {
    if (!user || !slidesArg.length) return;
    setSaving(true);
    try {
      const slug = generateSlug(title);
      const { data: pres, error: pErr } = await supabase.from("presentations").insert({
        user_id: user.id, title, description, type, language, theme, font_style: fontStyle,
        slug, slides_count: slidesArg.length, is_paid: true, is_published: true,
        persona,
        depth_level: depthLevel,
        presenters_count: presentersCount,
        presenters_names: presentersNames,
        include_speeches: includeSpeeches,
        // Bloco 12: tema dinâmico vive no nível da apresentação
        dynamic_theme: dynArg ?? null,
      } as any).select().single();
      if (pErr) throw pErr;

      const slidesToInsert = slidesArg.map((s, idx) => ({
        presentation_id: pres.id,
        position: idx,
        slide_type: s.slide_type,
        layout_template: s.layout_template,
        speaker_notes: s.speaker_notes,
        animation_transition: s.animation || "fade",
        presenters_data: (s as any).presenters_data ?? [],
        content: {
          headline: s.headline, subtitle: s.subtitle, body_text: s.body_text,
          bullets: s.bullets, stat_value: s.stat_value, stat_label: s.stat_label,
          quote_text: s.quote_text, quote_author: s.quote_author,
          image_query: s.image_query, image_strategy: s.image_strategy,
          image_url: s.image_url, ai_image_prompt: s.ai_image_prompt,
          chart: s.chart, animation: s.animation, cover_variant: s.cover_variant,
          visual_accents: (s as any).visual_accents,
          narrative_act: (s as any).narrative_act,
          animation_intent: (s as any).animation_intent,
          transition: (s as any).transition,
        },
      })) as any;
      const { error: sErr } = await supabase.from("slides").insert(slidesToInsert);
      if (sErr) {
        await supabase.from("presentations").delete().eq("id", pres.id);
        throw sErr;
      }

      // Incremento atômico via RPC — evita perder contagem quando o usuário
      // gera mais de uma apresentação em sucessão rápida (o padrão anterior
      // lia generations_count e gravava o valor calculado em duas chamadas
      // separadas, o que perde incrementos sob concorrência).
      const { error: incErr } = await supabase.rpc("increment_own_generations_count");
      if (incErr) console.error("increment_own_generations_count falhou:", incErr);

      toast.success("Apresentação criada! Abrindo editor…");
      navigate(mode === "view" ? `/slides/${slug}` : `/editor/${slug}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const persistAndOpen = (mode: "view" | "edit") => persistAndOpenWith(mode, slides, dynamicTheme);

  // ───────────────────────── PREVIEW PHASE (chat + slide) ─────────────────────────
  if (phase === "preview" && slides.length > 0) {
    const currentContent: SlideContent = {
      ...slides[currentSlide],
      animation: slides[currentSlide].animation,
    } as SlideContent;
    const slideForRender = {
      slide_type: slides[currentSlide].slide_type,
      layout_template: slides[currentSlide].layout_template,
      content: currentContent,
    };

    return (
      <div className="h-screen flex flex-col bg-background">
        <header className="border-b border-border flex-shrink-0">
          <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-3">
            <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Dashboard</span>
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-display font-bold truncate">{title}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm"
                onClick={async () => {
                  const t = toast.loading("Renderizando PDF (0%)…");
                  try {
                    const rows = slides.map((s, idx) => ({
                      position: idx,
                      slide_type: s.slide_type,
                      layout_template: s.layout_template,
                      content: {
                        ...s,
                        dynamic_theme: idx === 0 ? dynamicTheme : undefined,
                      },
                    }));
                    await exportPresentationToPdf({
                      title, themeId: theme, fontId: fontStyle, slides: rows as any,
                      dynamicTheme,
                      onProgress: (cur, total) => {
                        const pct = Math.round((cur / total) * 100);
                        toast.loading(`Renderizando PDF (${pct}%)…`, { id: t });
                      },
                    });
                    toast.success("PDF gerado!", { id: t });
                  } catch (e: any) {
                    console.error(e);
                    toast.error(e.message || "Erro ao exportar PDF", { id: t });
                  }
                }}
                disabled={saving}
              >
                <FileDown className="h-4 w-4" /> <span className="hidden sm:inline">PDF</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => persistAndOpen("edit")} disabled={saving}>
                <Edit3 className="h-4 w-4" /> <span className="hidden sm:inline">Editar manualmente</span>
              </Button>
              <Button variant="hero" size="sm" onClick={() => persistAndOpen("view")} disabled={saving}>
                <Save className="h-4 w-4" /> Salvar e abrir
              </Button>
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Chat panel */}
          <aside className="lg:w-[380px] xl:w-[420px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-border flex flex-col bg-card/30 max-h-[40vh] lg:max-h-none">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-shrink-0">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Assistente IA</span>
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {chat.map((m, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                      m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    }`}>
                      {m.content}
                    </div>
                  </motion.div>
                ))}
                {isEditing && (
                  <div className="flex justify-start">
                    <div className="bg-muted px-3 py-2 rounded-2xl text-sm flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" /> Aplicando...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>
            <div className="p-3 border-t border-border flex-shrink-0">
              <div className="flex gap-2">
                <Textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChat(); } }}
                  placeholder="Ex: deixa o slide 3 mais visual"
                  rows={2}
                  className="resize-none text-sm"
                  disabled={isEditing}
                />
                <Button size="icon" variant="hero" onClick={handleChat} disabled={isEditing || !chatInput.trim()} className="self-end h-10 w-10">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {["Mais visual", "Tom mais formal", "Resumir tudo", "Adicionar gráfico"].map((q) => (
                  <button key={q} onClick={() => setChatInput(q)} disabled={isEditing}
                    className="text-[11px] px-2 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Preview panel */}
          <main className="flex-1 flex flex-col bg-muted/20 overflow-hidden min-h-0">
            <div className="flex-1 flex items-center justify-center p-3 md:p-6 min-h-0 overflow-hidden">
              <div className="w-full max-w-[1400px] aspect-video relative shadow-elegant rounded-2xl overflow-hidden bg-black">
                {/*
                  ANTES: fade genérico de opacidade (0.25s), sem nenhuma
                  relação com a transição/coreografia que a apresentação
                  realmente terá no SlideViewer — o usuário revisava a
                  geração "às cegas" quanto à animação. Agora usa o MESMO
                  SlideStage do Editor/SlideViewer.
                */}
                <SlideStage
                  slide={slideForRender}
                  themeId={theme}
                  fontId={fontStyle}
                  dynamicTheme={dynamicTheme}
                  idx={currentSlide}
                  prevIdxRef={prevSlideIdxRef}
                  layoutGroupId="generate-preview"
                />
              </div>
            </div>
            {/* Slide thumbnails */}
            <div className="border-t border-border bg-card/40 px-3 py-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setCurrentSlide((i) => Math.max(0, i - 1))} disabled={currentSlide === 0}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <ScrollArea className="flex-1">
                  <div className="flex gap-2 pb-1">
                    {slides.map((s, i) => (
                      <button key={i} onClick={() => setCurrentSlide(i)}
                        className={`flex-shrink-0 w-28 aspect-video rounded-lg border-2 transition-all overflow-hidden relative ${
                          i === currentSlide ? "border-primary shadow-glow" : "border-border hover:border-muted-foreground/40"
                        }`}>
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="origin-top-left scale-[0.146] w-[800px] h-[450px]">
                            <SlideRendererWithChoreo
                              slide={{ slide_type: s.slide_type, layout_template: s.layout_template, content: s as any }}
                              themeId={theme} fontId={fontStyle} dynamicTheme={dynamicTheme} index={i} noAnimate
                            />
                          </div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 text-center">
                          {i + 1}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setCurrentSlide((i) => Math.min(slides.length - 1, i + 1))} disabled={currentSlide === slides.length - 1}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ───────────────────────── LOADING PHASE ─────────────────────────
  if (phase === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background relative">
        <div className="absolute inset-0 bg-gradient-glow opacity-30 pointer-events-none" />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative max-w-md w-full">
          <div className="text-center mb-8">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
              className="inline-flex items-center justify-center h-20 w-20 rounded-3xl bg-gradient-primary shadow-glow mb-6">
              <Sparkles className="h-10 w-10 text-primary-foreground" />
            </motion.div>
            <h2 className="font-display text-3xl font-bold">Criando sua apresentação</h2>
            <p className="text-muted-foreground mt-2">Pesquisando, escrevendo e ilustrando em segundos...</p>
          </div>
          <div className="space-y-2">
            {STEPS.map((s, i) => (
              <motion.div key={s} initial={{ opacity: 0.3 }} animate={{ opacity: i <= stepIdx ? 1 : 0.4 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${
                  i < stepIdx ? "bg-primary text-primary-foreground" : i === stepIdx ? "bg-primary/20" : "bg-muted"
                }`}>
                  {i < stepIdx ? "✓" : i === stepIdx ? <Loader2 className="h-3 w-3 animate-spin text-primary" /> : ""}
                </div>
                <span className="text-sm">{s}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // ───────────────────────── FORM PHASE ─────────────────────────
  return (
    <div className="min-h-screen bg-background relative">
      <div className="absolute inset-0 bg-gradient-glow opacity-30 pointer-events-none" />

      <header className="relative border-b border-border">
        <div className="container mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Dashboard</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-primary flex items-center justify-center"><Sparkles className="h-4 w-4 text-primary-foreground" /></div>
            <span className="font-display font-bold">SlideAI</span>
          </div>
        </div>
      </header>

      <main className="relative container mx-auto px-4 md:px-6 py-8 md:py-12 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8 md:mb-10">
            <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 uppercase tracking-wider">Gerador IA</div>
            <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight">Crie sua <span className="text-gradient">apresentação</span></h1>
            <p className="mt-3 text-sm md:text-base text-muted-foreground">Descreva o tema. A IA escreve, ilustra e desenha — você refina via chat.</p>
          </div>

          {!canGenerate && !ent.loading && (
            <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-4 md:p-5 flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <CreditCard className="h-4 w-4 text-primary" />
              </div>
              <div className="text-sm flex-1">
                <p className="font-semibold">Configure abaixo e escolha um plano para gerar</p>
                <p className="text-muted-foreground mt-1">
                  Defina o tema, slides e estilo. O pagamento acontece após a configuração — a geração inicia automaticamente assim que o pagamento for confirmado.
                </p>
              </div>
            </div>
          )}

          {canGenerate && devSettings.showCostOverlay && (() => {
            const est = estimateGenerationCost(slidesCount, includeImages, devSettings.maxBudgetUsd);
            const overBudget = est.totalUsd > devSettings.maxBudgetUsd;
            return (
              <div className={`mb-6 rounded-2xl border p-3 md:p-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono ${overBudget ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/30"}`}>
                <span className="uppercase tracking-wider text-muted-foreground">Dev · estimativa</span>
                <span>${est.totalUsd.toFixed(3)}</span>
                <span className="text-muted-foreground">~{Math.round(est.seconds)}s</span>
                <span className="text-muted-foreground">Pexels {est.imagesPexels} · IA {est.imagesAi}</span>
                <span className="text-muted-foreground">modo: {est.mode}</span>
                <span className="text-muted-foreground">teto: ${devSettings.maxBudgetUsd.toFixed(2)}</span>
                {overBudget && <span className="text-destructive font-semibold">⚠ acima do teto</span>}
              </div>
            );
          })()}

          <div className="bg-card border border-border rounded-3xl p-5 md:p-8 shadow-elegant space-y-5 md:space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Título / Tema *</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: História da Espanha medieval" maxLength={150} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc">Descrição <span className="text-primary text-xs font-semibold">(recomendado)</span></Label>
              <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o ângulo, público-alvo, tom desejado — quanto mais contexto, mais rica a apresentação." rows={3} maxLength={1000} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Número de slides</Label>
                <span className="text-sm font-semibold text-primary">{slidesCount}</span>
              </div>
              <Slider value={[slidesCount]} onValueChange={([v]) => setSlidesCount(v)} min={3} max={15} step={1} />
              <p className="text-xs text-muted-foreground">De 3 a 15 slides — recomendado entre 6 e 12 para máxima coesão narrativa.</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Acadêmico", "Escolar", "Corporativo", "Marketing", "Criativo", "Científico", "Pitch de negócios"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Idioma</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt-BR">Português</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Tema visual</Label>
                {theme === "auto" && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-primary font-medium">
                    <Wand2 className="h-3 w-3" /> A IA escolherá as cores
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {Object.entries(THEMES).map(([id, t]) => (
                  <button key={id} type="button" onClick={() => setTheme(id)}
                    className={`aspect-square rounded-xl border-2 transition-all relative overflow-hidden ${theme === id ? "border-primary scale-105 shadow-glow" : "border-border hover:border-muted-foreground/40"}`}
                    style={ id === "auto" ? { background: "conic-gradient(from 0deg, #ff5e5b, #f9c74f, #43aa8b, #277da1, #9d4edd, #ff5e5b)" } : { background: `linear-gradient(135deg, ${t.bg} 50%, ${t.accent} 50%)` }}
                    title={t.name}>
                    {id === "auto" && <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-white drop-shadow" />}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{THEMES[theme]?.name}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm">Gráficos & dados</div>
                  <div className="text-[11px] text-muted-foreground">A IA cria visualizações</div>
                </div>
                <Switch checked={includeCharts} onCheckedChange={setIncludeCharts} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm">Imagens reais</div>
                  <div className="text-[11px] text-muted-foreground">Pexels + Nano Banana 2</div>
                </div>
                <Switch checked={includeImages} onCheckedChange={setIncludeImages} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-primary/40 bg-primary/5 p-3 sm:col-span-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> Slide Dinâmico (magic move)
                  </div>
                  <div className="text-[11px] text-muted-foreground">Título e imagem-hero migram entre slides — em vez de troca abrupta.</div>
                </div>
                <Switch checked={preferDynamic} onCheckedChange={setPreferDynamic} />
              </div>
            </div>

            {/* DNA narrativo (Fase 2.5) — profundidade fica implícita ("high-level") */}
            <div className="pt-2 border-t border-border space-y-2">
              <Label>Persona do orador</Label>
              <Select value={persona} onValueChange={setPersona}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="educator">Educador (didático)</SelectItem>
                  <SelectItem value="technical-authority">Autoridade técnica</SelectItem>
                  <SelectItem value="inspirational-leader">Líder inspiracional</SelectItem>
                  <SelectItem value="salesperson">Vendedor (dor→solução)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Apresentadores</Label>
                <span className="text-sm font-semibold text-primary">{presentersCount}</span>
              </div>
              <Slider value={[presentersCount]} onValueChange={([v]) => {
                setPresentersCount(v);
                setPresentersNames((prev) => {
                  const next = [...prev];
                  while (next.length < v) next.push(`Apresentador ${next.length + 1}`);
                  return next.slice(0, v);
                });
              }} min={1} max={8} step={1} />
              {presentersCount > 1 && (
                <div className="grid sm:grid-cols-2 gap-2">
                  {Array.from({ length: presentersCount }).map((_, i) => (
                    <Input key={i} value={presentersNames[i] ?? ""} placeholder={`Nome ${i + 1}`}
                      onChange={(e) => setPresentersNames((prev) => { const n = [...prev]; n[i] = e.target.value; return n; })} />
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm">Gerar falas dos apresentadores</div>
                  <div className="text-[11px] text-muted-foreground">Script conciso (40-80 palavras) por slide, distribuído em blocos</div>
                </div>
                <Switch checked={includeSpeeches} onCheckedChange={setIncludeSpeeches} />
              </div>
            </div>

            <Button variant="hero" size="xl" className="w-full" onClick={handleGenerate} disabled={ent.loading}>
              <Sparkles className="h-4 w-4" /> {canGenerate ? "Gerar apresentação" : "Continuar para pagamento"}
            </Button>
          </div>
        </motion.div>
      </main>

      {/* Modal de limite (apenas free) — escondido para usuários pagos */}
      {showLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowLimitModal(false)}>
          <div className="bg-card border border-border rounded-3xl p-8 max-w-md w-full shadow-elegant" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-primary mx-auto mb-4">
              <Sparkles className="h-7 w-7 text-primary-foreground" />
            </div>
            <h3 className="font-display text-2xl font-bold text-center">Faça upgrade para continuar</h3>
            <p className="text-center text-muted-foreground mt-2 text-sm">
              Você atingiu o limite de testes gratuitos. Assine um plano PRO ou MAX para gerar apresentações completas.
            </p>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setShowLimitModal(false)}>Agora não</Button>
              <Button variant="hero" className="flex-1" onClick={() => navigate("/#pricing")}>Ver planos</Button>
            </div>
          </div>
        </div>
      )}

      <PaymentGate
        open={showPayment}
        onClose={() => setShowPayment(false)}
        onUnlocked={() => { setShowPayment(false); handleGenerate(); }}
      />
    </div>
  );
};

export default Generate;
