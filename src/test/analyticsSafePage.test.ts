import { describe, expect, it } from "vitest";
import { safePage } from "@/lib/analytics";

describe("safePage — o que vai para o Google Analytics/Ads", () => {
  it("remove o código de acesso das preferências de e-mail", () => {
    const p = safePage("https://slideai.com.br/emails/preferencias?t=segredo123", "Preferências");
    expect(p.path).toBe("/emails/preferencias");
    expect(p.location).toBe("https://slideai.com.br/emails/preferencias");
    expect(p.location).not.toContain("segredo");
  });

  it("mantém só os parâmetros de campanha", () => {
    const p = safePage("https://slideai.com.br/?utm_source=google&utm_campaign=lanc&gclid=abc&next=/editor/x&code=123", "SlideAI");
    expect(p.path).toBe("/?utm_source=google&utm_campaign=lanc&gclid=abc");
  });

  it("descarta o fragmento (tokens da troca de senha)", () => {
    const p = safePage("https://slideai.com.br/reset-password#access_token=tok&refresh_token=r", "Nova senha");
    expect(p.location).toBe("https://slideai.com.br/reset-password");
  });

  it("mascara slug, nome de usuário e atendimento, e o título dessas páginas", () => {
    expect(safePage("https://slideai.com.br/slides/plano-de-negocios-acme-x1y2", "Plano de negócios ACME — SlideAI"))
      .toEqual({ path: "/slides/:slug", location: "https://slideai.com.br/slides/:slug", title: "SlideAI" });
    expect(safePage("https://slideai.com.br/editor/meu-deck?print=1", "Editor").path).toBe("/editor/:slug");
    expect(safePage("https://slideai.com.br/u/maria", "Maria — SlideAI").path).toBe("/u/:username");
    expect(safePage("https://slideai.com.br/suporte/abc-123", "Suporte").path).toBe("/suporte/:id");
  });

  it("não mexe nas páginas públicas comuns", () => {
    expect(safePage("https://slideai.com.br/ajuda/creditos", "Créditos — Ajuda")).toEqual({
      path: "/ajuda/creditos", location: "https://slideai.com.br/ajuda/creditos", title: "Créditos — Ajuda",
    });
  });
});
