import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { cameraVariants, cameraTransition, pickCameraDirection } from "@/lib/animations";
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

interface Pres {
  id: string; title: string; description: string | null; theme: string; font_style: string; slug: string;
  include_speeches?: boolean; presenters_names?: string[];
}
interface PresenterEntry { id: string; name: string; technical_notes?: string; exact_speech?: string; transition_anchor?: string; }
interface SlideRow { id: string; position: number; slide_type: string; layout_template: string; content: any; presenters_data?: PresenterEntry[]; }

/** Camera-style transition between slides: pan + zoom + blur. */
const CinematicSlideStage = ({ current, pres, dynamicTheme, idx }: { current?: SlideRow; pres: Pres; dynamicTheme: any; idx: number }) => {
  const prevIdxRef = useRef(idx);
  const direction = pickCameraDirection(prevIdxRef.current, idx);
  useEffect(() => { prevIdxRef.current = idx; }, [idx]);
  const v = cameraVariants(direction);
  return (
    <LayoutGroup id="slide-shared-layout">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current?.id ?? idx}
          initial={v.initial}
          animate={v.animate}
          exit={v.exit}
          transition={cameraTransition}
          className="absolute inset-0"
          style={{ transformPerspective: 1200, willChange: "transform, opacity, filter" }}
        >
          {current && <SlideRenderer slide={current as any} themeId={pres.theme} fontId={pres.font_style} dynamicTheme={dynamicTheme} index={idx} />}
        </motion.div>
      </AnimatePresence>
    </LayoutGroup>
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
            <ExportMenu presentationId={pres.id} title={pres.title} themeId={pres.theme} fontId={pres.font_style} slug={pres.slug} variant="ghost" size="sm" />
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={toggleFullscreen}>
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              <span className="hidden md:inline ml-1">Apresentar</span>
            </Button>
          </div>
        </header>
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
        acts={slides.map((s, i) => actForSlide(i, slides.length, s.slide_type)) as NarrativeAct[]}
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

export default SlideViewer;
