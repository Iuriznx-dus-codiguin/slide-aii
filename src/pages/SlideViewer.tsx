import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Share2, Copy, Sparkles, Loader2, ArrowLeft, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SlideRenderer } from "@/components/SlideRenderer";
import { ExportMenu } from "@/components/ExportMenu";
import { CinematicHUD, actForSlide, type NarrativeAct } from "@/components/CinematicHUD";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChoreographyProvider, useSlideChoreography, type ChoreographyName } from "@/lib/slideChoreography";

interface Pres {
  id: string; title: string; description: string | null; theme: string; font_style: string; slug: string;
  include_speeches?: boolean; presenters_names?: string[];
}
interface PresenterEntry { id: string; name: string; technical_notes?: string; exact_speech?: string; transition_anchor?: string; }
interface SlideRow { id: string; position: number; slide_type: string; layout_template: string; content: any; presenters_data?: PresenterEntry[]; }

/**
 * Cinematic stage — sem deslizar a tela inteira. Cada elemento do slide
 * que sai é coreografado individualmente (voa, suga, contrai, gira, dissolve)
 * e os elementos do próximo slide entram com sua própria timeline cinemática,
 * todos sob o mesmo accent dinâmico do tema.
 */
const CinematicSlideStage = ({
  current, pres, dynamicTheme, idx,
}: { current?: SlideRow; pres: Pres; dynamicTheme: any; idx: number }) => {
  const accent = dynamicTheme?.accent ?? "#A855F7";
  const hint = current?.content?.transition as ChoreographyName | undefined;
  const choreo = useSlideChoreography(idx, current?.slide_type, hint);

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={current?.id ?? idx}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.4, delay: 0.15 } }}
        exit={{ opacity: 0, transition: { duration: 0.95, delay: 0.55 } }}
        className="absolute inset-0"
        style={{ willChange: "opacity", perspective: 1600 }}
      >
        {/* Flash sutil tingido pelo accent durante a troca. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.35, 0], transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } }}
          exit={{ opacity: 0 }}
          style={{
            background: `radial-gradient(circle at 50% 50%, ${accent}33 0%, transparent 65%)`,
            mixBlendMode: "screen",
          }}
        />
        <ChoreographyProvider value={choreo}>
          {current && (
            <SlideRenderer
              slide={current as any}
              themeId={pres.theme}
              fontId={pres.font_style}
              dynamicTheme={dynamicTheme}
              index={idx}
            />
          )}
        </ChoreographyProvider>
      </motion.div>
    </AnimatePresence>
  );
};

const SlideViewer = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const autoPrint = searchParams.get("print") === "1";
  const [pres, setPres] = useState<Pres | null>(null);
  const [slides, setSlides] = useState<SlideRow[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [hideUI, setHideUI] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: p } = await supabase.from("presentations").select("id,title,description,theme,font_style,slug,include_speeches,presenters_names").eq("slug", slug).maybeSingle();
      if (!p) { setLoading(false); return; }
      setPres({ ...p, presenters_names: Array.isArray(p.presenters_names) ? (p.presenters_names as string[]) : [] } as Pres);
      document.title = `${p.title} — SlideAI`;
      const { data: s } = await supabase.from("slides").select("id,position,slide_type,layout_template,content,presenters_data").eq("presentation_id", p.id).order("position");
      setSlides(((s as any[]) ?? []).map((row) => ({ ...row, presenters_data: Array.isArray(row.presenters_data) ? row.presenters_data : [] })) as any);
      setLoading(false);
      supabase.from("slide_views").insert({ presentation_id: p.id, user_agent: navigator.userAgent }).then(() => {});
    })();
  }, [slug]);

  const next = useCallback(() => setIdx((i) => Math.min(i + 1, slides.length - 1)), [slides.length]);
  const prev = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") prev();
      else if (e.key === "Escape" && document.fullscreenElement) document.exitFullscreen();
      else if (e.key === "f" || e.key === "F") toggleFullscreen();
      else if (e.key === "Home") setIdx(0);
      else if (e.key === "End") setIdx(slides.length - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, slides.length, toggleFullscreen]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Auto-hide UI in fullscreen
  useEffect(() => {
    if (!fullscreen) { setHideUI(false); return; }
    let t: any;
    const reset = () => {
      setHideUI(false);
      clearTimeout(t);
      t = setTimeout(() => setHideUI(true), 2500);
    };
    reset();
    window.addEventListener("mousemove", reset);
    window.addEventListener("touchstart", reset);
    return () => { clearTimeout(t); window.removeEventListener("mousemove", reset); window.removeEventListener("touchstart", reset); };
  }, [fullscreen]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copiado!");
  };

  // touch swipe
  useEffect(() => {
    let startX = 0;
    const onStart = (e: TouchEvent) => { startX = e.touches[0].clientX; };
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) (dx < 0 ? next() : prev());
    };
    window.addEventListener("touchstart", onStart);
    window.addEventListener("touchend", onEnd);
    return () => { window.removeEventListener("touchstart", onStart); window.removeEventListener("touchend", onEnd); };
  }, [next, prev]);

  // Auto-print when arrived with ?print=1
  useEffect(() => {
    if (autoPrint && !loading && slides.length > 0) {
      const t = setTimeout(() => window.print(), 800);
      return () => clearTimeout(t);
    }
  }, [autoPrint, loading, slides.length]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!pres) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold">Apresentação não encontrada</h1>
        <Link to="/" className="text-primary underline mt-4 inline-block">Voltar para o início</Link>
      </div>
    </div>
  );

  const progress = slides.length ? ((idx + 1) / slides.length) * 100 : 0;
  const current = slides[idx];
  const dynamicTheme = current?.content?.dynamic_theme ?? slides[0]?.content?.dynamic_theme ?? null;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col select-none">
      {/* Progress bar */}
      <div className={`fixed top-0 left-0 right-0 h-1 bg-white/10 z-50 transition-opacity ${hideUI ? "opacity-0" : "opacity-100"}`}>
        <div className="h-full bg-gradient-primary transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      {/* Top bar */}
      {!fullscreen && (
        <header className="relative z-40 flex items-center justify-between px-4 md:px-6 py-3 border-b border-white/10 flex-shrink-0">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-white/70 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Voltar</span>
          </button>
          <div className="text-sm font-medium truncate max-w-[40%] md:max-w-md">{pres.title}</div>
          <div className="flex items-center gap-1 md:gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10"><Share2 className="h-4 w-4" /></Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={copyLink}><Copy className="h-4 w-4" /> Copiar link</Button>
                  <a href={`https://wa.me/?text=${encodeURIComponent(window.location.href)}`} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" className="w-full justify-start">WhatsApp</Button>
                  </a>
                  <a href={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.href)}`} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" className="w-full justify-start">Gerar QR Code</Button>
                  </a>
                </div>
              </PopoverContent>
            </Popover>
            {pres.include_speeches && (
              <PresenterNotesPopover slide={current} presentersNames={pres.presenters_names ?? []} />
            )}
            <ExportMenu presentationId={pres.id} title={pres.title} themeId={pres.theme} fontId={pres.font_style} slug={pres.slug} variant="ghost" size="sm" />
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={toggleFullscreen}>
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              <span className="hidden md:inline ml-1">Apresentar</span>
            </Button>
          </div>
        </header>
      )}

      {/* Floating presenter notes button (visible during fullscreen presentation) */}
      {fullscreen && pres.include_speeches && (
        <div className={`fixed top-4 right-4 z-50 transition-opacity ${hideUI ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          <PresenterNotesPopover slide={current} presentersNames={pres.presenters_names ?? []} floating />
        </div>
      )}

      {/* Slide canvas — fullscreen: 100vw/100vh com letterbox 16:9 */}
      <main className={`flex-1 flex items-center justify-center relative ${fullscreen ? "p-0" : "p-2 md:p-6"}`}>
        <div
          data-export-target="slide"
          className={`relative ${fullscreen ? "shadow-none rounded-none" : "shadow-elegant rounded-2xl"} overflow-hidden bg-black`}
          style={fullscreen
            ? { width: "min(100vw, calc(100vh * 16 / 9))", height: "min(100vh, calc(100vw * 9 / 16))" }
            : { width: "100%", maxWidth: "1400px", aspectRatio: "16 / 9" }}
        >
          <CinematicSlideStage current={current} pres={pres} dynamicTheme={dynamicTheme} idx={idx} />

          {!fullscreen && (
            <Link to="/" className="absolute bottom-3 right-3 text-[10px] bg-black/50 text-white px-2 py-1 rounded-full backdrop-blur hover:bg-black/70 flex items-center gap-1 z-10">
              <Sparkles className="h-3 w-3" /> Criado com SlideAI
            </Link>
          )}
        </div>

        {/* Nav arrows */}
        <button onClick={prev} disabled={idx === 0}
          className={`absolute left-2 md:left-6 top-1/2 -translate-y-1/2 h-10 w-10 md:h-12 md:w-12 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center backdrop-blur transition-opacity ${hideUI ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
        </button>
        <button onClick={next} disabled={idx === slides.length - 1}
          className={`absolute right-2 md:right-6 top-1/2 -translate-y-1/2 h-10 w-10 md:h-12 md:w-12 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center backdrop-blur transition-opacity ${hideUI ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
        </button>
      </main>

      {/* Cinematic HUD — Progress Tracker global com glow + ato narrativo */}
      <CinematicHUD
        total={slides.length}
        current={idx}
        onJump={setIdx}
        hidden={hideUI}
        accent={dynamicTheme?.accent ?? "#A855F7"}
        acts={slides.map((s, i) => ((s as any).content?.narrative_act as NarrativeAct) ?? actForSlide(i, slides.length, s.slide_type)) as NarrativeAct[]}
      />
      {fullscreen && !hideUI && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 text-[10px] uppercase tracking-[0.3em] text-white/40 pointer-events-none">
          ESC para sair
        </div>
      )}
      {/* Hidden print-only deck — every slide becomes a printable A4-landscape page */}
      <div className="hidden print:block" data-no-print="false">
        {slides.map((s, i) => (
          <div key={s.id} className="print-slide" style={{ width: 1920, height: 1080 }}>
            <SlideRenderer
              slide={s as any}
              themeId={pres.theme}
              fontId={pres.font_style}
              dynamicTheme={s.content?.dynamic_theme ?? slides[0]?.content?.dynamic_theme ?? null}
              index={i}
              noAnimate
            />
          </div>
        ))}
      </div>
    </div>
  );
};

