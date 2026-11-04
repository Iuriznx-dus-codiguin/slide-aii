// Edição por chat: aplicação dos patches da IA sobre o deck original.
import { describe, expect, it } from "vitest";
import { applyEdits } from "../../supabase/functions/_shared/editDirector.ts";

const deck = () => [
  { slide_type: "title_slide", headline: "Capa", narrative_act: "hook" },
  { slide_type: "content", headline: "Antigo", body_text: "texto longo", chart: { type: "bar" }, visual_accents: ["dot-grid"] },
];

describe("applyEdits", () => {
  it("soma dois patches para o mesmo slide (antes o segundo descartava o primeiro)", () => {
    const { slides, changed } = applyEdits(deck(), [
      { index: 1, body_text: "curto" },
      { index: 1, headline: "Novo", remove_chart: true },
    ], [1]);
    expect(slides[1].body_text).toBe("curto");
    expect(slides[1].headline).toBe("Novo");
    expect(slides[1].chart).toBeNull();
    expect(changed).toEqual([1]);
  });

  it("ignora índices fora do escopo e preserva o DNA visual", () => {
    const { slides, changed } = applyEdits(deck(), [
      { index: 0, headline: "Fora do escopo" },
      { index: 1, headline: "Dentro" },
    ], [1]);
    expect(slides[0].headline).toBe("Capa");
    expect(slides[1].visual_accents).toEqual(["dot-grid"]);
    expect(changed).toEqual([1]);
  });

  it("não altera o deck recebido", () => {
    const original = deck();
    applyEdits(original, [{ index: 1, headline: "Novo" }], [1]);
    expect(original[1].headline).toBe("Antigo");
  });
});

// ── Correções da edição por chat (11/2026) ─────────────────────────────────
import { compactSlide, heuristicPlan, isDeckWide } from "../../supabase/functions/_shared/editDirector.ts";
import { slideDisplaysMedia } from "../../supabase/functions/_shared/sceneMedia.ts";

const photoDeck = () => [
  { slide_type: "title_slide", layout_template: "split-hero", headline: "História da Espanha", cover_variant: "split-hero", image_url: "https://img/capa.jpg", image_query: "alhambra" },
  { slide_type: "image_text", layout_template: "image-right", headline: "Reconquista", subtitle: "Oito séculos", body_text: "Texto", image_url: "https://img/old.jpg", image_query: "castle" },
  { slide_type: "content", layout_template: "title-content", headline: "Economia", bullets: ["a", "b"], stat_value: "4ª", stat_label: "economia da UE" },
];

describe("alvo da edição — o slide aberto, não o deck inteiro", () => {
  it("pedido sem número vai para o slide aberto (antes virava edição do deck)", () => {
    expect(heuristicPlan("troque a imagem por uma foto de castelo", 5, 2)).toMatchObject({ scope: "slide", indices: [2] });
    expect(heuristicPlan("troque a imagem", 5, 2).complex).toBe(false);
  });
  it("número explícito, ordinal e capa vencem o slide aberto", () => {
    expect(heuristicPlan("no slide 4, remova o subtítulo", 6, 1).indices).toEqual([3]);
    expect(heuristicPlan("mude o terceiro slide", 6, 1).indices).toEqual([2]);
    expect(heuristicPlan("mude a capa", 6, 3).indices).toEqual([0]);
    expect(heuristicPlan("ajuste o próximo slide", 6, 3).indices).toEqual([4]);
  });
  it("deck inteiro só com palavras inequívocas", () => {
    expect(isDeckWide("reduza o texto de todos os slides")).toBe(true);
    expect(isDeckWide("adicione uma visão geral")).toBe(false);
    expect(heuristicPlan("adicione uma visão geral", 5, 1).scope).toBe("slide");
  });
  it("cliente antigo (sem slide aberto) mantém o comportamento anterior", () => {
    expect(heuristicPlan("deixe mais curto", 5).scope).toBe("deck");
  });
});

