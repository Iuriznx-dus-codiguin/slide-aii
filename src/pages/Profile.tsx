import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Loader2, User, Globe, MapPin, Link2, Instagram, Twitter, Linkedin, Github,
  Copy, Check, ExternalLink, Upload, Trash2, Lock, ShieldCheck, X, Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AccountPanel } from "@/components/AccountPanel";
import { CreditsPanel } from "@/components/CreditsPanel";

import { uploadAvatar } from "@/lib/avatarUpload";
import { toast } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";

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
  allow_access_requests: boolean;
  social_links: Record<string, string> | null;
  generations_count: number | null;
  total_views: number | null;
}

type AccessRequest = {
  id: string;
  requester_id: string;
  message: string | null;
  status: "pending" | "approved" | "denied";
  created_at: string;
};

const ROLE_OPTIONS = [
  { value: "estudante", label: "Estudante" },
  { value: "professor", label: "Professor(a)" },
  { value: "profissional", label: "Profissional / Corporativo" },
  { value: "criador", label: "Criador de conteúdo" },
  { value: "empreendedor", label: "Empreendedor(a)" },
  { value: "outro", label: "Outro" },
];

const normalizeWebsite = (value: string | null) => {
  const v = (value ?? "").trim();
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
};

const isValidWebsite = (value: string | null) => {
  const v = normalizeWebsite(value);
  if (!v) return true;
  try { const u = new URL(v); return ["http:", "https:"].includes(u.protocol); } catch { return false; }
};

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
  const [initial, setInitial] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actualViews, setActualViews] = useState(0);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [requesterNames, setRequesterNames] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { document.title = "Meu Perfil — SlideAI"; }, []);

  const loadRequests = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profile_access_requests")
      .select("id,requester_id,message,status,created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    const rows = (data as AccessRequest[]) ?? [];
    setRequests(rows);
    const ids = Array.from(new Set(rows.map((r) => r.requester_id)));
    setRequesterNames(Object.fromEntries(ids.map((id) => [id, `Usuário ${id.slice(0, 8)}`])));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("presentations").select("view_count").eq("user_id", user.id).is("deleted_at", null),
    ]).then(([profileResult, presentationResult]) => {
      const p = profileResult.data as Profile | null;
      setProfile(p);
      setInitial(p);
      setActualViews((presentationResult.data ?? []).reduce((sum, item) => sum + (item.view_count ?? 0), 0));
      setLoading(false);
    });
    loadRequests();
  }, [user, loadRequests]);

  const update = (patch: Partial<Profile>) => setProfile((p) => (p ? { ...p, ...patch } : p));

  const dirty = !!profile && !!initial && JSON.stringify(profile) !== JSON.stringify(initial);

  /** Salva TODOS os campos editáveis do perfil de uma só vez (evita perda de alterações entre abas). */
  const saveAll = async () => {
    if (!user || !profile) return false;
    if (profile.username && profile.username.length < 3) {
      toast.error("O nome de usuário precisa ter ao menos 3 caracteres.");
      return false;
    }
    if (profile.is_public && !profile.username) {
      toast.error("Defina um nome de usuário para deixar o portfólio público.");
      return false;
    }
    if (!isValidWebsite(profile.website)) {
      toast.error("Informe um site válido (ex.: https://seusite.com).");
      return false;
    }
    setSaving(true);
    const payload = {
      full_name: profile.full_name?.trim() || null,
      role: profile.role,
      username: profile.username || null,
      bio: profile.bio?.trim() || null,
      website: normalizeWebsite(profile.website),
      location: profile.location?.trim() || null,
      avatar_url: profile.avatar_url,
      is_public: profile.is_public,
      allow_access_requests: profile.allow_access_requests,
      social_links: profile.social_links ?? {},
    };
    const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
    setSaving(false);
    if (error?.code === "23505") { toast.error("Este nome de usuário já está em uso."); return false; }
    if (error) { toast.error(error.message); return false; }
    const next = { ...profile, ...payload } as Profile;
    setProfile(next);
    setInitial(next);
    toast.success("Perfil salvo");
    return true;
  };

  const onAvatarFile = async (file: File | undefined) => {
    if (!file || !user) return;
    setUploading(true);
    const result = await uploadAvatar(user.id, file);
    setUploading(false);
    if ("error" in result) { toast.error(result.error); return; }
    update({ avatar_url: result.url });
    await supabase.from("profiles").update({ avatar_url: result.url }).eq("id", user.id);
    setInitial((p) => (p ? { ...p, avatar_url: result.url } : p));
    toast.success("Foto de perfil atualizada");
  };

  const removeAvatar = async () => {
    if (!user) return;
    update({ avatar_url: null });
    await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
    setInitial((p) => (p ? { ...p, avatar_url: null } : p));
    toast.success("Foto removida");
  };

  const decideRequest = async (id: string, status: "approved" | "denied") => {
    const { error } = await supabase.from("profile_access_requests").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "approved" ? "Acesso concedido" : "Solicitação recusada");
    loadRequests();
  };

  const changePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const password = new FormData(form).get("password") as string;
    if (password.length < 8) { toast.error("Use ao menos 8 caracteres."); return; }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) toast.error(error.message);
    else { toast.success("Senha alterada"); form.reset(); }
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
  const pending = requests.filter((r) => r.status === "pending");
  const approved = requests.filter((r) => r.status === "approved");

  const SaveBar = (
    <div className="flex items-center gap-3">
      <Button variant="hero" onClick={saveAll} disabled={saving || !dirty}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar alterações
      </Button>
      {dirty && <span className="text-[11px] text-muted-foreground">Você tem alterações não salvas.</span>}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/80 backdrop-blur z-30">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <BrandLogo size={30} />
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 max-w-4xl">
        <div className="flex items-start gap-5 mb-8">
          <div className="relative">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-gradient-primary text-primary-foreground font-display text-xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label="Enviar foto de perfil"
              className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:scale-105 transition-transform"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => { onAvatarFile(e.target.files?.[0]); e.target.value = ""; }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-3xl font-bold truncate">{profile?.full_name || "Sem nome"}</h1>
              <Badge variant={profile?.is_public ? "secondary" : "outline"} className="text-[10px]">
                {profile?.is_public ? "Portfólio público" : "Portfólio privado"}
              </Badge>
              {pending.length > 0 && (
                <Badge className="text-[10px]">{pending.length} solicitação(ões)</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span><strong className="text-foreground">{profile?.generations_count ?? 0}</strong> gerações</span>
              <span><strong className="text-foreground">{actualViews}</strong> visualizações</span>
              {profile?.avatar_url && (
                <button onClick={removeAvatar} className="flex items-center gap-1 hover:text-destructive">
                  <Trash2 className="h-3 w-3" /> remover foto
                </button>
              )}
            </div>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="conta">Conta</TabsTrigger>
            <TabsTrigger value="creditos">Créditos</TabsTrigger>
            <TabsTrigger value="perfil">Dados</TabsTrigger>
            <TabsTrigger value="portfolio">Portfólio</TabsTrigger>
            <TabsTrigger value="acessos">Acessos {pending.length > 0 && `(${pending.length})`}</TabsTrigger>
            <TabsTrigger value="assinatura">Assinatura</TabsTrigger>
            <TabsTrigger value="seguranca">Segurança</TabsTrigger>

          </TabsList>

          <TabsContent value="conta" className="space-y-4">
            <AccountPanel />
            <Card>
              <CardContent className="p-5 space-y-2">
                <h3 className="font-display font-bold flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Ações rápidas</h3>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>Minhas apresentações</Button>
                  <Button variant="outline" size="sm" onClick={() => navigate("/ajuda")}>Central de Ajuda</Button>
                  <Button variant="outline" size="sm" onClick={() => navigate("/suporte")}>Suporte</Button>
                  <Button variant="outline" size="sm" onClick={() => navigate("/gerar")}>Nova apresentação</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="creditos">
            <CreditsPanel />
          </TabsContent>


          <TabsContent value="perfil">
            <form onSubmit={(e) => { e.preventDefault(); saveAll(); }} className="space-y-4 bg-card border border-border rounded-2xl p-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nome completo</Label>
                  <Input id="full_name" value={profile?.full_name ?? ""} onChange={(e) => update({ full_name: e.target.value })} maxLength={80} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Nome de usuário (@)</Label>
                  <Input
                    id="username"
                    value={profile?.username ?? ""}
                    onChange={(e) => update({ username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30) })}
                    placeholder="seunome"
                  />
                  <p className="text-[11px] text-muted-foreground">Seu portfólio: /u/{profile?.username || "seunome"}</p>
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
                  <Input id="location" value={profile?.location ?? ""} onChange={(e) => update({ location: e.target.value })} placeholder="São Paulo, BR" maxLength={80} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Como você usa o SlideAI</Label>
                <Select value={profile?.role ?? undefined} onValueChange={(v) => update({ role: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma opção" /></SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Foto de perfil</Label>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Enviar imagem
                  </Button>
                  <span className="text-[11px] text-muted-foreground">PNG, JPG, WEBP ou GIF até 4 MB.</span>
                </div>
              </div>
              {SaveBar}
            </form>
          </TabsContent>

          <TabsContent value="portfolio">
            <div className="space-y-4">
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-display font-bold flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> Portfólio público</h3>
                      <p className="text-sm text-muted-foreground mt-1">Quando ativo, qualquer pessoa com o link vê seu perfil e suas apresentações publicadas.</p>
                    </div>
                    <Switch checked={!!profile?.is_public} onCheckedChange={(v) => update({ is_public: v })} />
                  </div>

                  {!profile?.is_public && (
                    <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
                      <div>
                        <p className="text-sm font-medium flex items-center gap-2"><Lock className="h-3.5 w-3.5" /> Acesso por solicitação</p>
                        <p className="text-xs text-muted-foreground mt-1">Visitantes logados podem pedir acesso ao seu portfólio privado. Você aprova na aba "Acessos".</p>
                      </div>
                      <Switch checked={!!profile?.allow_access_requests} onCheckedChange={(v) => update({ allow_access_requests: v })} />
                    </div>
                  )}

                  {portfolioUrl ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                      <Link2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <code className="text-xs flex-1 truncate">{portfolioUrl}</code>
                      <Button size="sm" variant="ghost" onClick={copyPortfolio} aria-label="Copiar link">
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="sm" variant="ghost" asChild><a href={portfolioUrl} target="_blank" rel="noreferrer" aria-label="Abrir portfólio"><ExternalLink className="h-3.5 w-3.5" /></a></Button>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                      Defina um nome de usuário na aba "Dados" para ativar seu link de portfólio.
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
                        <Input value={(social as Record<string, string>)[key] ?? ""} onChange={(e) => setSocial(key, e.target.value)} placeholder={ph} />
                      </div>
                    ))}
                  </div>
                  {SaveBar}
                  <p className="text-[11px] text-muted-foreground">As capas exibidas no portfólio usam a primeira imagem de cada apresentação publicada.</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="acessos">
            <Card>
              <CardContent className="p-6 space-y-5">
                <div>
                  <h3 className="font-display font-bold flex items-center gap-2"><Inbox className="h-4 w-4 text-primary" /> Solicitações de acesso</h3>
                  <p className="text-sm text-muted-foreground mt-1">Pessoas que pediram para ver seu portfólio privado.</p>
                </div>

                {pending.length === 0 ? (
                  <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-6 text-center">Nenhuma solicitação pendente.</p>
                ) : (
                  <div className="space-y-2">
                    {pending.map((r) => (
                      <div key={r.id} className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{requesterNames[r.requester_id] ?? "Usuário"}</p>
                          {r.message && <p className="text-xs text-muted-foreground mt-1 break-words">"{r.message}"</p>}
                          <p className="text-[11px] text-muted-foreground mt-1">{new Date(r.created_at).toLocaleString("pt-BR")}</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" onClick={() => decideRequest(r.id, "approved")}><ShieldCheck className="h-3.5 w-3.5" /> Aprovar</Button>
                          <Button size="sm" variant="outline" onClick={() => decideRequest(r.id, "denied")}><X className="h-3.5 w-3.5" /> Recusar</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {approved.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Acessos concedidos ({approved.length})</h4>
                    {approved.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                        <span className="text-sm">{requesterNames[r.requester_id] ?? "Usuário"}</span>
                        <Button size="sm" variant="ghost" onClick={() => decideRequest(r.id, "denied")}>Revogar</Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assinatura">
            <AccountPanel />
            <div className="mt-4 text-xs text-muted-foreground">
              Para trocar de plano ou cancelar, use os botões no painel acima. As mudanças são aplicadas imediatamente após a confirmação do pagamento.
            </div>
          </TabsContent>

          <TabsContent value="seguranca">
            <form onSubmit={changePassword} className="space-y-4 bg-card border border-border rounded-2xl p-6">
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <Input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
                <p className="text-[11px] text-muted-foreground">Mínimo de 8 caracteres.</p>
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
