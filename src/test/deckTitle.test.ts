// Título da apresentação fiel ao pedido: a capa e o título salvo são o título
// do usuário, só com correção de ortografia, acentos e maiúsculas.
import { describe, expect, it } from "vitest";
import {
  fallbackTitle,
  isSameTitle,
  resolveDeckTitle,
  stripRequestPrefix,
} from "../../supabase/functions/_shared/deckTitle.ts";

describe("resolveDeckTitle — correção da IA validada", () => {
  it("aceita a correção de acentos e maiúsculas (mesmas palavras, mesma ordem)", () => {
    expect(resolveDeckTitle("historia da espanha", "História da Espanha")).toEqual({ title: "História da Espanha", source: "ai" });
    expect(resolveDeckTitle("revolucao franceza", "Revolução Francesa").title).toBe("Revolução Francesa");
    expect(resolveDeckTitle("impactos da intelijencia artificial no mercado de trabalio",
      "Impactos da Inteligência Artificial no Mercado de Trabalho").source).toBe("ai");
  });

  it("aceita palavras que o usuário juntou ou separou por engano", () => {
    expect(resolveDeckTitle("fotos sintese", "Fotossíntese").title).toBe("Fotossíntese");
  });

  it("recusa reescrita, sinônimo, tradução e palavra acrescentada", () => {
    expect(resolveDeckTitle("historia da espanha", "Espanha: Séculos de Glória").source).toBe("fallback");
    expect(resolveDeckTitle("redes sociais e jovens", "Redes Sociais e Adolescentes").source).toBe("fallback");
    expect(resolveDeckTitle("historia da espanha", "History of Spain").source).toBe("fallback");
    expect(resolveDeckTitle("historia da espanha", "A História da Espanha").source).toBe("fallback");
  });

  it("aproveita só o título quando a IA acrescenta um subtítulo", () => {
    expect(resolveDeckTitle("historia da espanha", "História da Espanha: da Pré-História aos Dias Atuais"))
      .toEqual({ title: "História da Espanha", source: "ai" });
    expect(resolveDeckTitle("historia da espanha", "História da Espanha — uma jornada").title).toBe("História da Espanha");
  });

  it("sem correção da IA, corrige de forma determinística", () => {
    expect(resolveDeckTitle("historia da espanha", undefined)).toEqual({ title: "História da Espanha", source: "fallback" });
    expect(resolveDeckTitle("HISTÓRIA DA ESPANHA", null).title).toBe("História da Espanha");
  });
});

describe("pedido no lugar do título", () => {
  it("o título é o assunto do pedido", () => {
    expect(stripRequestPrefix("faça uma apresentação sobre a historia da espanha")).toBe("historia da espanha");
    expect(stripRequestPrefix("Crie slides sobre fotossíntese.")).toBe("fotossíntese");
    expect(stripRequestPrefix("create a presentation about climate change")).toBe("climate change");
    expect(stripRequestPrefix("Apresentação de vendas Q3")).toBe("Apresentação de vendas Q3");
    expect(resolveDeckTitle("faça uma apresentação sobre historia da espanha", "História da Espanha").title).toBe("História da Espanha");
  });
});

describe("fallbackTitle", () => {
  it("conectores minúsculos, siglas preservadas e acentos comuns", () => {
    expect(fallbackTitle("tcc sobre a saude publica no brasil")).toBe("Tcc sobre a Saúde Pública no Brasil");
    expect(fallbackTitle("o papel da IA na educacao")).toBe("O Papel da IA na Educação");
    expect(fallbackTitle("history of rome", "en")).toBe("History of Rome");
  });

  it("não inventa acento fora do português", () => {
    expect(fallbackTitle("historia de roma", "es")).toBe("Historia de Roma");
  });
});

describe("isSameTitle", () => {
  it("vazios nunca casam", () => {
    expect(isSameTitle("", "")).toBe(false);
    expect(isSameTitle("abc", "")).toBe(false);
  });
});
