// Hospedagem das apresentações (redução de custo). Regras no banco
// (migração 0020): owner_hosting_active, presentation_is_hosted e a
// varredura run_presentation_hosting_if_due. Este módulo é código puro
// (roda no vitest) mais a exclusão definitiva, que precisa da API do Storage.

/** Apresentações geradas com créditos avulsos ficam no ar por 3 meses. */
export const SINGLE_HOSTING_MONTHS = 3;
/** Fora do ar, a apresentação pode ser restaurada por 30 dias. */
export const HOSTING_GRACE_DAYS = 30;
/** Aviso de exclusão próxima: 7 dias antes. */
export const DELETION_NOTICE_DAYS = 7;

const BUCKET = "slide-images";
const PATH_RE = /\/storage\/v1\/object\/(?:sign|public|authenticated)\/slide-images\/([A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.[a-z0-9]{2,5})/g;

/** Caminhos de arquivos do bucket de imagens citados em qualquer texto/JSON. */
export const extractStoragePaths = (value: unknown): string[] => {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  const out = new Set<string>();
  for (const m of text.matchAll(PATH_RE)) out.add(m[1]);
  return [...out];
};

/**
 * Exclusão definitiva das apresentações fora do ar há mais de 30 dias:
 * apaga a apresentação (slides, visitas e cotas vão junto) e depois os
 * arquivos de imagem que nenhuma outra apresentação da conta usa.
 * Nunca lança; limitado por tempo para caber na rodada do despachante.
 */
export async function purgeExpiredPresentations(
  admin: any,
  opts: { limit?: number; deadlineMs?: number } = {},
): Promise<{ purged: number; files: number; errors: number }> {
  const result = { purged: 0, files: 0, errors: 0 };
  const deadline = Date.now() + (opts.deadlineMs ?? 30_000);
  const { data: rows, error } = await admin.rpc("presentation_purge_candidates", { _limit: opts.limit ?? 25 });
  if (error) {
    console.error("purge_candidates_failed", error.message);
    return { ...result, errors: 1 };
  }
  for (const row of (rows ?? []) as Array<{ id: string; user_id: string }>) {
    if (Date.now() > deadline) break;
    try {
      const { data: slides } = await admin.from("slides")
        .select("content, background_image_url").eq("presentation_id", row.id);
      const paths = extractStoragePaths(slides ?? []);
      const { data: deleted, error: delErr } = await admin.rpc("purge_offline_presentation", { _presentation_id: row.id });
      if (delErr) throw new Error(delErr.message);
      if (deleted !== true) continue; // restaurada no meio do caminho
      result.purged++;
      if (!paths.length) continue;
      const { data: free, error: relErr } = await admin.rpc("release_storage_paths", { _uid: row.user_id, _paths: paths });
      if (relErr) throw new Error(relErr.message);
      const removable = ((free ?? []) as string[]).filter((p) => p.startsWith(`${row.user_id}/`));
      if (removable.length) {
        const { error: rmErr } = await admin.storage.from(BUCKET).remove(removable);
        if (rmErr) throw new Error(rmErr.message);
        result.files += removable.length;
      }
    } catch (e) {
      result.errors++;
      console.error("purge_presentation_failed", row.id, e instanceof Error ? e.message : String(e));
    }
  }
  return result;
}
