// Resolvedor de cenas (motor v2): transforma a saída da IA + o plano visual
// em linhas de slide prontas para gravar. Aqui ficam duas garantias centrais:
//
//  1. Cadeia de fallback — comando que não cumpre o contrato desce para um
//     irmão mais simples e termina em texto; nunca slide vazio ou quebrado.
//  2. Invariante de imagens — toda imagem pedida é exibida e todo slot de
//     imagem exibido tem uma fonte. Antes, o gerador buscava imagens para
//     slides cujo layout não as mostrava (custo sem retorno).

import { describe, expect, it } from "vitest";
import { resolveCommandChain, type SceneVisual } from "../../supabase/functions/_shared/visualBlock.ts";
import { getCommand, MVP_COMMAND_IDS, VISUAL_COMMANDS } from "../../supabase/functions/_shared/visualCommands.ts";
import { planDeck, type PlannerBeat } from "../../supabase/functions/_shared/visualPlanner.ts";
import { resolveScenes, type ResolverOptions } from "../../supabase/functions/_shared/sceneResolver.ts";
import { isSceneContent, slideDisplaysMedia } from "../../supabase/functions/_shared/sceneMedia.ts";
import { SLIDE_LAYOUTS } from "../../supabase/functions/_shared/slideComposition.ts";
import { aiSlideToContentCore } from "../../supabase/functions/_shared/slideContent.ts";

const item = (label: string, extra: Record<string, unknown> = {}) => ({ label, ...extra });
/** Bloco visual como a IA manda (a intenção não interfere na cadeia). */
const vis = (v: Omit<SceneVisual, "intent">): SceneVisual => ({ intent: "EXPLAIN", ...v } as SceneVisual);

describe("cadeia de fallback (resolveCommandChain)", () => {
  it("PIPELINE com menos de 3 etapas vira SEQUENCE", () => {
    const r = resolveCommandChain(vis({ command: "PIPELINE", items: [item("Vento"), item("Rotor")] }));
    expect(r.visual?.command).toBe("SEQUENCE");
    expect(r.fallbacks).toEqual(["PIPELINE→SEQUENCE"]);
  });

  it("SYSTEM_ARCHITECTURE sem nenhuma aresta vira LAYERED_VIEW", () => {
    const r = resolveCommandChain(vis({ command: "SYSTEM_ARCHITECTURE", items: [item("Turbina"), item("Subestação"), item("Rede")] }));
    expect(r.visual?.command).toBe("LAYERED_VIEW");
    expect(r.fallbacks).toEqual(["SYSTEM_ARCHITECTURE→LAYERED_VIEW"]);
  });

  it("SYSTEM_ARCHITECTURE com arestas se mantém", () => {
    const r = resolveCommandChain(vis({
      command: "SYSTEM_ARCHITECTURE",
      items: [
        item("Turbina"), item("Subestação"), item("Rede"),
        // Arestas: itens com from/to (por label ou índice 1-based).
        item("gera", { from: "Turbina", to: "Subestação" }),
        item("injeta", { from: "2", to: "3" }),
      ],
    }));
    expect(r.visual?.command).toBe("SYSTEM_ARCHITECTURE");
    expect(r.fallbacks).toEqual([]);
  });

  it("dado insuficiente sem fallback → null (o slide volta ao texto)", () => {
    const r = resolveCommandChain(vis({ command: "GROWTH_VISUAL", items: [item("2024", { value: 10 })] }));
    expect(r.visual).toBeNull();
    expect(r.reason).toBeTruthy();
  });

  it("comando desconhecido → null", () => {
    expect(resolveCommandChain(vis({ command: "INEXISTENTE", items: [item("a"), item("b")] })).visual).toBeNull();
  });

  it("comando não permitido desce a cadeia até um permitido", () => {
    const r = resolveCommandChain(
      vis({ command: "EXPLODED_VIEW", subject: "motor elétrico", items: [item("Estator"), item("Rotor"), item("Eixo")] }),
      (spec) => spec.renderMode === "native",
    );
    expect(r.visual?.command).toBe("CONCEPTUAL_MODEL");
    expect(r.fallbacks).toEqual(["EXPLODED_VIEW→CONCEPTUAL_MODEL"]);
  });

  it("itens acima do máximo são cortados, não recusados", () => {
    const spec = getCommand("SEQUENCE")!;
    const items = Array.from({ length: spec.maxItems + 4 }, (_, i) => item(`Etapa ${i + 1}`));
    const r = resolveCommandChain(vis({ command: "SEQUENCE", items }));
    expect(r.visual?.items).toHaveLength(spec.maxItems);
  });

  it("no registro, toda cadeia termina (sem ciclos) em no máximo 4 passos e só passa por comandos existentes", () => {
    for (const c of VISUAL_COMMANDS) {
      const seen = new Set<string>([c.id]);
      let cur = c;
      let steps = 0;
      while (cur.fallback) {
        const next = getCommand(cur.fallback);
        expect(next, `${cur.id} → ${cur.fallback} não existe`).toBeDefined();
        expect(seen.has(next!.id), `ciclo em ${c.id}`).toBe(false);
        seen.add(next!.id);
        cur = next!;
        steps++;
      }
      expect(steps).toBeLessThanOrEqual(4);
    }
  });

  it("fallback de comando do MVP é sempre do MVP", () => {
    for (const id of MVP_COMMAND_IDS) {
      const fb = getCommand(id)!.fallback;
      if (fb) expect(MVP_COMMAND_IDS, `${id} → ${fb}`).toContain(fb);
    }
  });
});

