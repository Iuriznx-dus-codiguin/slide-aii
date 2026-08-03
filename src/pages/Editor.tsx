// 3-panel manual editor: draggable thumbnails (left), inline-editable canvas
// (center), and a tabbed inspector (right). Toolbar with undo/redo/zoom/preview
// and auto-save every 30s.
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft, Save, Undo2, Redo2, Plus, Trash2, ZoomIn, ZoomOut, Play,
  Type, Image as ImageIcon, Wand2, Layout as LayoutIcon, FileText, Loader2,
  GripVertical, Sparkles, Eye, MessageSquare, Send, Pencil, X, Users,
} from "lucide-react";
import { PresenterNotesPanel, type PresenterEntry } from "@/components/PresenterNotesPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { SlideRendererWithChoreo } from "@/components/SlideRendererWithChoreo";
import { SlideStage } from "@/components/SlideStage";
import { ExportMenu } from "@/components/ExportMenu";
import { THEMES, FONTS, ANIMATION_PRESETS, type ThemeColors } from "@/lib/slugify";
import { toast } from "sonner";
import React from "react";
import type { CreativeBrief } from "@/lib/creativeBrief";
import type { BrandIdentity } from "@/lib/brandIdentity";

const LAYOUTS = [
  "title-only", "title-content", "two-columns", "image-right", "image-left",
  "full-image", "quote", "data-chart", "centered", "split-hero", "stat-highlight",
];

const TRANSITIONS = [
  "dynamic",
  "mosaic", "iris", "shatter", "ribbon", "blinds", "fold",
  "portal", "wipe", "split", "morph", "stack", "letterbox",
];

const COVER_VARIANTS_LIST = [
  "split-hero", "typographic-bold", "full-bleed-image",
  "minimal-centered", "asymmetric-grid", "gradient-mesh",
];

const SLIDE_TYPES = [
  "title_slide", "content", "bullet_points", "quote", "image_text",
  "data_chart", "section_divider", "conclusion",
];

interface SlideRow {
  id: string;
  position: number;
  slide_type: string;
  layout_template: string;
  animation_transition: string;
  speaker_notes: string | null;
  content: any;
  presenters_data?: PresenterEntry[];
}

interface Pres {
  id: string; title: string; slug: string; theme: string; font_style: string;
  include_speeches?: boolean; presenters_names?: string[]; presenters_count?: number;
}