describe("remoção explícita de elementos", () => {
  it("remove vira null (atravessa o JSON) e o layout se ajusta ao que sobrou", () => {
    const { slides } = applyEdits(photoDeck(), [{ index: 1, remove: ["image", "subtitle"] }], [1]);
    const s = slides[1];
    expect(s.image_url).toBeNull();
    expect(s.asset).toBeNull();
    expect(s.subtitle).toBeNull();
    expect(s.layout_template).toBe("title-content");
    expect(JSON.parse(JSON.stringify(s))).toHaveProperty("image_url", null);
  });
  it("tirar o número do stat-highlight não deixa slide vazio de layout", () => {
    const deck = photoDeck();
    deck[2].layout_template = "stat-highlight";
    const { slides } = applyEdits(deck, [{ index: 2, remove: ["stat"] }], [2]);
    expect(slides[2].stat_value).toBeNull();
    expect(slides[2].layout_template).toBe("title-content");
  });
  it("excluir o slide inteiro, nunca o deck todo", () => {
    expect(applyEdits(photoDeck(), [{ index: 2, remove_slide: true }], [2])).toMatchObject({ deleted: [2], changed: [] });
    expect(applyEdits([photoDeck()[0]], [{ index: 0, remove_slide: true }], [0]).deleted).toEqual([]);
  });
});

describe("troca de imagem", () => {
  it("replace_image cria um ativo pendente com a busca nova e apaga a URL antiga", () => {
    const { slides } = applyEdits(photoDeck(), [{ index: 1, replace_image: true, image_query: "medieval stone castle" }], [1]);
    const s = slides[1];
    expect(s.image_url).toBeNull();
    expect(s.asset).toMatchObject({ status: "pending", source: "pexels", query: "medieval stone castle", allow_ai_fallback: true });
    expect(slideDisplaysMedia({ slide_type: s.slide_type, layout_template: s.layout_template, content: s })).toBe(true);
  });
  it("adicionar imagem num slide de texto muda para um layout que a exibe", () => {
    const { slides } = applyEdits(photoDeck(), [{ index: 2, replace_image: true, image_query: "madrid skyline" }], [2]);
    expect(slides[2].layout_template).toBe("image-right");
  });
  it("link https colado pelo usuário vai direto; outro protocolo é ignorado", () => {
    const ok = applyEdits(photoDeck(), [{ index: 1, image_url: "https://example.com/foto.jpg" }], [1]).slides[1];
    expect(ok.image_url).toBe("https://example.com/foto.jpg");
    expect(ok.asset).toBeNull();
    const bad = applyEdits(photoDeck(), [{ index: 1, image_url: "javascript:alert(1)" }], [1]).slides[1];
    expect(bad.image_url).toBe("https://img/old.jpg");
  });
  it("capa sem imagem vai para a variante tipográfica", () => {
    const { slides } = applyEdits(photoDeck(), [{ index: 0, remove: ["image"] }], [0]);
    expect(slides[0].cover_variant).toBe("asymmetric-grid");
  });
});

describe("validação do patch", () => {
  it("layout e tipo fora do repertório são ignorados; gráfico é saneado", () => {
    const { slides } = applyEdits(photoDeck(), [{ index: 2, layout_template: "inexistente", slide_type: "x", chart: { type: "pizza", labels: ["a", "b"], values: ["30%", 70] } }], [2]);
    expect(slides[2].slide_type).toBe("data_chart");
    expect(slides[2].layout_template).toBe("data-chart");
    expect(slides[2].chart).toMatchObject({ type: "pie", values: [30, 70], unit: "%" });
  });
  it("prompt compacto: sem URLs nem DNA de animação", () => {
    const c = compactSlide({ ...photoDeck()[1], visual_accents: ["dot-grid"], asset: { status: "ready" }, animation_intent: "x" });
    expect(c).not.toHaveProperty("image_url");
    expect(c).not.toHaveProperty("visual_accents");
    expect(c).not.toHaveProperty("asset");
    expect(c).toMatchObject({ headline: "Reconquista", has_image: true });
  });
});
