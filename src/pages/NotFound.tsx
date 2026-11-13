import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  // Mesma identidade visual do restante do site, com saídas claras.
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-subtle px-4 py-12">
      <Seo title="Página não encontrada | SlideAI" description="O endereço pode estar incorreto ou a página foi movida." path={location.pathname} noindex />
      <div className="w-full max-w-md text-center">
        <Link to="/" className="mb-8 inline-flex" aria-label="SlideAI, página inicial">
          <BrandLogo size={40} />
        </Link>
        <p className="font-display text-6xl font-extrabold tracking-tight text-gradient" aria-hidden="true">404</p>
        <h1 className="mt-3 font-display text-2xl font-bold">Página não encontrada</h1>
        <p className="mt-2 text-muted-foreground">O endereço pode estar incorreto ou a página foi movida.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild variant="hero"><Link to="/">Voltar para o início</Link></Button>
          <Button asChild variant="outline"><Link to="/ajuda">Central de Ajuda</Link></Button>
        </div>
      </div>
    </main>
  );
};

export default NotFound;