// ────────────────────────────────────────────────────────────────
// Deck de referência
// ────────────────────────────────────────────────────────────────

const BEATS: PlannerBeat[] = [
  { narrative_act: "hook", visual_intent: "EMPHASIZE", key_objects: ["wind turbine"] },
  { narrative_act: "tension", visual_intent: "SHOW_CAUSE_EFFECT", key_objects: ["emissões", "carvão"] },
  { narrative_act: "journey", visual_intent: "DECOMPOSE", key_objects: ["pás", "rotor", "gerador", "torre"] },
  { narrative_act: "journey", visual_intent: "SHOW_PROCESS", key_objects: ["vento", "rotor", "gerador", "rede"] },
  { narrative_act: "proof", visual_intent: "SHOW_DATA", key_objects: ["capacidade instalada"] },
  { narrative_act: "journey", visual_intent: "COMPARE", key_objects: ["eólica", "solar"] },
  { narrative_act: "proof", visual_intent: "SHOW_EVOLUTION", key_objects: ["1980", "2000", "2024"] },
  { narrative_act: "tension", visual_intent: "REVEAL_INTERNAL", key_objects: ["nacele", "caixa de engrenagens"] },
  { narrative_act: "journey", visual_intent: "SHOW_RELATIONSHIP", key_objects: ["rede", "armazenamento", "consumidores"] },
  { narrative_act: "proof", visual_intent: "SHOW_SCALE", key_objects: ["pá de 100 m"] },
  { narrative_act: "journey", visual_intent: "EXPLAIN", key_objects: [] },
  { narrative_act: "climax", visual_intent: "EMPHASIZE", key_objects: ["wind farm sunset"] },
];

const lorem = (n: number) => Array.from({ length: n }, (_, i) => `palavra${i}`).join(" ") + ".";

const AI_SLIDES: Record<string, unknown>[] = [
  { slide_type: "title_slide", headline: "Energia do vento", subtitle: "Como turbinas transformam ar em eletricidade", cover_variant: "full-bleed-image", image_query: "wind turbine farm" },
  { slide_type: "content", headline: "O custo do carvão", body_text: lorem(50), visual: { command: "LOOP", intent: "SHOW_CAUSE_EFFECT", items: [item("Queima", { detail: "CO2" }), item("Aquecimento", { detail: "clima" })] } },
  { slide_type: "content", headline: "Anatomia", visual: { command: "COMPONENT_MAP", subject: "turbina eólica", items: [item("Pás"), item("Rotor"), item("Gerador"), item("Torre")] } },
  { slide_type: "content", headline: "Do vento à rede", visual: { command: "PIPELINE", items: [item("Vento"), item("Rotor")] } },
  { slide_type: "data_chart", headline: "Crescimento", visual: { command: "GROWTH_VISUAL", items: [item("2015", { value: "400" }), item("2020", { value: "733" }), item("2024", { value: "1.136" })] } },
  { slide_type: "content", headline: "Eólica x Solar", visual: { command: "SIDE_BY_SIDE", items: [item("Eólica", { detail: "noite" }), item("Solar", { detail: "dia" })] } },
  { slide_type: "content", headline: "Linha do tempo", visual: { command: "TIMELINE", items: [item("1980", { detail: "a" }), item("2000", { detail: "b" }), item("2024", { detail: "c" })] } },
  { slide_type: "content", headline: "Por dentro", visual: { command: "CUTAWAY", subject: "nacele de turbina", items: [item("Caixa"), item("Freio")] } },
  { slide_type: "content", headline: "Sistema", visual: { command: "SYSTEM_ARCHITECTURE", items: [item("Turbina"), item("Subestação"), item("Rede")] } },
  { slide_type: "content", headline: "Escala", body_text: "texto", bullets: ["a", "b"] },
  { slide_type: "content", headline: "Explicação", body_text: lorem(200), bullets: ["um ponto importante", "outro ponto", "terceiro ponto", "quarto"] },
  { slide_type: "conclusion", headline: "O futuro", quote_text: "O vento é infinito", quote_author: "Alguém" },
];

