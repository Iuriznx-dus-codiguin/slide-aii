// Paridade dos catálogos entre os dois runtimes.
//
// O motor v2 roda metade no Deno (edge functions: planner, resolvedor,
// schemas das ferramentas de IA) e metade no Vite (renderer, Editor,
// exports). Todos os catálogos vivem em supabase/functions/_shared e são
// importados pelos dois lados — este teste garante que nenhuma ponta
// reintroduza uma lista local e que tudo que o servidor pode gravar tenha
// quem desenhe no cliente. Onde a outra ponta é um componente React, o teste
// lê o fonte (os componentes dependem do DOM e não precisam ser montados
// para provar a paridade dos nomes).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NARRATIVE_ACTS, VISUAL_INTENTS, DOMAINS } from "../../supabase/functions/_shared/sceneCatalog.ts";
import { MVP_COMMAND_IDS, SCENE_LAYOUTS, VISUAL_COMMANDS } from "../../supabase/functions/_shared/visualCommands.ts";
import { SCENE_ICONS } from "../../supabase/functions/_shared/sceneIcons.ts";
import {
  INTENT_FOR_MOTION,
  LEGACY_PRESET_FOR_MOTION,
  MOTION_PRESET_LABELS,
  MOTION_PRESETS,
} from "../../supabase/functions/_shared/motionPresets.ts";
import { BACKGROUND_KINDS, IMAGE_COVER_VARIANTS } from "../../supabase/functions/_shared/sceneMedia.ts";
import { COVER_VARIANTS, SLIDE_TYPES } from "../../supabase/functions/_shared/sceneResolver.ts";
import { LEGACY_SLIDE_LAYOUTS, SCENE_ONLY_LAYOUTS, SLIDE_LAYOUTS } from "../../supabase/functions/_shared/slideComposition.ts";
import { autoFontForContext, FONT_PAIRING_IDS } from "../../supabase/functions/_shared/typography.ts";
import { EDIT_TOOL } from "../../supabase/functions/_shared/editDirector.ts";
import { THEMES as SHARED_THEMES } from "../../supabase/functions/_shared/themes.ts";
import { buildToolV2, type ContentV2Request } from "../../supabase/functions/generate-presentation/contentV2.ts";
import { FONTS, THEMES } from "../lib/slugify";

const src = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const sorted = (xs: readonly string[]) => [...xs].sort();
/** Strings de `case "x":` num switch. */
const caseLabels = (code: string) => Array.from(code.matchAll(/case\s+"([^"]+)"\s*:/g), (m) => m[1]);
/** Chaves de um objeto literal `const NAME ... = { a: ..., "b-c": ... }` (primeiro nível). */
function objectKeys(code: string, name: string): string[] {
  const start = code.indexOf(`const ${name}`);
  if (start < 0) return [];
  const open = code.indexOf("{", code.indexOf("=", start));
  let depth = 0;
  let end = open;
  for (let i = open; i < code.length; i++) {
    if (code[i] === "{") depth++;
    else if (code[i] === "}" && --depth === 0) { end = i; break; }
  }
  const body = code.slice(open + 1, end);
  const keys: string[] = [];
  // Shorthand (`Target, Layers,`) ou `chave: valor` / `"chave": valor`.
  for (const part of body.split(/,(?![^{]*})/)) {
    const m = part.trim().match(/^"?([A-Za-z0-9_-]+)"?\s*(?::|$)/);
    if (m) keys.push(m[1]);
  }
  return keys;
}

const REQ: ContentV2Request = {
  title: "t", type: "business", language: "pt-BR", slidesCount: 8, includeCharts: true, includeImages: true,
  includeSpeeches: false, isAutoTheme: true, personaText: "", depthText: "", textDepth: "balanced", presenterNames: [],
};

// Localiza um schema dentro de uma árvore de JSON Schema pelo caminho de propriedades.
function schemaAt(root: unknown, path: string[]): Record<string, any> | undefined {
  let cur: any = root;
  for (const key of path) {
    if (!cur) return undefined;
    if (cur.type === "array") cur = cur.items;
    cur = cur?.properties?.[key];
  }
  return cur;
}

