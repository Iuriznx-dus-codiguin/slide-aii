// Reusable export dropdown — PPTX, PDF e PNG.
import { useState } from "react";
import { Download, FileDown, Loader2, FileText, ImageDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { exportPresentationToPptx } from "@/lib/exportPptx";
import { exportPresentationToPdf } from "@/lib/exportPdf";
import { toast } from "sonner";
import html2canvas from "html2canvas";

interface Props {
  presentationId: string;
  title: string;
  themeId: string;
  fontId?: string;
  slug?: string;
  variant?: "default" | "ghost" | "outline";
  size?: "sm" | "default" | "icon";
  label?: string;
}

export const ExportMenu = ({ presentationId, title, themeId, fontId = "modern", slug, variant = "outline", size = "sm", label = "Exportar" }: Props) => {
  const [busy, setBusy] = useState(false);

  const fetchSlides = async () => {
    const { data: rows, error } = await supabase
      .from("slides")
      .select("position,slide_type,layout_template,speaker_notes,content")
      .eq("presentation_id", presentationId)
      .order("position");
    if (error) throw error;
    return rows ?? [];
  };

  /**
   * Direção de arte do deck. Vive na tabela presentations (dynamic_theme,
   * creative_brief) desde o Creative Presentation Engine — o export de PDF
   * não lia nenhum dos dois, então o arquivo saía com a paleta e a densidade
   * padrão em vez das que o usuário vê na tela.
   */
  const fetchArtDirection = async () => {
    const { data } = await supabase
      .from("presentations")
      .select("dynamic_theme,creative_brief")
      .eq("id", presentationId)
      .maybeSingle();
    return {
      dynamicTheme: (data as any)?.dynamic_theme ?? null,
      creativeBrief: (data as any)?.creative_brief ?? null,
    };
  };

  const handlePptx = async () => {
    setBusy(true);
    const t = toast.loading("Gerando PPTX…");
    try {
      const rows = await fetchSlides();
      if (!rows.length) { toast.error("Nenhum slide encontrado", { id: t }); return; }
      await exportPresentationToPptx({ title, themeId, slides: rows as any });
      toast.success("PPTX gerado!", { id: t });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao exportar PPTX", { id: t });
    } finally {
      setBusy(false);
    }
  };

  const handlePdf = async () => {
    setBusy(true);
    const t = toast.loading("Renderizando PDF (0%)…");
    try {
      const rows = await fetchSlides();
      if (!rows.length) { toast.error("Nenhum slide encontrado", { id: t }); return; }
      const art = await fetchArtDirection();
      await exportPresentationToPdf({
        title,
        themeId,
        fontId,
        slides: rows as any,
        dynamicTheme: art.dynamicTheme,
        creativeBrief: art.creativeBrief,
        onProgress: (cur, total) => {
          const pct = Math.round((cur / total) * 100);
          toast.loading(`Renderizando PDF (${pct}%)…`, { id: t });
        },
      });
      toast.success("PDF gerado!", { id: t });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao exportar PDF", { id: t });
    } finally {
      setBusy(false);
    }
  };

  // Captura PNG do slide atualmente visível no viewer (se houver) ou abre tab para capturar
  const handlePng = async () => {
    setBusy(true);
    try {
      const target = document.querySelector<HTMLElement>("[data-export-target='slide']");
      if (target) {
        const canvas = await html2canvas(target, { backgroundColor: "#000", scale: 2, useCORS: true });
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = `${title.replace(/\s+/g, "-")}.png`; a.click();
          URL.revokeObjectURL(url);
          toast.success("PNG salvo!");
        });
      } else if (slug) {
        toast.message("Abra o visualizador para exportar PNG");
        window.open(`/slides/${slug}`, "_blank");
      } else {
        toast.error("Não foi possível capturar PNG aqui");
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao gerar PNG");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {size !== "icon" && <span className="ml-1">{label}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handlePptx} disabled={busy}>
          <FileDown className="h-4 w-4 mr-2" /> PowerPoint (.pptx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePdf} disabled={busy}>
          <FileText className="h-4 w-4 mr-2" /> PDF (alta fidelidade)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePng} disabled={busy}>
          <ImageDown className="h-4 w-4 mr-2" /> Imagem (.png)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
