import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { getMyPreferences, setMyPreferences } from "@/lib/emailPreferences";

/** Preferência dos e-mails de relacionamento, em Perfil → Conta. */
export const EmailPreferencesCard = () => {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMyPreferences().then((p) => setEnabled(p ? p.relationship_emails : null));
  }, []);

  if (enabled === null) return null;

  const change = async (v: boolean) => {
    setSaving(true);
    const ok = await setMyPreferences(v);
    setSaving(false);
    if (!ok) { toast.error("Não foi possível salvar agora."); return; }
    setEnabled(v);
    toast.success(v ? "Você vai receber dicas e ofertas." : "Dicas e ofertas desligadas.");
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <h3 className="font-display font-bold flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> E-mails</h3>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Dicas, ideias e ofertas</p>
            <p className="text-xs text-muted-foreground">
              Avisos da conta, de pagamento e do suporte continuam chegando, porque fazem parte do serviço.
            </p>
          </div>
          <Switch checked={enabled} disabled={saving} onCheckedChange={change} aria-label="Receber dicas, ideias e ofertas" />
        </div>
      </CardContent>
    </Card>
  );
};
