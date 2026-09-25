// Painel "Visual" do Editor (motor v2): troca o comando entre os compatíveis
// com os itens atuais, edita os itens, regenera a imagem e muda fundo e
// preset de movimento. Tudo escreve em `content` (visual/background/motion/
// asset), com merge sobre o valor anterior — o mesmo contrato do chat-editor.
import { useMemo } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Plus, Shapes, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ThemeColors } from "@/lib/slugify";
import { checkCommand, compatibleCommands, type SceneVisual, type VisualItem } from "../../../supabase/functions/_shared/visualBlock.ts";
import { getCommand, needsMedia } from "../../../supabase/functions/_shared/visualCommands.ts";
import { SCENE_ICONS } from "../../../supabase/functions/_shared/sceneIcons.ts";
import { MOTION_PRESETS, MOTION_PRESET_LABELS } from "../../../supabase/functions/_shared/motionPresets.ts";
import { BACKGROUND_KINDS, SCENE_ENGINE_VERSION } from "../../../supabase/functions/_shared/sceneMedia.ts";
import { aiAssetFor, photoAssetFor, type AssetContext } from "../../../supabase/functions/_shared/sceneResolver.ts";
import { isDomain } from "../../../supabase/functions/_shared/sceneCatalog.ts";

const BACKGROUND_LABELS: Record<string, string> = {
  solid: "Sólido",
  "gradient-mesh": "Gradient mesh",
  aurora: "Aurora (blobs)",
  grain: "Grão editorial",
  grid: "Grade geométrica",
  "photo-duotone": "Foto em duotone",
  spotlight: "Palco com spotlight",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "gerando…",
  ready: "pronta",
  failed: "falhou — usando o desenho nativo",
};

interface Props {
  slide: { id: string; slide_type: string; layout_template: string; content: any };
  theme: ThemeColors;
  brief?: { visual_style?: string; domain?: string } | null;
  onContentChange: (patch: Record<string, unknown>) => void;
  onLayoutChange: (layout: string) => void;
  /** O Editor recoloca o ativo do slide na fila de resolução. */
  onRequestMedia: () => void;
}

const NONE = "__none__";

/** "Rótulo: detalhe" → item; bullet curto → só rótulo. */
function itemFromBullet(b: string): VisualItem {
  const [head, ...rest] = b.split(/:\s+|\s+[—–-]\s+/);
  if (rest.length) return { label: head.trim().slice(0, 60), detail: rest.join(" — ").trim().slice(0, 160) };
  const words = b.trim().split(/\s+/);
  return words.length <= 5 ? { label: b.trim() } : { label: words.slice(0, 4).join(" "), detail: b.trim() };
}

