// Reusable export dropdown — used in SlideViewer and Dashboard.
import { useState } from "react";
import { Download, FileDown, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { exportPresentationToPptx } from "@/lib/exportPptx";
import { toast } from "sonner";

interface Props {
  presentationId: string;
  title: string;
  themeId: string;
  /** if provided we navigate the user to the slug for PDF print */
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
    // The viewer already has print CSS that turns each slide into a printable page.
    if (slug && !window.location.pathname.startsWith(`/slides/${slug}`)) {
      window.open(`/slides/${slug}?print=1`, "_blank");
    } else {
      window.print();
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
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={handlePptx} disabled={busy}>
          <FileDown className="h-4 w-4 mr-2" /> PowerPoint (.pptx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePdf}>
          <Printer className="h-4 w-4 mr-2" /> PDF (imprimir)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
