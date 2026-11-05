// ============================================================
// SlideAI — AmbientBackdrop (Fase B)
// ------------------------------------------------------------
// Camadas de profundidade cinematográficas:
//   1) Vídeo em loop (Pexels) baseado no tema/intent — opcional
//   2) Glassmorphism overlay com tint do accent
//   3) Partículas/orbs CSS leves animadas (sempre)
//   4) Grain SVG sutil para textura editorial
//
// O vídeo é OPCIONAL e degrada com graça: se o Pexels não responder,
// fica só com glass + orbs — sem layout shift.
// ============================================================
import { motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { ThemeColors } from "@/lib/slugify";

const hexToRgba = (hex: string, alpha: number) => {
  const h = hex.replace("#", "");
  const big = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(big >> 16) & 255}, ${(big >> 8) & 255}, ${big & 255}, ${alpha})`;
};

interface Props {
  theme: ThemeColors;
  /** Pista temática para buscar vídeo (ex.: "neural network", "ocean waves"). */
  videoQuery?: string | null;
  /** Desabilita o vídeo (útil em print/thumbnail/exporting). */
  noVideo?: boolean;
  /**
   * Bloco 16.1: vídeo agora é OPT-IN. Só busca/exibe quando enableVideo=true.
   * Isso evita N requisições em background no Editor/Generate. Habilite apenas
   * no SlideViewer em fullscreen.
   */
  enableVideo?: boolean;
  /** Intensidade do glass overlay (0..1). */
  glassOpacity?: number;
  /** Quantidade de orbs flutuantes. */
  orbCount?: number;
  /** Posiciona o conteúdo: este componente é absolute fill. */
  className?: string;
}

const cache = new Map<string, { url: string | null; poster: string | null }>();

/**
 * Vídeo de fundo só onde ele não pesa: sem economia de dados, sem rede lenta,
 * com memória e núcleos razoáveis e fora de celular/tablet (bateria e dados).
 * Nos demais, o fundo é o mesmo degradê com orbes — sem download de vídeo.
 */
function canAffordAmbientVideo(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string }; deviceMemory?: number };
  if (nav.connection?.saveData) return false;
  if (nav.connection?.effectiveType && /2g|3g/.test(nav.connection.effectiveType)) return false;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory < 4) return false;
  if ((nav.hardwareConcurrency ?? 8) < 4) return false;
  if (window.matchMedia?.("(pointer: coarse)").matches) return false;
  return true;
}

async function fetchVideo(query: string): Promise<{ url: string | null; poster: string | null }> {
  if (cache.has(query)) return cache.get(query)!;
  try {
    const { data, error } = await supabase.functions.invoke("fetch-image", {
      body: { strategy: "video", query },
    });
    if (error || !data) {
      cache.set(query, { url: null, poster: null });
      return { url: null, poster: null };
    }
    const result = { url: data.url ?? null, poster: data.poster ?? null };
    cache.set(query, result);
    return result;
  } catch {
    cache.set(query, { url: null, poster: null });
    return { url: null, poster: null };
  }
}

export const AmbientBackdrop = ({
  theme,
  videoQuery,
  noVideo = false,
  enableVideo = false,
  glassOpacity = 0.55,
  orbCount = 3,
  className = "",
}: Props) => {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [poster, setPoster] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Id único por instância — antes, o id="grain" fixo colidia (HTML inválido,
  // comportamento indefinido entre navegadores) sempre que várias miniaturas
  // renderizavam ao mesmo tempo (barra lateral do Editor, tira do Generate,
  // grid do Dashboard), já que cada uma monta seu próprio AmbientBackdrop.
  const grainId = useId();
  const prefersReducedMotion = usePrefersReducedMotion();
  // Contexto estático (thumbnail/export/print) OU preferência de sistema por
  // menos movimento: os orbs ainda aparecem (fazem parte do visual do tema),
  // mas param de rodar animação Infinity — antes, todo thumbnail em escala
  // 0.25x continuava animando indefinidamente um efeito imperceptível naquele
  // tamanho, desperdiçando GPU/CPU sem ganho visual nenhum.
  const staticOrbs = noVideo || prefersReducedMotion;

  useEffect(() => {
    if (noVideo || !enableVideo || !videoQuery || prefersReducedMotion || !canAffordAmbientVideo()) return;
    let cancelled = false;
    fetchVideo(videoQuery).then((r) => {
      if (!cancelled) {
        setVideoSrc(r.url);
        setPoster(r.poster);
      }
    });
    return () => { cancelled = true; };
  }, [videoQuery, noVideo, enableVideo, prefersReducedMotion]);

  // Aba em segundo plano: o vídeo pausa (antes seguia decodificando).
  useEffect(() => {
    if (!videoSrc) return;
    const onVisibility = () => {
      const v = videoRef.current;
      if (!v) return;
      if (document.hidden) v.pause();
      else void v.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [videoSrc]);

  const accent = theme.accent;
  const accent2 = theme.accent2 || theme.accent;
  const bg = theme.bg;

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden>
      {/* Camada 1 — Vídeo em loop (se disponível) */}
      {videoSrc && (
        <motion.video
          ref={videoRef}
          src={videoSrc}
          poster={poster ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ duration: 2.4, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Camada 2 — Glass tint usando o accent + bg */}
      {/* Sem backdrop-filter: sobre um vídeo ele era recalculado a cada quadro. */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${hexToRgba(bg, glassOpacity)} 0%, ${hexToRgba(accent, 0.18)} 50%, ${hexToRgba(bg, glassOpacity + 0.15)} 100%)`,
        }}
      />

      {/* Camada 3 — Orbes: o degradê radial já é o desfoque (sem filter: blur
          nem mix-blend-mode) e o movimento é CSS só de transform, no
          compositor. Também saem certos no export (html2canvas ignora blur). */}
      {Array.from({ length: orbCount }).map((_, i) => {
        const color = i % 2 === 0 ? accent : accent2;
        const size = 35 + (i % 3) * 18;
        const top = [-15, 55, 25][i % 3];
        const left = [-10, 60, 30][i % 3];
        return (
          <div
            key={i}
            className={staticOrbs ? "absolute" : "absolute slideai-orb"}
            style={{
              top: `${top}%`, left: `${left}%`,
              width: `${size}%`, height: `${size}%`,
              // closest-side: o degradê chega a transparente exatamente na borda
              // do elemento (sem borda dura quando o orbe sai do slide).
              background: `radial-gradient(closest-side, ${hexToRgba(color, 0.4)} 0%, ${hexToRgba(color, 0.16)} 45%, transparent 100%)`,
              ...(staticOrbs ? {} : {
                animationName: i % 2 === 0 ? "slideai-orb-a" : "slideai-orb-b",
                animationDuration: `${22 + i * 4}s`,
                animationDelay: `${-i * 3}s`,
              }),
            }}
          />
        );
      })}

      {/* Camada 4 — Grain SVG sutil (textura editorial) */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
        <filter id={grainId}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${grainId})`} />
      </svg>
    </div>
  );
};

/** Heurística: extrai uma query temática do conteúdo do slide. */
export function videoQueryForSlide(c: {
  image_query?: string;
  ai_image_prompt?: string;
  headline?: string;
}): string | null {
  if (c.image_query) return c.image_query;
  if (c.ai_image_prompt) {
    return c.ai_image_prompt.split(/[,.;]/)[0].slice(0, 60);
  }
  if (c.headline) {
    return c.headline
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gi, "")
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 3)
      .join(" ");
  }
  return null;
}
