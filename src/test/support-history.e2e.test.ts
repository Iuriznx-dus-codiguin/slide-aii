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

// Conversas só nascem pelo support-chat (migração 0010): o INSERT direto
// deixava ocupar ticket_ids e inundar a fila da equipe.
const openConversation = async (client: SupabaseClient, message: string): Promise<string | null> => {
  const { data, error } = await client.functions.invoke("support-chat", { body: { message } });
  if (error) return null;
  return (data as { conversation_id?: string } | null)?.conversation_id ?? null;
};

authed("suporte — histórico persiste e respeita o dono", () => {
  it("usuário não cria conversa nem grava resposta da equipe direto pela API", async () => {
    const a = await signIn("A");
    if (!a) return;
    clients.push(a.client);
    const { error: convError } = await a.client
      .from("support_conversations")
      .insert({ user_id: a.userId, subject: "E2E direto", state: "resolved", ticket_id: "TCK-999999" });
    expect(convError).toBeTruthy();
  });

  it("mensagens gravadas voltam na releitura, em ordem", async () => {
    const a = await signIn("A");
    expect(a, "credenciais E2E_USER_A inválidas").toBeTruthy();
    if (!a) return;
    clients.push(a.client);

    const convId = await openConversation(a.client, "E2E histórico: primeira");
    expect(convId, "support-chat não abriu a conversa").toBeTruthy();
    if (!convId) return;

    const { error: userMsgError } = await a.client.from("support_messages")
      .insert({ conversation_id: convId, role: "user", content: "segunda" });
    expect(userMsgError).toBeNull();
    const { error: spoofError } = await a.client.from("support_messages")
      .insert({ conversation_id: convId, role: "assistant", content: "reembolso aprovado" });
    expect(spoofError).toBeTruthy();

    // releitura em cliente novo: simula reabrir /suporte/:id em outra sessão
    const fresh = await signIn("A");
    if (!fresh) return;
    clients.push(fresh.client);
    const { data: msgs } = await fresh.client
      .from("support_messages")
      .select("role,content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });

    expect(msgs?.[0]).toMatchObject({ role: "user", content: "E2E histórico: primeira" });
    expect(msgs?.[msgs.length - 1]).toMatchObject({ role: "user", content: "segunda" });
    expect(msgs?.some((m) => m.content === "reembolso aprovado")).toBe(false);
  });

  const cross = creds("B") ? it : it.skip;
  cross("usuário B não enxerga nem escreve na conversa do usuário A", async () => {
    const a = await signIn("A");
    const b = await signIn("B");
    if (!a || !b) return;
    clients.push(a.client, b.client);

    const convId = await openConversation(a.client, "E2E RLS: privado");
    if (!convId) return;

    const { data: readAsB } = await b.client
      .from("support_messages")
      .select("id")
      .eq("conversation_id", convId);
    expect(readAsB ?? []).toEqual([]);

    const { data: convAsB } = await b.client
      .from("support_conversations")
      .select("id")
      .eq("id", convId);
    expect(convAsB ?? []).toEqual([]);

    const { error: writeAsB } = await b.client
      .from("support_messages")
      .insert({ conversation_id: convId, role: "user", content: "invasão" });
    expect(writeAsB).toBeTruthy();

    const { error: stealConv } = await b.client
      .from("support_conversations")
      .insert({ user_id: a.userId, subject: "spoof", state: "open" });
    expect(stealConv).toBeTruthy();
  });
});
