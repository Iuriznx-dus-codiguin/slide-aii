// Persistência no servidor (motores v1 e v2).
//
// Antes, o deck só era gravado pelo CLIENTE, depois que todas as imagens
// resolviam (Generate.tsx: resolveImages → persistAndOpenWith). Dois bugs
// vinham daí:
//   1. fechar a aba nesse intervalo perdia uma apresentação JÁ COBRADA (o
//      débito acontece aqui, no início da geração);
//   2. o creative_brief era salvo NULO: persistAndOpenWith lia o estado que
//      setCreativeBrief tinha acabado de atualizar na mesma execução.
// Agora generate-presentation grava presentations (com creative_brief,
// dynamic_theme e font_pairing) e slides logo após a resolução, com os
// ativos pendentes, e devolve o slug. O Editor resolve os ativos de forma
// progressiva e retomável. O brief certo é gravado por construção.

import { generateSlug } from "../_shared/slug.ts";
import type { SlideAsset } from "../_shared/sceneMedia.ts";

export interface PersistSlide {
  slide_type: string;
  layout_template: string;
  speaker_notes: string | null;
  animation_transition: string;
  presenters_data: unknown;
  content: Record<string, unknown>;
}

export interface PersistArgs {
  userId: string;
  title: string;
  description?: string;
  type: string;
  language: string;
  theme: string;
  fontStyle: string;
  persona?: string | null;
  textDepth?: string | null;
  presentersCount: number;
  presentersNames: string[];
  includeSpeeches: boolean;
  dynamicTheme: Record<string, unknown> | null;
  creativeBrief: unknown;
  engineVersion: 1 | 2;
  slides: PersistSlide[];
}

export type PersistResult =
  | { ok: true; id: string; slug: string; assets: { ai: number; photo: number }; quota: "created" | "skipped" | "unavailable"; latency_ms: number }
  | { ok: false; error: string; latency_ms: number };

const isMissingColumn = (err: { code?: string; message?: string } | null, column: string) =>
  !!err && (err.code === "PGRST204" || err.code === "42703" || String(err.message ?? "").includes(column));

export function countAssets(slides: PersistSlide[]): { ai: number; photo: number } {
  let ai = 0;
  let photo = 0;
  for (const s of slides) {
    const a = s.content.asset as SlideAsset | undefined;
    if (!a || a.status !== "pending") continue;
    if (a.source === "ai") ai++;
    else {
      photo++;
      // Foto que pode cair em IA também reserva a vaga de IA correspondente.
      if (a.allow_ai_fallback) ai++;
    }
  }
  return { ai, photo };
}

// deno-lint-ignore no-explicit-any
export async function persistPresentation(admin: any, args: PersistArgs): Promise<PersistResult> {
  const t0 = Date.now();
  const base: Record<string, unknown> = {
    user_id: args.userId,
    title: args.title,
    description: args.description ?? null,
    type: args.type,
    language: args.language,
    theme: args.theme,
    font_style: args.fontStyle,
    slides_count: args.slides.length,
    is_paid: true,
    is_published: true,
    persona: args.persona ?? null,
    depth_level: args.textDepth ?? null,
    presenters_count: args.presentersCount,
    presenters_names: args.presentersNames,
    include_speeches: args.includeSpeeches,
    dynamic_theme: args.dynamicTheme,
    creative_brief: args.creativeBrief ?? null,
    engine_version: args.engineVersion,
  };

  // Slug único: colisão (23505) tenta de novo com outro sufixo. Coluna
  // engine_version ausente (migração ainda não aplicada) não derruba a
  // gravação — o slide carrega engine_version no content de qualquer forma.
  let pres: { id: string; slug: string } | null = null;
  let lastError = "";
  let payload = { ...base };
  for (let attempt = 0; attempt < 4 && !pres; attempt++) {
    const slug = generateSlug(args.title);
    const { data, error } = await admin.from("presentations").insert({ ...payload, slug }).select("id,slug").single();
    if (!error && data) {
      pres = data;
      break;
    }
    lastError = error?.message ?? "insert falhou";
    if (isMissingColumn(error, "engine_version") && "engine_version" in payload) {
      const { engine_version: _drop, ...rest } = payload;
      payload = rest;
      continue;
    }
    if (error?.code !== "23505") break;
  }
  if (!pres) return { ok: false, error: lastError, latency_ms: Date.now() - t0 };

  const rows = args.slides.map((s, position) => ({
    presentation_id: pres!.id,
    position,
    slide_type: s.slide_type,
    layout_template: s.layout_template,
    speaker_notes: s.speaker_notes,
    animation_transition: s.animation_transition,
    presenters_data: s.presenters_data ?? [],
    content: s.content,
  }));
  const { error: sErr } = await admin.from("slides").insert(rows);
  if (sErr) {
    await admin.from("presentations").delete().eq("id", pres.id);
    return { ok: false, error: sErr.message ?? "slides insert falhou", latency_ms: Date.now() - t0 };
  }

  // Cota de ativos atrelada à apresentação e às imagens planejadas. fetch-image
  // consome esta cota no lugar do limite genérico (que continua valendo para
  // chamadas avulsas do Editor). Folga de 1 retry por ativo.
  const assets = countAssets(args.slides);
  let quota: "created" | "skipped" | "unavailable" = "skipped";
  if (assets.ai + assets.photo > 0) {
    const { error: qErr } = await admin.from("presentation_asset_quotas").insert({
      presentation_id: pres.id,
      user_id: args.userId,
      ai_planned: assets.ai * 2,
      photo_planned: assets.photo * 2,
    });
    quota = qErr ? "unavailable" : "created";
    if (qErr) console.warn("persist: cota de ativos indisponível (migração pendente?) —", qErr.message);
  }

  return { ok: true, id: pres.id, slug: pres.slug, assets, quota, latency_ms: Date.now() - t0 };
}
