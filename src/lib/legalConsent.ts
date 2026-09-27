// Aceite dos Termos/Política e registro de acesso (Marco Civil, art. 15).
//
// As tabelas e funções vêm da migração 0003_legal_compliance. O cliente usa
// uma interface mínima, sem depender dos tipos gerados: até a migração ser
// aplicada, o types.ts regenerado pela Lovable não tem essas entidades — e,
// nesse intervalo, tudo aqui falha em silêncio, sem bloquear ninguém.
import { supabase } from "@/integrations/supabase/client";
import { LEGAL } from "@/lib/legal";

type DbError = { message: string; code?: string } | null;

interface LooseQuery {
  select(columns: string): LooseQuery;
  eq(column: string, value: unknown): LooseQuery;
  order(column: string, options: { ascending: boolean }): LooseQuery;
  limit(n: number): LooseQuery;
  maybeSingle(): Promise<{ data: unknown; error: DbError }>;
}

interface LooseClient {
  rpc(fn: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: DbError }>;
  from(table: string): LooseQuery;
}

const db = supabase as unknown as LooseClient;

export type AcceptanceSource = "signup" | "gate" | "checkout";

export interface AcceptanceRow {
  terms_version: string;
  privacy_version: string;
  accepted_at: string;
}

export type AcceptanceLookup =
  | { status: "ok"; row: AcceptanceRow | null }
  | { status: "unavailable" };

/** Último aceite do usuário. `unavailable` = backend sem a migração (não bloquear). */
export const fetchLatestAcceptance = async (userId: string): Promise<AcceptanceLookup> => {
  try {
    const { data, error } = await db
      .from("legal_acceptances")
      .select("terms_version, privacy_version, accepted_at")
      .eq("user_id", userId)
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { status: "unavailable" };
    return { status: "ok", row: (data as AcceptanceRow | null) ?? null };
  } catch {
    return { status: "unavailable" };
  }
};

export const isCurrentAcceptance = (row: Pick<AcceptanceRow, "terms_version" | "privacy_version"> | null | undefined): boolean =>
  !!row && row.terms_version === LEGAL.termsVersion && row.privacy_version === LEGAL.privacyVersion;

/** Registra, no servidor (data, hora, IP e navegador), o aceite da versão vigente. */
export const acceptCurrentTerms = async (source: AcceptanceSource): Promise<{ ok: boolean; error?: string }> => {
  try {
    const { error } = await db.rpc("accept_legal_terms", {
      _terms_version: LEGAL.termsVersion,
      _privacy_version: LEGAL.privacyVersion,
      _source: source,
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

/** Metadados gravados no cadastro por e-mail (antes da confirmação da conta). */
export const signupConsentMetadata = () => ({
  terms_version: LEGAL.termsVersion,
  privacy_version: LEGAL.privacyVersion,
  terms_accepted_at: new Date().toISOString(),
});

/** Registro de acesso exigido pelo Marco Civil. O servidor deduplica (30 min por IP). */
export const recordAccess = async (event: "session" | "login" = "session"): Promise<void> => {
  try {
    await db.rpc("record_access", { _event: event });
  } catch {
    /* o registro de acesso nunca pode quebrar a navegação */
  }
};
