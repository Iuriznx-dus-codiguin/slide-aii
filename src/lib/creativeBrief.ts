// CreativeBrief (Fase 1 — Creative Director Engine) para o lado Vite.
//
// Este arquivo era uma CÓPIA manual da interface definida no backend, com a
// instrução de "manter em sincronia manual" — mesma armadilha que existia com
// os nomes de transição. Como o módulo do backend não usa nenhuma API
// específica do Deno, o front consegue importá-lo direto: agora há uma única
// definição, e um campo novo no backend aparece aqui sem ninguém lembrar.
//
// Consumido por: presentations.creative_brief (coluna jsonb, pode ser null
// para apresentações geradas antes desta feature) → prop `creativeBrief` do
// SlideStage → src/lib/slideTransitions.tsx (Motion Director).
export type { CreativeBrief } from "../../supabase/functions/_shared/creativeDirector.ts";