const BASE: ResolverOptions = {
  preferDynamic: true,
  includeImages: true,
  includeCharts: true,
  budgetMode: "balanced",
  textDepth: "balanced",
  palette: { bg: "#0A0A12", text: "#FFFFFF", accent: "#00E0A4" },
  title: "Energia eólica",
};

function run(o: Partial<ResolverOptions> = {}, aiSlides = AI_SLIDES, beats = BEATS) {
  const options = { ...BASE, ...o };
  const plan = planDeck(beats, { domain: "engineering", abstraction_degree: 0.3 }, {
    includeImages: options.includeImages,
    includeCharts: options.includeCharts,
    budgetMode: options.budgetMode,
    maxAiVisuals: options.budgetMode === "economy" ? 0 : 4,
    seed: options.title,
  });
  return resolveScenes({ aiSlides, plan, beats, brief: { domain: "engineering", visual_style: "técnico limpo" }, options });
}

const VARIANTS: [string, Partial<ResolverOptions>][] = [
  ["equilibrado", {}],
  ["economia", { budgetMode: "economy" }],
  ["premium", { budgetMode: "premium" }],
  ["sem imagens", { includeImages: false }],
  ["sem gráficos", { includeCharts: false }],
  ["modo clássico de transição", { preferDynamic: false }],
];

describe("resolveScenes — fallback aplicado ao deck", () => {
  const { slides, report } = run();

  it("registra os fallbacks percorridos no relatório", () => {
    const chains = report.fallbacks.map((f) => f.chain.join(","));
    expect(chains).toContain("PIPELINE→SEQUENCE");
    expect(chains).toContain("SYSTEM_ARCHITECTURE→LAYERED_VIEW");
  });

  it("nenhum slide sai vazio ou com visual fora do contrato", () => {
    for (const s of slides) {
      const c = s.content as Record<string, any>;
      expect(c.headline || c.quote_text || c.body_text, `slide vazio: ${JSON.stringify(c).slice(0, 80)}`).toBeTruthy();
      if (c.visual) {
        const again = resolveCommandChain(c.visual);
        expect(again.visual?.command, `visual gravado não passa no contrato: ${c.visual.command}`).toBe(c.visual.command);
      }
    }
  });

  it("todo slide sai marcado como cena v2 e com layout do repertório", () => {
    for (const s of slides) {
      expect(isSceneContent(s.content)).toBe(true);
      expect(SLIDE_LAYOUTS as readonly string[]).toContain(s.layout_template);
    }
  });

  it("visual inválido vindo da IA não quebra o deck", () => {
    const broken = AI_SLIDES.map((s, i) => (i === 3 ? { ...s, visual: { command: "???", items: "não é lista" } } : i === 4 ? { ...s, visual: { command: "GROWTH_VISUAL", items: [] } } : s));
    const out = run({}, broken);
    expect(out.slides).toHaveLength(AI_SLIDES.length);
    for (const s of out.slides) expect(s.content.headline || s.content.quote_text).toBeTruthy();
  });

  it("slides faltando na resposta da IA são preenchidos sem quebrar", () => {
    const holes = AI_SLIDES.map((s, i) => (i === 5 || i === 6 ? (undefined as unknown as Record<string, unknown>) : s));
    const out = run({}, holes);
    expect(out.slides).toHaveLength(AI_SLIDES.length);
  });

  it("é determinístico", () => {
    expect(run()).toEqual(run());
  });
});

