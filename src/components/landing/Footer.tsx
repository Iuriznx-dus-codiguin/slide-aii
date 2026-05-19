import { Link } from "react-router-dom";
import { Sparkles, Twitter, Instagram, Linkedin, Github } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="border-t border-border bg-card/50">
      <div className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
                <Sparkles className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <span className="font-display text-xl font-bold tracking-tight">SlideAI</span>
            </div>
            <p className="text-muted-foreground max-w-sm leading-relaxed">
              A forma mais rápida e elegante de criar apresentações profissionais, com a ajuda da inteligência artificial.
            </p>
            <div className="flex gap-3 mt-6">
              {[Twitter, Instagram, Linkedin, Github].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="h-9 w-9 rounded-full bg-secondary hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition-colors"
                  aria-label="Social"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-display font-bold mb-4">Produto</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground transition-colors">Recursos</a></li>
              <li><a href="#pricing" className="hover:text-foreground transition-colors">Preços</a></li>
              <li><Link to="/gerar" className="hover:text-foreground transition-colors">Criar apresentação</Link></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Novidades</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold mb-4">Empresa</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">Sobre</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Contato</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Privacidade</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} SlideAI. Todos os direitos reservados.
          </p>
          <p className="text-sm text-muted-foreground">
            Feito com 💜 no Brasil
          </p>
        </div>
      </div>
    </footer>
  );
};
