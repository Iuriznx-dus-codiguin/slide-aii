import { supabase } from "@/integrations/supabase/client";

type EmailRequest =
  | { event: "welcome" }
  | { event: "support_reply"; conversation_id: string; message: string; resolved: boolean }
  | { event: "access_requested"; request_id: string }
  | { event: "access_decided"; request_id: string };

/** Dispara um e-mail da plataforma. Falhas não interrompem o fluxo do usuário. */
export const sendPlatformEmail = async (body: EmailRequest) => {
  try {
    const { error } = await supabase.functions.invoke("send-email", { body });
    if (error) console.warn("send-email failed", error.message);
  } catch (e) {
    console.warn("send-email failed", e);
  }
};
