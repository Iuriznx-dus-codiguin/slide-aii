import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import { LEGAL, supplierLines } from "@/lib/legal";

export const Footer = () => {
  const supplier = supplierLines();
  return (
    <footer className="border-t border-border bg-card/50">
      <div className="container mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8">
          <div className="col-span-2 sm:col-span-3 lg:col-span-2">
            <div className="mb-4">
              <BrandLogo size={36} />
            </div>
            <p className="text-muted-foreground max-w-sm leading-relaxed">
              A forma mais rápida e elegante de criar apresentações profissionais, com a ajuda da inteligência artificial.
            </p>
            <a
              href={`mailto:${LEGAL.supportEmail}`}
              className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {LEGAL.supportEmail}
            </a>
          </div>

          <div>
            <h4 className="font-display font-bold mb-4">Produto</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><a href="/#features" className="hover:text-foreground transition-colors">Recursos</a></li>
              <li><a href="/#pricing" className="hover:text-foreground transition-colors">Preços</a></li>
              <li><Link to="/gerar" className="hover:text-foreground transition-colors">Criar apresentação</Link></li>
              <li><Link to="/templates" className="hover:text-foreground transition-colors">Templates</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold mb-4">Empresa</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><Link to="/sobre" className="hover:text-foreground transition-colors">Sobre</Link></li>
              <li><Link to="/ajuda" className="hover:text-foreground transition-colors">Central de Ajuda</Link></li>
              <li><Link to="/contato" className="hover:text-foreground transition-colors">Contato</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold mb-4">Legal</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><Link to="/termos" className="hover:text-foreground transition-colors">Termos de Uso</Link></li>
              <li><Link to="/privacidade" className="hover:text-foreground transition-colors">Política de Privacidade</Link></li>
              <li><Link to="/privacidade#cookies" className="hover:text-foreground transition-colors">Cookies</Link></li>
              <li><Link to="/termos#arrependimento" className="hover:text-foreground transition-colors">Reembolso e arrependimento</Link></li>
              <li><Link to="/privacidade#direitos" className="hover:text-foreground transition-colors">Seus direitos (LGPD)</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground text-center md:text-left">
            © {new Date().getFullYear()} {LEGAL.brand}. Todos os direitos reservados.
            {supplier.length > 0 && <span className="block text-xs mt-1">{supplier.join(" · ")}</span>}
          </p>
          <p className="text-sm text-muted-foreground">
            Feito com 💜 no Brasil
          </p>
        </div>
      </div>
    </footer>
  );
};