describe("atos narrativos — Story Engine (Deno) × HUD (Vite)", () => {
  const hud = src("src/components/CinematicHUD.tsx");
  it("o HUD importa o tipo do catálogo compartilhado (sem lista local)", () => {
    expect(hud).toContain("_shared/sceneCatalog.ts");
  });
  it("rótulo e cor para cada ato do catálogo", () => {
    for (const map of ["ACT_LABEL", "ACT_COLOR"]) {
      expect(sorted(objectKeys(hud, map)), map).toEqual(sorted([...NARRATIVE_ACTS, "neutral"]));
    }
  });
});

describe("comandos visuais — schema da IA (Deno) × renderer (Vite)", () => {
  const tool = buildToolV2(REQ, true) as any;
  const params = tool[0].function.parameters;
  const visual = schemaAt(params, ["slides", "visual"])!;

  it("o schema de conteúdo v2 oferece exatamente os comandos do MVP", () => {
    expect(sorted(visual.properties.command.enum)).toEqual(sorted(MVP_COMMAND_IDS));
  });

  it("intenções, ícones, tipos de slide e capas do schema vêm dos catálogos", () => {
    expect(sorted(visual.properties.intent.enum)).toEqual(sorted(VISUAL_INTENTS));
    expect(sorted(schemaAt(visual, ["items", "icon"])!.enum)).toEqual(sorted(SCENE_ICONS));
    expect(sorted(schemaAt(params, ["slides", "slide_type"])!.enum)).toEqual(sorted(SLIDE_TYPES));
    expect(sorted(schemaAt(params, ["slides", "cover_variant"])!.enum)).toEqual(sorted(COVER_VARIANTS));
  });

  it("o chat-editor aceita os mesmos comandos, fundos e movimentos", () => {
    const patch = (EDIT_TOOL[0].function.parameters.properties.edits as any).items.properties;
    expect(sorted(patch.visual.properties.command.enum)).toEqual(sorted(MVP_COMMAND_IDS));
    expect(sorted(patch.background.properties.kind.enum)).toEqual(sorted(BACKGROUND_KINDS));
    expect(sorted(patch.motion.properties.preset.enum)).toEqual(sorted(MOTION_PRESETS));
  });

  it("todo componente do registro (e todo gêmeo nativo) tem caso no despachante VisualBlock", () => {
    const cases = caseLabels(src("src/components/scene/VisualBlock.tsx"));
    for (const c of VISUAL_COMMANDS) {
      expect(cases, `${c.id} → ${c.component}`).toContain(c.component);
      if (c.nativeComponent) {
        expect(cases, `${c.id} → nativo ${c.nativeComponent}`).toContain(c.nativeComponent);
        expect(c.nativeComponent, `${c.id}: gêmeo nativo não pode depender de mídia`).not.toBe("MediaVisual");
      }
    }
  });

  it("ids únicos, e os domínios citados pelos comandos existem no catálogo", () => {
    expect(new Set(VISUAL_COMMANDS.map((c) => c.id)).size).toBe(VISUAL_COMMANDS.length);
    for (const c of VISUAL_COMMANDS) {
      for (const i of c.intents) expect(VISUAL_INTENTS as readonly string[], `${c.id}: ${i}`).toContain(i);
      for (const d of c.domains ?? []) expect(DOMAINS as readonly string[], `${c.id}: ${d}`).toContain(d);
    }
  });
});

describe("ícones — lista curada (Deno) × mapa lucide (Vite)", () => {
  it("todo ícone que a IA pode escolher tem componente no mapa, e vice-versa", () => {
    const keys = objectKeys(src("src/components/scene/sceneIcons.tsx"), "ICONS");
    expect(sorted(keys)).toEqual(sorted(SCENE_ICONS));
  });
  it("sem duplicatas", () => {
    expect(new Set(SCENE_ICONS).size).toBe(SCENE_ICONS.length);
  });
});

