// Motor principal (v1): composição do deck pelo conteúdo, com o que o v2
// trouxe de melhor (diagramas nativos, gráficos saneados, capa fiel ao tema)
// e obedecendo ao formulário (gráficos, imagens, slide dinâmico, profundidade).
import { describe, expect, it } from "vitest";
import { composeDeck, isV1Diagram, v1DiagramSpecs, V1_VISUAL_COMMANDS, type ComposeOptions } from "../../supabase/functions/_shared/deckComposer.ts";
import { slideDisplaysMedia } from "../../supabase/functions/_shared/sceneMedia.ts";
import { chartHighlight, sanitizeChart } from "../../supabase/functions/_shared/chartSpec.ts";

const OPTS: ComposeOptions = {
  title: "História da Espanha",
  includeImages: true,
  includeCharts: true,
  preferDynamic: true,
  budgetMode: "balanced",
  textDepth: "balanced",
  palette: { bg: "#0B0B12", text: "#F8FAFC", accent: "#E11D48", accent2: "#F59E0B" },
};

const beats = (n: number) => Array.from({ length: n }, (_, i) => ({
  narrative_act: (i === 0 ? "hook" : i === n - 1 ? "climax" : "journey") as "hook" | "journey" | "climax",
  key_message: `Mensagem ${i + 1}`,
}));

const timeline = {
  command: "TIMELINE",
  items: [
    { label: "711", detail: "Muçulmanos atravessam o estreito" },
    { label: "1492", detail: "Queda de Granada e fim da Reconquista" },
    { label: "1978", detail: "Constituição democrática" },
  ],
};

function deck(slides: Record<string, unknown>[], opts: Partial<ComposeOptions> = {}) {
  return composeDeck({ aiSlides: slides, beats: beats(slides.length), brief: { domain: "history", element_density: "moderate" }, options: { ...OPTS, ...opts } });
}

describe("capa — título do usuário e imagem do tema", () => {
  it("o headline da capa é o título da apresentação, nunca o da IA", () => {
    const { slides } = deck([{ slide_type: "content", headline: "Espanha: séculos de glória", subtitle: "De Roma à democracia", image_query: "alhambra granada spain" }, { headline: "x", body_text: "y" }]);
    expect(slides[0].slide_type).toBe("title_slide");
    expect(slides[0].content.headline).toBe("História da Espanha");
    expect(slides[0].content.subtitle).toBe("De Roma à democracia");
  });

  it("com imagens, a capa sempre exibe a foto do símbolo do tema", () => {
    const { slides } = deck([{ cover_variant: "minimal-centered", image_query: "alhambra granada spain" }, { headline: "x", body_text: "y" }]);
    expect(["split-hero", "full-bleed-image"]).toContain(slides[0].content.cover_variant);
    expect((slides[0].content.asset as { query: string }).query).toBe("alhambra granada spain");
    expect(slideDisplaysMedia(slides[0])).toBe(true);
  });

  it("sem imagens, a capa vai para a variante tipográfica e nada é buscado", () => {
    const { slides } = deck([{ cover_variant: "split-hero", image_query: "spain" }, { headline: "x", body_text: "y", image_query: "madrid" }], { includeImages: false });
    expect(slides[0].content.cover_variant).toBe("asymmetric-grid");
    expect(slides.every((s) => !s.content.asset)).toBe(true);
    expect(slides[1].layout_template).not.toMatch(/image|full-image/);
  });
});

