import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Check, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CHECKOUT_URLS, PLAN_PRICES } from "@/lib/cakto";
import { useEntitlement } from "@/hooks/useEntitlement";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onUnlocked: () => void;
}

/**
 * Modal de pagamento exibido APÓS o usuário configurar a geração.
 * Mostra os 3 planos Cakto; após o checkout, faz polling do entitlement
 * a cada 4s. Quando o webhook libera o plano, dispara `onUnlocked`.
 */
export const PaymentGate = ({ open, onClose, onUnlocked }: Props) => {
  const ent = useEntitlement();
  const [waiting, setWaiting] = useState<null | "single" | "mensal" | "anual">(null);

  // Polling do entitlement a cada 4s enquanto aguarda confirmação do pagamento.
  // Antes rodava indefinidamente enquanto o modal ficasse aberto; agora para
  // sozinho após ~10 minutos (150 tentativas) e avisa o usuário, em vez de
  // continuar consultando o backend para sempre se a aba ficar esquecida aberta.
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
      onUnlocked();
    }
  }, [waiting, ent.allowed, ent.loading, onUnlocked]);

  if (!open) return null;

  const plans: Array<{ id: "single" | "mensal" | "anual"; name: string; tagline: string; features: string[] }> = [
    { id: "single", name: "Geração única", tagline: PLAN_PRICES.single, features: ["1 apresentação completa", "Editor visual", "Exportar PDF/PPTX"] },
    { id: "mensal", name: "Plano Mensal", tagline: PLAN_PRICES.mensal, features: ["Até 20 gerações completas/mês", "Cancele quando quiser", "Suporte prioritário"] },
    { id: "anual", name: "Plano Anual", tagline: PLAN_PRICES.anual, features: ["Até 20 gerações completas/mês", "Equivalente a 8 meses — 4 grátis", "Tudo do plano mensal"] },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-card border border-border rounded-3xl p-6 md:p-8 max-w-3xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center">
          <X className="h-4 w-4" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3">
            <ShieldCheck className="h-3.5 w-3.5" /> Pagamento seguro · Cakto
          </div>
          <h2 className="font-display text-2xl md:text-3xl font-bold">Para gerar, escolha um plano</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Sua configuração está salva. Após pagar, a geração inicia automaticamente.
          </p>
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
          {plans.map((p) => (
            <div key={p.id} className={`rounded-2xl border p-4 ${p.id === "mensal" ? "border-primary/40 bg-gradient-card" : "border-border"}`}>
              <div className="font-display font-bold">{p.name}</div>
              <div className="text-lg font-semibold mt-1">{p.tagline}</div>
              <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5"><Check className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />{f}</li>
                ))}
              </ul>
              <Button
                size="sm"
                variant={p.id === "mensal" ? "hero" : "outline"}
                className="w-full mt-4 gap-1.5"
                onClick={() => {
                  setWaiting(p.id);
                  window.open(CHECKOUT_URLS[p.id], "_blank", "noopener,noreferrer");
                }}
              >
                Pagar agora <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-5">
          Após o pagamento, retorne a esta janela. A geração inicia em segundos.
        </p>
      </motion.div>
    </div>
  );
};