/** Popover compacto para consultar falas/notas do slide atual durante a apresentação. */
const PresenterNotesPopover = ({
  slide,
  presentersNames,
  floating,
}: {
  slide?: SlideRow;
  presentersNames: string[];
  floating?: boolean;
}) => {
  const existing = (slide?.presenters_data ?? []) as PresenterEntry[];
  const presenters: PresenterEntry[] =
    presentersNames.length > 0
      ? presentersNames.map((name, i) => {
          const found = existing.find((e) => e.name === name) ?? existing[i];
          return found
            ? { ...found, name }
            : { id: `${i}`, name, technical_notes: "", exact_speech: "", transition_anchor: "" };
        })
      : existing;

  // Aba ativa por ÍNDICE (estável entre slides). O índice do apresentador
  // que de fato fala neste slide; se ninguém fala, mantém o primeiro.
  const activeIndex = useMemo(() => {
    const idx = presenters.findIndex((p) => (p.exact_speech || "").trim().length > 0);
    return idx >= 0 ? idx : 0;
  }, [presenters]);
  const [tab, setTab] = useState<string>(String(activeIndex));
  // Reseta sempre que o slide muda (mesmo se o índice continuar igual).
  useEffect(() => { setTab(String(activeIndex)); }, [activeIndex, slide?.id]);

  const triggerCls = floating
    ? "h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur border border-white/15 text-white flex items-center justify-center shadow-elegant"
    : "";

  return (
    <Popover>
      <PopoverTrigger asChild>
        {floating ? (
          <button className={triggerCls} title="Consultar falas e notas">
            <Users className="h-4 w-4" />
          </button>
        ) : (
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" title="Consultar falas e notas">
            <Users className="h-4 w-4" />
            <span className="hidden md:inline ml-1">Falas</span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-1.5rem)] sm:w-[380px] p-0" align="end">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Users className="h-3.5 w-3.5 text-primary" /> Falas & Notas
          </span>
          <span className="text-[10px] text-muted-foreground">
            Slide {(slide?.position ?? 0) + 1}
          </span>
        </div>
        {presenters.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground text-center">
            Nenhuma fala registrada para este slide.
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="flex flex-col">
            <TabsList
              className="mx-2 mt-2 grid"
              style={{ gridTemplateColumns: `repeat(${presenters.length}, minmax(0, 1fr))` }}
            >
              {presenters.map((p, i) => {
                const speaks = (p.exact_speech || "").trim().length > 0;
                return (
                  <TabsTrigger key={i} value={String(i)} className="text-[11px] truncate gap-1">
                    <span className="opacity-60">{i + 1}.</span> {p.name || "Apresentador"}
                    {speaks && <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <ScrollArea className="max-h-[60vh]">
              {presenters.map((p, i) => (
                <TabsContent key={i} value={String(i)} className="px-3 py-3 space-y-3 mt-0">
                  {p.transition_anchor && (
                    <div className="text-[11px] italic text-muted-foreground border-l-2 border-primary/40 pl-2">
                      ↪ {p.transition_anchor}
                    </div>
                  )}
                  {p.exact_speech && (
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-wide text-primary font-semibold">🎤 Fala exata</div>
                      <p className="text-sm leading-relaxed font-medium whitespace-pre-wrap bg-muted/40 rounded-md p-2">
                        {p.exact_speech}
                      </p>
                    </div>
                  )}
                  {p.technical_notes && (
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">📚 Nota técnica</div>
                      <p className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                        {p.technical_notes}
                      </p>
                    </div>
                  )}
                  {!p.exact_speech && !p.technical_notes && !p.transition_anchor && (
                    <div className="text-xs text-muted-foreground text-center py-4">
                      Nenhuma anotação para {p.name}.
                    </div>
                  )}
                </TabsContent>
              ))}
            </ScrollArea>
          </Tabs>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default SlideViewer;
