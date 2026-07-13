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
    if (noVideo || !enableVideo || !videoQuery || prefersReducedMotion) return;
    let cancelled = false;
    fetchVideo(videoQuery).then((r) => {
      if (!cancelled) {
        setVideoSrc(r.url);
        setPoster(r.poster);
      }
    });
    return () => { cancelled = true; };
  }, [videoQuery, noVideo, enableVideo, prefersReducedMotion]);

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
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.35 }}
          transition={{ duration: 2.4, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "blur(2px) saturate(115%)" }}
        />
      )}

      {/* Camada 2 — Glass tint usando o accent + bg */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${hexToRgba(bg, glassOpacity)} 0%, ${hexToRgba(accent, 0.18)} 50%, ${hexToRgba(bg, glassOpacity + 0.15)} 100%)`,
          backdropFilter: videoSrc ? "blur(10px) saturate(140%)" : undefined,
          WebkitBackdropFilter: videoSrc ? "blur(10px) saturate(140%)" : undefined,
        }}
      />

      {/* Camada 3 — Orbs flutuantes (gradient mesh animado) */}
      {Array.from({ length: orbCount }).map((_, i) => {
        const colors = [accent, accent2, accent];
        const size = 35 + (i % 3) * 18;
        const top = [-15, 55, 25][i % 3];
        const left = [-10, 60, 30][i % 3];
        const dur = 22 + i * 4;
        return (
          <motion.div
            key={i}
            animate={staticOrbs ? undefined : {
              x: [0, 40, -30, 0],
              y: [0, -30, 50, 0],
              scale: [1, 1.1, 0.95, 1],
            }}
            transition={staticOrbs ? undefined : { duration: dur, repeat: Infinity, ease: "easeInOut", delay: i * 1.5 }}
            className="absolute rounded-full"
            style={{
              top: `${top}%`, left: `${left}%`,
              width: `${size}%`, height: `${size}%`,
              background: colors[i % colors.length],
              filter: "blur(110px)",
              opacity: 0.32,
              mixBlendMode: "screen",
            }}
          />
        );
      })}

      {/* Camada 4 — Grain SVG sutil (textura editorial) */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.06] mix-blend-overlay" xmlns="http://www.w3.org/2000/svg">
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
