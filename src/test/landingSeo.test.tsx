import { readFileSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LANDING_FAQS } from "@/components/landing/faqContent";
import { Pricing } from "@/components/landing/Pricing";
import { PLAN_MONTHLY_CREDITS, SINGLE_PURCHASE_CREDITS } from "@/lib/cakto";

// whileInView (framer-motion) usa IntersectionObserver, que o jsdom não tem.
globalThis.IntersectionObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
} as unknown as typeof IntersectionObserver;

const html = readFileSync("index.html", "utf8");
const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

describe("home — metadados e promessas", () => {
  it("o FAQ do JSON-LD é o mesmo da página", () => {
    const faq = jsonLd.find((j) => j["@type"] === "FAQPage");
    expect(faq.mainEntity.map((q: { name: string; acceptedAnswer: { text: string } }) => ({ q: q.name, a: q.acceptedAnswer.text })))
      .toEqual(LANDING_FAQS);
  });

  it("sem promessas antigas nem marca de terceiros", () => {
    for (const bad of ["em segundos", "@Lovable", "Ilimitado", "gpt-engineer-file-uploads", "Suporte prioritário"]) {
      expect(html, bad).not.toContain(bad);
    }
    expect(html).toContain('<meta property="og:image" content="https://slideai.com.br/og-image.png" />');
    expect(readFileSync("public/og-image.png").length).toBeGreaterThan(10_000);
  });

  it("estimativa do PRO derivada da cota mensal e do avulso, sem bônus de ativação (AGENTS.md)", () => {
    render(<MemoryRouter><Pricing /></MemoryRouter>);
    const expected = Math.floor((PLAN_MONTHLY_CREDITS.trimestral * 3) / SINGLE_PURCHASE_CREDITS);
    expect(expected).toBe(10);
    expect(screen.getByText(`≈ ${expected} apresentações por mês`)).toBeInTheDocument();
    expect(screen.queryByText(/Suporte prioritário/)).toBeNull();
    // Assinaturas sem bônus de ativação; o "100 Bônus" que resta é o do avulso, intacto.
    expect(screen.getByText(/1\.700 créditos por mês/)).toBeInTheDocument();
    expect(screen.getAllByText(/Bônus/).map((el) => el.textContent?.trim())).toEqual(["400 créditos + 100 Bônus"]);
  });

  it("cards mostram o preço anterior riscado e os descontos derivados da tabela", () => {
    render(<MemoryRouter><Pricing /></MemoryRouter>);
    // Trimestral (predefinido): PRO de 127,90 por 88,90; MAX de 377,90 por 375,00.
    expect(screen.getByLabelText("Preço anterior: R$ 127,90")).toBeInTheDocument();
    expect(screen.getByText("88,90")).toBeInTheDocument();
    expect(screen.getByLabelText("Preço anterior: R$ 377,90")).toBeInTheDocument();
    expect(screen.getByText("375,00")).toBeInTheDocument();
    expect(screen.getByText("-30%")).toBeInTheDocument();
    expect(screen.getByText("-15%")).toBeInTheDocument();
    expect(screen.getByText("-34%")).toBeInTheDocument();
    expect(screen.getByText(/até 5x mais uso que o Plano PRO \(8\.500 créditos por mês\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Mensal/ }));
    expect(screen.getByLabelText("Preço anterior: R$ 49,90")).toBeInTheDocument();
    expect(screen.getByText("34,90")).toBeInTheDocument();
    expect(screen.getByText("147,00")).toBeInTheDocument();
    // Avulso intacto.
    expect(screen.getByText("14,90")).toBeInTheDocument();
    expect(screen.getByText("≈ 3 apresentações")).toBeInTheDocument();
  });
});
