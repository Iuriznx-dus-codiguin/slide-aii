import { Link } from "react-router-dom";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";

const About = () => (
  <div className="min-h-screen flex flex-col bg-background">
    <Seo
      title="Sobre o SlideAI — quem somos e por que existimos"
      description="Conheça o SlideAI: uma plataforma brasileira que usa inteligência artificial para transformar ideias em apresentações profissionais em segundos."
      path="/sobre"
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "AboutPage",
        name: "Sobre o SlideAI",
        url: "https://slideai.com.br/sobre",
      }}
    />
    <Navbar />
    <main className="flex-1 pt-28 pb-20">
      <div className="container mx-auto px-6 max-w-3xl">
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
          Sobre o <span className="text-gradient">SlideAI</span>
        </h1>
        <div className="mt-8 space-y-5 text-muted-foreground leading-relaxed">
          <p>
            O SlideAI nasceu de uma frustração comum: montar uma apresentação leva horas que
            deveriam ser gastas com o conteúdo, não com o alinhamento de caixas de texto.
          </p>
          <p>
            Nossa plataforma usa inteligência artificial para estruturar a narrativa, escrever
            cada slide, sugerir imagens e criar gráficos quando detecta dados — tudo a partir de
            uma descrição em português. O resultado é editável do início ao fim: você continua no
            controle do design, dos textos e do ritmo da apresentação.
          </p>
          <p>
            Somos um produto brasileiro, pensado para o dia a dia de professores, estudantes,
            times comerciais, agências e empreendedores que precisam comunicar bem e rápido.
          </p>
          <p>
            Acreditamos em cobrança transparente por créditos, sem contratos escondidos: você paga
            pelo que gera e pode cancelar a assinatura quando quiser.
          </p>
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild size="lg"><Link to="/gerar">Criar apresentação</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/contato">Falar com a gente</Link></Button>
        </div>
      </div>
    </main>
    <Footer />
  </div>
);

export default About;
