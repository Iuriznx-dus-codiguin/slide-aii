// Resumo do contrato exibido ANTES do pagamento.
//
// O Decreto 7.962/2013 (art. 4º, I) exige apresentar ao consumidor, antes da
// contratação, um sumário do contrato com destaque para as cláusulas que
// limitam direitos. Este bloco é esse sumário; o texto integral está em
// /termos. Os números vêm das mesmas constantes que a cobrança usa.
import { useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import {
  CREDITS_PER_SLIDE,
  DEPTH_CREDITS,
  PLAN_MONTHLY_CREDITS,
  SINGLE_PURCHASE_CREDITS,
  SPEECHES_CREDITS,
} from "@/lib/cakto";
import { FAIR_USE_HOURLY_GENERATIONS } from "@/lib/fairUse";
import { cn } from "@/lib/utils";

const fmt = (n: number) => n.toLocaleString("pt-BR");

export const ContractSummary = ({ className, defaultOpen = false }: { className?: string; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  const items: Array<[string, string]> = [
    [
      "Custo de cada apresentação",
      `${CREDITS_PER_SLIDE} créditos por slide + profundidade do texto (curto ${DEPTH_CREDITS.short}, equilibrado ${DEPTH_CREDITS.balanced}, longo ${DEPTH_CREDITS.long}) + ${SPEECHES_CREDITS} se você ativar as falas dos apresentadores. O valor aparece antes de gerar.`,
    ],
    [
      "Compra avulsa",
      `${fmt(SINGLE_PURCHASE_CREDITS)} créditos permanentes, sem renovação automática.`,
    ],
    [
      "Assinaturas PRO e MAX",
      `Renovação automática ao fim de cada período (mensal, trimestral ou anual), pelo mesmo meio de pagamento. A cota mensal (${fmt(PLAN_MONTHLY_CREDITS.mensal)} no PRO) renova a cada mês e não acumula; o bônus de ativação vale uma vez por conta e não expira.`,
    ],
    [
      "Plano MAX — uso justo",
      `* Uso ilimitado para uma pessoa, dentro da Política de Uso Justo: até ${fmt(PLAN_MONTHLY_CREDITS.max_mensal)} créditos por ciclo mensal e ${FAIR_USE_HOURLY_GENERATIONS} gerações por hora.`,
    ],
    [
      "Cancelamento",
      "A qualquer momento, sem multa. A renovação é interrompida e o acesso continua até o fim do período já pago. O período em curso não é reembolsado, salvo arrependimento ou falha do serviço.",
    ],
    [
      "Direito de arrependimento",
      "Até 7 dias corridos após a compra: reembolso integral, com cancelamento dos créditos daquela compra (CDC, art. 49).",
    ],
    [
      "Pagamento",
      "Processado pela Cakto. O SlideAI não recebe nem guarda os dados do seu cartão.",
    ],
  ];

  return (
    <div className={cn("rounded-xl border border-border bg-muted/30 text-left", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-primary" /> Resumo do contrato</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <dl className="px-3 pb-3 space-y-2 text-[11px] leading-relaxed">
          {items.map(([k, v]) => (
            <div key={k}>
              <dt className="font-semibold text-foreground">{k}</dt>
              <dd className="text-muted-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="px-3 pb-3 text-[11px] text-muted-foreground">
        Ao clicar em <strong className="text-foreground">Pagar agora</strong>, você declara que leu e concorda com os{" "}
        <Link to="/termos" target="_blank" className="text-primary hover:underline">Termos de Uso</Link> e a{" "}
        <Link to="/privacidade" target="_blank" className="text-primary hover:underline">Política de Privacidade</Link>.
      </p>
    </div>
  );
};