export const VisualPanel = ({ slide, theme, brief, onContentChange, onLayoutChange, onRequestMedia }: Props) => {
  const c = slide.content ?? {};
  const visual: SceneVisual | undefined = c.visual;
  const spec = visual ? getCommand(visual.command) : undefined;
  const compatible = useMemo(() => (visual ? compatibleCommands(visual) : []), [visual]);
  const check = visual && spec ? checkCommand(spec, visual) : null;

  const briefDomain = brief?.domain;
  const assetCtx: AssetContext = {
    palette: { bg: theme.bg, text: theme.text, accent: theme.accent, accent2: theme.accent2 },
    style: brief?.visual_style,
    domain: isDomain(briefDomain) ? briefDomain : undefined,
    budgetMode: "balanced",
    fallbackSubject: c.headline ?? "",
  };

  const setVisual = (next: SceneVisual, extra: Record<string, unknown> = {}) =>
    onContentChange({ engine_version: SCENE_ENGINE_VERSION, visual: next, ...extra });

  const requestMedia = (next: SceneVisual) => {
    const s = getCommand(next.command);
    if (!s) return;
    const asset = s.photoEligible
      ? photoAssetFor(s, next, assetCtx, c.image_query || next.subject || c.headline || "", true)
      : aiAssetFor(s, next, assetCtx, slide.layout_template);
    setVisual({ ...next, render_mode: undefined }, { asset, image_url: null });
    onRequestMedia();
  };

  const changeCommand = (id: string) => {
    if (!visual) return;
    const s = getCommand(id);
    if (!s) return;
    const next: SceneVisual = { ...visual, command: id, render_mode: undefined };
    if (!s.layouts.includes(slide.layout_template as never)) onLayoutChange(s.layouts[0]);
    if (needsMedia(s) && !c.image_url) {
      requestMedia(next);
    } else {
      setVisual(next, { motion: { preset: s.motion }, ...(needsMedia(s) ? {} : { asset: undefined }) });
    }
  };

  const updateItems = (items: VisualItem[]) => visual && setVisual({ ...visual, items });
  const updateItem = (i: number, patch: Partial<VisualItem>) => {
    if (!visual) return;
    const items = visual.items.map((it, k) => {
      if (k !== i) return it;
      const next: VisualItem = { ...it, ...patch };
      for (const key of Object.keys(next) as (keyof VisualItem)[]) {
        if (next[key] === "" || next[key] === undefined || (typeof next[key] === "number" && !Number.isFinite(next[key] as number))) delete next[key];
      }
      if (next.label === undefined) next.label = "";
      return next;
    });
    updateItems(items);
  };
  const moveItem = (i: number, dir: -1 | 1) => {
    if (!visual) return;
    const j = i + dir;
    if (j < 0 || j >= visual.items.length) return;
    const items = [...visual.items];
    [items[i], items[j]] = [items[j], items[i]];
    updateItems(items);
  };

  if (!visual || !spec) {
    const bullets: string[] = Array.isArray(c.bullets) ? c.bullets : [];
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Este slide não tem bloco visual. Transforme os bullets em um diagrama nativo (editável, animado e sem custo de IA).
        </p>
        <Button
          variant="outline" size="sm" className="w-full"
          onClick={() => {
            const items = bullets.length ? bullets.slice(0, 6).map(itemFromBullet) : [{ label: "Etapa 1" }, { label: "Etapa 2" }, { label: "Etapa 3" }];
            const command = items.length >= 3 ? "PROCESS_FLOW" : "SEQUENCE";
            onContentChange({
              engine_version: SCENE_ENGINE_VERSION,
              visual: { intent: "EXPLAIN", command, items },
              bullets: undefined,
              motion: { preset: "connect-draw" },
              background: c.background ?? { kind: "grid", intensity: 0.3 },
            });
            onLayoutChange("visual-hero");
          }}
        >
          <Shapes className="h-4 w-4" /> Adicionar bloco visual
        </Button>
      </div>
    );
  }

  const media = spec.renderMode !== "native";
  const graph = spec.itemShape === "graph";
  const rows = spec.id === "BEFORE_AFTER";
  const grouped = spec.id === "WORKFLOW" || spec.id === "FEATURE_COMPARISON" || graph;
  const status: string | undefined = c.asset?.status;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Comando visual</Label>
        <Select value={visual.command} onValueChange={changeCommand}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {[spec, ...compatible.filter((s) => s.id !== spec.id)].map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.id.replace(/_/g, " ").toLowerCase()} · {s.renderMode === "native" ? "nativo" : s.renderMode === "hybrid" ? "híbrido" : "imagem"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">{spec.contract}</p>
        {check && !check.ok && <p className="text-[11px] text-amber-500">Atenção: {check.reason}.</p>}
      </div>

      {(spec.requires?.subject || media || spec.component === "ConceptMap" || spec.component === "CycleDiagram") && (
        <div className="space-y-1.5">
          <Label className="text-xs">Assunto (objeto, cena ou conceito central)</Label>
          <Input value={visual.subject ?? ""} onChange={(e) => setVisual({ ...visual, subject: e.target.value || undefined })} />
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Itens ({visual.items.length}/{spec.maxItems})</Label>
          <Button
            size="sm" variant="ghost" className="h-7 px-2"
            disabled={visual.items.length >= spec.maxItems + (graph ? spec.maxItems : 0)}
            onClick={() => updateItems([...visual.items, { label: `Item ${visual.items.length + 1}` }])}
          >
            <Plus className="h-3.5 w-3.5" /> Item
          </Button>
        </div>
        {visual.items.map((item, i) => (
          <div key={i} className="rounded-lg border border-border p-2 space-y-1.5">
            <div className="flex items-center gap-1">
              <Input className="h-8 text-xs" value={item.label} placeholder="Rótulo" onChange={(e) => updateItem(i, { label: e.target.value })} />
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => moveItem(i, -1)} disabled={i === 0}><ArrowUp className="h-3 w-3" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => moveItem(i, 1)} disabled={i === visual.items.length - 1}><ArrowDown className="h-3 w-3" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 hover:text-destructive" onClick={() => updateItems(visual.items.filter((_, k) => k !== i))}><Trash2 className="h-3 w-3" /></Button>
            </div>
            <Textarea className="text-xs min-h-[44px]" rows={2} value={item.detail ?? ""} placeholder="Detalhe" onChange={(e) => updateItem(i, { detail: e.target.value })} />
            <div className="grid grid-cols-2 gap-1.5">
              <Input
                className="h-8 text-xs" type="number" placeholder="Valor"
                value={item.value ?? ""}
                onChange={(e) => updateItem(i, { value: e.target.value === "" ? undefined : Number(e.target.value) })}
              />
              <Select value={item.icon ?? NONE} onValueChange={(v) => updateItem(i, { icon: v === NONE ? undefined : (v as VisualItem["icon"]) })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Ícone" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem ícone</SelectItem>
                  {SCENE_ICONS.map((ic) => <SelectItem key={ic} value={ic}>{ic}</SelectItem>)}
                </SelectContent>
              </Select>
              {grouped && (
                <Input className="h-8 text-xs col-span-2" placeholder={graph ? "Camada (group)" : "Grupo / lado"} value={item.group ?? ""} onChange={(e) => updateItem(i, { group: e.target.value })} />
              )}
              {(graph || rows) && (
                <>
                  <Input className="h-8 text-xs" placeholder={rows ? "Antes (from)" : "De (from)"} value={item.from ?? ""} onChange={(e) => updateItem(i, { from: e.target.value })} />
                  <Input className="h-8 text-xs" placeholder={rows ? "Depois (to)" : "Para (to)"} value={item.to ?? ""} onChange={(e) => updateItem(i, { to: e.target.value })} />
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {media && (
        <div className="space-y-1.5 rounded-lg border border-border p-2">
          <Label className="text-xs">Imagem do visual</Label>
          <p className="text-[11px] text-muted-foreground">
            {visual.render_mode === "native" ? "Desenho nativo (sem imagem)." : status ? `Status: ${STATUS_LABEL[status] ?? status}.` : c.image_url ? "Imagem pronta." : "Sem imagem."}
          </p>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => requestMedia(visual)} disabled={status === "pending"}>
              <ImagePlus className="h-3.5 w-3.5" /> {c.image_url ? "Gerar de novo" : "Gerar imagem"}
            </Button>
            {spec.nativeComponent && visual.render_mode !== "native" && (
              <Button size="sm" variant="ghost" onClick={() => setVisual({ ...visual, render_mode: "native" }, { asset: undefined })}>
                <Wand2 className="h-3.5 w-3.5" /> Nativo
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Nota do visual</Label>
        <Input value={visual.annotation ?? ""} onChange={(e) => setVisual({ ...visual, annotation: e.target.value || undefined })} placeholder="Fonte, legenda curta…" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Fundo</Label>
          <Select value={c.background?.kind ?? "solid"} onValueChange={(v) => onContentChange({ background: { kind: v, intensity: c.background?.intensity ?? 0.32 } })}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {BACKGROUND_KINDS.map((k) => <SelectItem key={k} value={k}>{BACKGROUND_LABELS[k] ?? k}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Movimento</Label>
          <Select value={c.motion?.preset ?? spec.motion} onValueChange={(v) => onContentChange({ motion: { ...(c.motion ?? {}), preset: v } })}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MOTION_PRESETS.map((m) => <SelectItem key={m} value={m}>{MOTION_PRESET_LABELS[m]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        variant="ghost" size="sm" className="w-full text-destructive"
        onClick={() => {
          onContentChange({
            visual: undefined,
            asset: undefined,
            bullets: visual.items.filter((it) => !(it.from && it.to)).map((it) => (it.detail ? `${it.label}: ${it.detail}` : it.label)),
          });
          onLayoutChange("title-content");
        }}
      >
        <Trash2 className="h-4 w-4" /> Remover bloco visual
      </Button>
    </div>
  );
};
