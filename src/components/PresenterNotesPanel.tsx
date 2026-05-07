// ============================================================
// SlideAI — Presenter Speeches Panel
// ------------------------------------------------------------
// Painel lateral do Editor para visualizar/editar:
//   • Fala exata (script literal por apresentador)
//   • Âncoras de transição entre apresentadores
//
// NUNCA renderizado dentro do slide — só no editor.
// Inclui exportar (TXT) e imprimir (script formatado).
// ============================================================
import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Printer, Users, X } from "lucide-react";

export interface PresenterEntry {
  id: string;
  name: string;
  /** @deprecated mantido por compatibilidade com dados antigos; não exibido nem editado */
  technical_notes?: string;
  exact_speech?: string;
  transition_anchor?: string;
}

interface SlideNoteData {
  slideIdx: number;
  headline?: string;
  presenters: PresenterEntry[];
}

interface PresenterNotesPanelProps {
  slides: Array<{ headline?: string; presenters_data?: PresenterEntry[] }>;
  activeIdx: number;
  presentationTitle: string;
  presentersNames: string[];
  onUpdate: (slideIdx: number, presenters: PresenterEntry[]) => void;
  onClose: () => void;
}

function downloadTxt(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildFullScript(
  title: string,
  slides: Array<{ headline?: string; presenters_data?: PresenterEntry[] }>,
): string {
  const parts: string[] = [];
  parts.push(`# ${title}\n# Roteiro de falas — apresentação completa\n`);
  slides.forEach((s, i) => {
    parts.push(`\n══════════════════════════════════════════`);
    parts.push(`SLIDE ${i + 1} — ${s.headline ?? "(sem título)"}`);
    parts.push(`══════════════════════════════════════════`);
    const presenters = s.presenters_data ?? [];
    if (presenters.length === 0) {
      parts.push(`(Sem falas atribuídas)`);
    } else {
      presenters.forEach((p) => {
        parts.push(`\n► ${p.name || "Apresentador"}`);
        if (p.transition_anchor) parts.push(`  ↪ ${p.transition_anchor}`);
        if (p.exact_speech) {
          parts.push(`\n  🎤 FALA:`);
          parts.push(p.exact_speech.split("\n").map((l) => `     ${l}`).join("\n"));
        }
      });
    }
  });
  return parts.join("\n");
}

function printScript(title: string, slides: Array<{ headline?: string; presenters_data?: PresenterEntry[] }>) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const html = `
    <html><head><title>${title} — Roteiro</title>
    <style>
      body{font-family:Georgia,serif;max-width:780px;margin:40px auto;padding:0 30px;line-height:1.6;color:#222}
      h1{font-size:28px;border-bottom:2px solid #222;padding-bottom:10px}
      h2{font-size:18px;margin-top:36px;background:#f5f5f5;padding:8px 12px;border-left:4px solid #A855F7}
      h3{font-size:14px;margin-top:18px;color:#444;text-transform:uppercase;letter-spacing:0.05em}
      .pres{margin-top:14px;padding-left:14px;border-left:3px solid #ddd}
      .anchor{font-style:italic;color:#666;font-size:13px;margin-bottom:8px}
      .speech{background:#eef6ff;padding:10px 14px;border-radius:6px;font-size:15px;font-weight:500;margin-top:8px}
      .slide-no{color:#A855F7;font-weight:bold}
      @media print{body{margin:20px}h2{break-before:page}}
    </style></head><body>
    <h1>${title}</h1>
    ${slides.map((s, i) => `
      <h2><span class="slide-no">Slide ${i + 1}.</span> ${s.headline ?? "(sem título)"}</h2>
      ${(s.presenters_data ?? []).map((p) => `
        <div class="pres">
          <h3>${p.name || "Apresentador"}</h3>
          ${p.transition_anchor ? `<div class="anchor">↪ ${p.transition_anchor}</div>` : ""}
          ${p.exact_speech ? `<div class="speech"><strong>Fala:</strong><br>${p.exact_speech.replace(/\n/g, "<br>")}</div>` : ""}
        </div>
      `).join("")}
    `).join("")}
    </body></html>
  `;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

export const PresenterNotesPanel = ({
  slides,
  activeIdx,
  presentationTitle,
  presentersNames,
  onUpdate,
  onClose,
}: PresenterNotesPanelProps) => {
  const current = slides[activeIdx];
  // Garantir que todos os apresentadores configurados tenham entrada
  const presenters: PresenterEntry[] = useMemo(() => {
    const existing = current?.presenters_data ?? [];
    const merged = presentersNames.map((name, i) => {
      const found = existing.find((e) => e.name === name) ?? existing[i];
      return found
        ? { ...found, name }
        : { id: crypto.randomUUID(), name, exact_speech: "", transition_anchor: "" };
    });
    return merged.length > 0 ? merged : existing;
  }, [current, presentersNames]);

  const [activeTab, setActiveTab] = useState(presenters[0]?.id ?? "0");

  const updatePresenter = (presenterId: string, patch: Partial<PresenterEntry>) => {
    const updated = presenters.map((p) => (p.id === presenterId ? { ...p, ...patch } : p));
    onUpdate(activeIdx, updated);
  };

  return (
    <aside className="w-80 md:w-96 border-l border-border bg-card/40 flex flex-col flex-shrink-0">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Users className="h-3.5 w-3.5 text-primary" /> Falas dos apresentadores
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="icon" variant="ghost" className="h-7 w-7"
            title="Exportar roteiro completo (.txt)"
            onClick={() => downloadTxt(`${presentationTitle}-roteiro.txt`, buildFullScript(presentationTitle, slides))}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon" variant="ghost" className="h-7 w-7"
            title="Imprimir roteiro completo"
            onClick={() => printScript(presentationTitle, slides)}
          >
            <Printer className="h-3.5 w-3.5" />
          </Button>
          <button onClick={onClose} className="hover:bg-muted rounded p-1">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-border bg-muted/30">
        <p className="text-[11px] text-muted-foreground">
          Slide {activeIdx + 1} — <span className="font-medium text-foreground">{current?.headline || "(sem título)"}</span>
        </p>
      </div>

      {presenters.length === 0 ? (
        <div className="p-4 text-center text-xs text-muted-foreground">
          Nenhum apresentador configurado. Defina na geração ou edite o número de apresentadores nas configurações da apresentação.
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="flex-shrink-0 mx-2 mt-2 grid" style={{ gridTemplateColumns: `repeat(${presenters.length}, minmax(0, 1fr))` }}>
            {presenters.map((p, i) => {
              const speaks = (p.exact_speech || "").trim().length > 0;
              return (
                <TabsTrigger key={p.id} value={p.id} className="text-[11px] truncate gap-1">
                  <span className="opacity-60">{i + 1}.</span> {p.name || "Apresentador"}
                  {speaks && <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" title="Fala neste slide" />}
                </TabsTrigger>
              );
            })}
          </TabsList>
          <ScrollArea className="flex-1">
            {presenters.map((p) => {
              const wordCount = (p.exact_speech || "").trim().split(/\s+/).filter(Boolean).length;
              const wordOk = wordCount === 0 || (wordCount >= 20 && wordCount <= 100);
              return (
                <TabsContent key={p.id} value={p.id} className="px-3 py-3 space-y-3 mt-0">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] flex items-center gap-1">
                      Âncora de transição
                      <span className="text-muted-foreground font-normal">(handoff entre apresentadores)</span>
                    </Label>
                    <Textarea
                      value={p.transition_anchor || ""}
                      onChange={(e) => updatePresenter(p.id, { transition_anchor: e.target.value })}
                      rows={2}
                      placeholder='Ex: "Agora, Maria explicará a parte técnica."'
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] flex items-center gap-1">
                        🎤 Fala (40-80 palavras)
                      </Label>
                      <span className={`text-[10px] font-mono ${wordOk ? "text-muted-foreground" : "text-destructive"}`}>
                        {wordCount} palavras
                      </span>
                    </div>
                    <Textarea
                      value={p.exact_speech || ""}
                      onChange={(e) => updatePresenter(p.id, { exact_speech: e.target.value })}
                      rows={8}
                      placeholder="Abertura curta → ponto principal → gancho para o próximo slide..."
                      className="text-xs leading-relaxed font-medium"
                    />
                  </div>
                </TabsContent>
              );
            })}
          </ScrollArea>
        </Tabs>
      )}
    </aside>
  );
};
