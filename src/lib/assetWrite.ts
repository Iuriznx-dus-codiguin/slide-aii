// Grava no banco um ativo resolvido em segundo plano (Editor e Viewer do dono).
//
// Um único ponto de escrita: o `content` do slide recebe a URL e o ativo
// atualizado; na capa (posição 0) a mesma URL alimenta a miniatura do
// portfólio público (slides.background_image_url).
import { supabase } from "@/integrations/supabase/client";
import type { AssetPatch } from "@/hooks/useProgressiveAssets";

export async function saveResolvedAsset(
  row: { id: string; position: number; content: Record<string, unknown> | null | undefined },
  patch: AssetPatch,
): Promise<Record<string, unknown>> {
  const content = { ...(row.content ?? {}), ...patch };
  const update: Record<string, unknown> = { content };
  if (row.position === 0 && patch.image_url) update.background_image_url = patch.image_url;
  const { error } = await supabase.from("slides").update(update as never).eq("id", row.id);
  if (error) console.warn("ativo: gravação falhou (fica pendente para a próxima abertura)", error.message);
  return content;
}
