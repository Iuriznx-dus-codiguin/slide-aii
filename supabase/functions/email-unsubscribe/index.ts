// Descadastro em um clique (RFC 8058) dos e-mails de relacionamento.
//
// POST ?t=<token>  → o provedor de e-mail (Gmail, Yahoo…) chama ao clicar em
//                    "Cancelar inscrição". Desliga e responde 200.
// GET  ?t=<token>  → só redireciona para a página de preferências, que pede
//                    confirmação: leitores de link e antivírus abrem GETs
//                    sozinhos e não podem descadastrar ninguém.
// O token (email_preferences.token) é a credencial; nada além disso é exposto.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SITE_URL = "https://slideai.com.br";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  if (!UUID.test(token)) return new Response("invalid token", { status: 400 });

  if (req.method === "GET") {
    return Response.redirect(`${SITE_URL}/emails/preferencias?t=${token}&sair=1`, 302);
  }
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await admin.rpc("set_email_preferences_by_token", { _token: token, _relationship: false });
  if (error) {
    console.error("unsubscribe_failed", error.message);
    return new Response("error", { status: 500 });
  }
  return new Response("ok", { status: 200 });
});
