import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { LayeredPanels, GradientMeshDrift, ReactiveDotGrid, CardStack } from "./SlideDecorations";
import type { ThemeColors } from "@/lib/slugify";

const theme: ThemeColors = {
  bg: "#0B0B12",
  text: "#FFFFFF",
  accent: "#A855F7",
  accent2: "#22D3EE",
  name: "test-theme",
};

// As 4 decorações novas do modo dynamic. Cada uma precisa renderizar sem
// lançar exceção tanto animada quanto em contexto estático (noAnimate) —
// que é exatamente o contexto em que rodam em miniaturas/export, onde um
// erro de render quebraria a barra lateral inteira do editor.
describe("Novas decorações — smoke test", () => {
  it("LayeredPanels renderiza animado e estático sem erros", () => {
    expect(() => render(<LayeredPanels theme={theme} />)).not.toThrow();
    expect(() => render(<LayeredPanels theme={theme} noAnimate />)).not.toThrow();
  });

  it("GradientMeshDrift renderiza animado e estático sem erros", () => {
    expect(() => render(<GradientMeshDrift theme={theme} />)).not.toThrow();
    expect(() => render(<GradientMeshDrift theme={theme} noAnimate />)).not.toThrow();
  });

  it("ReactiveDotGrid renderiza animado e estático sem erros", () => {
    expect(() => render(<ReactiveDotGrid theme={theme} />)).not.toThrow();
    expect(() => render(<ReactiveDotGrid theme={theme} noAnimate />)).not.toThrow();
  });

  it("CardStack renderiza animado e estático sem erros", () => {
    expect(() => render(<CardStack theme={theme} />)).not.toThrow();
    expect(() => render(<CardStack theme={theme} noAnimate />)).not.toThrow();
  });

  it("todas respeitam a prop intensity sem quebrar em 0", () => {
    expect(() => render(<LayeredPanels theme={theme} intensity={0} />)).not.toThrow();
    expect(() => render(<GradientMeshDrift theme={theme} intensity={0} />)).not.toThrow();
    expect(() => render(<ReactiveDotGrid theme={theme} intensity={0} />)).not.toThrow();
    expect(() => render(<CardStack theme={theme} intensity={0} />)).not.toThrow();
  });
});
