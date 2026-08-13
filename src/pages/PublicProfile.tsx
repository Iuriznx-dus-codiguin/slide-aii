import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ExternalLink, Eye, Globe, MapPin, Presentation } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

type PublicProfileData = { id: string; full_name: string | null; username: string; avatar_url: string | null; bio: string | null; website: string | null; location: string | null; social_links: Record<string, string> | null; created_at: string };
type PresentationData = { id: string; title: string; slug: string; description: string | null; slides_count: number; view_count: number; created_at: string };

const safeExternalUrl = (value: string | null | undefined) => {
  if (!value) return null;
  try { const url = new URL(value.startsWith("http") ? value : `https://${value}`); return ["http:", "https:"].includes(url.protocol) ? url.href : null; } catch { return null; }
};

export default function PublicProfile() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [presentations, setPresentations] = useState<PresentationData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return;
    (async () => {
      const { data } = await supabase.rpc("get_public_profile", { _username: username });
      const found = (data?.[0] as PublicProfileData | undefined) ?? null;
      setProfile(found);
      if (found) {
        const { data: items } = await supabase.from("presentations")
          .select("id,title,slug,description,slides_count,view_count,created_at")
          .eq("user_id", found.id).eq("is_published", true).is("deleted_at", null).order("created_at", { ascending: false });
        setPresentations((items as PresentationData[]) ?? []);
        document.title = `${found.full_name || `@${found.username}`} — SlideAI`;
      }
      setLoading(false);
    })();
  }, [username]);

  if (loading) return <div className="container mx-auto max-w-6xl space-y-6 px-6 py-16"><Skeleton className="h-24 w-24 rounded-full" /><Skeleton className="h-10 w-80" /><Skeleton className="h-56 w-full" /></div>;
  if (!profile) return <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"><Presentation className="h-12 w-12 text-muted-foreground" /><h1 className="text-2xl font-bold">Portfólio não encontrado</h1><p className="text-muted-foreground">Este perfil não existe ou não está público.</p><Button asChild><Link to="/">Conhecer o SlideAI</Link></Button></div>;


  const website = safeExternalUrl(profile.website);
  const initials = (profile.full_name || profile.username).slice(0, 2).toUpperCase();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border"><div className="container mx-auto flex h-16 items-center justify-between px-6"><Link to="/"><BrandLogo size={34} /></Link><Button asChild size="sm"><Link to="/gerar">Criar apresentação</Link></Button></div></header>
      <main>
        <section className="border-b border-border bg-muted/30"><div className="container mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 md:flex-row md:items-center">
          <Avatar className="h-28 w-28 border-4 border-background shadow-md"><AvatarImage src={profile.avatar_url ?? undefined} /><AvatarFallback className="text-2xl font-bold">{initials}</AvatarFallback></Avatar>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-primary">@{profile.username}</p><h1 className="mt-1 text-3xl font-bold md:text-4xl">{profile.full_name || profile.username}</h1>{profile.bio && <p className="mt-3 max-w-2xl text-muted-foreground">{profile.bio}</p>}
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">{profile.location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{profile.location}</span>}{website && <a className="flex items-center gap-1 hover:text-primary" href={website} target="_blank" rel="noreferrer"><Globe className="h-4 w-4" />Site <ExternalLink className="h-3 w-3" /></a>}<span>{presentations.length} apresentações públicas</span></div>
          </div>
        </div></section>
        <section className="container mx-auto max-w-6xl px-6 py-10"><div className="mb-6"><h2 className="text-2xl font-bold">Apresentações</h2><p className="text-sm text-muted-foreground">Trabalhos publicados por {profile.full_name || `@${profile.username}`}.</p></div>
          {presentations.length === 0 ? <div className="border-y border-border py-16 text-center text-muted-foreground">Nenhuma apresentação publicada ainda.</div> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{presentations.map((item) => <Link key={item.id} to={`/slides/${item.slug}`} className="group overflow-hidden rounded-md border border-border bg-card transition hover:border-primary/40 hover:shadow-md"><div className="flex aspect-video items-center justify-center bg-muted"><Presentation className="h-12 w-12 text-primary/40 transition group-hover:scale-110" /></div><div className="p-4"><h3 className="truncate font-bold group-hover:text-primary">{item.title}</h3>{item.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>}<div className="mt-3 flex justify-between text-xs text-muted-foreground"><span>{item.slides_count} slides</span><span className="flex items-center gap-1"><Eye className="h-3 w-3" />{item.view_count}</span></div></div></Link>)}</div>}
        </section>
      </main>
    </div>
  );
}