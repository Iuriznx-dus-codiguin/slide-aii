import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { Sparkles, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const Navbar = () => {
  const { scrollY } = useScroll();
  const bg = useTransform(scrollY, [0, 80], ["hsl(var(--background) / 0)", "hsl(var(--background) / 0.85)"]);
  const [open, setOpen] = useState(false);

  const links = [
    { href: "#how", label: "Como funciona" },
    { href: "#features", label: "Recursos" },
    { href: "#pricing", label: "Preços" },
    { href: "#faq", label: "FAQ" },
  ];

  return (
    <motion.header
      style={{ backgroundColor: bg }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b border-border/40"
    >
      <nav className="container mx-auto flex h-16 items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow group-hover:scale-105 transition-transform">
            <Sparkles className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">SlideAI</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link to="/auth"><Button variant="ghost" size="sm">Entrar</Button></Link>
          <Link to="/auth"><Button variant="hero" size="sm">Começar grátis</Button></Link>
        </div>

        <button className="md:hidden p-2" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-md">
          <div className="container mx-auto px-6 py-4 flex flex-col gap-4">
            {links.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-sm font-medium text-muted-foreground hover:text-foreground">
                {l.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-2">
              <Link to="/auth"><Button variant="ghost" size="sm" className="w-full">Entrar</Button></Link>
              <Link to="/auth"><Button variant="hero" size="sm" className="w-full">Começar grátis</Button></Link>
            </div>
          </div>
        </div>
      )}
    </motion.header>
  );
};
