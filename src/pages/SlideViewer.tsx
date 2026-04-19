import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Share2, Copy, Sparkles, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SlideRenderer } from "@/components/SlideRenderer";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Pres { id: string; title: string; description: string | null; theme: string; font_style: string; slug: string; }
interface SlideRow { id: string; position: number; slide_type: string; layout_template: string; content: any; }

const SlideViewer = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [pres, setPres] = useState<Pres | null>(null);
  const [slides, setSlides] = useState<SlideRow[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: p } = await supabase.from("presentations").select("id,title,description,theme,font_style,slug").eq("slug", slug).maybeSingle();
      if (!p) { setLoading(false); return; }
      setPres(p as Pres);
      document.title = `${p.title} — SlideAI`;
      const { data: s } = await supabase.from("slides").select("id,position,slide_type,layout_template,content").eq("presentation_id", p.id).order("position");
      setSlides((s as any) ?? []);
      setLoading(false);
      // log view
      supabase.from("slide_views").insert({ presentation_id: p.id, user_agent: navigator.userAgent }).then(() => {});
    })();
  }, [slug]);

  const next = useCallback(() => setIdx((i) => Math.min(i + 1, slides.length - 1)), [slides.length]);
  const prev = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape" && document.fullscreenElement) document.exitFullscreen();
      else if (e.key === "f" || e.key === "F") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  };

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

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!pres) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold">Apresentação não encontrada</h1>
        <Link to="/" className="text-primary underline mt-4 inline-block">Voltar para o início</Link>
      </div>
    </div>
  );

  const progress = slides.length ? ((idx + 1) / slides.length) * 100 : 0;
  const current = slides[idx];

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-white/10 z-50">
        <div className="h-full bg-gradient-primary transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      {/* Top bar */}
      {!fullscreen && (
        <header className="relative z-40 flex items-center justify-between px-6 py-3 border-b border-white/10">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-white/70 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <div className="text-sm font-medium truncate max-w-md">{pres.title}</div>
          <div className="flex items-center gap-2">
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
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={toggleFullscreen}>
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </header>
      )}

      {/* Slide canvas */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-8 relative">
        <div className="w-full max-w-6xl aspect-video relative shadow-elegant rounded-2xl overflow-hidden bg-white">
          <AnimatePresence mode="wait">
            <motion.div key={current?.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.4 }} className="absolute inset-0">
              {current && <SlideRenderer slide={current as any} themeId={pres.theme} fontId={pres.font_style} />}
            </motion.div>
          </AnimatePresence>

          {/* Watermark */}
          <Link to="/" className="absolute bottom-3 right-3 text-[10px] bg-black/40 text-white px-2 py-1 rounded-full backdrop-blur hover:bg-black/60 flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Criado com SlideAI
          </Link>
        </div>

        {/* Nav */}
        <button onClick={prev} disabled={idx === 0} className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center backdrop-blur">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button onClick={next} disabled={idx === slides.length - 1} className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center backdrop-blur">
          <ChevronRight className="h-6 w-6" />
        </button>
      </main>

      {/* Bottom counter */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white/10 backdrop-blur px-4 py-2 rounded-full text-sm font-medium">
        {idx + 1} / {slides.length}
      </div>
    </div>
  );
};

export default SlideViewer;
