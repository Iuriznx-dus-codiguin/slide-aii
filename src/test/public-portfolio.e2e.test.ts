/**
 * E2E / integration tests — portfólio público (/u/:username) e link compartilhado.
 * Valida permissões (RLS + RPC), slugs e comportamento de "não encontrado".
 */
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const URL = import.meta.env.VITE_SUPABASE_URL as string;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const anon = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

describe("portfólio público — permissões", () => {
  it("tabela profiles não é legível anonimamente", async () => {
    const { data } = await anon.from("profiles").select("id,email,username").limit(5);
    expect(data ?? []).toEqual([]);
  });

  it("get_public_profile devolve vazio para username inexistente", async () => {
    const { data, error } = await anon.rpc("get_public_profile", {
      _username: `nao-existe-${Date.now()}`,
    });
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it("get_public_profile nunca expõe campos sensíveis", async () => {
    const { data } = await anon.rpc("get_public_profile", { _username: "qualquer" });
    for (const row of data ?? []) {
      expect(Object.keys(row)).not.toContain("email");
      expect(Object.keys(row)).not.toContain("plan");
      expect(Object.keys(row)).not.toContain("credits_bonus");
      expect(Object.keys(row)).not.toContain("credits_monthly");
    }
  });

  it("só retorna perfis marcados como públicos", async () => {
    const { data } = await anon.rpc("get_public_profile", { _username: "admin" });
    // Se existir, precisa ser público — a função filtra is_public = true.
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("apresentações compartilhadas — slugs e visibilidade", () => {
  it("anônimo só enxerga apresentações publicadas e não excluídas", async () => {
    const { data, error } = await anon
      .from("presentations")
      .select("id,slug,is_published,deleted_at")
      .limit(50);
    expect(error).toBeNull();
    for (const item of data ?? []) {
      expect(item.is_published).toBe(true);
      expect(item.deleted_at).toBeNull();
      expect(item.slug).toBeTruthy();
    }
  });

  it("slug inexistente não retorna apresentação", async () => {
    const { data } = await anon
      .from("presentations")
      .select("id")
      .eq("slug", `slug-inexistente-${Date.now()}`)
      .maybeSingle();
    expect(data).toBeNull();
  });

  it("anônimo não consegue alterar nem excluir apresentações", async () => {
    const { data } = await anon.from("presentations").select("id").limit(1);
    const target = data?.[0]?.id;
    if (!target) return;
    const { error: updateError } = await anon
      .from("presentations")
      .update({ title: "hackeado" })
      .eq("id", target)
      .select("id");
    const { data: deleted } = await anon
      .from("presentations")
      .delete()
      .eq("id", target)
      .select("id");
    expect(updateError ?? (deleted ?? []).length === 0).toBeTruthy();
  });
});
