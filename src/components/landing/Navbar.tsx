import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const Navbar = () => {
  const { scrollY } = useScroll();
  const bg = useTransform(scrollY, [0, 80], ["hsl(var(--background) / 0)", "hsl(var(--background) / 0.85)"]);
  const [open, setOpen] = useState(false);

  const links = [
    { href: "#how", label: "Como funciona", to: null },
    { href: "#features", label: "Recursos", to: null },
    { href: "#pricing", label: "Preços", to: null },
    { href: "#faq", label: "FAQ", to: null },
  ];

  return (
    <motion.header
      style={{ backgroundColor: bg }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b border-border/40"
    >
      <nav className="container mx-auto flex h-16 items-center justify-between px-6">
        <Link to="/" className="group transition-transform group-hover:scale-105">
          <BrandLogo size={36} />
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            l.to ? (
              <Link key={l.href} to={l.to} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{l.label}</Link>
            ) : (
              <a key={l.href} href={l.href} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{l.label}</a>
            )
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link to="/auth"><Button variant="ghost" size="sm">Entrar</Button></Link>
          <Link to="/gerar"><Button variant="hero" size="sm">Criar apresentação</Button></Link>
        </div>

        <button className="md:hidden p-2" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-md">
          <div className="container mx-auto px-6 py-4 flex flex-col gap-4">
            {links.map((l) => (
              l.to ? (
                <Link key={l.href} to={l.to} onClick={() => setOpen(false)} className="text-sm font-medium text-muted-foreground hover:text-foreground">{l.label}</Link>
              ) : (
                <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-sm font-medium text-muted-foreground hover:text-foreground">{l.label}</a>
              )
            ))}
            <div className="flex flex-col gap-2 pt-2">
              <Link to="/auth"><Button variant="ghost" size="sm" className="w-full">Entrar</Button></Link>
              <Link to="/gerar"><Button variant="hero" size="sm" className="w-full">Criar apresentação</Button></Link>
            </div>
          </div>
        </div>
      )}
    </motion.header>
  );
};