describe("invariante: imagens pedidas = imagens exibidas", () => {
  for (const [name, o] of VARIANTS) {
    it(name, () => {
      const { slides, report } = run(o);
      const withAsset = slides.filter((s) => !!s.content.asset);
      const requested = report.images_requested.pexels + report.images_requested.ai;
      // Toda imagem pedida vai aparecer…
      for (const s of withAsset) expect(slideDisplaysMedia(s), `${s.layout_template} pediu imagem que não aparece`).toBe(true);
      // …e todo slot de imagem exibido tem uma fonte.
      for (const s of slides.filter((x) => slideDisplaysMedia(x))) {
        expect(!!s.content.asset || !!s.content.image_url, `${s.layout_template} exibe slot sem imagem`).toBe(true);
      }
      expect(requested).toBe(withAsset.length);
      expect(report.images_displayed).toBe(requested);
      if (o.includeImages === false) expect(requested).toBe(0);
      if (o.budgetMode === "economy") expect(report.images_requested.ai).toBe(0);
    });
  }

  it("capa com imagem só pede imagem quando o usuário quer imagens", () => {
    const off = run({ includeImages: false }).slides[0];
    expect(off.content.asset).toBeUndefined();
    expect(slideDisplaysMedia(off)).toBe(false);
    const on = run().slides[0];
    expect(on.content.cover_variant).toBe("full-bleed-image");
    expect((on.content.asset as { source?: string })?.source).toBe("pexels");
  });

  it("slides clássicos (v1): só layouts que mostram imagem contam como exibidos", () => {
    // title-only e split-hero são desenhados como capa pelo SlideRenderer; a
    // capa padrão (sem cover_variant) tem slot de imagem.
    const shows = ["image-left", "image-right", "full-image", "title-only", "split-hero"];
    for (const layout of SLIDE_LAYOUTS) {
      const displays = slideDisplaysMedia({ slide_type: "content", layout_template: layout, content: { headline: "x" } });
      expect(displays, layout).toBe(shows.includes(layout));
    }
    for (const v of ["typographic-bold", "minimal-centered", "asymmetric-grid", "gradient-mesh"]) {
      expect(slideDisplaysMedia({ slide_type: "title_slide", layout_template: "split-hero", content: { cover_variant: v } }), v).toBe(false);
    }
  });
});

describe("modo dinâmico × modo clássico", () => {
  // Dois slides seguidos sobre o mesmo objeto recebem a mesma âncora (magic
  // move entre eles). No modo clássico, nenhuma âncora é gravada.
  const beats: PlannerBeat[] = [
    { narrative_act: "hook", key_objects: ["motor"] },
    { narrative_act: "journey", visual_intent: "DECOMPOSE", key_objects: ["motor elétrico"] },
    { narrative_act: "journey", visual_intent: "REVEAL_INTERNAL", key_objects: ["motor elétrico"] },
    { narrative_act: "climax", key_objects: ["futuro"] },
  ];
  const ai = [
    { slide_type: "title_slide", headline: "Motores" },
    { slide_type: "content", headline: "Partes", visual: { command: "COMPONENT_MAP", subject: "motor elétrico", items: [item("Estator"), item("Rotor"), item("Eixo")] } },
    { slide_type: "content", headline: "Por dentro", visual: { command: "CUTAWAY", subject: "motor elétrico", items: [item("Bobina"), item("Ímã"), item("Rolamento")] } },
    { slide_type: "conclusion", headline: "Fim", quote_text: "Tudo gira" },
  ];

  it("dinâmico: âncora semântica compartilhada entre slides consecutivos do mesmo objeto", () => {
    const { slides } = run({ title: "Motores" }, ai, beats);
    expect(slides[1].content.anchor_key).toBe("motor-eletrico");
    expect(slides[2].content.anchor_key).toBe("motor-eletrico");
    expect(slides[0].content.anchor_key).toBeUndefined();
  });

  it("clássico: nenhuma âncora gravada", () => {
    const { slides } = run({ title: "Motores", preferDynamic: false }, ai, beats);
    for (const s of slides) expect(s.content.anchor_key).toBeUndefined();
  });
});

describe("decks antigos (v1) continuam iguais", () => {
  it("conversão de slide do v1 não ganha nenhum campo do motor v2", () => {
    const v1 = aiSlideToContentCore({
      slide_type: "content", headline: "Título", body_text: "Corpo", bullets: ["a", "b"],
      image_query: "x", image_strategy: "pexels", animation_intent: "narrative-build",
    } as Record<string, unknown>);
    for (const k of ["engine_version", "visual", "background", "motion", "anchor_key", "asset"]) {
      expect(k in v1, `campo v2 vazou para o v1: ${k}`).toBe(false);
    }
    expect(isSceneContent(v1)).toBe(false);
  });
});
