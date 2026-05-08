import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
import { toast } from "sonner";
import { generateSlug, THEMES, FONTS, type ThemeColors } from "@/lib/slugify";
import { TEMPLATES } from "@/lib/templates";
import { SlideRenderer, type SlideContent } from "@/components/SlideRenderer";

// Cota gratuita (escondida do usuário pago — pagos vêem "Ilimitado")
const FREE_GENERATIONS_LIMIT = 1;

const STEPS = [
  "Pesquisando o tema...",
  "Estruturando narrativa...",
  "Definindo direção visual...",
  "Buscando imagens reais...",
  "Adicionando animações...",
  "Finalizando...",
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
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const Generate = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [phase, setPhase] = useState<"form" | "loading" | "preview">("form");
  const [stepIdx, setStepIdx] = useState(0);
  const [showLimitModal, setShowLimitModal] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slidesCount, setSlidesCount] = useState(8);
  const [type, setType] = useState("Corporativo");
  const [language, setLanguage] = useState("pt-BR");
  const [theme, setTheme] = useState("auto");
  const [fontStyle, setFontStyle] = useState("modern-sans");
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeImages, setIncludeImages] = useState(true);
  // DNA narrativo (Fase 2.5+)
  const [persona, setPersona] = useState<string>("educator");
  const [depthLevel, setDepthLevel] = useState<string>("high-level");
  const [presentersCount, setPresentersCount] = useState(1);
  const [presentersNames, setPresentersNames] = useState<string[]>(["Apresentador 1"]);
  const [includeSpeeches, setIncludeSpeeches] = useState(false);

  // Preview state
  const [slides, setSlides] = useState<AISlide[]>([]);
  const [dynamicTheme, setDynamicTheme] = useState<Partial<ThemeColors> | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
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
    setFontStyle(tpl.seed.fontStyle);
    setIncludeCharts(tpl.seed.includeCharts);
    setIncludeImages(tpl.seed.includeImages);
    toast.success(`Template "${tpl.title}" carregado — ajuste e gere!`);
  }, [searchParams]);

  // Steps são controlados manualmente nos pontos reais do fluxo (ver handleGenerate).

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  // Resolve images for slides (Pexels/AI) in parallel after generation
  const resolveImages = async (slidesList: AISlide[]) => {
    const updated = await Promise.all(slidesList.map(async (s) => {
      if (!s.image_strategy || s.image_strategy === "none" || !s.image_query) return s;
      try {
        const { data } = await supabase.functions.invoke("fetch-image", {
          body: {
            query: s.image_query,
            ai_prompt: s.ai_image_prompt,
            strategy: s.image_strategy,
            orientation: "landscape",
          },
        });
        return { ...s, image_url: data?.url ?? null };
      } catch (e) {
        console.warn("Image fetch failed", e);
        return s;
      }
    }));
    return updated;
  };

  const handleGenerate = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!title.trim()) { toast.error("Informe o título da apresentação"); return; }

    // [DEV] Limite de gerações desativado temporariamente para testes.

    setPhase("loading");
    setStepIdx(0);

    try {
      const { data, error } = await supabase.functions.invoke("generate-presentation", {
        body: {
          title, description, slidesCount, type, language, theme, fontStyle,
          includeCharts, includeImages,
          persona, depthLevel, presentersCount, presentersNames, includeSpeeches,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.slides?.length) throw new Error("Nenhum slide gerado");

      setStepIdx(2);
      const withImages = includeImages ? await resolveImages(data.slides) : data.slides;
      setStepIdx(4);

      const dyn = data.dynamic_theme ?? null;
      setDynamicTheme(dyn);
      setSlides(withImages);
      setChat([{
        role: "assistant",
        content: `Sua apresentação com ${withImages.length} slides está pronta!`,
      }]);
      setStepIdx(STEPS.length - 1);
      // Auto-abrir o editor manual com a aba de edição de conteúdo já ativa.
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

  const persistAndOpen = async (mode: "view" | "edit") => {
    if (!user || !slides.length) return;
    setSaving(true);
    try {
      const slug = generateSlug(title);
      const { data: pres, error: pErr } = await supabase.from("presentations").insert({
        user_id: user.id, title, description, type, language, theme, font_style: fontStyle,
        slug, slides_count: slides.length, is_paid: true, is_published: true,
        persona,
        depth_level: depthLevel,
        presenters_count: presentersCount,
        presenters_names: presentersNames,
        include_speeches: includeSpeeches,
      } as any).select().single();
      if (pErr) throw pErr;

      const slidesToInsert = slides.map((s, idx) => ({
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
          narrative_act: (s as any).narrative_act,
          animation_intent: (s as any).animation_intent,
          dynamic_theme: idx === 0 ? dynamicTheme : undefined,
        },
      })) as any;
      const { error: sErr } = await supabase.from("slides").insert(slidesToInsert);
      if (sErr) {
        // Rollback: evita apresentações órfãs sem slides no banco
        await supabase.from("presentations").delete().eq("id", pres.id);
        throw sErr;
      }

      const { data: profile } = await supabase.from("profiles").select("generations_count").eq("id", user.id).maybeSingle();
      await supabase.from("profiles").update({ generations_count: (profile?.generations_count ?? 0) + 1 }).eq("id", user.id);

      toast.success("Apresentação salva!");
      navigate(mode === "view" ? `/slides/${slug}` : `/editor/${slug}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

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
                <AnimatePresence mode="wait">
                  <motion.div key={currentSlide} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="absolute inset-0">
                    <SlideRenderer slide={slideForRender} themeId={theme} fontId={fontStyle} dynamicTheme={dynamicTheme} index={currentSlide} />
                  </motion.div>
                </AnimatePresence>
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
                          <div className="origin-top-left scale-[0.058] w-[1920px] h-[1080px]">
                            <SlideRenderer
                              slide={{ slide_type: s.slide_type, layout_template: s.layout_template, content: s as any }}
                              themeId={theme} fontId={fontStyle} dynamicTheme={dynamicTheme} noAnimate
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

          <div className="bg-card border border-border rounded-3xl p-5 md:p-8 shadow-elegant space-y-5 md:space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Título / Tema *</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: História da Espanha medieval" maxLength={150} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc">Descrição (opcional)</Label>
              <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Foque em algum aspecto, público-alvo, tom desejado..." rows={3} maxLength={1000} />
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

            <div className="space-y-2">
              <Label>Estilo de fonte</Label>
              <Select value={fontStyle} onValueChange={setFontStyle}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FONTS).map(([id, f]) => <SelectItem key={id} value={id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
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
                  <div className="text-[11px] text-muted-foreground">Pexels + IA</div>
                </div>
                <Switch checked={includeImages} onCheckedChange={setIncludeImages} />
              </div>
            </div>

            {/* DNA narrativo (Fase 2.5) */}
            <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-border">
              <div className="space-y-2">
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
              <div className="space-y-2">
                <Label>Profundidade</Label>
                <Select value={depthLevel} onValueChange={setDepthLevel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high-level">Executivo (high-level)</SelectItem>
                    <SelectItem value="deep-dive">Operacional (deep-dive)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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

            <Button variant="hero" size="xl" className="w-full" onClick={handleGenerate}>
              <Sparkles className="h-4 w-4" /> Gerar apresentação
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
              Você atingiu o limite de testes gratuitos. Assine o plano Ilimitado para criar quantas apresentações quiser.
            </p>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setShowLimitModal(false)}>Agora não</Button>
              <Button variant="hero" className="flex-1" onClick={() => navigate("/#pricing")}>Ver planos</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Generate;
