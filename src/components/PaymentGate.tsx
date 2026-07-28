import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Check, ExternalLink, Loader2, ShieldCheck, Crown, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CHECKOUT_URLS, PLAN_PRICES, proPlanFor, maxPlanFor, type PaidPlan, type BillingCycle } from "@/lib/cakto";
import { useEntitlement } from "@/hooks/useEntitlement";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onUnlocked: () => void;
}

/**
 * Modal de pagamento exibido APÓS o usuário configurar a geração.
 * Mostra 3 tiers (Único / PRO / MAX). Assinaturas trocam entre mensal /
 * trimestral / anual (trimestral é o predefinido). Depois do checkout, faz
 * polling do entitlement a cada 4 s.
 */
export const PaymentGate = ({ open, onClose, onUnlocked }: Props) => {
  const ent = useEntitlement();
  const [waiting, setWaiting] = useState<null | PaidPlan>(null);
  const [cycle, setCycle] = useState<BillingCycle>("trimestral");

  const MAX_POLL_ATTEMPTS = 150;
  useEffect(() => {
    if (!open || !waiting) return;
    let attempts = 0;
    const t = setInterval(async () => {
      attempts += 1;
      await ent.refresh();
      if (attempts >= MAX_POLL_ATTEMPTS) {
        clearInterval(t);
        toast.info("Ainda não vimos a confirmação do pagamento. Clique em \"Já paguei\" quando finalizar, ou aguarde alguns minutos.");
      }
    }, 4000);
    return () => clearInterval(t);
  }, [open, waiting, ent]);

  useEffect(() => {
    if (waiting && ent.allowed && !ent.loading) {
      toast.success("Pagamento confirmado! Iniciando geração…");
      window.dispatchEvent(new CustomEvent("slideai:payment-success"));
      onUnlocked();
    }
  }, [waiting, ent.allowed, ent.loading, onUnlocked]);

  if (!open) return null;

  const proId = proPlanFor(cycle);
  const maxId = maxPlanFor(cycle);

  const startCheckout = (id: PaidPlan) => {
    const url = CHECKOUT_URLS[id];
    if (!url) {
      toast.info("Checkout indisponível no momento. Fale com o suporte.");
      return;
    }
    setWaiting(id);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const cycleButton = (id: BillingCycle, label: string, badge?: string) => (
    <button
      onClick={() => setCycle(id)}
      className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${cycle === id ? "bg-background shadow-sm" : "text-muted-foreground"}`}
    >
      {label}
      {badge && (
        <span className="text-[9px] px-1 py-0.5 rounded-full bg-primary/15 text-primary font-bold">{badge}</span>
      )}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-card border border-border rounded-3xl p-6 md:p-8 max-w-4xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center">
          <X className="h-4 w-4" />
        </button>

        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3">
            <ShieldCheck className="h-3.5 w-3.5" /> Pagamento seguro · Cakto
          </div>
          <h2 className="font-display text-2xl md:text-3xl font-bold">Escolha seu plano</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Sua configuração está salva. Após pagar, a geração inicia automaticamente.
          </p>
        </div>

        {/* Toggle para assinaturas — trimestral é o predefinido */}
        <div className="flex justify-center mb-5">
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted border border-border">
            {cycleButton("mensal", "Mensal")}
            {cycleButton("trimestral", "Trimestral", "-15%")}
            {cycleButton("anual", "Anual", "-33%")}
          </div>
        </div>

        {waiting && (
          <div className="mb-5 rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div className="flex-1 text-sm">
              <p className="font-semibold">Aguardando confirmação do pagamento…</p>
              <p className="text-muted-foreground text-xs">Assim que o pagamento for aprovado, sua geração começa automaticamente.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => ent.refresh()}>Já paguei</Button>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-3">
          {/* Único */}
          <div className="rounded-2xl border-2 border-primary/30 p-4 bg-card flex flex-col">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary mb-1">
              <Zap className="h-3 w-3" /> Ideal para começar
            </div>
            <div className="font-display font-bold">Geração única</div>
            <div className="text-lg font-semibold mt-1">{PLAN_PRICES.single}</div>
            <div className="mt-2 inline-flex items-center gap-1 self-start rounded-full bg-primary/10 border border-primary/30 px-2 py-0.5 text-[10px] font-bold text-primary">
              1 apresentação
            </div>
            <Button size="sm" variant="outline" className="w-full mt-4 gap-1.5 border-primary/50" onClick={() => startCheckout("single")}>
              Pagar agora <ExternalLink className="h-3 w-3" />
            </Button>
          </div>

          {/* PRO */}
          <div className="rounded-2xl border-2 border-primary/60 p-4 bg-gradient-card relative flex flex-col md:scale-[1.02]">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-gradient-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-glow whitespace-nowrap">
              <Sparkles className="h-2.5 w-2.5" /> Mais popular
            </div>
            <div className="font-display font-bold mt-1">Plano PRO</div>
            <div className="text-lg font-semibold mt-1">{PLAN_PRICES[proId]}</div>
            <div className="mt-2 inline-flex items-center gap-1 self-start rounded-full bg-gradient-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-glow">
              <Sparkles className="h-2.5 w-2.5" /> 20 gerações/mês
            </div>
            <Button size="sm" variant="hero" className="w-full mt-4 gap-1.5" onClick={() => startCheckout(proId)}>
              Pagar agora <ExternalLink className="h-3 w-3" />
            </Button>
          </div>

          {/* MAX */}
          <div className="rounded-2xl border-2 border-amber-500/40 p-4 bg-gradient-to-br from-amber-500/5 to-primary/5 relative flex flex-col">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-primary px-2 py-0.5 text-[10px] font-bold text-white shadow-glow whitespace-nowrap">
              <Crown className="h-2.5 w-2.5" /> Ilimitado
            </div>
            <div className="font-display font-bold mt-1">Plano MAX</div>
            <div className="text-lg font-semibold mt-1">{PLAN_PRICES[maxId]}</div>
            <div className="mt-2 inline-flex items-center gap-1 self-start rounded-full bg-gradient-to-r from-amber-500 to-primary px-2 py-0.5 text-[10px] font-bold text-white shadow-glow">
              <Crown className="h-2.5 w-2.5" /> Gerações ilimitadas
            </div>
            <Button size="sm" variant="outline" className="w-full mt-4 gap-1.5 border-amber-500/50 hover:bg-amber-500/10" onClick={() => startCheckout(maxId)}>
              Pagar agora <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="mt-5 rounded-xl bg-muted/40 border border-border p-3">
          <p className="text-[11px] text-muted-foreground text-center">
            <Check className="h-3 w-3 text-primary inline mr-1" />
            Todos os planos incluem geração em segundos, exportação PDF/PPTX/PNG, link público compartilhável e suporte prioritário.
          </p>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-3">
          Após o pagamento, retorne a esta janela. A geração inicia em segundos.
        </p>
      </motion.div>
    </div>
  );
};