describe("elemento protagonista → layout coerente com o conteúdo", () => {
  it("linha do tempo vira cena com diagrama nativo, sem custo de imagem", () => {
    const { slides, report } = deck([{}, { headline: "Marcos", body_text: "Cronologia.", visual: timeline }]);
    const s = slides[1];
    expect(s.content.engine_version).toBe(2);
    expect((s.content.visual as { command: string; render_mode: string })).toMatchObject({ command: "TIMELINE", render_mode: "native" });
    expect(s.layout_template).toBe("diagram-full");
    expect(s.content.asset).toBeUndefined();
    expect(report.visuals[1]).toBe("TIMELINE");
  });

  it("diagrama sem dado suficiente desce a cadeia; sem saída, vira bullets", () => {
    const short = deck([{}, { headline: "Etapas", visual: { command: "PROCESS_FLOW", items: [{ label: "A" }, { label: "B" }] } }]);
    expect((short.slides[1].content.visual as { command: string }).command).toBe("SEQUENCE");
    const broken = deck([{}, { headline: "Conceito", visual: { command: "CONCEPTUAL_MODEL", items: [{ label: "A", detail: "um" }, { label: "B", detail: "dois" }, { label: "C", detail: "três" }] } }]);
    expect(broken.slides[1].content.visual).toBeUndefined();
    expect(broken.slides[1].content.bullets).toEqual(["A: um", "B: dois", "C: três"]);
    expect(broken.report.dropped.invalid_visuals).toBe(1);
  });

  it("comandos que dependem de mídia ou de IA nunca entram pelo v1", () => {
    const { slides } = deck([{}, { headline: "Motor", visual: { command: "EXPLODED_VIEW", subject: "motor", items: [{ label: "a" }, { label: "b" }, { label: "c" }] } }]);
    const v = slides[1].content.visual as { command: string; render_mode: string } | undefined;
    if (v) expect(v.render_mode).toBe("native");
    expect(slides[1].content.asset).toBeUndefined();
  });

  it("gráfico saneado em data-chart; com 'Gráficos & dados' desligado, nenhum gráfico", () => {
    const chart = { type: "line", labels: ["2019", "2020", "2021"], values: ["10%", 12, 15], source: "INE, 2022" };
    const on = deck([{}, { headline: "Turismo", chart }]);
    expect(on.slides[1].layout_template).toBe("data-chart");
    expect(on.slides[1].slide_type).toBe("data_chart");
    expect(on.slides[1].content.chart).toMatchObject({ type: "line", values: [10, 12, 15], unit: "%", source: "INE, 2022" });
    const off = deck([{}, { headline: "Turismo", chart, bullets: ["a", "b", "c"] }], { includeCharts: false });
    expect(off.slides[1].content.chart).toBeUndefined();
    expect(off.slides[1].layout_template).not.toBe("data-chart");
    expect(off.report.dropped.charts_disabled).toBe(1);
  });

  it("citação só com citação; o texto extra vai para as notas", () => {
    const { slides } = deck([{}, { slide_type: "quote", headline: "Voz", quote_text: "Frase real", quote_author: "Autor", body_text: "Contexto da frase." }]);
    expect(slides[1].layout_template).toBe("quote");
    expect(slides[1].content.body_text).toBeUndefined();
    expect(slides[1].speaker_notes).toContain("Contexto da frase.");
  });

  it("número com texto de apoio vai para o two-columns (o stat-highlight esconderia o texto)", () => {
    const rich = deck([{}, { headline: "Turistas", stat_value: "85 mi", stat_label: "visitantes em 2023", bullets: ["um", "dois"] }]);
    expect(rich.slides[1].layout_template).toBe("two-columns");
    const bare = deck([{}, { headline: "Turistas", stat_value: "85 mi", stat_label: "visitantes em 2023" }]);
    expect(bare.slides[1].layout_template).toBe("stat-highlight");
  });

  it("foto só onde o layout a exibe (pedidas = exibidas) e dentro do teto", () => {
    const content = Array.from({ length: 10 }, (_, i) => ({ headline: `S${i}`, body_text: "Texto de apoio do slide.", image_query: `query ${i}` }));
    const { slides, report } = deck([{ image_query: "spain" }, ...content]);
    for (const s of slides) {
      if (s.content.asset) expect(slideDisplaysMedia(s), s.layout_template).toBe(true);
    }
    const contentPhotos = slides.slice(1).filter((s) => s.content.asset).length;
    expect(contentPhotos).toBeLessThanOrEqual(Math.round(10 * 0.45));
    expect(report.dropped.photos_over_cap).toBe(10 - contentPhotos);
  });

  it("foto sem texto de apoio vira slide de impacto em tela cheia; com texto, alterna os lados", () => {
    const filler = Array.from({ length: 5 }, (_, i) => ({ headline: `T${i}`, body_text: "Texto sem foto." }));
    const { slides } = deck([{}, { headline: "Alhambra", image_query: "alhambra" }, { headline: "Madri", body_text: "Capital.", image_query: "madrid" }, { headline: "Sevilha", body_text: "Sul.", image_query: "seville" }, ...filler]);
    expect(slides[1].layout_template).toBe("full-image");
    expect(slides[2].layout_template).toBe("image-right");
    expect(slides[3].layout_template).toBe("image-left");
  });

  it("'seção' só no layout centralizado — nunca esconde bullets", () => {
    const { slides } = deck([{}, { slide_type: "section_divider", headline: "Parte 2", bullets: ["a", "b", "c"] }]);
    expect(slides[1].slide_type).not.toBe("section_divider");
    expect(slides[1].layout_template).not.toBe("centered");
  });

  it("slide vazio recebe a mensagem do roteiro", () => {
    const { slides } = deck([{}, { headline: "Só título" }]);
    expect(slides[1].content.body_text).toBe("Mensagem 2");
  });
});

