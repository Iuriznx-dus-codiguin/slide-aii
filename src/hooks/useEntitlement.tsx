import { createContext, useContext } from "react";
import type { EntitlementReason } from "@/lib/entitlement";
import { FAIR_USE_MAX_MONTHLY_CREDITS } from "@/lib/fairUse";

export interface Entitlement {
  allowed: boolean;
  reason: EntitlementReason;
  plan:
    | "free" | "single"
    | "mensal" | "trimestral" | "anual"
    | "max_mensal" | "max_trimestral" | "max_anual"
    | "dev";
  /** Créditos permanentes (compras avulsas e promoções) — nunca expiram. */
  credits_bonus: number;
  /** Cota mensal utilizável agora (0 quando a assinatura não está vigente). */
  credits_monthly: number;
  /** Soma disponível agora. */
  credits_available: number;
  /** Cota mensal do plano (0 para avulso/free). */
  monthly_allowance: number;
  /** Assinatura PRO/MAX dentro do período pago (ativa ou cancelada até o fim). */
  subscription_current: boolean;
  /** Plano MAX vigente (uso ilimitado dentro da Política de Uso Justo). */
  unlimited: boolean;
  /** Assinatura cancelada que segue ativa até esta data (ISO). */
  access_until: string | null;
  /** Data (dd/mm/aaaa) da próxima renovação da cota mensal. */
  next_monthly_reset: string | null;
  subscription_renews_at: string | null;
  subscription_status: string | null;
  loading: boolean;
  /** Recarrega e devolve o estado novo (o objeto `ent` do render atual não muda). */
  refresh: () => Promise<EntitlementState>;
}

export type EntitlementState = Omit<Entitlement, "refresh">;

/** `true` quando o bloqueio se resolve reativando/renovando a assinatura. */
export const needsRenewal = (reason: Entitlement["reason"]): boolean =>
  reason === "subscription_canceled" || reason === "subscription_expired";

/** Mensagem amigável por `ent.reason`. `resetDate` completa o aviso de uso justo. */
export const reasonMessage = (reason: Entitlement["reason"], resetDate?: string | null): string => {
  switch (reason) {
    case "insufficient_credits":
      return "Seus créditos acabaram. A cota mensal renova um mês depois da última renovação — ou adquira uma geração avulsa.";
    case "fair_use_limit":
      return `Você atingiu o limite da Política de Uso Justo do plano MAX neste ciclo (${FAIR_USE_MAX_MONTHLY_CREDITS.toLocaleString("pt-BR")} créditos). A cota renova ${resetDate ? `em ${resetDate}` : "um mês depois da última renovação"} — até lá, você pode usar créditos avulsos.`;
    case "system_error":
      return "Não foi possível verificar seu saldo agora. Tente novamente em alguns minutos.";
    case "subscription_canceled":
      return "Sua assinatura foi cancelada e o período pago terminou. Reative um plano ou use créditos avulsos para voltar a gerar — suas apresentações continuam salvas.";
    case "subscription_expired":
      return "Sua assinatura venceu e as gerações estão pausadas. Renove o plano ou use créditos avulsos para voltar a gerar — suas apresentações continuam salvas.";
    case "no_plan":
      return "Escolha um plano para gerar apresentações.";
    default:
      return "";
  }
};

/** Preenchido por <EntitlementProvider> (src/components/EntitlementProvider.tsx). */
export const EntitlementContext = createContext<Entitlement | null>(null);

export const useEntitlement = (): Entitlement => {
  const ctx = useContext(EntitlementContext);
  if (!ctx) throw new Error("useEntitlement precisa estar dentro de <EntitlementProvider>.");
  return ctx;
};