describe("layouts — composição (Deno) × Editor/renderer (Vite)", () => {
  it("SLIDE_LAYOUTS = layouts clássicos + layouts exclusivos de cena, sem sobreposição", () => {
    expect(sorted(SLIDE_LAYOUTS)).toEqual(sorted([...LEGACY_SLIDE_LAYOUTS, ...SCENE_ONLY_LAYOUTS]));
    for (const l of SCENE_ONLY_LAYOUTS) expect(LEGACY_SLIDE_LAYOUTS as readonly string[]).not.toContain(l);
  });

  it("todo layout de cena está no repertório e tem caso no SceneSlide", () => {
    const cases = caseLabels(src("src/components/scene/SceneSlide.tsx"));
    for (const l of SCENE_LAYOUTS) {
      expect(SLIDE_LAYOUTS as readonly string[]).toContain(l);
      expect(cases, `SceneSlide sem caso para ${l}`).toContain(l);
    }
    for (const c of VISUAL_COMMANDS) {
      for (const l of c.layouts) expect(SCENE_LAYOUTS as readonly string[], `${c.id}: ${l}`).toContain(l);
    }
  });

  it("o Editor usa a lista compartilhada (sem lista local de layouts)", () => {
    const editor = src("src/pages/Editor.tsx");
    expect(editor).toContain("_shared/slideComposition.ts");
    expect(editor).not.toMatch(/const LAYOUTS\s*=\s*\[/);
  });
});

describe("capas — resolvedor (Deno) × CoverLayouts (Vite)", () => {
  it("mesmas variantes, cada uma com caso no despachante", () => {
    const code = src("src/components/slides/CoverLayouts.tsx");
    const cases = caseLabels(code.slice(code.indexOf("export function renderCover")));
    expect(sorted(cases)).toEqual(sorted(COVER_VARIANTS));
    for (const v of IMAGE_COVER_VARIANTS) expect(COVER_VARIANTS as readonly string[]).toContain(v);
  });
});

describe("tipografia e temas — servidor × cliente", () => {
  it("todo id de par tipográfico do servidor existe em FONTS do cliente", () => {
    expect(sorted(Object.keys(FONTS))).toEqual(sorted(FONT_PAIRING_IDS));
  });
  it("a escolha automática de fonte sempre devolve um id conhecido", () => {
    for (const type of ["business", "educational", "pitch", "technical", "creative", "xyz"]) {
      for (const theme of ["dark", "light", "auto", "neon"]) {
        expect(FONTS[autoFontForContext(type, theme, "Título")], `${type}/${theme}`).toBeDefined();
      }
    }
  });
  it("o cliente usa as mesmas paletas do servidor", () => {
    expect(THEMES).toBe(SHARED_THEMES);
  });
});

describe("fundos e movimento — catálogo (Deno) × renderer/timeline (Vite)", () => {
  it("todo tipo de fundo tem caso no SceneBackground", () => {
    const cases = caseLabels(src("src/components/scene/SceneBackground.tsx"));
    for (const k of BACKGROUND_KINDS) expect(cases, k).toContain(k);
  });

  it("rótulos e equivalentes legados cobrem todos os presets", () => {
    expect(sorted(Object.keys(MOTION_PRESET_LABELS))).toEqual(sorted(MOTION_PRESETS));
    expect(sorted(Object.keys(LEGACY_PRESET_FOR_MOTION))).toEqual(sorted(MOTION_PRESETS));
  });

  it("equivalentes legados existem nos presets cinematográficos de animations.ts", () => {
    const code = src("src/lib/animations.ts");
    const union = code.slice(code.indexOf("export type CinematicPreset"), code.indexOf(";", code.indexOf("export type CinematicPreset")));
    const known = Array.from(union.matchAll(/"([a-z-]+)"/g), (m) => m[1]);
    for (const v of Object.values(LEGACY_PRESET_FOR_MOTION)) expect(known, v).toContain(v);
  });

  it("intents equivalentes existem em AnimationIntent da timeline", () => {
    const code = src("src/lib/timeline.ts");
    const union = code.slice(code.indexOf("export type AnimationIntent"), code.indexOf(";", code.indexOf("export type AnimationIntent")));
    const known = Array.from(union.matchAll(/"([a-z-]+)"/g), (m) => m[1]);
    expect(known.length).toBeGreaterThan(0);
    for (const v of Object.values(INTENT_FOR_MOTION)) expect(known, String(v)).toContain(v);
  });
});
