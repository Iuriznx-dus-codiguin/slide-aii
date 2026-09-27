// Pede o aceite da versão vigente dos Termos de Uso e da Política de
// Privacidade antes de usar as áreas logadas, e registra o acesso (Marco
// Civil, art. 15).
//
// • Cadastro por e-mail: a caixa marcada no formulário vai nos metadados da
//   conta; no primeiro acesso já confirmado, o aceite é registrado sem
//   perguntar de novo.
// • Login pelo Google e contas antigas: aparece o diálogo de aceite.
// • Nova versão dos documentos (LEGAL.termsVersion/privacyVersion): o
//   diálogo reaparece como "atualizamos os termos".
// • Backend sem a migração 0003: nada é bloqueado (fail-open).
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { LEGAL } from "@/lib/legal";
import { acceptCurrentTerms, fetchLatestAcceptance, isCurrentAcceptance, recordAccess } from "@/lib/legalConsent";
import { toast } from "sonner";

/** Áreas logadas em que o aceite é exigido. Páginas públicas e a tela de consentimento OAuth ficam de fora. */
const GATED_PREFIXES = ["/dashboard", "/gerar", "/editor", "/perfil", "/settings", "/suporte", "/onboarding", "/admin", "/__dev"];

const isGated = (pathname: string) => GATED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export const LegalConsentGate = () => {
  const { user, loading, signOut } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [needed, setNeeded] = useState(false);
  const [isUpdate, setIsUpdate] = useState(false);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const loggedFor = useRef<string | null>(null);

  // Registro de acesso: uma vez por carregamento e por conta (o servidor
  // ainda deduplica por IP a cada 30 minutos).
  useEffect(() => {
    if (!user || loggedFor.current === user.id) return;
    loggedFor.current = user.id;
    void recordAccess();
  }, [user]);

  useEffect(() => {
    if (loading || !user) {
      setNeeded(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const lookup = await fetchLatestAcceptance(user.id);
      if (cancelled || lookup.status === "unavailable") return;
      if (isCurrentAcceptance(lookup.row)) {
        setNeeded(false);
        return;
      }
      // Aceite dado no formulário de cadastro, antes da confirmação do e-mail.
      const meta = (user.user_metadata ?? {}) as { terms_version?: string; privacy_version?: string };
      if (!lookup.row && isCurrentAcceptance({ terms_version: meta.terms_version ?? "", privacy_version: meta.privacy_version ?? "" })) {
        const res = await acceptCurrentTerms("signup");
        if (cancelled) return;
        if (res.ok) {
          setNeeded(false);
          return;
        }
      }
      setIsUpdate(!!lookup.row);
      setChecked(false);
      setNeeded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  if (!needed || !isGated(pathname)) return null;

  const accept = async () => {
    if (!checked) return;
    setSaving(true);
    const res = await acceptCurrentTerms("gate");
    setSaving(false);
    if (!res.ok) {
      toast.error("Não foi possível registrar o aceite. Verifique sua conexão e tente de novo.");
      return;
    }
    setNeeded(false);
    toast.success("Obrigado! Aceite registrado.");
  };

  const leave = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <AlertDialog open>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <AlertDialogTitle>
            {isUpdate ? "Atualizamos os Termos de Uso e a Política de Privacidade" : "Antes de continuar"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              {isUpdate ? (
                <>
                  <p>Os documentos agora deixam mais claros os seus direitos. Os principais pontos:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>ao cancelar, o acesso continua até o fim do período já pago;</li>
                    <li>créditos bônus são permanentes, mesmo depois que a assinatura termina;</li>
                    <li>direito de arrependimento de 7 dias, com reembolso integral;</li>
                    <li>a Política de Uso Justo do plano MAX, com os limites divulgados;</li>
                    <li>quais dados tratamos, por quanto tempo e como pedir exclusão.</li>
                  </ul>
                </>
              ) : (
                <p>
                  Para usar o {LEGAL.brand}, confirme que leu e concorda com as condições do serviço. Elas explicam como
                  funcionam créditos, planos, cancelamento, reembolso e o tratamento dos seus dados.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm cursor-pointer">
          <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} className="mt-0.5" aria-label="Aceitar os Termos de Uso e a Política de Privacidade" />
          <span>
            Li e aceito os{" "}
            <Link to="/termos" target="_blank" className="text-primary hover:underline">Termos de Uso</Link> e a{" "}
            <Link to="/privacidade" target="_blank" className="text-primary hover:underline">Política de Privacidade</Link>{" "}
            <span className="text-muted-foreground">(versão {LEGAL.termsVersion})</span>.
          </span>
        </label>

        <AlertDialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={leave} disabled={saving}>Sair da conta</Button>
          <Button variant="hero" onClick={accept} disabled={!checked || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Aceitar e continuar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
