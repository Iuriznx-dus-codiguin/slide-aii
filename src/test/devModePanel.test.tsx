import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// O Slider (Radix) do painel mede o próprio tamanho; o jsdom não tem ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

let isDeveloper = true;
vi.mock("@/hooks/useDeveloperRole", () => ({
  useDeveloperRole: () => ({ isDeveloper, isAdmin: false, loading: false }),
}));

import { DevModePanel } from "@/components/DevModePanel";
import { loadDevSettings, openDevModePanel } from "@/lib/devSettings";

const renderPanel = () => render(<MemoryRouter><DevModePanel /></MemoryRouter>);

describe("DevModePanel: seletor de motor", () => {
  beforeEach(() => {
    localStorage.clear();
    isDeveloper = true;
  });

  it("abre pelo evento devmode:open e mostra v1 marcado por padrão", async () => {
    renderPanel();
    await act(async () => openDevModePanel());
    const radios = await screen.findAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(screen.getByRole("radio", { name: /v1 · Principal/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /v2 · Motor de cenas/ })).toHaveAttribute("aria-checked", "false");
  });

  it("trocar para v2 grava a escolha e marca o cartão", async () => {
    renderPanel();
    await act(async () => openDevModePanel());
    fireEvent.click(await screen.findByRole("radio", { name: /v2 · Motor de cenas/ }));
    expect(loadDevSettings().engine).toBe(2);
    expect(screen.getByRole("radio", { name: /v2 · Motor de cenas/ })).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByRole("radio", { name: /v1 · Principal/ }));
    expect(loadDevSettings().engine).toBe(1);
  });

  it("não aparece para quem não é desenvolvedor", async () => {
    isDeveloper = false;
    renderPanel();
    await act(async () => openDevModePanel());
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByLabelText("Abrir Dev Mode")).toBeNull();
  });
});
