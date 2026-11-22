// Artigo da Central de Ajuda com o Supabase simulado.
//
// Para robôs verificados, a Lovable renderiza a página na hora e copia o
// resultado. O artigo precisa aparecer assim que a consulta principal chega:
// antes, ele esperava também os códigos de erro e os artigos relacionados, e a
// cópia saía com o título certo e o corpo vazio. E uma falha de conexão (banco
// pausado, rede) não pode virar "não encontrado" com noindex.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown; error: { message: string } | null };
const state = {
  article: { data: null, error: null } as Result,
  /** Consultas secundárias (códigos de erro, relacionados) que nunca respondem. */
  hangSecondary: false,
  calls: [] as string[],
};

const ARTICLE = {
  id: "a1",
  slug: "cancelar-assinatura",
  title: "Cancelar a assinatura",
  category: "planos",
  content_md: "Você pode cancelar a qualquer momento, sem multa.\n\n## Como cancelar\n\n1. Abra o Perfil.",
  keywords: ["cancelar"],
  updated_at: "2026-11-01T12:00:00Z",
};

const query = (table: string) => {
  const filters: string[] = [];
  const q = {
    select: () => q,
    eq: (col: string) => { filters.push(`eq:${col}`); return q; },
    neq: () => { filters.push("neq"); return q; },
    order: () => q,
    contains: () => { filters.push("contains"); return q; },
    limit: () => q,
    maybeSingle: async () => { state.calls.push(`${table}:main`); return state.article; },
    then: (resolve: (r: Result) => void) => {
      state.calls.push(`${table}:${filters.includes("neq") ? "related" : "list"}`);
      if (state.hangSecondary) return; // nunca resolve
      resolve({ data: [], error: null });
    },
  };
  return q;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => query(table), rpc: async () => ({ data: null, error: null }) },
}));
vi.mock("sonner", () => ({ toast: { success: () => {}, error: () => {} } }));

const { default: HelpArticle } = await import("@/pages/HelpArticle");

const renderArticle = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/ajuda/cancelar-assinatura"]}>
        <Routes><Route path="/ajuda/:slug" element={<HelpArticle />} /></Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

const robots = () => document.head.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null;

describe("artigo da Central de Ajuda", () => {
  beforeEach(() => {
    state.article = { data: null, error: null };
    state.hangSecondary = false;
    state.calls = [];
    document.head.querySelectorAll("[data-rh]").forEach((el) => el.remove());
  });

  it("mostra o artigo sem esperar códigos de erro e relacionados", async () => {
    state.article = { data: ARTICLE, error: null };
    state.hangSecondary = true;
    renderArticle();
    expect(await screen.findByRole("heading", { level: 1, name: "Cancelar a assinatura" })).toBeInTheDocument();
    expect(screen.getByText(/Você pode cancelar a qualquer momento/)).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("Cancelar a assinatura | Central de Ajuda SlideAI"));
    // As consultas secundárias saem juntas, depois da principal.
    expect(state.calls).toEqual(["help_articles:main", "error_catalog:list", "help_articles:related"]);
  });

  it("falha de conexão mostra aviso com nova tentativa, sem noindex", async () => {
    state.article = { data: null, error: { message: "Failed to fetch" } };
    renderArticle();
    expect(await screen.findByText("Não foi possível carregar o artigo")).toBeInTheDocument();
    expect(screen.queryByText("Artigo não encontrado")).toBeNull();
    await new Promise((r) => setTimeout(r, 50));
    expect(robots() ?? "").not.toMatch(/noindex/);

    // Banco de volta: "Tentar novamente" carrega o artigo.
    state.article = { data: ARTICLE, error: null };
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Cancelar a assinatura" })).toBeInTheDocument();
  });

  it("artigo inexistente mostra 'não encontrado' com noindex", async () => {
    state.article = { data: null, error: null };
    renderArticle();
    expect(await screen.findByText("Artigo não encontrado")).toBeInTheDocument();
    await waitFor(() => expect(robots()).toMatch(/noindex/));
  });
});
