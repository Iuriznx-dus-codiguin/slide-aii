import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { getPreferencesByToken, setPreferencesByToken, type EmailPreferences } from "@/lib/emailPreferences";

// Página aberta pelo link "Descadastrar" / "Preferências de e-mail" do rodapé
// dos e-mails de relacionamento. Não exige login: o token do link identifica
// a conta. Com ?sair=1, a página já sugere o descadastro, mas só aplica com um
// clique (leitores de link abrem URLs sozinhos).
const EmailPreferencesPage = () => {
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";
  const wantsOut = params.get("sair") === "1";
  const [prefs, setPrefs] = useState<EmailPreferences | null | "invalid">(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Preferências de e-mail — SlideAI";
    if (!token) { setPrefs("invalid"); return; }
    getPreferencesByToken(token).then((p) => setPrefs(p ?? "invalid"));
  }, [token]);

  const apply = async (relationship: boolean) => {
    setSaving(true);
    const ok = await setPreferencesByToken(token, relationship);
    setSaving(false);
    if (ok) {
      setPrefs((p) => (p && p !== "invalid" ? { ...p, relationship_emails: relationship } : p));
      setDone(relationship
        ? "Pronto! Você volta a receber dicas, ideias e ofertas do SlideAI."
        : "Pronto! Você não vai mais receber dicas e ofertas. Avisos da sua conta e dos pagamentos continuam chegando.");
    } else {
      setDone("Não conseguimos salvar agora. Tente de novo em instantes.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-5">
          <Link to="/" className="inline-flex items-center gap-2 font-display font-bold text-lg">
            <img src="/email-logo.png" alt="" className="h-7 w-7 rounded-md" /> SlideAI
          </Link>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <h1 className="font-display text-xl font-bold">Preferências de e-mail</h1>
          </div>

          {prefs === null && <p className="text-sm text-muted-foreground">Carregando…</p>}

          {prefs === "invalid" && (
            <p className="text-sm text-muted-foreground">
              Este link não é válido ou expirou. Você também pode mudar suas preferências em{" "}
              <Link to="/perfil" className="text-primary underline">Perfil → Conta</Link>.
            </p>
          )}

          {prefs && prefs !== "invalid" && (
            <>
              {prefs.email_hint && <p className="text-sm text-muted-foreground">Conta: {prefs.email_hint}</p>}
              <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
                <div>
                  <p className="font-medium">Dicas, ideias e ofertas</p>
                  <p className="text-sm text-muted-foreground">
                    Ideias de apresentação, novidades e condições especiais. No máximo um por dia.
                  </p>
                </div>
                <Switch
                  checked={prefs.relationship_emails}
                  disabled={saving}
                  onCheckedChange={(v) => apply(v)}
                  aria-label="Receber dicas, ideias e ofertas"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Avisos da sua conta (compras, renovação, segurança e suporte) são sempre enviados, porque fazem parte do serviço.
              </p>

              {wantsOut && prefs.relationship_emails && !done && (
                <Button variant="outline" className="w-full" disabled={saving} onClick={() => apply(false)}>
                  Confirmar descadastro
                </Button>
              )}
            </>
          )}

          {done && (
            <p className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" /> {done}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailPreferencesPage;
