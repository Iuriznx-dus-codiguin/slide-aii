// Preferências dos e-mails de relacionamento (dicas, ideias e ofertas).
// RPCs da migração 0008_lifecycle_emails. Avisos de conta e de pagamento não
// dependem desta preferência.
import { supabase } from "@/integrations/supabase/client";

type RpcResult = Promise<{ data: unknown; error: { message: string } | null }>;
const db = supabase as unknown as { rpc(fn: string, args?: Record<string, unknown>): RpcResult };

export interface EmailPreferences {
  relationship_emails: boolean;
  email_hint?: string;
}

/** Pela página pública (link do e-mail): o token é a credencial. */
export const getPreferencesByToken = async (token: string): Promise<EmailPreferences | null> => {
  const { data, error } = await db.rpc("get_email_preferences_by_token", { _token: token });
  if (error || !data) return null;
  return data as EmailPreferences;
};

export const setPreferencesByToken = async (token: string, relationship: boolean): Promise<boolean> => {
  const { data, error } = await db.rpc("set_email_preferences_by_token", { _token: token, _relationship: relationship });
  return !error && data === true;
};

/** Da própria conta, logado. */
export const getMyPreferences = async (): Promise<EmailPreferences | null> => {
  const { data, error } = await db.rpc("get_my_email_preferences");
  if (error || !data) return null;
  return data as EmailPreferences;
};

export const setMyPreferences = async (relationship: boolean): Promise<boolean> => {
  const { data, error } = await db.rpc("set_my_email_preferences", { _relationship: relationship });
  return !error && data === true;
};
