// Aplica a resposta do assistente de edição (chat-editor) ao deck da tela.
//
// A resposta vem por índice, na ordem em que os slides foram enviados. Só os
// slides que a IA mudou (`changed_slides`) são aplicados, localizados pelo id
// sobre o deck ATUAL: o que o usuário fez enquanto a IA respondia (editar
// outros slides, reordenar, excluir) continua. Antes a resposta substituía o
// deck inteiro pelo estado do momento do envio.
import type { SlideContent } from "@/components/SlideRenderer";
import { aiSlideToContent, type AiSlide } from "@/lib/aiSlide";

export interface EditableSlide {
  id: string;
  slide_type: string;
  layout_template: string;
  animation_transition: string;
  speaker_notes: string | null;
  content: SlideContent;
}

export function mergeAiEdits<T extends EditableSlide>(
  current: T[],
  sentIds: string[],
  returned: AiSlide[],
  changed: number[] | undefined,
): T[] {
  // Servidor antigo, sem `changed_slides`: trata todos como alterados.
  const changedIdx = Array.isArray(changed) ? changed : returned.map((_, i) => i);
  return current.map((row) => {
    const sentAt = sentIds.indexOf(row.id);
    const ns = sentAt >= 0 && changedIdx.includes(sentAt) ? returned[sentAt] : undefined;
    if (!ns) return row;
    return {
      // Colunas que não vão para a IA (falas dos apresentadores, que são
      // pagas, e o que mais existir no slide) vêm do slide atual.
      ...row,
      slide_type: ns.slide_type ?? row.slide_type ?? "content",
      layout_template: ns.layout_template ?? row.layout_template ?? "title-content",
      animation_transition: ns.animation ?? row.animation_transition ?? "fade",
      speaker_notes: ns.speaker_notes ?? row.speaker_notes ?? null,
      // Bloco 11.3: campos "DNA" (acentos, ato narrativo, variante de capa)
      // preservados quando a IA não os devolve — ver aiSlideToContent.
      content: aiSlideToContent(ns, row.content),
    };
  });
}
