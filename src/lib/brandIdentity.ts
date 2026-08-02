// Espelho frontend de BrandIdentity (Fase 6 — Brand Identity Extraction).
// Definição autoritativa em supabase/functions/_shared/brandIdentity.ts —
// Deno e Vite são runtimes separados sem import compartilhado possível.
export interface BrandIdentity {
  source_url: string;
  primary_color: string | null;
  accent_color: string | null;
  font_families: string[];
  logo_url: string | null;
  confidence: "high" | "medium" | "low";
}
