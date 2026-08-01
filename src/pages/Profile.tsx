import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Loader2, User, Globe, MapPin, Link2, Instagram, Twitter, Linkedin, Github, Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AccountPanel } from "@/components/AccountPanel";
import { toast } from "sonner";

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  username: string | null;
  bio: string | null;
  website: string | null;
  location: string | null;
  is_public: boolean;
  social_links: Record<string, string> | null;
  generations_count: number | null;
  total_views: number | null;
}

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTabState] = useState(searchParams.get("tab") ?? "conta");
  const setTab = (v: string) => {
    setTabState(v);
    setSearchParams(v === "conta" ? {} : { tab: v }, { replace: true });
  };
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);


  useEffect(() => { document.title = "Meu Perfil — SlideAI"; }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      setProfile(data as Profile);
      setLoading(false);
    });
  }, [user]);

  const update = (patch: Partial<Profile>) => setProfile((p) => (p ? { ...p, ...patch } : p));

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: profile.full_name,
      role: profile.role,
      username: profile.username,
      bio: profile.bio,
      website: profile.website,
      location: profile.location,
      avatar_url: profile.avatar_url,
    }).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Perfil atualizado");
  };

  const savePortfolio = async () => {
    if (!user || !profile) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      is_public: profile.is_public,
      social_links: profile.social_links ?? {},
    }).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Configurações de portfólio salvas");
  };

  const changePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const password = new FormData(e.currentTarget).get("password") as string;
    if (password.length < 6) { toast.error("Mínimo 6 caracteres"); return; }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) toast.error(error.message); else toast.success("Senha alterada");
  };

  const social = profile?.social_links ?? {};
  const setSocial = (key: string, val: string) => update({ social_links: { ...social, [key]: val } });

  const portfolioUrl = profile?.username ? `${window.location.origin}/u/${profile.username}` : null;

  const copyPortfolio = async () => {
    if (!portfolioUrl) return;
    await navigator.clipboard.writeText(portfolioUrl);
    setCopied(true);
    toast.success("Link copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const initials = (profile?.full_name || user?.email || "?").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/80 backdrop-blur z-30">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold">SlideAI</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 max-w-4xl">
        {/* Header do perfil */}
        <div className="flex items-start gap-5 mb-8">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-gradient-primary text-primary-foreground font-display text-xl">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-3xl font-bold truncate">
                {profile?.full_name || "Sem nome"}
              </h1>
              {profile?.is_public && <Badge variant="secondary" className="text-[10px]">Público</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span><strong className="text-foreground">{profile?.generations_count ?? 0}</strong> gerações</span>
              <span><strong className="text-foreground">{profile?.total_views ?? 0}</strong> visualizações</span>
            </div>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="conta">Conta</TabsTrigger>
            <TabsTrigger value="perfil">Dados</TabsTrigger>
            <TabsTrigger value="portfolio">Portfólio público</TabsTrigger>
            <TabsTrigger value="assinatura">Assinatura</TabsTrigger>
            <TabsTrigger value="seguranca">Segurança</TabsTrigger>
          </TabsList>

          {/* Conta / Assinatura resumo */}
          <TabsContent value="conta" className="space-y-4">
            <AccountPanel />
            <Card>
              <CardContent className="p-5 space-y-2">
                <h3 className="font-display font-bold flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Ações rápidas</h3>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>Minhas apresentações</Button>
                  <Button variant="outline" size="sm" onClick={() => navigate("/ajuda")}>Central de Ajuda</Button>
                  <Button variant="outline" size="sm" onClick={() => navigate("/gerar")}>Nova apresentação</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dados de perfil */}
          <TabsContent value="perfil">
            <form onSubmit={saveProfile} className="space-y-4 bg-card border border-border rounded-2xl p-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nome completo</Label>
                  <Input id="full_name" value={profile?.full_name ?? ""} onChange={(e) => update({ full_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Nome de usuário (@)</Label>
                  <Input
                    id="username"
                    value={profile?.username ?? ""}
                    onChange={(e) => update({ username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
                    placeholder="seunome"
                  />
                  <p className="text-[11px] text-muted-foreground">Será usado no seu portfólio público: /u/{profile?.username || "seunome"}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea id="bio" rows={3} value={profile?.bio ?? ""} onChange={(e) => update({ bio: e.target.value })} placeholder="Uma breve descrição sobre você." maxLength={280} />
                <p className="text-[11px] text-muted-foreground text-right">{(profile?.bio ?? "").length}/280</p>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="website" className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> Site</Label>
                  <Input id="website" value={profile?.website ?? ""} onChange={(e) => update({ website: e.target.value })} placeholder="https://seusite.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location" className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Localização</Label>
                  <Input id="location" value={profile?.location ?? ""} onChange={(e) => update({ location: e.target.value })} placeholder="São Paulo, BR" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Como você usa o SlideAI</Label>
                <Input id="role" value={profile?.role ?? ""} onChange={(e) => update({ role: e.target.value })} placeholder="estudante, professor, profissional, criador" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="avatar">URL do avatar</Label>
                <Input id="avatar" value={profile?.avatar_url ?? ""} onChange={(e) => update({ avatar_url: e.target.value })} placeholder="https://…" />
              </div>
              <Button variant="hero" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar perfil</Button>
            </form>
          </TabsContent>

          {/* Portfólio público */}
          <TabsContent value="portfolio">
            <div className="space-y-4">
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-display font-bold flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> Portfólio público</h3>
                      <p className="text-sm text-muted-foreground mt-1">Torne seu perfil visível publicamente para exibir suas apresentações abertas.</p>
                    </div>
                    <Switch checked={!!profile?.is_public} onCheckedChange={(v) => update({ is_public: v })} />
                  </div>

                  {profile?.is_public && portfolioUrl && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                      <Link2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <code className="text-xs flex-1 truncate">{portfolioUrl}</code>
                      <Button size="sm" variant="ghost" onClick={copyPortfolio}>
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  )}

                  {profile?.is_public && !profile?.username && (
                    <div className="text-xs text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                      Defina um nome de usuário na aba "Dados" para ativar seu link público.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 space-y-4">
                  <h3 className="font-display font-bold">Redes sociais</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {[
                      { key: "instagram", icon: Instagram, label: "Instagram", ph: "@usuario" },
                      { key: "twitter", icon: Twitter, label: "X / Twitter", ph: "@usuario" },
                      { key: "linkedin", icon: Linkedin, label: "LinkedIn", ph: "https://linkedin.com/in/…" },
                      { key: "github", icon: Github, label: "GitHub", ph: "usuario" },
                    ].map(({ key, icon: Icon, label, ph }) => (
                      <div key={key} className="space-y-1.5">
                        <Label className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {label}</Label>
                        <Input value={(social as any)[key] ?? ""} onChange={(e) => setSocial(key, e.target.value)} placeholder={ph} />
                      </div>
                    ))}
                  </div>
                  <Button variant="hero" onClick={savePortfolio} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar portfólio
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Em breve: escolha quais apresentações aparecem no seu portfólio público.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Assinatura */}
          <TabsContent value="assinatura">
            <AccountPanel />
            <div className="mt-4 text-xs text-muted-foreground">
              Para trocar de plano ou cancelar, use os botões no painel acima. As mudanças são aplicadas imediatamente após confirmação da Cakto.
            </div>
          </TabsContent>

          {/* Segurança */}
          <TabsContent value="seguranca">
            <form onSubmit={changePassword} className="space-y-4 bg-card border border-border rounded-2xl p-6">
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <Input id="password" name="password" type="password" minLength={6} required />
              </div>
              <Button variant="hero">Alterar senha</Button>
              <hr className="border-border" />
              <Button type="button" variant="outline" onClick={async () => { await signOut(); navigate("/"); }}>
                Sair de todas as sessões
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ProfilePage;
