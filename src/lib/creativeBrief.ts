// Espelho frontend de CreativeBrief (Fase 1 — Creative Director Engine).
// A definição autoritativa vive em
// supabase/functions/_shared/creativeDirector.ts — Deno (edge functions) e
// Vite (este app) são runtimes/bundles separados sem import compartilhado
// possível, então os dois precisam ficar em sincronia manual. Qualquer campo
// novo no backend deve ser espelhado aqui.
//
// Consumido por: presentations.creative_brief (coluna jsonb, pode ser null
// para apresentações geradas antes desta feature) → prop `creativeBrief` do
// SlideStage → src/lib/slideTransitions.tsx (Motion Director).
export interface CreativeBrief {
  objective: string;
  audience: string;
  technical_level: "beginner" | "intermediate" | "expert";
  visual_style: string;
  formality: "casual" | "professional" | "formal";
  emotional_identity: string;
  pacing: "slow" | "moderate" | "fast";
  visual_density: "sparse" | "balanced" | "dense";
  minimalism_degree: number;
  creativity_degree: number;
  abstraction_degree: number;
  depth: "surface" | "deep";
  contrast: "low" | "medium" | "high";
  hierarchy_strength: "subtle" | "clear" | "bold";
  spacing: "tight" | "balanced" | "generous";
  asymmetry: "symmetric" | "balanced" | "asymmetric";
  narrative_type: "linear" | "problem-solution" | "before-after" | "story-arc" | "data-driven";
  animation_speed: "slow" | "moderate" | "fast";
  element_density: "minimal" | "moderate" | "rich";
  allowed_transitions: string[];
  forbidden_effects: string[];
  camera_movements: string;
  rationale: string;
}
