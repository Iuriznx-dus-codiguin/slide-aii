import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, Wand2, SlidersHorizontal, MessageSquare, Share2, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { useEntitlement } from "@/hooks/useEntitlement";
import { PLAN_LABELS } from "@/lib/cakto";
import { createConfetti, type ConfettiPiece } from "@/components/PaymentNotifications";
import { Seo } from "@/components/Seo";

const DEFAULT_MESSAGE = "🎉 Compra realizada com sucesso! SlideAI agradece a sua contribuição 🎉";

const steps = [
  { icon: Wand2, title: "Descreva o tema", text: "Em Gerar, escreva o assunto, o público e o objetivo da apresentação." },
  { icon: SlidersHorizontal, title: "Ajuste as opções", text: "Escolha quantidade de slides, profundidade dos textos e se quer falas do apresentador." },
  { icon: MessageSquare, title: "Refine com a IA", text: "No editor, peça mudanças conversando com a IA ou edite manualmente cada slide." },
  { icon: Share2, title: "Apresente e compartilhe", text: "Use o modo apresentação, exporte em PDF/PPTX ou publique um link público." },
];

const Success = () => {
  const location = useLocation();
  const { user } = useAuth();
  const ent = useEntitlement();
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const fired = useRef(false);
  const message = (location.state as { message?: string } | null)?.message ?? DEFAULT_MESSAGE;

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    setConfetti(createConfetti());
    const t1 = window.setTimeout(() => toast.success(message, { duration: 8000 }), 260);
    const t2 = window.setTimeout(() => setConfetti([]), 4200);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [message]);

  const planLabel = ent.plan && ent.plan !== "free" ? PLAN_LABELS[ent.plan] : null;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Seo title="Pagamento confirmado | SlideAI" description="Obrigado pela sua compra no SlideAI." path="/sucesso" noindex />
      {confetti.length > 0 && (
        <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden="true">
          {confetti.map((p) => (
            <span
              key={p.id}
              className={`slideai-confetti-piece ${p.className}`}
              style={{
                left: p.left, animationDelay: p.delay, animationDuration: p.duration,
                "--slideai-confetti-x": p.drift, "--slideai-confetti-rotation": p.rotation,
              } as CSSProperties}
            />
          ))}
        </div>
      )}

      <section className="mx-auto max-w-3xl px-5 py-16 sm:py-24 animate-fade-in">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 animate-scale-in">
            <CheckCircle2 className="h-11 w-11 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Obrigado pela sua compra!</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Seu pagamento foi recebido. Os créditos são liberados automaticamente assim que a Cakto confirmar — normalmente em poucos segundos.
          </p>
        </div>

        <Alert className="mt-8 border-primary/30 bg-primary/5">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <AlertTitle>Pagamento reconhecido</AlertTitle>
          <AlertDescription>
            {user
              ? planLabel
                ? `Plano atual: ${planLabel}. Você já pode gerar suas apresentações.`
                : "Assim que a confirmação chegar, seu saldo será atualizado nesta conta automaticamente."
              : "Entre com o mesmo e-mail usado no pagamento para acessar seus créditos."}
          </AlertDescription>
        </Alert>

        <h2 className="mt-12 text-xl font-semibold">Como aproveitar o SlideAI</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="rounded-xl border border-border bg-card p-5 animate-fade-in"
              style={{ animationDelay: `${150 + i * 120}ms`, animationFillMode: "both" }}
            >
              <s.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">{i + 1}. {s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {user ? (
            <>
              <Button asChild size="lg"><Link to="/gerar"><Wand2 className="mr-2 h-4 w-4" />Gerar apresentação</Link></Button>
              <Button asChild size="lg" variant="outline"><Link to="/dashboard"><LayoutDashboard className="mr-2 h-4 w-4" />Meu painel</Link></Button>
            </>
          ) : (
            <Button asChild size="lg"><Link to="/auth">Entrar na minha conta</Link></Button>
          )}
          <Button asChild size="lg" variant="ghost"><Link to="/ajuda">Central de ajuda</Link></Button>
        </div>
      </section>
    </main>
  );
};

export default Success;
