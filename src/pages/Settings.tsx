import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const Settings = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { document.title = "Configurações — SlideAI"; }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      setProfile(data); setLoading(false);
    });
  }, [user]);

  const saveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: fd.get("full_name") as string,
      role: fd.get("role") as string,
    }).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Perfil atualizado");
  };

  const changePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const password = new FormData(e.currentTarget).get("password") as string;
    if (password.length < 6) { toast.error("Mínimo 6 caracteres"); return; }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) toast.error(error.message);
    else toast.success("Senha alterada");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-primary flex items-center justify-center"><Sparkles className="h-4 w-4 text-primary-foreground" /></div>
            <span className="font-display font-bold">SlideAI</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 max-w-3xl">
        <h1 className="font-display text-3xl font-bold mb-8">Configurações</h1>
        <Tabs defaultValue="perfil">
          <TabsList className="mb-6">
            <TabsTrigger value="perfil">Perfil</TabsTrigger>
            <TabsTrigger value="plano">Plano</TabsTrigger>
            <TabsTrigger value="seguranca">Segurança</TabsTrigger>
          </TabsList>

          <TabsContent value="perfil">
            <form onSubmit={saveProfile} className="space-y-4 bg-card border border-border rounded-2xl p-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome completo</Label>
                <Input id="full_name" name="full_name" defaultValue={profile?.full_name ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Como você usa o SlideAI</Label>
                <Input id="role" name="role" defaultValue={profile?.role ?? ""} placeholder="estudante, professor, profissional, criador" />
              </div>
              <Button variant="hero" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar</Button>
            </form>
          </TabsContent>

          <TabsContent value="plano">
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Plano atual</div>
                <div className="font-display text-2xl font-bold capitalize">{profile?.plan ?? "free"}</div>
              </div>
              <div className="text-sm text-muted-foreground">Apresentações geradas: <strong>{profile?.generations_count ?? 0}</strong></div>
              <Button variant="hero" onClick={() => navigate("/#pricing")}>Ver planos</Button>
            </div>
          </TabsContent>

          <TabsContent value="seguranca">
            <form onSubmit={changePassword} className="space-y-4 bg-card border border-border rounded-2xl p-6">
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <Input id="password" name="password" type="password" minLength={6} required />
              </div>
              <Button variant="hero">Alterar senha</Button>
              <hr className="border-border" />
              <Button type="button" variant="outline" onClick={async () => { await signOut(); navigate("/"); }}>Sair de todas as sessões</Button>
            </form>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Settings;
