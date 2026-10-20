// Editor com o Supabase simulado: carregar, salvar em fila, erro de exclusão
// e deck na lixeira. Cobre os achados M-8, M-9 e B-18 da auditoria de 17/10/2026.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

type Row = Record<string, unknown>;
const state = {
  presentations: [] as Row[],
  slides: [] as Row[],
  calls: [] as { table: string; op: string; payload?: unknown; filters: unknown[] }[],
  inFlightWrites: 0,
  maxInFlightWrites: 0,
  deleteError: null as null | { message: string },
};

const chain = () => {
  const ch = { on: () => ch, subscribe: () => ch };
  return ch;
};

const from = (table: string) => {
  const q = { op: "select", payload: undefined as unknown, filters: [] as unknown[] };
  const exec = async (single: boolean) => {
    state.calls.push({ table, op: q.op, payload: q.payload, filters: q.filters });
    if (q.op !== "select") {
      state.inFlightWrites++;
      state.maxInFlightWrites = Math.max(state.maxInFlightWrites, state.inFlightWrites);
      await new Promise((r) => setTimeout(r, 20));
      state.inFlightWrites--;
      if (q.op === "delete" && state.deleteError) return { data: null, error: state.deleteError };
      return { data: null, error: null };
    }
    const eq = (q.filters.filter((f) => (f as unknown[])[0] === "eq") as [string, string, unknown][]);
    const rows = (state as unknown as Record<string, Row[]>)[table] ?? [];
    const match = rows.filter((r) => eq.every(([, k, v]) => r[k] === v));
    return { data: single ? match[0] ?? null : match, error: null };
  };
  const api: Record<string, unknown> = {
    select: () => api,
    eq: (k: string, v: unknown) => { q.filters.push(["eq", k, v]); return api; },
    not: (...a: unknown[]) => { q.filters.push(["not", ...a]); return api; },
    is: () => api, order: () => api, limit: () => api, in: () => api, gte: () => api,
    update: (p: unknown) => { q.op = "update"; q.payload = p; return api; },
    upsert: (p: unknown) => { q.op = "upsert"; q.payload = p; return api; },
    insert: (p: unknown) => { q.op = "insert"; q.payload = p; return api; },
    delete: () => { q.op = "delete"; return api; },
    maybeSingle: () => exec(true),
    single: () => exec(true),
    then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => exec(false).then(res, rej),
  };
  return api;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => from(t),
    rpc: async () => ({ data: null, error: null }),
    functions: { invoke: async () => ({ data: null, error: null }) },
    channel: () => chain(),
    removeChannel: () => {},
    storage: { from: () => ({}) },
    auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" }, loading: false, session: null, signOut: async () => {} }) }));
vi.mock("@/hooks/useDeveloperRole", () => ({ useDeveloperRole: () => ({ isDeveloper: false, isAdmin: false, loading: false }) }));
const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a), message: vi.fn(), loading: vi.fn(), info: vi.fn() }),
  Toaster: () => null,
}));

import EditorPage from "@/pages/Editor";

const deck = (id: string, slug: string, extra: Row = {}) => ({
  id, user_id: "u1", title: `Deck ${slug}`, slug, theme: "auto", font_style: "modern", include_speeches: false,
  presenters_names: [], presenters_count: 1, dynamic_theme: null, creative_brief: null, engine_version: 1,
  is_published: false, deleted_at: null, ...extra,
});
const slideRow = (id: string, presentation_id: string, position: number, headline: string) => ({
  id, presentation_id, position, slide_type: "content", layout_template: "title-content", animation_transition: "fade",
  speaker_notes: null, content: { headline }, presenters_data: [],
});

let goTo: (path: string) => void = () => {};
const Nav = () => { goTo = useNavigate(); return null; };
const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Nav />
    <Routes><Route path="/editor/:slug" element={<EditorPage />} /></Routes>
  </MemoryRouter>,
);

describe("Editor — integridade", () => {
  beforeEach(() => {
    state.presentations = [deck("pA", "deck-a"), deck("pB", "deck-b"), deck("pT", "deck-lixo", { deleted_at: "2026-10-01T00:00:00Z" })];
    state.slides = [slideRow("a1", "pA", 0, "Slide A1"), slideRow("a2", "pA", 1, "Slide A2"), slideRow("b1", "pB", 0, "Slide B1")];
    state.calls = [];
    state.inFlightWrites = 0;
    state.maxInFlightWrites = 0;
    state.deleteError = null;
    toastError.mockClear();
    toastSuccess.mockClear();
  });

  it("carrega o deck e nomeia os botões dos slides", async () => {
    renderAt("/editor/deck-a");
    expect(await screen.findByRole("button", { name: "Ir para o slide 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir o slide 1" })).toBeInTheDocument();
  });

  it("dois saves seguidos rodam em fila, nunca ao mesmo tempo", async () => {
    renderAt("/editor/deck-a");
    await screen.findByRole("button", { name: "Ir para o slide 2" });
    await act(async () => {
      fireEvent.keyDown(window, { key: "s", ctrlKey: true });
      fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    });
    await waitFor(() => expect(state.calls.filter((c) => c.op === "upsert")).toHaveLength(2), { timeout: 3000 });
    await waitFor(() => expect(state.inFlightWrites).toBe(0));
    expect(state.maxInFlightWrites).toBe(1);
    expect(toastSuccess).toHaveBeenCalledWith("Salvo!");
  });

  it("falha ao remover slides antigos não mostra \"Salvo!\"", async () => {
    state.deleteError = { message: "falhou" };
    renderAt("/editor/deck-a");
    await screen.findByRole("button", { name: "Ir para o slide 2" });
    await act(async () => { fireEvent.keyDown(window, { key: "s", ctrlKey: true }); });
    await waitFor(() => expect(toastError).toHaveBeenCalled(), { timeout: 3000 });
    expect(toastSuccess).not.toHaveBeenCalledWith("Salvo!");
  });

  it("deck na lixeira não abre para edição", async () => {
    renderAt("/editor/deck-lixo");
    expect(await screen.findByText("Esta apresentação está na lixeira")).toBeInTheDocument();
    expect(state.calls.some((c) => c.table === "slides")).toBe(false);
  });

  it("trocar de apresentação na mesma rota recarrega do zero", async () => {
    renderAt("/editor/deck-a");
    await screen.findByRole("button", { name: "Ir para o slide 2" });
    await act(async () => { goTo("/editor/deck-b"); });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Ir para o slide 2" })).not.toBeInTheDocument());
    expect(await screen.findByRole("button", { name: "Ir para o slide 1" })).toBeInTheDocument();
    expect(screen.getByText("Deck deck-b")).toBeInTheDocument();
  });
});
