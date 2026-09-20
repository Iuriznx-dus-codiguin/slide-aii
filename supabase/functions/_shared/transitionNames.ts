// Fonte ÚNICA dos nomes de transição de slide.
//
// Antes, a lista existia duplicada: `ALL_TRANSITION_NAMES` aqui no lado Deno
// (creativeDirector.ts, que a usa no enum da tool do Creative Director) e a
// união `SlideTransition` + `ALL_TRANSITIONS` no lado Vite
// (src/lib/slideTransitions.tsx, que implementa cada efeito). Adicionar uma
// transição exigia lembrar dos dois lugares; esquecer um deles produzia um
// brief pedindo um efeito que o front não sabe renderizar (ou o inverso).
//
// Este arquivo não importa nada e não usa nenhuma API específica de runtime —
// por isso pode ser importado pelos dois lados: o Deno o resolve como vizinho
// em `_shared/` (e o deploy o inclui junto das functions), e o Vite o resolve
// como um módulo TS comum. A implementação de cada efeito continua vivendo só
// em slideTransitions.tsx; aqui ficam apenas os NOMES.
//
// Há ainda um teste de guarda (src/test/transitionNames.sync.test.ts) que
// falha caso as duas pontas voltem a divergir por qualquer motivo.

/** Modo de continuidade (magic move): os mesmos elementos se movem entre slides. */
export const MAGIC_MOVE_TRANSITION = "dynamic";

/**
 * As 12 transições cinematográficas clássicas — o slide que sai se DESMONTA e
 * o que entra se RECONSTRÓI. Usadas quando o magic move está desativado.
 */
export const CINEMATIC_TRANSITIONS = [
  "mosaic",     // grade de tiles que viram e revelam
  "iris",       // máscara circular abre/fecha do centro
  "shatter",    // clip-path triangular: estilhaça e reagrupa
  "ribbon",     // 5 faixas horizontais varrem em sequência
  "blinds",     // 8 venezianas verticais giram em 3D
  "fold",       // dobra editorial 3D (perspective rotateY)
  "portal",     // zoom+rotate+blur, "entra em portal"
  "wipe",       // diagonal wipe com clip-path polygon
  "split",      // metades superior/inferior se afastam
  "morph",      // crossfade com scale e color-shift líquido
  "stack",      // empilha e dispara em camadas
  "letterbox",  // barras pretas fecham/abrem como cinema
] as const;

export type CinematicTransition = (typeof CINEMATIC_TRANSITIONS)[number];
export type SlideTransitionName = typeof MAGIC_MOVE_TRANSITION | CinematicTransition;

/** As 13 (magic move + 12 cinematográficas) — universo completo para o Creative Director. */
export const ALL_TRANSITION_NAMES: SlideTransitionName[] = [
  MAGIC_MOVE_TRANSITION,
  ...CINEMATIC_TRANSITIONS,
];
