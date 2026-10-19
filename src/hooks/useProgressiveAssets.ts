// Resolução PROGRESSIVA e RETOMÁVEL dos ativos de um deck.
//
// Antes, a geração só gravava o deck depois que TODAS as imagens resolviam no
// cliente (Generate.tsx) — fechar a aba nesse intervalo perdia uma
// apresentação já cobrada. Agora o servidor grava o deck com os ativos
// pendentes (content.asset.status = "pending") e é o Editor que os resolve:
//   • pega os slides pendentes e chama fetch-image com a concorrência atual (5);
//   • grava cada URL assim que chega (não espera o lote inteiro);
//   • se a aba fechar, o que faltou continua "pending" no banco e é retomado
//     na próxima abertura.
// Visuais nativos já aparecem completos; mídia pendente usa o placeholder do
// próprio comando até a imagem chegar.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchSlideAsset } from "@/lib/slideImage";
import type { SlideAsset } from "../../supabase/functions/_shared/sceneMedia.ts";

export interface AssetSlide {
  id: string;
  content: any;
}

export interface AssetPatch {
  image_url: string | null;
  asset: SlideAsset;
}

/** Identidade do pedido de mídia (sem o estado da resolução). */
const assetKey = (a: SlideAsset | undefined) => (a ? JSON.stringify({ ...a, status: undefined, attempts: undefined }) : "");

/**
 * Uma aba por vez resolve cada slide. Editor e visualizador do dono abertos
 * juntos buscavam as mesmas imagens em paralelo: custo de IA em dobro e cota
 * da apresentação esgotada. Quem chega depois espera e encontra o resultado
 * já gravado no banco.
 */
const withSlideLock = <T,>(slideId: string, fn: () => Promise<T>): Promise<T> => {
  const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  return locks ? locks.request(`slideai-asset:${slideId}`, fn) as Promise<T> : fn();
};

/** O que está gravado agora para o slide (outra aba pode já ter resolvido). */
const storedAsset = async (slideId: string): Promise<AssetPatch | null> => {
  const { data } = await supabase.from("slides").select("content").eq("id", slideId).maybeSingle();
  const content = (data?.content ?? null) as { image_url?: string | null; asset?: SlideAsset } | null;
  if (!content?.asset || content.asset.status === "pending") return null;
  return { image_url: content.image_url ?? null, asset: content.asset };
};

const CONCURRENCY = 5;
const MAX_ATTEMPTS = 2;
const QUERY_SUFFIXES = ["wide angle", "close up", "different perspective", "alternative", "minimal", "cinematic"];

export function useProgressiveAssets(opts: {
  presentationId?: string;
  slides: AssetSlide[];
  enabled: boolean;
  onResolved: (slideId: string, patch: AssetPatch) => void | Promise<void>;
}) {
  const { presentationId, slides, enabled, onResolved } = opts;
  const queued = useRef(new Set<string>());
  // Pedidos novos feitos nesta aba ("gerar de novo", chat): resolvem sempre,
  // sem reaproveitar o que está gravado (que é justamente o que se quer trocar).
  const fresh = useRef(new Set<string>());
  const inflight = useRef(0);
  const queue = useRef<string[]>([]);
  const usedUrls = useRef(new Set<string>());
  const usedQueries = useRef(new Set<string>());
  const slidesRef = useRef(slides);
  const onResolvedRef = useRef(onResolved);
  const [running, setRunning] = useState(0);
  const [done, setDone] = useState(0);

  useEffect(() => { slidesRef.current = slides; onResolvedRef.current = onResolved; });

  // URLs já exibidas no deck entram no "evitar" da Pexels.
  useEffect(() => {
    for (const s of slides) if (s.content?.image_url) usedUrls.current.add(s.content.image_url);
  }, [slides]);

  const pump = useCallback(() => {
    while (inflight.current < CONCURRENCY && queue.current.length) {
      const id = queue.current.shift()!;
      const slide = slidesRef.current.find((s) => s.id === id);
      const asset: SlideAsset | undefined = slide?.content?.asset;
      if (!slide || !asset || asset.status !== "pending") continue;
      inflight.current++;
      setRunning(inflight.current);
      // Query desduplicada no deck: a mesma busca não traz a mesma foto duas vezes.
      let query: string | undefined = asset.query ?? slide.content?.image_query;
      if (query) {
        const key = query.toLowerCase();
        if (usedQueries.current.has(key)) query = `${query} ${QUERY_SUFFIXES[usedQueries.current.size % QUERY_SUFFIXES.length]}`;
        usedQueries.current.add(query.toLowerCase());
      }
      const startedImage = slide.content?.image_url ?? null;
      const reuseStored = !fresh.current.delete(id);
      (async () => {
        try {
          const patch = await withSlideLock(id, async (): Promise<AssetPatch> => {
            const stored = reuseStored ? await storedAsset(id).catch(() => null) : null;
            if (stored && assetKey(stored.asset) === assetKey(asset)) return stored;
            let url: string | null = null;
            let tries = 0;
            for (let k = 0; k < MAX_ATTEMPTS && !url; k++) {
              tries++;
              url = await fetchSlideAsset(asset, {
                presentationId,
                avoidUrls: Array.from(usedUrls.current),
                query,
                legacy: { ai_image_prompt: slide.content?.ai_image_prompt, image_style: slide.content?.image_style, image_query: slide.content?.image_query },
              });
              if (url && usedUrls.current.has(url) && asset.source === "pexels") url = null;
            }
            // Conta as tentativas de fato feitas (antes somava 2 mesmo quando a
            // primeira dava certo — a métrica enganava).
            return { image_url: url, asset: { ...asset, status: url ? "ready" : "failed", attempts: (asset.attempts ?? 0) + tries } };
          });
          if (patch.image_url) usedUrls.current.add(patch.image_url);
          // O usuário trocou a imagem ou o pedido de mídia enquanto esta busca
          // rodava: a escolha dele vale (antes o resultado atrasado a apagava).
          const latest = slidesRef.current.find((s) => s.id === id);
          const superseded = !latest
            || (latest.content?.image_url ?? null) !== startedImage
            || assetKey(latest.content?.asset) !== assetKey(asset);
          if (!superseded) await onResolvedRef.current(id, patch);
        } finally {
          inflight.current--;
          setRunning(inflight.current);
          setDone((d) => d + 1);
          pump();
        }
      })();
    }
  }, [presentationId]);

  // Enfileira todo ativo pendente ainda não visto nesta sessão (inclui os
  // criados depois, por troca de comando no painel Visual ou pelo chat).
  useEffect(() => {
    if (!enabled || !presentationId) return;
    let added = false;
    for (const s of slides) {
      if (s.content?.asset?.status === "pending" && !queued.current.has(s.id)) {
        queued.current.add(s.id);
        queue.current.push(s.id);
        added = true;
      }
    }
    if (added) pump();
  }, [slides, enabled, presentationId, pump]);

  /** Recoloca um slide na fila (ex.: "gerar de novo" no painel Visual). */
  const requeue = useCallback((slideId: string) => {
    queued.current.delete(slideId);
    fresh.current.add(slideId);
  }, []);

  const pending = slides.filter((s) => s.content?.asset?.status === "pending").length;
  return { pending, running, done, requeue };
}
