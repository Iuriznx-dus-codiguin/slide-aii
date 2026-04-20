// Reusable export dropdown — PPTX, PDF e PNG.
import { useState } from "react";
import { Download, FileDown, Loader2, Printer, ImageDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { exportPresentationToPptx } from "@/lib/exportPptx";
import { toast } from "sonner";
import html2canvas from "html2canvas";

interface Props {
  presentationId: string;
  title: string;
  themeId: string;
  slug?: string;
  variant?: "default" | "ghost" | "outline";
  size?: "sm" | "default" | "icon";
  label?: string;
}

export const ExportMenu = ({ presentationId, title, themeId, slug, variant = "outline", size = "sm", label = "Exportar" }: Props) => {
  const [busy, setBusy] = useState(false);

  const handlePptx = async () => {
    setBusy(true);
    try {
      const { data: rows, error } = await supabase
        .from("slides")
        .select("position,slide_type,layout_template,speaker_notes,content")
        .eq("presentation_id", presentationId)
        .order("position");
      if (error) throw error;
      if (!rows?.length) { toast.error("Nenhum slide encontrado"); return; }
      await exportPresentationToPptx({ title, themeId, slides: rows as any });
      toast.success("PPTX gerado!");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao exportar PPTX");
    } finally {
      setBusy(false);
    }
  };

  const handlePdf = () => {
    if (slug && !window.location.pathname.startsWith(`/slides/${slug}`)) {
      window.open(`/slides/${slug}?print=1`, "_blank");
    } else {
      window.print();
    }
  };

  // Captura PNG do slide atualmente visível no viewer (se houver) ou abre tab para capturar
  const handlePng = async () => {
    setBusy(true);
    try {
      // Se estamos no viewer, capturamos o canvas visível
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
        <DropdownMenuItem onClick={handlePdf}>
          <Printer className="h-4 w-4 mr-2" /> PDF (imprimir)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePng} disabled={busy}>
          <ImageDown className="h-4 w-4 mr-2" /> Imagem (.png)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