// Bloco 13: thumbnail renderizado em 800x450 (4x menos pixels que 1920x1080)
// + React.memo + lazy rendering (placeholder se >2 posições do ativo).
const SortableThumbInner = ({ slide, idx, active, onClick, onDelete, themeId, fontId, dynamicTheme, lazyHide, creativeBrief }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="group relative">
      <button onClick={onClick}
        className={`block w-full aspect-video rounded-lg overflow-hidden border-2 transition-all relative ${
          active ? "border-primary shadow-glow" : "border-border hover:border-muted-foreground/40"
        }`}>
        <div className="absolute inset-0 pointer-events-none">
          {lazyHide ? (
            <div className="absolute inset-0" style={{ background: dynamicTheme?.bg ?? "#0a0a0a" }} />
          ) : (
            <div className="origin-top-left scale-[0.25] w-[800px] h-[450px]">
              <SlideRendererWithChoreo
                slide={{ slide_type: slide.slide_type, layout_template: slide.layout_template, content: slide.content }}
                themeId={themeId} fontId={fontId} dynamicTheme={dynamicTheme} index={idx} noAnimate
                creativeBrief={creativeBrief}
              />
            </div>
          )}
        </div>
        <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
          {idx + 1}
        </div>
      </button>
      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button {...attributes} {...listeners}
          className="h-6 w-6 rounded bg-background/90 border border-border flex items-center justify-center cursor-grab active:cursor-grabbing">
          <GripVertical className="h-3 w-3" />
        </button>
        <button onClick={onDelete}
          className="h-6 w-6 rounded bg-background/90 border border-border flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};
const SortableThumb = React.memo(SortableThumbInner);

const Editor = () => {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [pres, setPres] = useState<(Pres & { dynamic_theme?: any; creative_brief?: CreativeBrief | null; brand_identity?: BrandIdentity | null }) | null>(null);
  const [slides, setSlides] = useState<SlideRow[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  // Usado pelo SlideStage para saber a direção (avançar/voltar) da navegação
  // entre slides — necessário para os Overlays de transição que dependem de
  // direção (ex: wipe, split).
  const prevActiveIdxRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(0.7);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [chat, setChat] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [inlineEdit, setInlineEdit] = useState(false);

  // Undo/redo stacks (snapshots of full slides array)
  const undoStack = useRef<SlideRow[][]>([]);
  const redoStack = useRef<SlideRow[][]>([]);
  const skipNextSnapshot = useRef(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => { document.title = "Editor — SlideAI"; }, []);

  // Load presentation
  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: p } = await supabase.from("presentations")
        .select("id,title,slug,theme,font_style,include_speeches,presenters_names,presenters_count,dynamic_theme,creative_brief,brand_identity").eq("slug", slug).maybeSingle();
      if (!p) { setLoading(false); return; }
      const presLoaded = {
        ...p,
        presenters_names: Array.isArray(p.presenters_names) ? (p.presenters_names as string[]) : [],
      } as any;
      setPres(presLoaded);
      const { data: s } = await supabase.from("slides")
        .select("id,position,slide_type,layout_template,animation_transition,speaker_notes,content,presenters_data")
        .eq("presentation_id", p.id).order("position");
      const normalized = ((s as any[]) ?? []).map((row) => ({
        ...row,
        presenters_data: Array.isArray(row.presenters_data) ? row.presenters_data : [],
      })) as SlideRow[];
      setSlides(normalized);
      if (presLoaded.include_speeches) setNotesOpen(true);
      setLoading(false);
    })();
  }, [slug]);

  // Bloco 12.2: dynamic_theme prioriza presentations.dynamic_theme; fallback p/ slides legados.
  const dynamicTheme: Partial<ThemeColors> | null = useMemo(
    () => (pres as any)?.dynamic_theme ?? slides[0]?.content?.dynamic_theme ?? null,
    [pres, slides]
  );

  // Bloco 12.3: debounce de 500ms para snapshots — evita um por keystroke.
  const snapshotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushSnapshot = useCallback(() => {
    if (skipNextSnapshot.current) { skipNextSnapshot.current = false; return; }
    if (snapshotTimer.current) clearTimeout(snapshotTimer.current);
    const snap = JSON.parse(JSON.stringify(slides));
    snapshotTimer.current = setTimeout(() => {
      undoStack.current.push(snap);
      if (undoStack.current.length > 50) undoStack.current.shift();
      redoStack.current = [];
    }, 500);
  }, [slides]);

  const updateSlide = (idx: number, patch: Partial<SlideRow> | { content: any }) => {
    pushSnapshot();
    setSlides((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...patch, content: { ...copy[idx].content, ...(patch as any).content } };
      return copy;
    });
  };

  const updateContent = (idx: number, patch: any) => {
    pushSnapshot();
    setSlides((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], content: { ...copy[idx].content, ...patch } };
      return copy;
    });
  };

  const updatePresenters = (idx: number, presenters: PresenterEntry[]) => {
    pushSnapshot();
    setSlides((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], presenters_data: presenters };
      return copy;
    });
  };

  const undo = () => {
    const last = undoStack.current.pop();
    if (!last) return;
    redoStack.current.push(JSON.parse(JSON.stringify(slides)));
    skipNextSnapshot.current = true;
    setSlides(last);
  };
  const redo = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(JSON.parse(JSON.stringify(slides)));
    skipNextSnapshot.current = true;
    setSlides(next);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    pushSnapshot();
    setSlides((prev) => {
      const oldIdx = prev.findIndex((s) => s.id === active.id);
      const newIdx = prev.findIndex((s) => s.id === over.id);
      const reordered = arrayMove(prev, oldIdx, newIdx);
      if (activeIdx === oldIdx) setActiveIdx(newIdx);
      return reordered;
    });
  };

  const addSlide = () => {
    if (slides.length >= 30) { toast.error("Limite de 30 slides por apresentação"); return; }
    pushSnapshot();
    const newSlide: SlideRow = {
      id: crypto.randomUUID(),
      position: slides.length,
      slide_type: "content",
      layout_template: "title-content",
      animation_transition: "fade",
      speaker_notes: "",
      content: { headline: "Novo slide", subtitle: "", body_text: "", animation: "fade" },
    };
    setSlides((p) => [...p, newSlide]);
    setActiveIdx(slides.length);
  };

  const deleteSlide = (idx: number) => {
    if (slides.length <= 1) { toast.error("A apresentação precisa ter ao menos 1 slide"); return; }
    pushSnapshot();
    setSlides((p) => p.filter((_, i) => i !== idx));
    setActiveIdx((i) => Math.max(0, Math.min(slides.length - 2, i > idx ? i - 1 : i)));
  };

  // Bloco 12.1: upsert por id em vez de delete+reinsert — elimina o gap temporal.
  const save = useCallback(async (silent = false) => {
    if (!pres) return;
    setSaving(true);
    try {
      const rows = slides.map((s, i) => ({
        id: s.id,
        presentation_id: pres.id,
        position: i,
        slide_type: s.slide_type,
        layout_template: s.layout_template,
        animation_transition: s.animation_transition || "fade",
        speaker_notes: s.speaker_notes || null,
        content: s.content || {},
        presenters_data: (s.presenters_data ?? []) as any,
      }));
      // Upsert mantém UUIDs estáveis (slides novos do editor já recebem crypto.randomUUID)
      const { error: upErr } = await supabase
        .from("slides")
        .upsert(rows, { onConflict: "id" });
      if (upErr) throw upErr;

      // Remove slides do banco que não estão mais na lista
      const keepIds = rows.map((r) => r.id);
      if (keepIds.length > 0) {
        await supabase
          .from("slides")
          .delete()
          .eq("presentation_id", pres.id)
          .not("id", "in", `(${keepIds.map((id) => `"${id}"`).join(",")})`);
      }

      // Bloco 12.2: tema dinâmico vive em presentations.dynamic_theme
      await supabase.from("presentations").update({
        slides_count: slides.length,
        updated_at: new Date().toISOString(),
        dynamic_theme: (pres as any).dynamic_theme ?? dynamicTheme ?? null,
      } as any).eq("id", pres.id);

      setLastSaved(new Date());
      if (!silent) toast.success("Salvo!");
    } catch (e: any) {
      console.error(e);
      if (!silent) toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }, [pres, slides, dynamicTheme]);

  // Auto-save every 30s
  useEffect(() => {
    if (!pres) return;
    const id = setInterval(() => { save(true); }, 30000);
    return () => clearInterval(id);
  }, [pres, save]);

  // Chat IA do editor manual — usa a mesma edge function chat-editor
  const sendChat = async () => {
    const instruction = chatInput.trim();
    if (!instruction || chatBusy) return;
    setChatInput("");
    setChat((c) => [...c, { role: "user", content: instruction }]);
    setChatBusy(true);
    try {
      // Mapear slides para o formato esperado pela edge function
      const aiSlides = slides.map((s) => ({
        slide_title: s.content?.headline || "",
        slide_type: s.slide_type,
        layout_template: s.layout_template,
        animation: s.animation_transition || s.content?.animation || "fade",
        ...s.content,
        speaker_notes: s.speaker_notes || s.content?.speaker_notes,
      }));
      const { data, error } = await supabase.functions.invoke("chat-editor", {
        body: { slides: aiSlides, dynamic_theme: dynamicTheme, instruction },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Aplicar updates: mantém ID e position originais por índice
      pushSnapshot();
      const updated = (data.slides as any[]).map((ns, i) => ({
        id: slides[i]?.id ?? crypto.randomUUID(),
        position: i,
        slide_type: ns.slide_type ?? slides[i]?.slide_type ?? "content",
        layout_template: ns.layout_template ?? slides[i]?.layout_template ?? "title-content",
        animation_transition: ns.animation ?? slides[i]?.animation_transition ?? "fade",
        speaker_notes: ns.speaker_notes ?? slides[i]?.speaker_notes ?? null,
        content: {
          ...slides[i]?.content,
          headline: ns.headline, subtitle: ns.subtitle, body_text: ns.body_text,
          bullets: ns.bullets, stat_value: ns.stat_value, stat_label: ns.stat_label,
          quote_text: ns.quote_text, quote_author: ns.quote_author,
          image_query: ns.image_query, image_strategy: ns.image_strategy,
          image_url: ns.image_url ?? slides[i]?.content?.image_url,
          ai_image_prompt: ns.ai_image_prompt, chart: ns.chart, animation: ns.animation,
          // Bloco 11.3: preserva campos "DNA" se a IA não devolveu
          visual_accents: (ns as any).visual_accents ?? (slides[i]?.content as any)?.visual_accents,
          narrative_act: (ns as any).narrative_act ?? (slides[i]?.content as any)?.narrative_act,
          animation_intent: (ns as any).animation_intent ?? (slides[i]?.content as any)?.animation_intent,
          cover_variant: (ns as any).cover_variant ?? (slides[i]?.content as any)?.cover_variant,
          transition: (ns as any).transition ?? (slides[i]?.content as any)?.transition,
        },
      }));
      skipNextSnapshot.current = true;
      setSlides(updated as any);
      setChat((c) => [...c, { role: "assistant", content: data.assistant_message || "Pronto, atualizei!" }]);
    } catch (e: any) {
      console.error(e);
      setChat((c) => [...c, { role: "assistant", content: "Não consegui aplicar essa mudança. Tenta reformular?" }]);
      toast.error(e.message || "Erro no chat");
    } finally {
      setChatBusy(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (meta && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      else if (meta && e.key === "s") { e.preventDefault(); save(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!pres) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold">Apresentação não encontrada</h1>
        <Link to="/dashboard" className="text-primary underline mt-4 inline-block">Voltar</Link>
      </div>
    </div>
  );

  const current = slides[activeIdx];
  const c = current?.content || {};

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Toolbar */}
      <header className="border-b border-border flex-shrink-0 bg-card/40 backdrop-blur">
        <div className="px-3 md:px-4 py-2 flex items-center gap-2 md:gap-3 flex-wrap">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Dashboard</span>
          </button>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-1 min-w-0">
            <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="font-display font-semibold truncate text-sm">{pres.title}</span>
          </div>
          <div className="h-5 w-px bg-border hidden md:block" />
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={undo} disabled={!undoStack.current.length} title="Desfazer (Ctrl+Z)">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={redo} disabled={!redoStack.current.length} title="Refazer (Ctrl+Y)">
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="h-5 w-px bg-border hidden md:block" />
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}><ZoomOut className="h-4 w-4" /></Button>
            <span className="text-xs font-medium w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(1.2, z + 0.1))}><ZoomIn className="h-4 w-4" /></Button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground hidden md:inline">
              {saving ? "Salvando..." : lastSaved ? `Salvo ${lastSaved.toLocaleTimeString()}` : "Não salvo"}
            </span>
            <Button variant={inlineEdit ? "hero" : "ghost"} size="sm" onClick={() => setInlineEdit((v) => !v)} title="Editar texto direto no canvas">
              <Pencil className="h-4 w-4" /> <span className="hidden md:inline">Inline</span>
            </Button>
            <Button variant={chatOpen ? "hero" : "ghost"} size="sm" onClick={() => setChatOpen((v) => !v)} title="Assistente IA">
              <MessageSquare className="h-4 w-4" /> <span className="hidden md:inline">IA</span>
            </Button>
            {pres.include_speeches && (
              <Button
                variant={notesOpen ? "hero" : "ghost"} size="sm"
                onClick={() => setNotesOpen((v) => !v)}
                title="Falas e notas por apresentador"
              >
                <Users className="h-4 w-4" /> <span className="hidden md:inline">Falas</span>
              </Button>
            )}
            <Link to={`/slides/${pres.slug}`} target="_blank">
              <Button variant="ghost" size="sm"><Play className="h-4 w-4" /> <span className="hidden md:inline">Apresentar</span></Button>
            </Link>
            <ExportMenu presentationId={pres.id} title={pres.title} themeId={pres.theme} fontId={pres.font_style} slug={pres.slug} />
            <Button variant="hero" size="sm" onClick={() => save()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Left: thumbnails — vertical em ≥lg, horizontal em <lg */}
        <aside className="lg:w-44 xl:w-52 border-b lg:border-b-0 lg:border-r border-border bg-card/30 flex lg:flex-col flex-shrink-0">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between lg:w-auto w-full">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Slides</span>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={addSlide}><Plus className="h-3.5 w-3.5" /></Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 flex lg:flex-col gap-2 lg:space-y-0">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  {slides.map((s, i) => (
                    <div key={s.id} className="lg:w-auto w-32 flex-shrink-0">
                      <SortableThumb slide={s} idx={i} active={i === activeIdx}
                        onClick={() => setActiveIdx(i)} onDelete={() => deleteSlide(i)}
                        themeId={pres.theme} fontId={pres.font_style} dynamicTheme={dynamicTheme}
                        lazyHide={Math.abs(i - activeIdx) > 2}
                        creativeBrief={pres.creative_brief}
                      />
                    </div>
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          </ScrollArea>
        </aside>

        {/* Center: canvas */}
        <main className="flex-1 bg-muted/30 overflow-auto min-w-0">
          <div className="min-h-full flex items-center justify-center p-6">
            {current && (
              <div
                className="shadow-elegant rounded-2xl overflow-hidden bg-black flex-shrink-0 relative"
                style={{ width: `${1280 * zoom}px`, height: `${720 * zoom}px` }}
              >
                {/*
                  ANTES: SlideRendererWithChoreo com noAnimate fixo — o canvas
                  do editor nunca mostrava NENHUMA animação/transição, então o
                  usuário criava a apresentação "às cegas" em relação a 100%
                  do trabalho de animação (só via o resultado real na tela de
                  visualização pública). Agora usa o MESMO SlideStage do
                  SlideViewer — a mesma transição escolhida, a mesma
                  coreografia, o mesmo magic move de âncoras no modo dynamic.
                  position:relative é necessário aqui porque o SlideStage
                  posiciona seu conteúdo com "absolute inset-0" contra ESTE
                  elemento (que já carrega o scale() e o tamanho-fonte de
                  1920x1080 que o SlideRenderer espera preencher).
                */}
                <div className="relative origin-top-left" style={{ transform: `scale(${zoom * (1280/1920)})`, width: 1920, height: 1080 }}>
                  <SlideStage
                    slideId={current.id}
                    slide={{ slide_type: current.slide_type, layout_template: current.layout_template, content: c }}
                    themeId={pres.theme}
                    fontId={pres.font_style}
                    dynamicTheme={dynamicTheme}
                    idx={activeIdx}
                    prevIdxRef={prevActiveIdxRef}
                    layoutGroupId={pres.id ?? "draft"}
                    creativeBrief={pres.creative_brief}
                  />
                </div>

                {/* Overlay de edição inline — campos sobrepostos com fundo translúcido */}
                {inlineEdit && (
                  <div className="absolute inset-0 flex flex-col p-4 gap-2 bg-black/50 backdrop-blur-sm">
                    <div className="flex items-center justify-between text-white text-xs mb-1">
                      <span className="flex items-center gap-1.5"><Pencil className="h-3 w-3" /> Edição inline ativa</span>
                      <button onClick={() => setInlineEdit(false)} className="hover:bg-white/10 rounded p-1"><X className="h-3 w-3" /></button>
                    </div>
                    <input
                      value={c.headline || ""}
                      onChange={(e) => updateContent(activeIdx, { headline: e.target.value })}
                      placeholder="Título do slide"
                      className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-2xl font-bold placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <input
                      value={c.subtitle || ""}
                      onChange={(e) => updateContent(activeIdx, { subtitle: e.target.value })}
                      placeholder="Subtítulo"
                      className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-base placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <textarea
                      value={c.body_text || ""}
                      onChange={(e) => updateContent(activeIdx, { body_text: e.target.value })}
                      placeholder="Texto principal"
                      className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* AI Assistant drawer (esquerda do inspector) */}
        {chatOpen && (
          <aside className="w-72 md:w-80 border-l border-border bg-card/40 flex flex-col flex-shrink-0">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5 text-primary" /> Assistente IA
              </span>
              <button onClick={() => setChatOpen(false)} className="hover:bg-muted rounded p-1"><X className="h-3 w-3" /></button>
            </div>
            <ScrollArea className="flex-1 px-3 py-3">
              <div className="space-y-3">
                {chat.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-6">
                    Peça mudanças em linguagem natural.<br />
                    Ex: <em>"deixa o slide 3 mais visual"</em>, <em>"resume tudo"</em>.
                  </div>
                )}
                {chat.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[88%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {chatBusy && (
                  <div className="flex justify-start">
                    <div className="bg-muted px-3 py-2 rounded-2xl text-xs flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" /> Aplicando...
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="p-2 border-t border-border">
              <div className="flex gap-1.5">
                <Textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  placeholder="Ex: tom mais formal" rows={2} className="resize-none text-xs" disabled={chatBusy} />
                <Button size="icon" variant="hero" onClick={sendChat} disabled={chatBusy || !chatInput.trim()} className="self-end h-9 w-9">
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </aside>
        )}

        {/* Presenter Notes Panel — apenas quando include_speeches está ativo */}
        {notesOpen && pres.include_speeches && current && (
          <PresenterNotesPanel
            slides={slides.map((s) => ({ headline: s.content?.headline, presenters_data: s.presenters_data ?? [] }))}
            activeIdx={activeIdx}
            presentationTitle={pres.title}
            presentersNames={pres.presenters_names ?? []}
            onUpdate={updatePresenters}
            onClose={() => setNotesOpen(false)}
          />
        )}

        {/* Right: inspector */}
        <aside className="w-72 md:w-80 border-l border-border bg-card/30 flex flex-col flex-shrink-0">
          {current && (
            <Tabs defaultValue="text" className="flex-1 flex flex-col">
              <TabsList className="grid grid-cols-5 m-2">
                <TabsTrigger value="text" title="Texto"><Type className="h-3.5 w-3.5" /></TabsTrigger>
                <TabsTrigger value="image" title="Imagem"><ImageIcon className="h-3.5 w-3.5" /></TabsTrigger>
                <TabsTrigger value="anim" title="Animação"><Wand2 className="h-3.5 w-3.5" /></TabsTrigger>
                <TabsTrigger value="layout" title="Layout"><LayoutIcon className="h-3.5 w-3.5" /></TabsTrigger>
                <TabsTrigger value="slide" title="Slide"><FileText className="h-3.5 w-3.5" /></TabsTrigger>
              </TabsList>
              <ScrollArea className="flex-1 px-3 pb-4">
                <TabsContent value="text" className="space-y-3 mt-0">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Headline</Label>
                    <Textarea value={c.headline || ""} onChange={(e) => updateContent(activeIdx, { headline: e.target.value })} rows={2} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Subtítulo</Label>
                    <Textarea value={c.subtitle || ""} onChange={(e) => updateContent(activeIdx, { subtitle: e.target.value })} rows={2} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Texto principal</Label>
                    <Textarea value={c.body_text || ""} onChange={(e) => updateContent(activeIdx, { body_text: e.target.value })} rows={5} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Bullets (um por linha)</Label>
                    <Textarea value={(c.bullets || []).join("\n")}
                      onChange={(e) => updateContent(activeIdx, { bullets: e.target.value.split("\n").filter(Boolean) })}
                      rows={5} />
                  </div>
                  {(current.layout_template === "stat-highlight") && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Stat (número)</Label>
                        <Input value={c.stat_value || ""} onChange={(e) => updateContent(activeIdx, { stat_value: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Stat (descrição)</Label>
                        <Input value={c.stat_label || ""} onChange={(e) => updateContent(activeIdx, { stat_label: e.target.value })} />
                      </div>
                    </>
                  )}
                  {(current.slide_type === "quote" || current.layout_template === "quote") && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Citação</Label>
                        <Textarea value={c.quote_text || ""} onChange={(e) => updateContent(activeIdx, { quote_text: e.target.value })} rows={3} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Autor</Label>
                        <Input value={c.quote_author || ""} onChange={(e) => updateContent(activeIdx, { quote_author: e.target.value })} />
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="image" className="space-y-3 mt-0">
                  <div className="space-y-1.5">
                    <Label className="text-xs">URL da imagem</Label>
                    <Input value={c.image_url || ""} onChange={(e) => updateContent(activeIdx, { image_url: e.target.value })} placeholder="https://..." />
                  </div>
                  {c.image_url && <img src={c.image_url} alt="" className="w-full rounded-lg aspect-video object-cover" />}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Termo de busca (Pexels) / prompt</Label>
                    <Input value={c.image_query || ""} onChange={(e) => updateContent(activeIdx, { image_query: e.target.value })} placeholder="ex: spanish flag sunset" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Estratégia</Label>
                    <Select value={c.image_strategy || "pexels"} onValueChange={(v) => updateContent(activeIdx, { image_strategy: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pexels">Pexels (foto real)</SelectItem>
                        <SelectItem value="ai">Gerar com IA</SelectItem>
                        <SelectItem value="none">Sem imagem</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {c.image_strategy === "ai" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Prompt de IA</Label>
                      <Textarea value={c.ai_image_prompt || ""} onChange={(e) => updateContent(activeIdx, { ai_image_prompt: e.target.value })} rows={3} />
                    </div>
                  )}
                  <Button variant="outline" size="sm" className="w-full" disabled={!c.image_query}
                    onClick={async () => {
                      try {
                        toast.loading("Buscando imagem...", { id: "img" });
                        const { data } = await supabase.functions.invoke("fetch-image", {
                          // `style` é parte da chave de cache do Asset
                          // Intelligence — sem ele, trocar a imagem no Editor
                          // sempre paga uma geração nova.
                          body: { query: c.image_query, ai_prompt: c.ai_image_prompt, strategy: c.image_strategy || "pexels", style: c.image_style, orientation: "landscape" },
                        });
                        if (data?.url) updateContent(activeIdx, { image_url: data.url });
                        toast.success("Imagem atualizada!", { id: "img" });
                      } catch (e: any) { toast.error(e.message || "Erro", { id: "img" }); }
                    }}>
                    <ImageIcon className="h-4 w-4" /> Buscar / gerar imagem
                  </Button>
                </TabsContent>

                <TabsContent value="anim" className="space-y-3 mt-0">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Animação de entrada (per-elemento)</Label>
                    <Select value={c.animation || current.animation_transition || "fade"}
                      onValueChange={(v) => { updateSlide(activeIdx, { animation_transition: v } as any); updateContent(activeIdx, { animation: v }); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ANIMATION_PRESETS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Bloco 1.5: transição cinematográfica do slide */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Transição entre slides</Label>
                    {/* Toggle proeminente para o modo Dinâmico (magic move) */}
                    <button
                      type="button"
                      onClick={() => updateContent(activeIdx, { transition: ((c as any).transition === "dynamic" ? "" : "dynamic") })}
                      className={`w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                        (c as any).transition === "dynamic"
                          ? "border-primary bg-primary/10 text-primary shadow-glow"
                          : "border-border hover:border-primary/50 text-foreground"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5" />
                        Slide Dinâmico (magic move)
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        (c as any).transition === "dynamic" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}>
                        {(c as any).transition === "dynamic" ? "ATIVO" : "ativar"}
                      </span>
                    </button>
                    <Select value={(c as any).transition || ""}
                      onValueChange={(v) => updateContent(activeIdx, { transition: v })}>
                      <SelectTrigger><SelectValue placeholder="auto (padrão dinâmico)" /></SelectTrigger>
                      <SelectContent>
                        {TRANSITIONS.map((t) => (
                          <SelectItem key={t} value={t}>{t === "dynamic" ? "dynamic (padrão — magic move)" : t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Bloco 7.3: cover_variant apenas para title_slide */}
                  {current.slide_type === "title_slide" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Variação da capa</Label>
                      <Select value={(c as any).cover_variant || ""}
                        onValueChange={(v) => updateContent(activeIdx, { cover_variant: v })}>
                        <SelectTrigger><SelectValue placeholder="auto" /></SelectTrigger>
                        <SelectContent>
                          {COVER_VARIANTS_LIST.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    A animação afeta cada elemento; a transição é como o slide inteiro entra e sai. Veja em <strong>Apresentar</strong>.
                  </p>
                </TabsContent>

                <TabsContent value="layout" className="space-y-3 mt-0">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Layout</Label>
                    <Select value={current.layout_template} onValueChange={(v) => updateSlide(activeIdx, { layout_template: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LAYOUTS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo de slide</Label>
                    <Select value={current.slide_type} onValueChange={(v) => updateSlide(activeIdx, { slide_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SLIDE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <TabsContent value="slide" className="space-y-3 mt-0">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Notas do orador</Label>
                    <Textarea value={current.speaker_notes || ""}
                      onChange={(e) => updateSlide(activeIdx, { speaker_notes: e.target.value } as any)} rows={6} />
                  </div>
                  <Button variant="outline" size="sm" className="w-full text-destructive" onClick={() => deleteSlide(activeIdx)}>
                    <Trash2 className="h-4 w-4" /> Excluir slide
                  </Button>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          )}
        </aside>
      </div>
    </div>
  );
};

export default Editor;
