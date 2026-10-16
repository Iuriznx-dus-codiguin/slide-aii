// Leitura de uma apresentação pelo slug (visualizador e exportação).
//
// Desde a migração 0010 não existe leitura pública das tabelas presentations
// e slides — antes, a API listava TODAS as apresentações publicadas de todos
// os usuários. O link compartilhado passa pelo RPC get_shared_presentation,
// que devolve um deck pelo slug exato se ele estiver publicado ou for do
// próprio usuário, sem expor o user_id do autor.
//
// Enquanto a migração não estiver aplicada (front publicado antes do banco),
// o RPC não existe e a leitura cai no caminho antigo, direto nas tabelas.
import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface SharedPresentation {
  id: string;
  title: string;
  description: string | null;
  theme: string;
  font_style: string;
  slug: string;
  include_speeches?: boolean;
  presenters_names?: unknown;
  dynamic_theme?: unknown;
  creative_brief?: unknown;
  /** Só vem do RPC; no caminho antigo é deduzido do user_id. */
  is_published?: boolean;
  is_owner: boolean;
}

export interface SharedSlide {
  id: string;
  position: number;
  slide_type: string;
  layout_template: string;
  content: Record<string, unknown> | null;
  speaker_notes?: string | null;
  presenters_data?: unknown;
}

export interface SharedDeck {
  presentation: SharedPresentation;
  slides: SharedSlide[];
}

/** RPC ausente no banco (migração pendente). */
export const isMissingRpc = (error: Pick<PostgrestError, "code"> | null | undefined): boolean =>
  !!error && (error.code === "PGRST202" || error.code === "42883");

async function loadLegacy(slug: string): Promise<SharedDeck | null> {
  const { data: p } = await supabase.from("presentations")
    .select("id,user_id,title,description,theme,font_style,slug,include_speeches,presenters_names,dynamic_theme,creative_brief,is_published")
    .eq("slug", slug).maybeSingle();
  if (!p) return null;
  const { data: s } = await supabase.from("slides")
    .select("id,position,slide_type,layout_template,content,speaker_notes,presenters_data")
    .eq("presentation_id", p.id).order("position");
  const { data: auth } = await supabase.auth.getUser();
  const { user_id, ...rest } = p;
  return {
    presentation: { ...rest, is_owner: !!auth.user && auth.user.id === user_id } as SharedPresentation,
    slides: (s ?? []) as SharedSlide[],
  };
}

export async function loadSharedPresentation(slug: string): Promise<SharedDeck | null> {
  const { data, error } = await supabase.rpc("get_shared_presentation", { _slug: slug });
  if (isMissingRpc(error)) return loadLegacy(slug);
  if (error) throw error;
  if (!data || typeof data !== "object") return null;
  const deck = data as unknown as SharedDeck;
  return { presentation: deck.presentation, slides: Array.isArray(deck.slides) ? deck.slides : [] };
}

/** Conta uma visualização (o servidor aplica o teto por visitante). Nunca lança. */
export async function recordPresentationView(presentationId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc("record_presentation_view", { _presentation_id: presentationId });
    if (isMissingRpc(error)) {
      await supabase.from("slide_views").insert({ presentation_id: presentationId, user_agent: navigator.userAgent });
    }
  } catch {
    /* contador de visitas nunca quebra o visualizador */
  }
}
