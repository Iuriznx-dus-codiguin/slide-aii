import { CreditCard, CheckCircle2, AlertCircle, ExternalLink, Crown, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useEntitlement } from "@/hooks/useEntitlement";
import { CHECKOUT_URLS, PLAN_LABELS } from "@/lib/cakto";

/** Seção "Minha conta" no Dashboard. */
export const AccountPanel = () => {
  const ent = useEntitlement();

  if (ent.loading) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-5 text-sm text-muted-foreground">Carregando informações da conta…</CardContent>
      </Card>
    );
  }

  const isDev = ent.plan === "dev";
  const isPaid = ent.plan === "mensal" || ent.plan === "anual" || ent.plan === "single";
  const isSubscription = ent.plan === "mensal" || ent.plan === "anual";
  const renews = ent.subscription_renews_at ? new Date(ent.subscription_renews_at).toLocaleDateString("pt-BR") : null;

  return (
    <Card className="border-border/60 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-11 w-11 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              {isDev ? <Crown className="h-5 w-5 text-primary" /> : isPaid ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <AlertCircle className="h-5 w-5 text-amber-500" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display font-bold">Plano atual: {PLAN_LABELS[ent.plan] ?? "Gratuito"}</h3>
                {ent.subscription_status === "active" && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-semibold">Ativa</span>}
                {ent.subscription_status === "canceled" && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-semibold">Cancelada</span>}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {isDev && "Acesso desenvolvedor — gerações ilimitadas e bypass de paywall ativo."}
                {ent.plan === "single" && `${ent.single_credits} crédito${ent.single_credits === 1 ? "" : "s"} de geração disponível${ent.single_credits === 1 ? "" : "s"}.`}
                {isSubscription && renews && `Renova em ${renews}.`}
                {ent.plan === "free" && "Você ainda não possui um plano. Adquira para gerar apresentações."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!isPaid && !isDev && (
              <Button asChild variant="hero" size="sm">
                <a href="/gerar"><Zap className="h-4 w-4" /> Adquirir plano</a>
              </Button>
            )}
            {ent.plan === "single" && (
              <Button asChild variant="outline" size="sm">
                <a href={CHECKOUT_URLS.single} target="_blank" rel="noopener noreferrer">
                  <CreditCard className="h-4 w-4" /> Comprar mais
                </a>
              </Button>
            )}
            {isSubscription && (
              <>
                <Button asChild variant="outline" size="sm">
                  <a href="https://app.cakto.com.br/" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" /> Gerenciar
                  </a>
                </Button>
                <Button asChild variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                  <a href="mailto:suporte@slideai.app?subject=Cancelar%20assinatura">Cancelar</a>
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
