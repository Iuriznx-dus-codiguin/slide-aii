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
      (async () => {
        let url: string | null = null;
        const attempts = (asset.attempts ?? 0);
        for (let k = 0; k < MAX_ATTEMPTS && !url; k++) {
          url = await fetchSlideAsset(asset, {
            presentationId,
            avoidUrls: Array.from(usedUrls.current),
            query,
            legacy: { ai_image_prompt: slide.content?.ai_image_prompt, image_style: slide.content?.image_style, image_query: slide.content?.image_query },
          });
          if (url && usedUrls.current.has(url) && asset.source === "pexels") url = null;
        }
        if (url) usedUrls.current.add(url);
        const next: SlideAsset = { ...asset, status: url ? "ready" : "failed", attempts: attempts + MAX_ATTEMPTS };
        try {
          await onResolvedRef.current(id, { image_url: url, asset: next });
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
  }, []);

  const pending = slides.filter((s) => s.content?.asset?.status === "pending").length;
  return { pending, running, done, requeue };
}
