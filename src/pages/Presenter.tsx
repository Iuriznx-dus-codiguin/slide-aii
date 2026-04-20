// Modo Apresentador: slide atual + próximo + notas + cronômetro.
// Sincronização via BroadcastChannel — quando aberto a partir de /slides/:slug,
// envia comandos prev/next para o viewer principal e recebe atualizações.
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Pause, Play, RotateCcw, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SlideRenderer } from "@/components/SlideRenderer";

interface Pres { id: string; title: string; theme: string; font_style: string; }
interface SlideRow { id: string; position: number; slide_type: string; layout_template: string; speaker_notes: string | null; content: any; }

const fmt = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const Presenter = () => {
  const { slug } = useParams();
  const [pres, setPres] = useState<Pres | null>(null);
  const [slides, setSlides] = useState<SlideRow[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => { document.title = "Apresentador — SlideAI"; }, []);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: p } = await supabase.from("presentations").select("id,title,theme,font_style").eq("slug", slug).maybeSingle();
      if (!p) { setLoading(false); return; }
      setPres(p as Pres);
      const { data: s } = await supabase.from("slides")
        .select("id,position,slide_type,layout_template,speaker_notes,content")
        .eq("presentation_id", p.id).order("position");
      setSlides((s as any) ?? []);
      setLoading(false);
    })();
  }, [slug]);

  // Cronômetro
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Canal de sincronização
  useEffect(() => {
    if (!slug) return;
    const ch = new BroadcastChannel(`slideai-${slug}`);
    channelRef.current = ch;
    ch.onmessage = (e) => {
      if (e.data?.type === "goto" && typeof e.data.idx === "number") setIdx(e.data.idx);
    };
    return () => ch.close();
  }, [slug]);

  const send = (newIdx: number) => {
    setIdx(newIdx);
    channelRef.current?.postMessage({ type: "goto", idx: newIdx });
  };
  const next = () => send(Math.min(idx + 1, slides.length - 1));
  const prev = () => send(Math.max(idx - 1, 0));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "p" || e.key === "P") setRunning((r) => !r);
      else if (e.key === "r" || e.key === "R") setSeconds(0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, slides.length]);

  const dynamicTheme = useMemo(
    () => slides[idx]?.content?.dynamic_theme ?? slides[0]?.content?.dynamic_theme ?? null,
    [slides, idx]
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-black"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!pres) return <div className="min-h-screen flex items-center justify-center bg-black text-white">Apresentação não encontrada</div>;

  const current = slides[idx];
  const upcoming = slides[idx + 1];

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Top bar: timer + título */}
      <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs uppercase tracking-widest text-white/50">Apresentador</span>
          <span className="font-display font-semibold truncate">{pres.title}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="font-mono text-2xl md:text-3xl font-bold tabular-nums">{fmt(seconds)}</div>
          <Button size="icon" variant="ghost" className="text-white hover:bg-white/10 h-8 w-8" onClick={() => setRunning((r) => !r)} title="Pausar (P)">
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="ghost" className="text-white hover:bg-white/10 h-8 w-8" onClick={() => setSeconds(0)} title="Zerar (R)">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 overflow-hidden min-h-0">
        {/* Atual (grande) */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <div className="text-xs uppercase tracking-widest text-white/50 mb-2">Atual — {idx + 1}/{slides.length}</div>
          <div className="flex-1 rounded-2xl overflow-hidden bg-black border border-white/10 relative">
            <div className="absolute inset-0">
              {current && <SlideRenderer slide={current as any} themeId={pres.theme} fontId={pres.font_style} dynamicTheme={dynamicTheme} index={idx} noAnimate />}
            </div>
          </div>
        </div>

        {/* Próximo + notas */}
        <div className="flex flex-col gap-4 min-h-0">
          <div className="flex flex-col">
            <div className="text-xs uppercase tracking-widest text-white/50 mb-2">Próximo</div>
            <div className="aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 relative">
              {upcoming ? (
                <div className="absolute inset-0">
                  <SlideRenderer slide={upcoming as any} themeId={pres.theme} fontId={pres.font_style} dynamicTheme={dynamicTheme} index={idx + 1} noAnimate />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/40 text-sm">Fim da apresentação</div>
              )}
            </div>
          </div>

          <div className="flex-1 rounded-2xl bg-white/5 border border-white/10 p-4 overflow-auto min-h-0">
            <div className="text-xs uppercase tracking-widest text-white/50 mb-2">Notas do orador</div>
            <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap text-white/90">
              {current?.speaker_notes || <span className="text-white/30">Nenhuma nota para este slide.</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Controles de navegação */}
      <footer className="flex items-center justify-center gap-3 px-4 py-3 border-t border-white/10 flex-shrink-0">
        <Button variant="ghost" className="text-white hover:bg-white/10" onClick={prev} disabled={idx === 0}>
          <ChevronLeft className="h-4 w-4" /> Anterior
        </Button>
        <span className="text-xs text-white/50 px-3">← → para navegar · P para pausar · R para zerar</span>
        <Button variant="ghost" className="text-white hover:bg-white/10" onClick={next} disabled={idx === slides.length - 1}>
          Próximo <ChevronRight className="h-4 w-4" />
        </Button>
      </footer>
    </div>
  );
};

export default Presenter;
