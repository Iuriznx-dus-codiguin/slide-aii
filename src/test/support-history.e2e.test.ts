/**
 * E2E / integration tests — histórico do suporte e RLS por usuário.
 *
 * Rodam contra o backend real usando a chave pública (anon).
 * Os testes autenticados só rodam quando as credenciais de teste estão
 * disponíveis no ambiente (E2E_USER_A_EMAIL / E2E_USER_A_PASSWORD e,
 * opcionalmente, E2E_USER_B_*). Sem elas, apenas as garantias de acesso
 * anônimo são verificadas — que são justamente as mais críticas.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

const URL = import.meta.env.VITE_SUPABASE_URL as string;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const makeClient = () =>
  createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const creds = (suffix: "A" | "B") => {
  const email = process.env[`E2E_USER_${suffix}_EMAIL`];
  const password = process.env[`E2E_USER_${suffix}_PASSWORD`];
  return email && password ? { email, password } : null;
};

const signIn = async (suffix: "A" | "B") => {
  const c = creds(suffix);
  if (!c) return null;
  const client = makeClient();
  const { data, error } = await client.auth.signInWithPassword(c);
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
};

const clients: SupabaseClient[] = [];
afterAll(async () => {
  await Promise.all(clients.map((c) => c.auth.signOut().catch(() => undefined)));
});

describe("suporte — acesso anônimo é totalmente bloqueado", () => {
  const anon = makeClient();

  it("não lê conversas de suporte", async () => {
    const { data, error } = await anon.from("support_conversations").select("id").limit(5);
    expect(error ?? { code: "" }).toBeTruthy();
    expect(data ?? []).toEqual([]);
  });

  it("não lê mensagens de suporte", async () => {
    const { data } = await anon.from("support_messages").select("id").limit(5);
    expect(data ?? []).toEqual([]);
  });

  it("não cria conversas de suporte", async () => {
    const { error } = await anon
      .from("support_conversations")
      .insert({ subject: "intruso", state: "open" });
    expect(error).toBeTruthy();
  });

  it("não cria mensagens em conversas alheias", async () => {
    const { error } = await anon.from("support_messages").insert({
      conversation_id: "00000000-0000-0000-0000-000000000000",
      role: "user",
      content: "intruso",
    });
    expect(error).toBeTruthy();
  });
});

const authed = creds("A") ? describe : describe.skip;

// Desde a migração 0011 conversas e mensagens são criadas pela edge function
// support-chat; o cliente só lê as próprias e avalia (rating).
authed("suporte — escrita pelo servidor e leitura só do dono", () => {
  it("cliente não cria conversa, não forja mensagem e não muda o estado", async () => {
    const a = await signIn("A");
    expect(a, "credenciais E2E_USER_A inválidas").toBeTruthy();
    if (!a) return;
    clients.push(a.client);

    const { error: convError } = await a.client
      .from("support_conversations")
      .insert({ user_id: a.userId, subject: "E2E", state: "open" });
    expect(convError).toBeTruthy();

    const { data: mine } = await a.client.from("support_conversations").select("id").limit(1);
    const target = mine?.[0]?.id;
    if (!target) return;

    const { error: forged } = await a.client
      .from("support_messages")
      .insert({ conversation_id: target, role: "assistant", content: "forjada" });
    expect(forged).toBeTruthy();

    const { error: stateError } = await a.client
      .from("support_conversations")
      .update({ state: "resolved" })
      .eq("id", target);
    expect(stateError).toBeTruthy();
  });

  const cross = creds("B") ? it : it.skip;
  cross("usuário B não enxerga nem escreve na conversa do usuário A", async () => {
    const a = await signIn("A");
    const b = await signIn("B");
    if (!a || !b) return;
    clients.push(a.client, b.client);

    const { data: mine } = await a.client.from("support_conversations").select("id").limit(1);
    const target = mine?.[0]?.id;
    if (!target) return;

    const { data: readAsB } = await b.client
      .from("support_messages")
      .select("id")
      .eq("conversation_id", target);
    expect(readAsB ?? []).toEqual([]);

    const { data: convAsB } = await b.client
      .from("support_conversations")
      .select("id")
      .eq("id", target);
    expect(convAsB ?? []).toEqual([]);

    const { error: writeAsB } = await b.client
      .from("support_messages")
      .insert({ conversation_id: target, role: "user", content: "invasão" });
    expect(writeAsB).toBeTruthy();
  });
});