describe("formulário e ritmo", () => {
  it("slide dinâmico liga o magic move em todos; desligado, modo clássico em todos", () => {
    const slides = [{}, { headline: "a", body_text: "b" }, { headline: "c", visual: timeline }];
    expect(deck(slides).slides.every((s) => s.content.transition === "dynamic")).toBe(true);
    expect(deck(slides, { preferDynamic: false }).slides.every((s) => s.content.transition === "fade")).toBe(true);
  });

  it("nenhum campo morto da IA chega ao conteúdo (layout, acentos e animação são do código)", () => {
    const { slides } = deck([{}, { headline: "a", body_text: "b", layout_template: "quote", animation: "zoom-in", visual_accents: ["x"] }]);
    expect(slides[1].layout_template).not.toBe("quote");
    expect(slides[1].content.animation).toBeUndefined();
    expect(slides[1].content.visual_accents).not.toContain("x");
  });

  it("intenção de animação não se repete em slides vizinhos", () => {
    const content = Array.from({ length: 6 }, (_, i) => ({ headline: `S${i}`, body_text: "Texto." }));
    const { slides } = deck([{}, ...content]);
    for (let i = 1; i < slides.length; i++) {
      expect(slides[i].content.animation_intent).not.toBe(slides[i - 1].content.animation_intent);
    }
  });

  it("os diagramas oferecidos à IA são todos nativos e estão no registro", () => {
    expect(v1DiagramSpecs().map((s) => s.id)).toEqual([...V1_VISUAL_COMMANDS]);
    for (const s of v1DiagramSpecs()) expect(isV1Diagram(s)).toBe(true);
  });
});

describe("gráficos — saneamento e destaque", () => {
  it("tipos desconhecidos e listas desiguais não quebram a tela", () => {
    expect(sanitizeChart({ type: "radar-3d", labels: ["a", "b", "c"], values: [1, 2] })).toMatchObject({ type: "bar", labels: ["a", "b"], values: [1, 2] });
    expect(sanitizeChart({ type: "pie", labels: ["a"], values: [1] })).toBeNull();
    expect(sanitizeChart({ type: "pie", labels: ["a", "b"], values: [-1, 3] })?.type).toBe("horizontal-bar");
  });

  it("série temporal destaca o último ponto e a variação; categorias destacam o maior", () => {
    const series = chartHighlight(sanitizeChart({ type: "bar", labels: ["2021", "2022", "2023"], values: [100, 120, 150] }));
    expect(series).toMatchObject({ kind: "latest", value: 150, label: "2023" });
    expect(series?.delta).toBeCloseTo(50);
    const cats = chartHighlight(sanitizeChart({ type: "bar", labels: ["Madri", "Barcelona", "Sevilha"], values: [6.7, 5.6, 0.7] }));
    expect(cats).toMatchObject({ kind: "max", value: 6.7, label: "Madri" });
    expect(cats?.delta).toBeUndefined();
    const pie = chartHighlight(sanitizeChart({ type: "donut", labels: ["A", "B"], values: [75, 25] }));
    expect(pie).toMatchObject({ kind: "share", label: "A" });
    expect(pie?.share).toBeCloseTo(75);
  });
});
