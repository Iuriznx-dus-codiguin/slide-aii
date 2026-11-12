// 3-panel manual editor: draggable thumbnails (left), inline-editable canvas
// (center), and a tabbed inspector (right). Toolbar with undo/redo/zoom/preview
// and auto-save every 30s.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft, Save, Undo2, Redo2, Plus, Trash2, ZoomIn, ZoomOut, Play,
  Type, Image as ImageIcon, Wand2, Layout as LayoutIcon, FileText, Loader2,
  GripVertical, Sparkles, Eye, MessageSquare, Send, Pencil, X, Users, Shapes,
  Globe, Lock, MoreHorizontal, Maximize, SlidersHorizontal,
} from "lucide-react";
import { PresenterNotesPanel, type PresenterEntry } from "@/components/PresenterNotesPanel";
import { ensurePresenterSpeeches } from "@/lib/presenterSpeech";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { PresentationOffline } from "@/components/PresentationOffline";
import { HOSTING_GRACE_DAYS } from "@/lib/hosting";
import { SlideRendererWithChoreo } from "@/components/SlideRendererWithChoreo";
import { SlideStage } from "@/components/SlideStage";
import { ExportMenu, type ExportDeck } from "@/components/ExportMenu";
import { mergeAiEdits } from "@/lib/aiEditMerge";
import { THEMES, FONTS, resolveTheme, type ThemeColors } from "@/lib/slugify";
import { toast } from "sonner";
import React from "react";
import type { CreativeBrief } from "@/lib/creativeBrief";
import { fetchSlideImage } from "@/lib/slideImage";
import { LEGACY_SLIDE_LAYOUTS, SLIDE_LAYOUTS } from "../../supabase/functions/_shared/slideComposition.ts";
import { MOTION_PRESETS, MOTION_PRESET_LABELS } from "../../supabase/functions/_shared/motionPresets.ts";
import { getCommand } from "../../supabase/functions/_shared/visualCommands.ts";
import { aiAssetFor, photoAssetFor } from "../../supabase/functions/_shared/sceneResolver.ts";
import { isSceneContent, type SlideAsset } from "../../supabase/functions/_shared/sceneMedia.ts";
import { isDomain } from "../../supabase/functions/_shared/sceneCatalog.ts";
import { useProgressiveAssets, type AssetPatch } from "@/hooks/useProgressiveAssets";
import { saveResolvedAsset } from "@/lib/assetWrite";
import { useAuth } from "@/hooks/useAuth";
import { useDeveloperRole } from "@/hooks/useDeveloperRole";
import { VisualPanel } from "@/components/editor/VisualPanel";

// Fonte única compartilhada com o backend — ver _shared/slideComposition.ts.
// Slides clássicos (v1) só oferecem os layouts que o renderer clássico
// conhece; visual-hero e diagram-full existem apenas em cenas do motor v2.
const LAYOUTS = SLIDE_LAYOUTS;
const layoutsFor = (content: unknown): readonly string[] =>
  isSceneContent(content as Record<string, unknown>) ? LAYOUTS : LEGACY_SLIDE_LAYOUTS;

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
  /** Publicada = quem tem o link abre em /slides/:slug. Nasce privada. */
  is_published?: boolean;
  /** 1 = motor principal, 2 = motor de cenas (teste); selo só para devs. */
  engine_version?: number;
}

