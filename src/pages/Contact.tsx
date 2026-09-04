import { Link } from "react-router-dom";
import { Mail, LifeBuoy, BookOpen } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Seo } from "@/components/Seo";
import { Card, CardContent } from "@/components/ui/card";

const SUPPORT_EMAIL = "suporte@slideai.com.br";

const Contact = () => (
  <div className="min-h-screen flex flex-col bg-background">
    <Seo
      title="Contato — fale com o time do SlideAI"
      description="Precisa de ajuda com o SlideAI? Fale com o suporte por e-mail, pelo chat com IA dentro da plataforma ou consulte a Central de Ajuda."
      path="/contato"
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "ContactPage",
        name: "Contato SlideAI",
        url: "https://slideai.com.br/contato",
      }}
    />
    <Navbar />
    <main className="flex-1 pt-28 pb-20">
      <div className="container mx-auto px-6 max-w-3xl">
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
          Fale com a <span className="text-gradient">gente</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Dúvidas sobre créditos, assinatura, geração de slides ou parcerias? Escolha o canal mais
          prático para você.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <Mail className="h-5 w-5 text-primary mb-3" />
              <h2 className="font-display font-bold mb-1">E-mail</h2>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sm text-muted-foreground hover:text-foreground break-all">
                {SUPPORT_EMAIL}
              </a>
              <p className="text-xs text-muted-foreground mt-2">Resposta em até 1 dia útil.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <LifeBuoy className="h-5 w-5 text-primary mb-3" />
              <h2 className="font-display font-bold mb-1">Suporte com IA</h2>
              <Link to="/suporte" className="text-sm text-muted-foreground hover:text-foreground">
                Abrir o chat de suporte
              </Link>
              <p className="text-xs text-muted-foreground mt-2">Disponível 24/7 na sua conta.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <BookOpen className="h-5 w-5 text-primary mb-3" />
              <h2 className="font-display font-bold mb-1">Central de Ajuda</h2>
              <Link to="/ajuda" className="text-sm text-muted-foreground hover:text-foreground">
                Ver tutoriais e guias
              </Link>
              <p className="text-xs text-muted-foreground mt-2">Respostas imediatas.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
    <Footer />
  </div>
);

export default Contact;
