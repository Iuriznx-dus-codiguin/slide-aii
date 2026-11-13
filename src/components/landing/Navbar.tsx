import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export const Navbar = () => {
  const { scrollY } = useScroll();
  const bg = useTransform(scrollY, [0, 80], ["hsl(var(--background) / 0)", "hsl(var(--background) / 0.85)"]);
  const [open, setOpen] = useState(false);

  // Esc fecha o menu do celular.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Âncoras com "/" na frente: a Navbar também aparece em /templates, /sobre e
  // nas páginas legais, onde "#how" sozinho apontava para uma seção inexistente.
  const links = [
    { href: "/#how", label: "Como funciona", to: null },
    { href: "/#features", label: "Recursos", to: null },
    { href: "/templates", label: "Templates", to: "/templates" },
    { href: "/#pricing", label: "Preços", to: null },
    { href: "/ajuda", label: "Ajuda", to: "/ajuda" },
  ];

  return (
    <motion.header
      style={{ backgroundColor: bg }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b border-border/40"
    >
      <nav className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        <Link to="/" className="group transition-transform group-hover:scale-105" aria-label="SlideAI, página inicial">
          <BrandLogo size={36} />
        </Link>

        <div className="hidden lg:flex items-center gap-8">
          {links.map((l) => (
            l.to ? (
              <Link key={l.href} to={l.to} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{l.label}</Link>
            ) : (
              <a key={l.href} href={l.href} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{l.label}</a>
            )
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-3">
          <Button asChild variant="ghost" size="sm"><Link to="/auth">Entrar</Link></Button>
          <Button asChild variant="hero" size="sm"><Link to="/gerar">Criar apresentação</Link></Button>
        </div>

        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(!open)} aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} aria-controls="landing-mobile-menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </nav>

      {open && (
        <div id="landing-mobile-menu" className="lg:hidden max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-border/40 bg-background/95 backdrop-blur-md">
          {/* Itens com 44px de altura (antes 20px: difíceis de tocar). */}
          <div className="container mx-auto px-4 sm:px-6 py-3 flex flex-col gap-1">
            {links.map((l) => (
              l.to ? (
                <Link key={l.href} to={l.to} onClick={() => setOpen(false)} className="-mx-2 flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">{l.label}</Link>
              ) : (
                <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="-mx-2 flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">{l.label}</a>
              )
            ))}
            <div className="flex flex-col gap-2 pt-3">
              <Button asChild variant="ghost" className="w-full"><Link to="/auth" onClick={() => setOpen(false)}>Entrar</Link></Button>
              <Button asChild variant="hero" className="w-full"><Link to="/gerar" onClick={() => setOpen(false)}>Criar apresentação</Link></Button>
            </div>
          </div>
        </div>
      )}
    </motion.header>
  );
};
