import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ExternalLink, Eye, Globe, Lock, MapPin, Presentation, Send, ShieldCheck, Clock3 } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type AccessState = "granted" | "anonymous" | "none" | "pending" | "approved" | "denied";

type ViewerProfile = {
  id: string; full_name: string | null; username: string; avatar_url: string | null;
  bio: string | null; website: string | null; location: string | null;
  social_links: Record<string, string> | null; created_at: string;
  is_public: boolean; allow_access_requests: boolean; access_state: AccessState;
};

type PresentationData = {
  id: string; title: string; slug: string; description: string | null;
  slides_count: number; view_count: number; created_at: string; cover_image_url: string | null;
};

const safeExternalUrl = (value: string | null | undefined) => {
  if (!value) return null;
  try { const url = new URL(value.startsWith("http") ? value : `https://${value}`); return ["http:", "https:"].includes(url.protocol) ? url.href : null; } catch { return null; }
};

const setRobots = (content: string | null) => {
  const existing = document.querySelector<HTMLMetaElement>('meta[name="robots"][data-dynamic="true"]');
  if (!content) { existing?.remove(); return; }
  const tag = existing ?? Object.assign(document.createElement("meta"), { name: "robots" });
  tag.setAttribute("data-dynamic", "true");
  tag.content = content;
  if (!existing) document.head.appendChild(tag);
};

