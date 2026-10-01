import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEntitlement } from "@/hooks/useEntitlement";
import { isSubscriptionPlan, PLAN_LABELS } from "@/lib/cakto";

const PAYMENT_SUCCESS_MESSAGE = "🎉 Compra realizada com sucesso! SlideAI agradece a sua contribuição 🎉";

type ConfettiPiece = {
  id: number;
  left: string;
  delay: string;
  duration: string;
  drift: string;
  rotation: string;
  className: string;
};

const createConfetti = (): ConfettiPiece[] => {
  const palette = ["bg-primary", "bg-accent", "bg-secondary", "bg-foreground"];
  return Array.from({ length: 84 }, (_, i) => ({
    id: i,
    left: `${(i * 37) % 100}%`,
    delay: `${(i % 12) * 0.055}s`,
    duration: `${2.1 + (i % 9) * 0.12}s`,
    drift: `${((i % 11) - 5) * 18}px`,
    rotation: `${90 + (i % 7) * 42}deg`,
    className: palette[i % palette.length],
  }));
};

const daysUntil = (date: string | null): number | null => {
  if (!date) return null;
  const target = new Date(date).getTime();
  if (Number.isNaN(target)) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const targetDay = new Date(target);
  targetDay.setHours(0, 0, 0, 0);
  return Math.ceil((targetDay.getTime() - now.getTime()) / 86_400_000);
};

export const PaymentNotifications = () => {
  const { user } = useAuth();
  const ent = useEntitlement();
  const lastPlanRef = useRef<string | null>(null);
  const lastStatusRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);

  const renewalDays = useMemo(() => daysUntil(ent.subscription_renews_at), [ent.subscription_renews_at]);

  const celebratePayment = (message: string = PAYMENT_SUCCESS_MESSAGE) => {
    setConfetti(createConfetti());
    window.setTimeout(() => {
      toast.success(message, { duration: 8000 });
    }, 260);
    window.setTimeout(() => setConfetti([]), 3800);
  };

  useEffect(() => {
    const handler = () => celebratePayment();
    window.addEventListener("slideai:payment-success", handler);
    return () => window.removeEventListener("slideai:payment-success", handler);
  }, []);

  useEffect(() => {
    if (!user || ent.loading || !isSubscriptionPlan(ent.plan) || ent.subscription_status !== "active") return;
    if (renewalDays === null || renewalDays < 0 || renewalDays > 5) return;

    const today = new Date().toISOString().slice(0, 10);
    const key = `slideai-renewal-${user.id}-${ent.subscription_renews_at}-${today}`;
    if (window.localStorage.getItem(key)) return;

    const label = renewalDays === 0 ? "hoje" : `em ${renewalDays} dia${renewalDays === 1 ? "" : "s"}`;
    toast.info(`Sua assinatura ${PLAN_LABELS[ent.plan] ?? "SlideAI"} renova ${label}.`);
    window.localStorage.setItem(key, "shown");
  }, [user, ent.loading, ent.plan, ent.subscription_status, ent.subscription_renews_at, renewalDays]);

  // Cada evento da Cakto vira uma transação de créditos (ou mudança de status);
  // a animação reage ao que de fato aconteceu, sem depender de refresh.
  useEffect(() => {
    if (!user) return;
    const seen = new Set<string>();
    const fmt = (n: number) => n.toLocaleString("pt-BR");

    const channel = supabase.channel(`payment-events-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "credit_transactions", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const tx = payload.new as { id: string; type: string; amount: number };
          if (seen.has(tx.id)) return;
          seen.add(tx.id);
          switch (tx.type) {
            case "single_purchase":
              celebratePayment(`🎉 Compra aprovada! +${fmt(tx.amount)} créditos na sua conta.`);
              break;
            case "subscription_monthly":
              celebratePayment(`🎉 Assinatura ativada! ${fmt(tx.amount)} créditos do mês liberados.`);
              break;
            case "subscription_renewal":
              celebratePayment(`🔄 Assinatura renovada! Seus ${fmt(tx.amount)} créditos do mês foram recarregados.`);
              break;
            case "subscription_signup_bonus":
              window.setTimeout(() => toast.success(`🎁 Bônus de boas-vindas: +${fmt(tx.amount)} créditos permanentes.`), 900);
              break;
            case "refund_revoke":
              toast.info("Reembolso processado. Os créditos daquela compra foram retirados.");
              break;
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          const next = payload.new as { subscription_status?: string | null; subscription_renews_at?: string | null };
          const prev = payload.old as { subscription_status?: string | null };
          if (prev.subscription_status === next.subscription_status) return;
          if (next.subscription_status === "canceled") {
            const until = next.subscription_renews_at ? new Date(next.subscription_renews_at).toLocaleDateString("pt-BR") : null;
            toast.info(until ? `Assinatura cancelada. Seu acesso continua até ${until}.` : "Assinatura cancelada.");
          } else if (next.subscription_status === "paused") {
            toast.info("Assinatura pausada. Seus créditos bônus continuam disponíveis.");
          } else if (next.subscription_status === "active" && prev.subscription_status === "paused") {
            celebratePayment("▶️ Assinatura retomada! Bem-vindo de volta.");
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (confetti.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden="true">
      {confetti.map((piece) => (
        <span
          key={piece.id}
          className={`slideai-confetti-piece ${piece.className}`}
          style={{
            left: piece.left,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
            "--slideai-confetti-x": piece.drift,
            "--slideai-confetti-rotation": piece.rotation,
          } as CSSProperties}
        />
      ))}
    </div>
  );
};