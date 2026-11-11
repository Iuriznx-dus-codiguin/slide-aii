// Hospedagem das apresentações — mesma regra do banco (migração 0020):
// • assinatura vigente, sem falha de cobrança aberta, mantém tudo no ar;
// • sem assinatura, cada apresentação fica no ar até `hosting_expires_at`
//   (3 meses após a geração ou a última compra de créditos);
// • fora do ar, pode ser restaurada por 30 dias; depois é excluída.

export const SINGLE_HOSTING_MONTHS = 3;
export const HOSTING_GRACE_DAYS = 30;
const DAY_MS = 86_400_000;

export interface DeckHostingInput {
  hosting_expires_at?: string | null;
  offline_since?: string | null;
}

export interface DeckHosting {
  online: boolean;
  /** Quando sai do ar (só para apresentações de créditos avulsos, sem assinatura). */
  expiresAt: Date | null;
  /** Data da exclusão definitiva, se estiver fora do ar. */
  purgeAt: Date | null;
}

export const deckHosting = (deck: DeckHostingInput, ownerActive: boolean, now: Date = new Date()): DeckHosting => {
  const exp = deck.hosting_expires_at ? new Date(deck.hosting_expires_at) : null;
  const online = ownerActive || (!!exp && exp.getTime() > now.getTime());
  if (online) return { online, expiresAt: ownerActive ? null : exp, purgeAt: null };
  const since = deck.offline_since ? new Date(deck.offline_since) : now;
  return { online, expiresAt: null, purgeAt: new Date(since.getTime() + HOSTING_GRACE_DAYS * DAY_MS) };
};

export type HostingReason = "subscription" | "payment_failed" | "subscription_ended" | "no_subscription";

export interface HostingStatus {
  active: boolean;
  reason: HostingReason;
  subscription_ends_at?: string | null;
}

export const offlineReasonText = (reason: HostingReason | null | undefined): string => {
  switch (reason) {
    case "payment_failed": return "o pagamento da renovação do seu plano não foi confirmado";
    case "subscription_ended": return "seu plano terminou";
    default: return "o prazo de hospedagem dos créditos avulsos terminou";
  }
};

export const fmtDay = (d: Date | string | null | undefined): string =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";

export const RESTORE_URL = "/gerar?planos=1";