export default function PublicProfile() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ViewerProfile | null>(null);
  const [presentations, setPresentations] = useState<PresentationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestMessage, setRequestMessage] = useState("");
  const [requesting, setRequesting] = useState(false);

  const load = useCallback(async () => {
    if (!username) return;
    const { data } = await supabase.rpc("get_profile_for_viewer", { _username: username });
    const found = (data?.[0] as ViewerProfile | undefined) ?? null;
    setProfile(found);
    if (found?.access_state === "granted") {
      const { data: items } = await supabase.rpc("get_portfolio_presentations", { _owner: found.id });
      setPresentations((items as PresentationData[]) ?? []);
      document.title = `${found.full_name || `@${found.username}`} — SlideAI`;
      setRobots(found.is_public ? null : "noindex, follow");
    } else if (found) {
      setPresentations([]);
      document.title = `@${found.username} — portfólio privado — SlideAI`;
      setRobots("noindex, follow");
    } else {
      document.title = "Portfólio não encontrado — SlideAI";
      setRobots("noindex, follow");
    }
    setLoading(false);
  }, [username]);

  useEffect(() => { load(); return () => setRobots(null); }, [load]);

  const requestAccess = async () => {
    if (!profile || !user) return;
    setRequesting(true);
    const { error } = await supabase.from("profile_access_requests").insert({
      owner_id: profile.id,
      requester_id: user.id,
      message: requestMessage.trim().slice(0, 400) || null,
    });
    setRequesting(false);
    if (error) { toast.error(error.code === "23505" ? "Você já solicitou acesso a este portfólio." : error.message); return; }
    toast.success("Solicitação enviada. Você será liberado assim que o dono aprovar.");
    setRequestMessage("");
    load();
  };

  if (loading) return <div className="container mx-auto max-w-6xl space-y-6 px-6 py-16"><Skeleton className="h-24 w-24 rounded-full" /><Skeleton className="h-10 w-80" /><Skeleton className="h-56 w-full" /></div>;

  if (!profile) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <Presentation className="h-12 w-12 text-muted-foreground" />
      <h1 className="text-2xl font-bold">Portfólio não encontrado</h1>
      <p className="text-muted-foreground">Este perfil não existe ou não está disponível.</p>
      <Button asChild><Link to="/">Conhecer o SlideAI</Link></Button>
    </div>
  );

  const header = (
    <header className="border-b border-border">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <Link to="/"><BrandLogo size={34} /></Link>
        <Button asChild size="sm"><Link to="/gerar">Criar apresentação</Link></Button>
      </div>
    </header>
  );

  if (profile.access_state !== "granted") {
    const state = profile.access_state;
    return (
      <div className="min-h-screen bg-background">
        {header}
        <main className="container mx-auto flex max-w-xl flex-col items-center gap-5 px-6 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted"><Lock className="h-7 w-7 text-muted-foreground" /></div>
          <div>
            <h1 className="text-2xl font-bold">@{profile.username} mantém este portfólio privado</h1>
            <p className="mt-2 text-sm text-muted-foreground">O conteúdo só fica visível para pessoas com acesso aprovado.</p>
          </div>

          {state === "pending" && (
            <p className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm"><Clock3 className="h-4 w-4 text-primary" /> Sua solicitação está aguardando aprovação.</p>
          )}
          {state === "denied" && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">Sua solicitação de acesso não foi aprovada.</p>
          )}
          {state === "anonymous" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Entre na sua conta para solicitar acesso.</p>
              <Button asChild><Link to="/auth">Entrar</Link></Button>
            </div>
          )}
          {state === "none" && (
            profile.allow_access_requests ? (
              <div className="w-full space-y-3 text-left">
                <Textarea
                  rows={3}
                  maxLength={400}
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  placeholder="Conte rapidamente por que quer acessar este portfólio (opcional)."
                />
                <Button className="w-full" onClick={requestAccess} disabled={requesting}>
                  <Send className="h-4 w-4" /> Solicitar acesso
                </Button>
              </div>
            ) : (
              <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">Este usuário não está aceitando solicitações de acesso no momento.</p>
            )
          )}

          <Button asChild variant="ghost" size="sm"><Link to="/">Voltar ao início</Link></Button>
        </main>
      </div>
    );
  }

  const website = safeExternalUrl(profile.website);
  const initials = (profile.full_name || profile.username).slice(0, 2).toUpperCase();
  const socials = Object.entries(profile.social_links ?? {}).filter(([, v]) => v);

  return (
    <div className="min-h-screen bg-background">
      {header}
      <main>
        <section className="border-b border-border bg-muted/30">
          <div className="container mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 md:flex-row md:items-center">
            <Avatar className="h-28 w-28 border-4 border-background shadow-md">
              <AvatarImage src={profile.avatar_url ?? undefined} alt={`Foto de ${profile.full_name || profile.username}`} />
              <AvatarFallback className="text-2xl font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-primary">@{profile.username}</p>
                {!profile.is_public && <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"><ShieldCheck className="h-3 w-3" /> acesso concedido</span>}
              </div>
              <h1 className="mt-1 text-3xl font-bold md:text-4xl">{profile.full_name || profile.username}</h1>
              {profile.bio && <p className="mt-3 max-w-2xl text-muted-foreground">{profile.bio}</p>}
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                {profile.location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{profile.location}</span>}
                {website && <a className="flex items-center gap-1 hover:text-primary" href={website} target="_blank" rel="noreferrer"><Globe className="h-4 w-4" />Site <ExternalLink className="h-3 w-3" /></a>}
                <span>{presentations.length} apresentações publicadas</span>
              </div>
              {socials.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {socials.map(([key, value]) => {
                    const href = safeExternalUrl(value.startsWith("@") ? socialUrl(key, value) : value) ?? socialUrl(key, value);
                    return <a key={key} href={href ?? undefined} target="_blank" rel="noreferrer" className="rounded-full border border-border px-3 py-1 text-xs capitalize hover:border-primary hover:text-primary">{key}</a>;
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="container mx-auto max-w-6xl px-6 py-10">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">Apresentações</h2>
            <p className="text-sm text-muted-foreground">Trabalhos publicados por {profile.full_name || `@${profile.username}`}.</p>
          </div>
          {presentations.length === 0 ? (
            <div className="border-y border-border py-16 text-center text-muted-foreground">Nenhuma apresentação publicada ainda.</div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {presentations.map((item) => (
                <Link key={item.id} to={`/slides/${item.slug}`} className="group overflow-hidden rounded-md border border-border bg-card transition hover:border-primary/40 hover:shadow-md">
                  <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-muted">
                    {item.cover_image_url ? (
                      <img src={item.cover_image_url} alt={`Capa de ${item.title}`} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    ) : (
                      <Presentation className="h-12 w-12 text-primary/40 transition group-hover:scale-110" />
                    )}
                    <span className="absolute bottom-2 right-2 rounded bg-background/85 px-2 py-0.5 text-[10px] font-medium backdrop-blur">{item.slides_count} slides</span>
                  </div>
                  <div className="p-4">
                    <h3 className="truncate font-bold group-hover:text-primary">{item.title}</h3>
                    {item.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>}
                    <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                      <span>{new Date(item.created_at).toLocaleDateString("pt-BR")}</span>
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{item.view_count}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function socialUrl(key: string, value: string): string | null {
  const handle = value.replace(/^@/, "").trim();
  if (!handle) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const base: Record<string, string> = {
    instagram: "https://instagram.com/",
    twitter: "https://x.com/",
    linkedin: "https://linkedin.com/in/",
    github: "https://github.com/",
  };
  return base[key] ? `${base[key]}${handle}` : null;
}
