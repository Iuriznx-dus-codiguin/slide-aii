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
  GripVertical, Sparkles, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { SlideRenderer } from "@/components/SlideRenderer";
import { ExportMenu } from "@/components/ExportMenu";
import { THEMES, FONTS, ANIMATION_PRESETS, type ThemeColors } from "@/lib/slugify";
import { toast } from "sonner";

const LAYOUTS = [
  "title-only", "title-content", "two-columns", "image-right", "image-left",
  "full-image", "quote", "data-chart", "centered", "split-hero", "stat-highlight",
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
}

interface Pres {
  id: string; title: string; slug: string; theme: string; font_style: string;
}

const SortableThumb = ({ slide, idx, active, onClick, onDelete, themeId, fontId, dynamicTheme }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="group relative">
      <button onClick={onClick}
        className={`block w-full aspect-video rounded-lg overflow-hidden border-2 transition-all relative ${
          active ? "border-primary shadow-glow" : "border-border hover:border-muted-foreground/40"
        }`}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="origin-top-left scale-[0.115] w-[1920px] h-[1080px]">
            <SlideRenderer
              slide={{ slide_type: slide.slide_type, layout_template: slide.layout_template, content: slide.content }}
              themeId={themeId} fontId={fontId} dynamicTheme={dynamicTheme} noAnimate
            />
          </div>
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

const Editor = () => {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [pres, setPres] = useState<Pres | null>(null);
  const [slides, setSlides] = useState<SlideRow[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(0.7);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

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
        .select("id,title,slug,theme,font_style").eq("slug", slug).maybeSingle();
      if (!p) { setLoading(false); return; }
      setPres(p as Pres);
      const { data: s } = await supabase.from("slides")
        .select("id,position,slide_type,layout_template,animation_transition,speaker_notes,content")
        .eq("presentation_id", p.id).order("position");
      setSlides((s as SlideRow[]) ?? []);
      setLoading(false);
    })();
  }, [slug]);

  const dynamicTheme: Partial<ThemeColors> | null = useMemo(
    () => slides[0]?.content?.dynamic_theme ?? null,
    [slides]
  );

  const pushSnapshot = useCallback(() => {
    if (skipNextSnapshot.current) { skipNextSnapshot.current = false; return; }
    undoStack.current.push(JSON.parse(JSON.stringify(slides)));
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
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

  // Save (full upsert: simplest reliable approach)
  const save = useCallback(async (silent = false) => {
    if (!pres) return;
    setSaving(true);
    try {
      // Delete all + reinsert with new positions (simpler than diffing)
      await supabase.from("slides").delete().eq("presentation_id", pres.id);
      const rows = slides.map((s, i) => ({
        presentation_id: pres.id,
        position: i,
        slide_type: s.slide_type,
        layout_template: s.layout_template,
        animation_transition: s.animation_transition || "fade",
        speaker_notes: s.speaker_notes || null,
        content: s.content || {},
      }));
      const { error } = await supabase.from("slides").insert(rows);
      if (error) throw error;
      await supabase.from("presentations").update({
        slides_count: slides.length, updated_at: new Date().toISOString(),
      }).eq("id", pres.id);
      setLastSaved(new Date());
      if (!silent) toast.success("Salvo!");
    } catch (e: any) {
      console.error(e);
      if (!silent) toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }, [pres, slides]);

  // Auto-save every 30s
  useEffect(() => {
    if (!pres) return;
    const id = setInterval(() => { save(true); }, 30000);
    return () => clearInterval(id);
  }, [pres, save]);

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
            <Link to={`/slides/${pres.slug}`} target="_blank">
              <Button variant="ghost" size="sm"><Play className="h-4 w-4" /> <span className="hidden md:inline">Apresentar</span></Button>
            </Link>
            <ExportMenu presentationId={pres.id} title={pres.title} themeId={pres.theme} slug={pres.slug} />
            <Button variant="hero" size="sm" onClick={() => save()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left: thumbnails */}
        <aside className="w-44 md:w-52 border-r border-border bg-card/30 flex flex-col flex-shrink-0">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Slides</span>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={addSlide}><Plus className="h-3.5 w-3.5" /></Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  {slides.map((s, i) => (
                    <SortableThumb key={s.id} slide={s} idx={i} active={i === activeIdx}
                      onClick={() => setActiveIdx(i)} onDelete={() => deleteSlide(i)}
                      themeId={pres.theme} fontId={pres.font_style} dynamicTheme={dynamicTheme}
                    />
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
                className="shadow-elegant rounded-2xl overflow-hidden bg-black flex-shrink-0"
                style={{ width: `${1280 * zoom}px`, height: `${720 * zoom}px` }}
              >
                <div className="origin-top-left" style={{ transform: `scale(${zoom * (1280/1920)})`, width: 1920, height: 1080 }}>
                  <SlideRenderer
                    slide={{ slide_type: current.slide_type, layout_template: current.layout_template, content: c }}
                    themeId={pres.theme} fontId={pres.font_style} dynamicTheme={dynamicTheme}
                    index={activeIdx} noAnimate
                  />
                </div>
              </div>
            )}
          </div>
        </main>

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
                          body: { query: c.image_query, ai_prompt: c.ai_image_prompt, strategy: c.image_strategy || "pexels", orientation: "landscape" },
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
                    <Label className="text-xs">Animação de entrada</Label>
                    <Select value={c.animation || current.animation_transition || "fade"}
                      onValueChange={(v) => { updateSlide(activeIdx, { animation_transition: v } as any); updateContent(activeIdx, { animation: v }); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ANIMATION_PRESETS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    A animação é aplicada quando o slide entra durante a apresentação. Veja em <strong>Apresentar</strong>.
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