// Bloco 13: thumbnail renderizado em 800x450 (4x menos pixels que 1920x1080)
// + React.memo + lazy rendering (placeholder se >2 posições do ativo).
const SortableThumbInner = ({ slide, idx, active, onClick, onDelete, themeId, fontId, dynamicTheme, lazyHide, creativeBrief }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="group relative">
      <button onClick={onClick} aria-label={`Ir para o slide ${idx + 1}`} aria-current={active ? "true" : undefined}
        className={`block w-full aspect-video rounded-lg overflow-hidden border-2 transition-all relative ${
          active ? "border-primary shadow-glow" : "border-border hover:border-muted-foreground/40"
        }`}>
        <div className="absolute inset-0 pointer-events-none">
          {lazyHide ? (
            <div className="absolute inset-0" style={{ background: dynamicTheme?.bg ?? "#0a0a0a" }} />
          ) : (
            // 0,155 × 800px = 124px: a largura interna da miniatura do celular (w-32 menos a
            // borda de 2px); no desktop segue 0,25.
            <div className="origin-top-left scale-[0.155] lg:scale-[0.25] w-[800px] h-[450px]">
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
      {/* Visíveis também no foco do teclado e sempre em telas de toque (sem hover, ficavam invisíveis). */}
      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
        <button {...attributes} {...listeners}
          aria-label={`Mover o slide ${idx + 1} (espaço para pegar, setas para mover)`} title="Arrastar para reordenar"
          className="h-6 w-6 [@media(pointer:coarse)]:h-7 [@media(pointer:coarse)]:w-7 rounded bg-background/90 border border-border flex items-center justify-center cursor-grab active:cursor-grabbing">
          <GripVertical className="h-3 w-3" />
        </button>
        <button onClick={onDelete} aria-label={`Excluir o slide ${idx + 1}`} title="Excluir slide"
          className="h-6 w-6 [@media(pointer:coarse)]:h-7 [@media(pointer:coarse)]:w-7 rounded bg-background/90 border border-border flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};
const SortableThumb = React.memo(SortableThumbInner);

/** Menor zoom do canvas: 20% faz o slide caber inteiro mesmo em 320px. */
const MIN_ZOOM = 0.2;
/** Maior zoom dos botões de zoom. */
const MAX_ZOOM = 1.2;
/** Teto do "ajustar à tela": 100% (o slide com 1280px de largura). */
const MAX_FIT_ZOOM = 1;

/**
 * Zoom que faz o slide (1280×720) caber inteiro na área livre do canvas, como o
 * "Ajustar" do Google Slides e do Canva. Antes era fixo (70% no desktop): com o
 * painel de falas aberto entre 1024 e ~1280px o slide ficava estreito ou cortado.
 */
const fitZoomFor = (width: number, height: number): number => {
  const fit = Math.min(width / 1280, height / 720, MAX_FIT_ZOOM);
  return Math.max(MIN_ZOOM, Math.floor(fit * 100) / 100);
};

// Cota de edição por IA (espelha MAX_CHAT_MESSAGES/MAX_COMPLEX_EDITS na edge
// function chat-editor — o backend é a autoridade; aqui é só UX).
const AI_MAX_MESSAGES = 10;
const AI_MAX_COMPLEX = 3;
const AI_LIMIT_MESSAGE = "Limite de edições com IA atingido, gere uma nova apresentação do zero.";
const aiUsageKey = (id: string) => `slideai:edit-usage:${id}`;

/** Assinatura dos campos que `save()` persiste — base da detecção de alterações não salvas. */
const deckSignature = (rows: SlideRow[]): string =>
  JSON.stringify(rows.map((s, i) => [
    s.id, i, s.slide_type, s.layout_template, s.animation_transition || "fade",
    s.speaker_notes || null, s.content ?? {}, s.presenters_data ?? [],
  ]));

const Editor = () => {

  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isDeveloper } = useDeveloperRole();
  // Id (string estável): o objeto `user` muda a cada renovação de token e
  // recarregaria o deck, perdendo edições não salvas.
  const userId = user?.id ?? null;

  const [pres, setPres] = useState<(Pres & { dynamic_theme?: any; creative_brief?: CreativeBrief | null }) | null>(null);
  const [slides, setSlides] = useState<SlideRow[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  // Usado pelo SlideStage para saber a direção (avançar/voltar) da navegação
  // entre slides — necessário para os Overlays de transição que dependem de
  // direção (ex: wipe, split).
  const prevActiveIdxRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [trashed, setTrashed] = useState(false);
  // Fora do ar (plano encerrado ou créditos expirados): não abre para edição.
  const [offline, setOffline] = useState<{ title: string; purgeAt: string | null } | null>(null);
  // O slide abre inteiro na área livre do canvas e reajusta quando ela muda
  // (girar o aparelho, abrir a IA, as falas ou a gaveta do celular, redimensionar
  // a janela), enquanto o usuário não mexer no zoom. "Ajustar à tela" volta ao automático.
  const [zoom, setZoom] = useState(0.7);
  const zoomTouchedRef = useRef(false);
  const [canvasEl, setCanvasEl] = useState<HTMLElement | null>(null);
  const fitToCanvas = useCallback(() => {
    if (!canvasEl) return;
    const inner = canvasEl.firstElementChild as HTMLElement | null;
    const cs = inner ? getComputedStyle(inner) : null;
    const padX = cs ? parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) : 0;
    const padY = cs ? parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) : 0;
    const width = canvasEl.clientWidth - padX;
    const height = canvasEl.clientHeight - padY;
    if (width <= 0 || height <= 0) return;
    setZoom(fitZoomFor(width, height));
  }, [canvasEl]);
  useLayoutEffect(() => {
    if (!canvasEl) return;
    const refit = () => { if (!zoomTouchedRef.current) fitToCanvas(); };
    refit();
    const ro = new ResizeObserver(refit);
    ro.observe(canvasEl);
    return () => ro.disconnect();
  }, [canvasEl, fitToCanvas]);
  const zoomBy = (delta: number) => {
    zoomTouchedRef.current = true;
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((z + delta) * 100) / 100)));
  };
  const zoomToFit = () => {
    zoomTouchedRef.current = false;
    fitToCanvas();
  };
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  // Estado único de "há trabalho não gravado": alimenta o indicador do topo, o
  // autosave e o aviso de beforeunload. Comparar o deck atual com o último
  // persistido (em vez de marcar um flag em cada mutação) garante que nenhum
  // caminho de edição — incluindo undo/redo e as edições vindas da IA, que
  // chamam setSlides direto — escape da detecção.
  const [dirty, setDirty] = useState(false);
  const savedSnapshotRef = useRef<string | null>(null);
  // Cópia do que está gravado no banco — base do merge dos ativos que chegam
  // em segundo plano (resolução progressiva), sem marcar o deck como sujo.
  const savedRowsRef = useRef<SlideRow[]>([]);
  const [savedMark, setSavedMark] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  // Abaixo de 1024px as propriedades ficam numa gaveta que abre pela barra de
  // ferramentas (no desktop o painel fica sempre visível à direita).
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [chat, setChat] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [inlineEdit, setInlineEdit] = useState(false);

  // Cota de edição por IA: 10 mensagens OU 3 edições complexas por apresentação.
  // Persistida por apresentação e reenviada ao backend, que é quem decide.
  const [aiUsage, setAiUsage] = useState({ messages: 0, complex: 0 });
  const aiUndoRef = useRef<SlideRow[] | null>(null);
  const aiUndoThemeRef = useRef<{ theme: Partial<ThemeColors> | null } | null>(null);
  const [canUndoAi, setCanUndoAi] = useState(false);

  // Undo/redo stacks (snapshots of full slides array)
  const undoStack = useRef<SlideRow[][]>([]);
  const redoStack = useRef<SlideRow[][]>([]);
  const skipNextSnapshot = useRef(false);


  // Estado mais recente para callbacks assíncronos (save em fila, resposta da
  // IA): a closure de quem começou a operação enxerga o deck daquele momento.
  const slidesRef = useRef(slides);
  slidesRef.current = slides;
  const presRef = useRef(pres);
  presRef.current = pres;

  // Teclado: espaço pega o slide, setas movem, espaço solta (LBI, art. 63).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => { document.title = "Editor — SlideAI"; }, []);

  // Load presentation
  useEffect(() => {
    if (!slug || authLoading) return;
    (async () => {
      const { data: p } = await supabase.from("presentations")
        .select("id,user_id,title,slug,theme,font_style,include_speeches,presenters_names,presenters_count,dynamic_theme,creative_brief,engine_version,is_published,deleted_at,offline_since").eq("slug", slug).maybeSingle();
      if (!p) {
        // Deck de outra pessoa não aparece aqui (RLS). Se estiver publicado,
        // abre no modo apresentação.
        const { data: shared } = await supabase.rpc("get_shared_presentation", { _slug: slug });
        if (shared) {
          toast.message("Esta apresentação é de outra pessoa — abrindo no modo apresentação.");
          navigate(`/slides/${slug}`, { replace: true });
          return;
        }
        setLoading(false);
        return;
      }
      // Só o dono edita. Uma apresentação pública de outra pessoa abria o
      // Editor (salvar falhava no RLS, mas as imagens pendentes eram buscadas
      // por conta da plataforma) — agora vai para o modo apresentação.
      if (userId && p.user_id !== userId) {
        toast.message("Esta apresentação é de outra pessoa — abrindo no modo apresentação.");
        navigate(`/slides/${slug}`, { replace: true });
        return;
      }
      // Na lixeira: não abre para edição (o autosave gravaria num deck excluído).
      if (p.deleted_at) {
        setTrashed(true);
        setLoading(false);
        return;
      }
      const { data: hosted } = await supabase.rpc("presentation_is_hosted", { _presentation_id: p.id });
      if (hosted === false) {
        const since = p.offline_since ? new Date(p.offline_since) : new Date();
        setOffline({ title: p.title, purgeAt: new Date(since.getTime() + HOSTING_GRACE_DAYS * 86_400_000).toISOString() });
        setLoading(false);
        return;
      }
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
      savedSnapshotRef.current = deckSignature(normalized);
      savedRowsRef.current = JSON.parse(JSON.stringify(normalized));
      // No celular o editor abre com o slide livre (as falas ficam a um toque, na barra de baixo).
      if (presLoaded.include_speeches && window.matchMedia?.("(min-width: 1024px)").matches) setNotesOpen(true);
      setLoading(false);
    })();
  }, [slug, userId, authLoading, navigate]);

  // Bloco 12.2: dynamic_theme prioriza presentations.dynamic_theme; fallback p/ slides legados.
  const dynamicTheme: Partial<ThemeColors> | null = useMemo(
    () => (pres as any)?.dynamic_theme ?? slides[0]?.content?.dynamic_theme ?? null,
    [pres, slides]
  );

  // ── Ativos em segundo plano (motor v2 / persistência no servidor) ──
  // A geração grava o deck com imagens pendentes; aqui elas são resolvidas
  // aos poucos e cada URL é gravada assim que chega. O merge vai no estado
  // local, nas pilhas de desfazer/refazer e na cópia gravada — então um ativo
  // que chega não marca o deck como "não salvo" nem se perde num undo.
  const applyAsset = useCallback(async (slideId: string, patch: AssetPatch) => {
    const merge = (row: SlideRow) => (row.id === slideId ? { ...row, content: { ...row.content, ...patch } } : row);
    setSlides((prev) => prev.map(merge));
    undoStack.current = undoStack.current.map((snap) => snap.map(merge));
    redoStack.current = redoStack.current.map((snap) => snap.map(merge));
    const saved = savedRowsRef.current.find((r) => r.id === slideId);
    if (!saved) return;
    saved.content = { ...saved.content, ...patch };
    savedSnapshotRef.current = deckSignature(savedRowsRef.current);
    setSavedMark((m) => m + 1);
    await saveResolvedAsset(saved, patch);
  }, []);

  const assets = useProgressiveAssets({
    presentationId: pres?.id,
    slides,
    enabled: !loading && !!pres,
    onResolved: applyAsset,
  });

  // Tema resolvido (receitas de imagem do painel Visual usam os hex reais).
  const resolvedTheme = useMemo(() => resolveTheme(pres?.theme ?? "auto", dynamicTheme), [pres?.theme, dynamicTheme]);

  // Pede (de novo) a mídia do slide ativo: o próprio hook enfileira o ativo
  // pendente na próxima renderização.
  const requestMediaFor = (idx: number) => {
    const row = slides[idx];
    if (row) assets.requeue(row.id);
  };

  // Carrega/persiste a cota de edição por IA desta apresentação.
  useEffect(() => {
    if (!pres?.id) return;
    try {
      const raw = localStorage.getItem(aiUsageKey(pres.id));
      if (raw) {
        const parsed = JSON.parse(raw);
        setAiUsage({ messages: Number(parsed.messages) || 0, complex: Number(parsed.complex) || 0 });
      }
    } catch { /* storage indisponível — cota volta a zero, backend segue limitando */ }
  }, [pres?.id]);

  useEffect(() => {
    if (!pres?.id) return;
    try { localStorage.setItem(aiUsageKey(pres.id), JSON.stringify(aiUsage)); } catch { /* ignore */ }
  }, [pres?.id, aiUsage]);


  // `savedMark` reavalia contra os slides ATUAIS depois de cada gravação: se o
  // usuário editou enquanto o save estava em voo, o deck continua sujo.
  useEffect(() => {
    if (savedSnapshotRef.current === null) return;
    setDirty(deckSignature(slides) !== savedSnapshotRef.current);
  }, [slides, savedMark]);

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

  // ── Regeneração de falas por IA (slide atual ou deck inteiro) ──
  const [regeneratingSpeech, setRegeneratingSpeech] = useState<"slide" | "all" | null>(null);
  const [regensLeft, setRegensLeft] = useState<number | null>(null);

  const regenerateSpeeches = async (scope: "slide" | "all") => {
    if (!pres || regeneratingSpeech) return;
    setRegeneratingSpeech(scope);
    try {
      // O servidor escreve as falas a partir dos slides GRAVADOS: com
      // alterações pendentes (texto novo, reordenação), salva antes.
      if (dirty) await save(true);
      const { data, error } = await supabase.functions.invoke("regenerate-speeches", {
        body: { presentationId: pres.id, scope, slideIndex: activeIdx, slideId: slides[activeIdx]?.id },
      });
      const payload: any = data ?? {};
      if (error || payload?.error) {
        toast.error(payload?.error || "Não foi possível regenerar as falas.");
        if (payload?.limitReached) setRegensLeft(0);
        return;
      }
      pushSnapshot();
      setSlides((prev) => {
        const copy = [...prev];
        for (const u of payload.updated ?? []) {
          // Pelo id do slide (a posição na tela pode ter mudado); servidor
          // antigo devolve só a posição.
          const i = u.id ? copy.findIndex((s) => s.id === u.id) : copy.findIndex((_, idx) => idx === u.position);
          if (i >= 0) copy[i] = { ...copy[i], presenters_data: u.presenters_data };
        }
        return copy;
      });
      if (typeof payload.remaining === "number") setRegensLeft(payload.remaining);
      toast.success(
        scope === "all"
          ? "Falas de toda a apresentação regeneradas."
          : `Falas do slide ${activeIdx + 1} regeneradas.`,
      );
    } catch (e: any) {
      toast.error(e?.message || "Erro ao regenerar falas.");
    } finally {
      setRegeneratingSpeech(null);
    }
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
  // Um save por vez, e cada um grava o deck do momento em que roda: antes um
  // autosave e um Ctrl+S simultâneos podiam apagar um slide recém-criado (o
  // delete do save mais antigo não conhecia o slide novo).
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const runSave = useCallback(async (silent: boolean) => {
    const presNow = presRef.current;
    if (!presNow) return;
    const deck = slidesRef.current;
    setSaving(true);
    // Assinatura do que está sendo gravado AGORA — aplicada só se o save der
    // certo, para não marcar como salvo um deck que falhou no meio.
    const attemptedSignature = deckSignature(deck);
    try {
      const rows = deck.map((s, i) => ({
        id: s.id,
        presentation_id: presNow.id,
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

      // Remove slides do banco que não estão mais na lista. Falha aqui deixava
      // posições duplicadas e mostrava "Salvo!".
      const keepIds = rows.map((r) => r.id);
      if (keepIds.length > 0) {
        const { error: delErr } = await supabase
          .from("slides")
          .delete()
          .eq("presentation_id", presNow.id)
          .not("id", "in", `(${keepIds.map((id) => `"${id}"`).join(",")})`);
        if (delErr) throw delErr;
      }

      // Bloco 12.2: tema dinâmico vive em presentations.dynamic_theme
      const { error: presErr } = await supabase.from("presentations").update({
        slides_count: deck.length,
        updated_at: new Date().toISOString(),
        dynamic_theme: presNow.dynamic_theme ?? deck[0]?.content?.dynamic_theme ?? null,
      } as any).eq("id", presNow.id);
      if (presErr) throw presErr;

      savedSnapshotRef.current = attemptedSignature;
      savedRowsRef.current = JSON.parse(JSON.stringify(deck));
      setSavedMark((m) => m + 1);
      setLastSaved(new Date());
      if (!silent) toast.success("Salvo!");
    } catch (e: any) {
      console.error(e);
      if (!silent) toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }, []);

  const save = useCallback((silent = false): Promise<void> => {
    const run = saveChainRef.current.then(() => runSave(silent));
    saveChainRef.current = run.catch(() => undefined);
    return run;
  }, [runSave]);

  // Export do que está na tela, inclusive o que ainda não foi salvo (antes o
  // arquivo saía com a versão gravada no banco).
  const getExportDeck = useCallback((): ExportDeck => ({
    slides: slidesRef.current,
    dynamicTheme: presRef.current?.dynamic_theme ?? slidesRef.current[0]?.content?.dynamic_theme ?? null,
    creativeBrief: presRef.current?.creative_brief ?? null,
  }), []);

  const [publishing, setPublishing] = useState(false);
  const togglePublished = async () => {
    if (!pres) return;
    setPublishing(true);
    const next = !pres.is_published;
    const { error } = await supabase.from("presentations").update({ is_published: next }).eq("id", pres.id);
    setPublishing(false);
    if (error) { toast.error("Não foi possível alterar a visibilidade."); return; }
    setPres((cur) => (cur ? { ...cur, is_published: next } : cur));
    toast.success(next ? "Apresentação publicada: quem tiver o link consegue abrir." : "Apresentação privada: só você abre.");
  };

  // Auto-save a cada 30s, apenas quando há mudança pendente.
  useEffect(() => {
    if (!pres) return;
    const id = setInterval(() => { if (dirty) save(true); }, 30000);
    return () => clearInterval(id);
  }, [pres, save, dirty]);

  // Fechar aba, recarregar ou sair do site com edição pendente: o navegador
  // pede confirmação. Sem isso, tudo que foi feito desde o último autosave
  // (até 30s de trabalho) sumia sem qualquer aviso.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Navegadores antigos só mostram o diálogo quando returnValue é definido.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Navegação interna (react-router) não dispara beforeunload — ao desmontar o
  // editor com alterações pendentes, grava em background.
  const saveRef = useRef(save);
  const dirtyRef = useRef(dirty);
  useEffect(() => { saveRef.current = save; dirtyRef.current = dirty; });
  useEffect(() => () => { if (dirtyRef.current) void saveRef.current(true); }, []);

  // Chat IA do editor manual — Edit Director Engine (edge function chat-editor).
  // Envia contexto completo (deck + presentation_id, de onde o backend puxa
  // creative_brief/dynamic_theme/tokens), histórico da conversa para comandos
  // sequenciais e os contadores de cota; recebe de volta o deck atualizado e o
  // estado anterior, que fica guardado para desfazer a última edição da IA.
  const sendChat = async () => {
    const instruction = chatInput.trim();
    if (!instruction || chatBusy) return;
    if (aiUsage.messages >= AI_MAX_MESSAGES || aiUsage.complex >= AI_MAX_COMPLEX) {
      toast.error(AI_LIMIT_MESSAGE);
      setChat((c) => [...c, { role: "assistant", content: AI_LIMIT_MESSAGE }]);
      return;
    }
    setChatInput("");
    setChat((c) => [...c, { role: "user", content: instruction }]);
    setChatBusy(true);
    try {
      // Ids na ordem enviada: a resposta vem por índice.
      const sentIds = slides.map((s) => s.id);
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
        body: {
          slides: aiSlides,
          dynamic_theme: dynamicTheme,
          instruction,
          presentation_id: pres?.id,
          // Slide aberto: alvo dos pedidos sem número ("troque a imagem", "remova o subtítulo").
          active_index: activeIdx,
          history: chat.slice(-8),
          usage: { messages: aiUsage.messages, complex_edits: aiUsage.complex },
        },
      });
      if (error && !data?.error) throw error;
      if (data?.error) {
        if (data.reason === "edit_quota_reached") {
          setAiUsage({ messages: AI_MAX_MESSAGES, complex: AI_MAX_COMPLEX });
          setChat((c) => [...c, { role: "assistant", content: AI_LIMIT_MESSAGE }]);
          toast.error(AI_LIMIT_MESSAGE);
          return;
        }
        throw new Error(data.error);
      }

      // Só os slides que a IA mudou, sobre o deck ATUAL (ver mergeAiEdits).
      const returned = (data.slides ?? []) as any[];
      const changedIdx: number[] = Array.isArray(data.changed_slides) ? data.changed_slides : returned.map((_, i) => i);
      const deletedIdx: number[] = Array.isArray(data.deleted_slides) ? data.deleted_slides : [];
      const current = slidesRef.current;
      const updated = mergeAiEdits(current, sentIds, returned, data.changed_slides, deletedIdx);
      const structural = changedIdx.length > 0 || deletedIdx.length > 0;

      // Cores pedidas no chat: o servidor devolve o tema novo. Antes era
      // descartado (e a mensagem contava na cota).
      const prevTheme = presRef.current?.dynamic_theme ?? null;
      const nextTheme = data.dynamic_theme && typeof data.dynamic_theme === "object" ? data.dynamic_theme : null;
      const themeChanged = !!nextTheme && JSON.stringify(nextTheme) !== JSON.stringify(dynamicTheme ?? null);

      // Desfazer a edição da IA (além do undo genérico) volta a este estado.
      aiUndoRef.current = JSON.parse(JSON.stringify(current));
      aiUndoThemeRef.current = themeChanged ? { theme: prevTheme } : null;
      setCanUndoAi(structural || themeChanged);
      if (structural) {
        undoStack.current.push(JSON.parse(JSON.stringify(current)));
        if (undoStack.current.length > 50) undoStack.current.shift();
        redoStack.current = [];
        // Atualiza a referência já: o save abaixo grava o deck editado.
        slidesRef.current = updated;
        setSlides(updated);
        // Slide aberto foi excluído: fica no vizinho.
        if (deletedIdx.length) setActiveIdx((i) => Math.max(0, Math.min(updated.length - 1, i)));
      }
      if (themeChanged && pres) {
        setPres((p) => (p ? { ...p, dynamic_theme: nextTheme } : p));
        const { error: themeErr } = await supabase.from("presentations").update({ dynamic_theme: nextTheme } as any).eq("id", pres.id);
        if (themeErr) toast.error("As cores mudaram na tela, mas não foram salvas. Tente de novo.");
      }
      // Bloco visual que passou a pedir mídia (ex.: "mostre a vista explodida"):
      // o ativo pendente entra na fila de resolução em segundo plano.
      for (const row of updated) {
        if (row.content?.asset?.status === "pending") assets.requeue(row.id);
      }
      if (data.usage) {
        setAiUsage({
          messages: Number(data.usage.messages) || aiUsage.messages + 1,
          complex: Number(data.usage.complex_edits) || aiUsage.complex,
        });
      }
      // A alteração vai direto para a apresentação: grava agora, sem esperar o autosave.
      if (structural) void save(true);
      setChat((c) => [...c, { role: "assistant", content: data.assistant_message || "Pronto, atualizei!" }]);
    } catch (e: any) {
      console.error(e);
      setChat((c) => [...c, { role: "assistant", content: "Não consegui aplicar essa mudança. Tenta reformular?" }]);
      toast.error(e.message || "Erro no chat");
    } finally {
      setChatBusy(false);
    }
  };

  const undoAiEdit = () => {
    const snap = aiUndoRef.current;
    if (!snap) return;
    skipNextSnapshot.current = true;
    setSlides(JSON.parse(JSON.stringify(snap)));
    const themeUndo = aiUndoThemeRef.current;
    if (themeUndo && pres) {
      setPres((p) => (p ? { ...p, dynamic_theme: themeUndo.theme } : p));
      void supabase.from("presentations").update({ dynamic_theme: themeUndo.theme } as any).eq("id", pres.id);
    }
    aiUndoRef.current = null;
    aiUndoThemeRef.current = null;
    setCanUndoAi(false);
    toast.success("Última edição da IA desfeita.");
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
  if (offline) return <PresentationOffline isOwner title={offline.title} purgeAt={offline.purgeAt} />;
  if (!pres) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold">{trashed ? "Esta apresentação está na lixeira" : "Apresentação não encontrada"}</h1>
        {trashed && <p className="text-muted-foreground mt-2">Para editá-la de novo, <Link to="/suporte" className="text-primary underline">abra um atendimento</Link> e peça para restaurá-la.</p>}
        <Link to="/dashboard" className="text-primary underline mt-4 inline-block">Voltar</Link>
      </div>
    </div>
  );

  const current = slides[activeIdx];
  const c = current?.content || {};

  // Celular e tablet (< 1024px): um painel por vez, numa gaveta abaixo do slide
  // (ao lado dele com o aparelho deitado), como no Canva e no Google Slides.
  // O slide continua à vista enquanto se edita.
  const notesAvailable = !!pres.include_speeches && !!current;
  type MobilePanel = "inspector" | "chat" | "notes";
  const mobilePanel: MobilePanel | null =
    notesOpen && notesAvailable ? "notes" : chatOpen ? "chat" : inspectorOpen ? "inspector" : null;
  const toggleMobilePanel = (panel: MobilePanel) => {
    const opening = mobilePanel !== panel;
    setInspectorOpen(opening && panel === "inspector");
    setChatOpen(opening && panel === "chat");
    setNotesOpen(opening && panel === "notes");
  };
  /** Gaveta do celular: só o painel ativo aparece, embaixo do slide (ao lado, deitado). */
  const drawerClass = (panel: MobilePanel) =>
    `${mobilePanel === panel ? "flex" : "hidden"} basis-[55%] mobile-landscape:basis-1/2 min-h-0 min-w-0 w-full border-t mobile-landscape:border-t-0 mobile-landscape:border-l`;
  // IA e falas: de 1024 a 1535px ficam embaixo do slide, um por vez (como as notas
  // do PowerPoint e do Google Slides). Antes, em coluna, com as falas abertas o
  // slide ficava com ~150px em 1024px e 320px em 1280px. A partir de 1536px voltam a ser colunas.
  const dockedPanel: "chat" | "notes" | null = notesOpen && notesAvailable ? "notes" : chatOpen ? "chat" : null;
  const dockedClass = (panel: "chat" | "notes", wideWidth: string) =>
    `${drawerClass(panel)} ${dockedPanel === panel ? "lg:flex" : "lg:hidden"} lg:basis-[45%] lg:w-full lg:border-t lg:border-l-0 2xl:flex 2xl:basis-auto ${wideWidth} 2xl:border-t-0 2xl:border-l`;
  const stackedPanels = () => window.matchMedia?.("(max-width: 1535px)").matches === true;
  const mobileTools: { id: string; icon: typeof Pencil; label: string; name: string; active: boolean; onClick: () => void; controls?: string }[] = [
    { id: "inspector", icon: SlidersHorizontal, label: "Editar", name: "Editar slide", active: mobilePanel === "inspector", onClick: () => toggleMobilePanel("inspector"), controls: "editor-panel-inspector" },
    { id: "inline", icon: Pencil, label: "Texto", name: "Texto no slide", active: inlineEdit, onClick: () => setInlineEdit((v) => !v) },
    { id: "chat", icon: MessageSquare, label: "IA", name: "Assistente IA", active: mobilePanel === "chat", onClick: () => toggleMobilePanel("chat"), controls: "editor-panel-chat" },
    ...(notesAvailable ? [{ id: "notes", icon: Users, label: "Falas", name: "Falas e notas", active: mobilePanel === "notes", onClick: () => toggleMobilePanel("notes"), controls: "editor-panel-notes" }] : []),
  ];
  // Painéis: aria-expanded (+ aria-controls quando aberto); "Texto" é um alternador (aria-pressed).
  const toolState = (t: (typeof mobileTools)[number]) =>
    t.controls ? { "aria-expanded": t.active, "aria-controls": t.active ? t.controls : undefined } : { "aria-pressed": t.active };

  return (
    // 100dvh: no celular, 100vh inclui a área atrás da barra do navegador e escondia o rodapé.
    <div className="h-screen supports-[height:100dvh]:h-[100dvh] flex flex-col bg-background">
      {/* Toolbar */}
      <header className="border-b border-border flex-shrink-0 bg-card/40 backdrop-blur">
        {/* Celular: uma linha só (antes eram três). Zoom, publicar e apresentar vão para
            "Mais opções"; Editar, Texto, IA e Falas, para a barra de baixo. */}
        <div className="px-3 md:px-4 py-2 flex items-center gap-1 sm:gap-2 md:gap-3 flex-nowrap lg:flex-wrap">
          <button type="button" onClick={() => navigate("/dashboard")} aria-label="Voltar ao painel"
            className="flex items-center justify-center gap-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11">
            <ArrowLeft className="h-4 w-4" /> {/* Some no celular deitado (altura ≤ 500px), onde o cabeçalho divide espaço com as ferramentas. */}
            <span className="hidden sm:[@media(min-height:501px)]:inline lg:inline">Dashboard</span>
          </button>
          <div className="h-5 w-px bg-border hidden sm:block" />
          <div className="hidden min-[360px]:flex items-center gap-1 min-w-0">
            <Sparkles className="h-4 w-4 text-primary flex-shrink-0 hidden sm:block" />
            <span className="font-display font-semibold truncate text-sm">{pres.title}</span>
            {isDeveloper && (
              <span
                className={`ml-1 flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                  pres.engine_version === 2 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground"
                }`}
                title="Visível só para desenvolvedores: motor que gerou esta apresentação"
              >
                {pres.engine_version === 2 ? "v2 · teste" : "v1"}
              </span>
            )}
          </div>
          <div className="h-5 w-px bg-border hidden md:block" />
          <div className="flex flex-shrink-0 items-center gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={undo} disabled={!undoStack.current.length} title="Desfazer (Ctrl+Z)" aria-label="Desfazer">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={redo} disabled={!redoStack.current.length} title="Refazer (Ctrl+Y)" aria-label="Refazer">
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="h-5 w-px bg-border hidden lg:block" />
          <div className="hidden lg:flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => zoomBy(-0.1)} aria-label="Diminuir zoom" title="Diminuir zoom"><ZoomOut className="h-4 w-4" /></Button>
            {/* Clicar no percentual volta ao "ajustar à tela" (como no Google Slides). */}
            <button type="button" onClick={zoomToFit} title="Ajustar à tela" aria-label={`Ajustar à tela (zoom atual ${Math.round(zoom * 100)}%)`}
              className="h-8 min-w-10 rounded-md px-1 text-xs font-medium tabular-nums hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {Math.round(zoom * 100)}%
            </button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => zoomBy(0.1)} aria-label="Aumentar zoom" title="Aumentar zoom"><ZoomIn className="h-4 w-4" /></Button>
          </div>
          {/* Celular deitado: as ferramentas cabem aqui em cima (a barra de baixo roubaria altura). */}
          <div className="hidden mobile-landscape:flex items-center gap-1" role="group" aria-label="Ferramentas do editor">
            {mobileTools.map((t) => (
              <Button key={t.id} size="icon" variant={t.active ? "hero" : "ghost"} className="h-8 w-8" onClick={t.onClick} aria-label={t.name} title={t.name} {...toolState(t)}>
                <t.icon className="h-4 w-4" />
              </Button>
            ))}
          </div>
          <div className="ml-auto flex flex-shrink-0 items-center justify-end gap-1 md:gap-2 lg:flex-wrap">
            {/* No celular (retrato ou deitado) o estado vira um ponto no botão Salvar. */}
            <span className={`hidden sm:[@media(min-height:501px)]:inline lg:inline text-[11px] ${dirty && !saving ? "text-amber-500" : "text-muted-foreground"}`}>
              {saving ? "Salvando..." : dirty ? "Não salvo" : lastSaved ? `Salvo ${lastSaved.toLocaleTimeString()}` : "Salvo"}
            </span>
            <Button variant={inlineEdit ? "hero" : "ghost"} size="sm" className="hidden lg:inline-flex" onClick={() => setInlineEdit((v) => !v)} title="Editar texto direto no canvas" aria-label="Editar texto direto no canvas" aria-pressed={inlineEdit}>
              <Pencil className="h-4 w-4" /> <span className="hidden md:inline">Inline</span>
            </Button>
            <Button variant={chatOpen ? "hero" : "ghost"} size="sm" className="hidden lg:inline-flex" onClick={() => { const next = !chatOpen; setChatOpen(next); if (next && stackedPanels()) setNotesOpen(false); }} title="Assistente IA" aria-label="Assistente IA" aria-pressed={chatOpen}>
              <MessageSquare className="h-4 w-4" /> <span className="hidden md:inline">IA</span>
            </Button>
            {pres.include_speeches && (
              <Button
                variant={notesOpen ? "hero" : "ghost"} size="sm" className="hidden lg:inline-flex"
                onClick={() => { const next = !notesOpen; setNotesOpen(next); if (next && stackedPanels()) setChatOpen(false); }}
                title="Falas e notas por apresentador"
                aria-label="Falas e notas por apresentador"
                aria-pressed={notesOpen}
              >
                <Users className="h-4 w-4" /> <span className="hidden md:inline">Falas</span>
              </Button>
            )}
            <Button
              variant="ghost" size="sm" className="hidden lg:inline-flex" onClick={togglePublished} disabled={publishing}
              title={pres.is_published ? "Publicada: quem tiver o link abre. Clique para tornar privada." : "Privada: só você abre. Clique para publicar."}
              aria-label={pres.is_published ? "Tornar apresentação privada" : "Publicar apresentação"}
            >
              {pres.is_published ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              <span className="hidden md:inline">{pres.is_published ? "Publicada" : "Privada"}</span>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden lg:inline-flex">
              <Link to={`/slides/${pres.slug}`} target="_blank" aria-label="Apresentar (abre em nova aba)"><Play className="h-4 w-4" /> <span className="hidden md:inline">Apresentar</span></Link>
            </Button>
            <ExportMenu presentationId={pres.id} getDeck={getExportDeck} title={pres.title} themeId={pres.theme} fontId={pres.font_style} slug={pres.slug} />
            {/* Celular e tablet: zoom, publicar e apresentar num menu (como o "⋯" do Canva). */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 lg:hidden" aria-label="Mais opções" title="Mais opções">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Zoom: {Math.round(zoom * 100)}%</DropdownMenuLabel>
                <DropdownMenuItem className="gap-2" onSelect={zoomToFit}><Maximize className="h-4 w-4" /> Ajustar à tela</DropdownMenuItem>
                {/* Ampliar/reduzir não fecham o menu: dá para tocar várias vezes. */}
                <DropdownMenuItem className="gap-2" onSelect={(e) => { e.preventDefault(); zoomBy(0.1); }}><ZoomIn className="h-4 w-4" /> Ampliar</DropdownMenuItem>
                <DropdownMenuItem className="gap-2" onSelect={(e) => { e.preventDefault(); zoomBy(-0.1); }}><ZoomOut className="h-4 w-4" /> Reduzir</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2" disabled={publishing} onSelect={() => { void togglePublished(); }}>
                  {pres.is_published ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                  {pres.is_published ? "Tornar privada" : "Publicar"}
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2" asChild>
                  <Link to={`/slides/${pres.slug}`} target="_blank"><Play className="h-4 w-4" /> Apresentar (nova aba)</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="hero" size="sm" className="relative [@media(pointer:coarse)]:min-w-11" onClick={() => save()} disabled={saving}
              aria-label={dirty && !saving ? "Salvar (há alterações não salvas)" : "Salvar"}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} <span className="hidden sm:[@media(min-height:501px)]:inline lg:inline">Salvar</span>
              {dirty && !saving && <span aria-hidden className="sm:[@media(min-height:501px)]:hidden lg:hidden absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-background" />}
            </Button>
          </div>
        </div>
      </header>

      {/* < 1024px: slide fixo no topo, miniaturas numa faixa e um painel por vez numa
          gaveta embaixo (deitado: miniaturas à esquerda e painel ao lado do slide). */}
      <div className="flex-1 flex flex-col lg:flex-row mobile-landscape:flex-row overflow-hidden min-h-0">
        {/* Left: thumbnails — vertical em ≥lg e no celular deitado, horizontal no retrato.
            Deitado, com um painel aberto, a coluna some para o slide e o painel caberem. */}
        <aside aria-label="Slides" className={`${mobilePanel ? "mobile-landscape:hidden" : ""} lg:w-44 xl:w-52 mobile-landscape:w-36 border-b lg:border-b-0 lg:border-r mobile-landscape:border-b-0 mobile-landscape:border-r border-border bg-card/30 flex lg:flex-col mobile-landscape:flex-col flex-shrink-0 min-h-0`}>
          {/* No celular o cabeçalho fica estreito ao lado da faixa (com w-full ele ocupava a linha e escondia as miniaturas). */}
          <div className="px-2 lg:px-3 py-2 border-r lg:border-r-0 lg:border-b mobile-landscape:border-r-0 mobile-landscape:border-b border-border flex items-center justify-between flex-shrink-0">
            <span className="hidden lg:inline mobile-landscape:inline text-xs font-semibold uppercase tracking-wide text-muted-foreground">Slides</span>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={addSlide} aria-label="Adicionar slide" title="Adicionar slide"><Plus className="h-3.5 w-3.5" /></Button>
          </div>
          <ScrollArea className="flex-1 min-w-0 min-h-0" scrollbars="both">
            <div className="p-2 flex lg:flex-col mobile-landscape:flex-col gap-2 lg:space-y-0">
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

        {/* Slide + painéis. Celular: coluna (deitado, linha) com a gaveta. 1024–1535px: slide
            com IA/falas embaixo e propriedades à direita. ≥1536px: os invólucros somem
            (contents) e tudo fica numa linha, como antes. */}
        <div className="flex flex-1 min-h-0 min-w-0 flex-col mobile-landscape:flex-row lg:flex-row 2xl:contents">
        <div className="contents lg:flex lg:flex-1 lg:flex-col lg:min-h-0 lg:min-w-0 2xl:contents">
        {/* Center: canvas */}
        {/* Focável: quando o slide é maior que a área, dá para rolar pelo teclado. */}
        <main ref={setCanvasEl} tabIndex={0} aria-label="Área do slide" className="flex-1 min-h-0 min-w-0 bg-muted/30 overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
          {/* Centralização "segura" (m-auto): com justify-center, um slide maior que a
              área ficava cortado à esquerda, sem como rolar até lá. */}
          <div className="min-h-full min-w-full w-max flex p-3 lg:p-6">
            {current && (
              <div
                className="m-auto shadow-elegant rounded-2xl overflow-hidden bg-black flex-shrink-0 relative"
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
                  <div className="absolute inset-0 flex flex-col p-2 lg:p-4 gap-2 overflow-y-auto bg-black/50 backdrop-blur-sm">
                    <div className="flex items-center justify-between text-white text-xs mb-1">
                      <span className="flex items-center gap-1.5"><Pencil className="h-3 w-3" /> Edição inline ativa</span>
                      <button type="button" onClick={() => setInlineEdit(false)} className="hover:bg-white/10 rounded p-1 [@media(pointer:coarse)]:p-2.5" aria-label="Sair da edição direta"><X className="h-3 w-3" /></button>
                    </div>
                    <input
                      value={c.headline || ""}
                      onChange={(e) => updateContent(activeIdx, { headline: e.target.value })}
                      placeholder="Título do slide"
                      aria-label="Título do slide"
                      className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-base lg:text-2xl font-bold placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <input
                      value={c.subtitle || ""}
                      onChange={(e) => updateContent(activeIdx, { subtitle: e.target.value })}
                      placeholder="Subtítulo"
                      aria-label="Subtítulo"
                      className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-base placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <textarea
                      value={c.body_text || ""}
                      onChange={(e) => updateContent(activeIdx, { body_text: e.target.value })}
                      placeholder="Texto principal"
                      aria-label="Texto principal"
                      className="flex-1 min-h-[3rem] bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-base lg:text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* AI Assistant drawer (esquerda do inspector) */}
        {chatOpen && (
          <aside id="editor-panel-chat" aria-label="Assistente IA" className={`${dockedClass("chat", "2xl:w-80")} border-border bg-card/40 flex-col flex-shrink-0`}>
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5 text-primary" /> Assistente IA
              </span>
              <button type="button" onClick={() => setChatOpen(false)} className="hover:bg-muted rounded p-1 [@media(pointer:coarse)]:p-2.5" aria-label="Fechar assistente de IA"><X className="h-3 w-3" /></button>
            </div>
            <ScrollArea className="flex-1 min-h-0 px-3 py-3">
              {/* Respostas da IA anunciadas por leitores de tela. */}
              <div className="space-y-3" role="log" aria-live="polite" aria-label="Conversa com o assistente de IA">
                {chat.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-6">
                    Peça mudanças em linguagem natural — a IA aplica direto na apresentação e salva.<br />
                    Sem número de slide, vale o slide aberto (agora: {activeIdx + 1}).<br />
                    Ex: <em>"troque a imagem por uma foto de um castelo"</em>, <em>"remova o subtítulo"</em>,{" "}
                    <em>"mude o título para Reconquista"</em>, <em>"transforme os tópicos em linha do tempo"</em>,{" "}
                    <em>"exclua o slide 5"</em>.
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
            <div className="p-2 border-t border-border space-y-2">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>
                  {aiUsage.messages}/{AI_MAX_MESSAGES} mensagens · {aiUsage.complex}/{AI_MAX_COMPLEX} edições complexas
                </span>
                {canUndoAi && (
                  <button onClick={undoAiEdit} className="text-primary hover:underline font-medium">
                    Desfazer edição da IA
                  </button>
                )}
              </div>
              <div className="flex gap-1.5">
                <Textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)} aria-label="Pedido para a IA"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  placeholder={`Ex: troque a imagem deste slide (${activeIdx + 1})`} rows={2} className="resize-none text-base md:text-xs"
                  disabled={chatBusy || aiUsage.messages >= AI_MAX_MESSAGES || aiUsage.complex >= AI_MAX_COMPLEX} />
                <Button size="icon" variant="hero" onClick={sendChat} aria-label="Enviar pedido à IA"
                  disabled={chatBusy || !chatInput.trim() || aiUsage.messages >= AI_MAX_MESSAGES || aiUsage.complex >= AI_MAX_COMPLEX}
                  className="self-end h-9 w-9">
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

          </aside>
        )}

        {/* Presenter Notes Panel — apenas quando include_speeches está ativo */}
        {notesOpen && pres.include_speeches && current && (
          <PresenterNotesPanel
            slides={slides.map((s, i) => ({
              headline: s.content?.headline,
              presenters_data: ensurePresenterSpeeches(s as any, pres.presenters_names ?? [], i) as any,
            }))}
            activeIdx={activeIdx}
            presentationTitle={pres.title}
            presentersNames={pres.presenters_names ?? []}
            onUpdate={updatePresenters}
            onRegenerate={regenerateSpeeches}
            regenerating={regeneratingSpeech}
            regensLeft={regensLeft}
            onClose={() => setNotesOpen(false)}
            id="editor-panel-notes"
            className={dockedClass("notes", "2xl:w-96")}
          />

        )}
        </div>

        {/* Right: inspector */}
        <aside id="editor-panel-inspector" aria-label="Propriedades do slide" className={`${drawerClass("inspector")} lg:flex lg:basis-auto lg:w-80 lg:border-t-0 lg:border-l border-border bg-card/30 flex-col flex-shrink-0`}>
          {/* Cabeçalho da gaveta (só celular/tablet): no desktop o painel é fixo. */}
          <div className="lg:hidden px-3 py-1.5 border-b border-border flex items-center justify-between flex-shrink-0">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5 text-primary" /> Editar slide {activeIdx + 1}
            </span>
            <button type="button" onClick={() => setInspectorOpen(false)} className="hover:bg-muted rounded p-1 [@media(pointer:coarse)]:p-2.5" aria-label="Fechar painel de edição"><X className="h-3 w-3" /></button>
          </div>
          {current && (
            <Tabs defaultValue="text" className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid grid-cols-6 m-2">
                <TabsTrigger value="text" title="Texto" aria-label="Texto"><Type className="h-3.5 w-3.5" /></TabsTrigger>
                <TabsTrigger value="visual" title="Visual" aria-label="Visual"><Shapes className="h-3.5 w-3.5" /></TabsTrigger>
                <TabsTrigger value="image" title="Imagem" aria-label="Imagem"><ImageIcon className="h-3.5 w-3.5" /></TabsTrigger>
                <TabsTrigger value="anim" title="Animação" aria-label="Animação"><Wand2 className="h-3.5 w-3.5" /></TabsTrigger>
                <TabsTrigger value="layout" title="Layout" aria-label="Layout"><LayoutIcon className="h-3.5 w-3.5" /></TabsTrigger>
                <TabsTrigger value="slide" title="Slide" aria-label="Slide"><FileText className="h-3.5 w-3.5" /></TabsTrigger>
              </TabsList>
              <ScrollArea className="flex-1 min-h-0 px-3 pb-4">
                <TabsContent value="text" className="space-y-3 mt-0">
                  <div className="space-y-1.5">
                    <Label htmlFor="insp-headline" className="text-xs">Headline</Label>
                    <Textarea id="insp-headline" value={c.headline || ""} onChange={(e) => updateContent(activeIdx, { headline: e.target.value })} rows={2} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="insp-subtitle" className="text-xs">Subtítulo</Label>
                    <Textarea id="insp-subtitle" value={c.subtitle || ""} onChange={(e) => updateContent(activeIdx, { subtitle: e.target.value })} rows={2} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="insp-body" className="text-xs">Texto principal</Label>
                    <Textarea id="insp-body" value={c.body_text || ""} onChange={(e) => updateContent(activeIdx, { body_text: e.target.value })} rows={5} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="insp-bullets" className="text-xs">Bullets (um por linha)</Label>
                    <Textarea id="insp-bullets" value={(c.bullets || []).join("\n")}
                      onChange={(e) => updateContent(activeIdx, { bullets: e.target.value.split("\n").filter(Boolean) })}
                      rows={5} />
                  </div>
                  {(current.layout_template === "stat-highlight") && (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="insp-stat-value" className="text-xs">Stat (número)</Label>
                        <Input id="insp-stat-value" value={c.stat_value || ""} onChange={(e) => updateContent(activeIdx, { stat_value: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="insp-stat-label" className="text-xs">Stat (descrição)</Label>
                        <Input id="insp-stat-label" value={c.stat_label || ""} onChange={(e) => updateContent(activeIdx, { stat_label: e.target.value })} />
                      </div>
                    </>
                  )}
                  {(current.slide_type === "quote" || current.layout_template === "quote") && (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="insp-quote" className="text-xs">Citação</Label>
                        <Textarea id="insp-quote" value={c.quote_text || ""} onChange={(e) => updateContent(activeIdx, { quote_text: e.target.value })} rows={3} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="insp-quote-author" className="text-xs">Autor</Label>
                        <Input id="insp-quote-author" value={c.quote_author || ""} onChange={(e) => updateContent(activeIdx, { quote_author: e.target.value })} />
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="visual" className="mt-0">
                  <VisualPanel
                    slide={current}
                    theme={resolvedTheme}
                    brief={pres.creative_brief ?? null}
                    onContentChange={(patch) => updateContent(activeIdx, patch)}
                    onLayoutChange={(layout) => updateSlide(activeIdx, { layout_template: layout })}
                    onRequestMedia={() => requestMediaFor(activeIdx)}
                  />
                  {assets.pending > 0 && (
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      {assets.pending} {assets.pending === 1 ? "imagem sendo preparada" : "imagens sendo preparadas"} em segundo plano.
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="image" className="space-y-3 mt-0">
                  <div className="space-y-1.5">
                    <Label htmlFor="insp-image-url" className="text-xs">URL da imagem</Label>
                    <Input id="insp-image-url" value={c.image_url || ""} onChange={(e) => updateContent(activeIdx, { image_url: e.target.value })} placeholder="https://..." />
                  </div>
                  {c.image_url && <img src={c.image_url} alt="" className="w-full rounded-lg aspect-video object-cover" />}
                  <div className="space-y-1.5">
                    <Label htmlFor="insp-image-query" className="text-xs">Termo de busca (Pexels) / prompt</Label>
                    <Input id="insp-image-query" value={c.image_query || ""} onChange={(e) => updateContent(activeIdx, { image_query: e.target.value })} placeholder="ex: spanish flag sunset" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="insp-image-strategy" className="text-xs">Estratégia</Label>
                    <Select value={c.image_strategy || "pexels"} onValueChange={(v) => updateContent(activeIdx, { image_strategy: v })}>
                      <SelectTrigger id="insp-image-strategy"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pexels">Pexels (foto real)</SelectItem>
                        <SelectItem value="ai">Gerar com IA</SelectItem>
                        <SelectItem value="none">Sem imagem</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {c.image_strategy === "ai" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="insp-ai-prompt" className="text-xs">Prompt de IA</Label>
                      <Textarea id="insp-ai-prompt" value={c.ai_image_prompt || ""} onChange={(e) => updateContent(activeIdx, { ai_image_prompt: e.target.value })} rows={3} />
                    </div>
                  )}
                  <Button variant="outline" size="sm" className="w-full" disabled={!c.image_query && !(isSceneContent(c) && c.visual)}
                    onClick={async () => {
                      // Motor v2: a imagem do bloco visual vem da receita do
                      // Image Director e entra na fila de ativos do deck.
                      const spec = isSceneContent(c) && c.visual ? getCommand(c.visual.command) : undefined;
                      if (spec && spec.renderMode !== "native") {
                        const briefDomain = pres.creative_brief?.domain;
                        const ctx = {
                          palette: { bg: resolvedTheme.bg, text: resolvedTheme.text, accent: resolvedTheme.accent, accent2: resolvedTheme.accent2 },
                          style: pres.creative_brief?.visual_style,
                          domain: isDomain(briefDomain) ? briefDomain : undefined,
                          budgetMode: "balanced" as const,
                          fallbackSubject: c.headline ?? "",
                        };
                        const asset: SlideAsset = spec.photoEligible
                          ? photoAssetFor(spec, c.visual, ctx, c.image_query || c.visual.subject || c.headline || "", true)
                          : aiAssetFor(spec, c.visual, ctx, current.layout_template);
                        updateContent(activeIdx, { asset, image_url: null, visual: { ...c.visual, render_mode: undefined } });
                        requestMediaFor(activeIdx);
                        toast.success("Imagem na fila — ela aparece no slide assim que ficar pronta.");
                        return;
                      }
                      toast.loading("Buscando imagem...", { id: "img" });
                      const url = await fetchSlideImage({
                        query: c.image_query!,
                        ai_image_prompt: c.ai_image_prompt,
                        image_strategy: c.image_strategy,
                        image_style: c.image_style,
                      });
                      if (url) {
                        updateContent(activeIdx, { image_url: url });
                        toast.success("Imagem atualizada!", { id: "img" });
                      } else {
                        toast.error("Não foi possível buscar a imagem.", { id: "img" });
                      }
                    }}>
                    <ImageIcon className="h-4 w-4" /> Buscar / gerar imagem
                  </Button>
                </TabsContent>

                <TabsContent value="anim" className="space-y-3 mt-0">
                  <div className="space-y-1.5">
                    <Label htmlFor="insp-motion" className="text-xs">Animação de entrada (per-elemento)</Label>
                    {/* Antes gravava o campo legado `animation`, que sempre perdia
                        para animation_intent — o seletor não tinha efeito visível.
                        Agora grava `motion` (preset em JSON), lido pelo motor de
                        cenas e traduzido para os slides de texto. */}
                    <Select value={c.motion?.preset ?? ""}
                      onValueChange={(v) => updateContent(activeIdx, { motion: { ...(c.motion ?? {}), preset: v } })}>
                      <SelectTrigger id="insp-motion"><SelectValue placeholder="automática (pelo papel do slide)" /></SelectTrigger>
                      <SelectContent>
                        {MOTION_PRESETS.map((m) => <SelectItem key={m} value={m}>{MOTION_PRESET_LABELS[m]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Bloco 1.5: transição cinematográfica do slide */}
                  <div className="space-y-1.5">
                    <Label htmlFor="insp-transition" className="text-xs">Transição entre slides</Label>
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
                      <SelectTrigger id="insp-transition"><SelectValue placeholder="auto (padrão dinâmico)" /></SelectTrigger>
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
                      <Label htmlFor="insp-cover" className="text-xs">Variação da capa</Label>
                      <Select value={(c as any).cover_variant || ""}
                        onValueChange={(v) => updateContent(activeIdx, { cover_variant: v })}>
                        <SelectTrigger id="insp-cover"><SelectValue placeholder="auto" /></SelectTrigger>
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
                    <Label htmlFor="insp-layout" className="text-xs">Layout</Label>
                    <Select value={current.layout_template} onValueChange={(v) => updateSlide(activeIdx, { layout_template: v })}>
                      <SelectTrigger id="insp-layout"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {layoutsFor(current.content).map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="insp-slide-type" className="text-xs">Tipo de slide</Label>
                    <Select value={current.slide_type} onValueChange={(v) => updateSlide(activeIdx, { slide_type: v })}>
                      <SelectTrigger id="insp-slide-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SLIDE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <TabsContent value="slide" className="space-y-3 mt-0">
                  <div className="space-y-1.5">
                    <Label htmlFor="insp-notes" className="text-xs">Notas do orador</Label>
                    <Textarea id="insp-notes" value={current.speaker_notes || ""}
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

      {/* Celular (retrato): ferramentas ao alcance do polegar, como no Canva; cada uma
          abre (ou fecha) a gaveta correspondente. Deitado, ficam no topo. */}
      <div role="group" aria-label="Ferramentas do editor" className="lg:hidden mobile-landscape:hidden flex-shrink-0 grid grid-flow-col auto-cols-fr border-t border-border bg-card/80 backdrop-blur">
        {mobileTools.map((t) => (
          <button key={t.id} type="button" onClick={t.onClick} aria-label={t.name} title={t.name} {...toolState(t)}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${t.active ? "text-[hsl(var(--primary-deep))] dark:text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${t.active ? "bg-primary/15" : ""}`}>
              <t.icon className="h-4 w-4" />
            </span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * Uma instância por apresentação: sem a key, trocar de /editor/A para
 * /editor/B (ex.: uma geração que termina enquanto se edita outro deck)
 * reaproveitava o estado — undo, fila de save e cota de A — dentro de B.
 */
const EditorPage = () => {
  const { slug } = useParams();
  return <Editor key={slug} />;
};

export default EditorPage;
