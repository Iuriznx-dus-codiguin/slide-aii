// Disparo de e-mails acionados pelo app. O destinatário NUNCA vem do cliente:
// é derivado no servidor a partir do evento e de quem está logado, para que a
// função não possa ser usada para mandar e-mail a qualquer endereço.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { sendPlatformEmail } from "../_shared/email.ts";
import { sendLifecycle } from "../_shared/lifecycle.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.discriminatedUnion("event", [
  z.object({ event: z.literal("welcome") }),
  z.object({ event: z.literal("support_reply"), conversation_id: z.string().uuid(), message: z.string().min(1).max(4000), resolved: z.boolean() }),
  z.object({ event: z.literal("access_requested"), request_id: z.string().uuid() }),
  z.object({ event: z.literal("access_decided"), request_id: z.string().uuid() }),
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  let parsed;
  try { parsed = Body.safeParse(await req.json()); } catch { return json({ error: "invalid_json" }, 400); }
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
  const body = parsed.data;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const profileOf = async (id: string) =>
    (await admin.from("profiles").select("id, full_name, username, email").eq("id", id).maybeSingle()).data;

  switch (body.event) {
    case "welcome": {
      // Boas-vindas pela situação da conta: sem compra, chama para escolher um
      // plano; com compra, para criar. A sequência de nutrição é agendada pelo
      // planejador (plan_lifecycle_emails).
      const result = await sendLifecycle(admin, { userId: user.id, template: "welcome", dedupeKey: `welcome:${user.id}` });
      return json({ ok: true, result });
    }
    case "support_reply": {
      const [{ data: isAdmin }, { data: isDev }] = await Promise.all([
        admin.rpc("has_role", { _user_id: user.id, _role: "admin" }),
        admin.rpc("has_role", { _user_id: user.id, _role: "developer" }),
      ]);
      if (!isAdmin && !isDev) return json({ error: "forbidden" }, 403);
      const { data: conv } = await admin.from("support_conversations")
        .select("id, ticket_id, user_id").eq("id", body.conversation_id).maybeSingle();
      if (!conv?.user_id) return json({ error: "not_found" }, 404);
      const owner = await profileOf(conv.user_id);
      const result = await sendPlatformEmail(admin, {
        to: owner?.email ?? "", userId: conv.user_id,
        dedupeKey: `support_reply:${conv.id}:${crypto.randomUUID()}`,
        event: { type: "support_reply", ticketId: conv.ticket_id ?? "", reply: body.message, resolved: body.resolved, conversationId: conv.id },
      });
      return json({ ok: true, result });
    }
    case "access_requested": {
      const { data: r } = await admin.from("profile_access_requests")
        .select("id, owner_id, requester_id, message").eq("id", body.request_id).maybeSingle();
      if (!r || r.requester_id !== user.id) return json({ error: "not_found" }, 404);
      const [owner, requester] = await Promise.all([profileOf(r.owner_id), profileOf(r.requester_id)]);
      const result = await sendPlatformEmail(admin, {
        to: owner?.email ?? "", userId: r.owner_id, dedupeKey: `access_requested:${r.id}`,
        event: { type: "access_requested", requesterName: requester?.full_name || requester?.username || "Um usuário", message: r.message },
      });
      return json({ ok: true, result });
    }
    case "access_decided": {
      const { data: r } = await admin.from("profile_access_requests")
        .select("id, owner_id, requester_id, status").eq("id", body.request_id).maybeSingle();
      if (!r || r.owner_id !== user.id) return json({ error: "not_found" }, 404);
      if (r.status !== "approved" && r.status !== "denied") return json({ error: "not_decided" }, 400);
      const [owner, requester] = await Promise.all([profileOf(r.owner_id), profileOf(r.requester_id)]);
      const result = await sendPlatformEmail(admin, {
        to: requester?.email ?? "", userId: r.requester_id, dedupeKey: `access_decided:${r.id}:${r.status}`,
        event: { type: "access_decided", ownerName: owner?.full_name || owner?.username || "O dono", ownerUsername: owner?.username, approved: r.status === "approved" },
      });
      return json({ ok: true, result });
    }
  }
});
