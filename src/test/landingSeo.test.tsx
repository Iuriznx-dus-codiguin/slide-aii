import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
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
    expect(expected).toBe(19);
    expect(screen.getByText(`≈ ${expected} apresentações por mês`)).toBeInTheDocument();
    expect(screen.queryByText(/Suporte prioritário/)).toBeNull();
  });
});
