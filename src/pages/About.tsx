import { Link } from "react-router-dom";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { ORGANIZATION_ID, absoluteUrl, breadcrumbJsonLd } from "@/lib/seo";
import { LEGAL } from "@/lib/legal";

const About = () => (
  <div className="min-h-screen flex flex-col bg-background">
    <Seo
      title="Sobre o SlideAI: IA Brasileira para Criar Apresentações"
      description="Conheça o SlideAI: uma plataforma brasileira que usa inteligência artificial para transformar ideias em apresentações profissionais em cerca de um minuto."
      path="/sobre"
      jsonLd={[
        {
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "Sobre o SlideAI",
          url: absoluteUrl("/sobre"),
          inLanguage: "pt-BR",
          about: { "@id": ORGANIZATION_ID },
        },
        { "@context": "https://schema.org", ...breadcrumbJsonLd([{ name: "Sobre", path: "/sobre" }]) },
      ]}
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

        <section className="mt-12" aria-labelledby="como-funciona">
          <h2 id="como-funciona" className="font-display text-2xl font-bold tracking-tight">O que o SlideAI faz</h2>
          <div className="mt-4 space-y-4 text-muted-foreground leading-relaxed">
            <p>
              Você informa o tema, o público e o objetivo. Em cerca de um minuto, o SlideAI entrega de 5 a 20 slides com
              roteiro, textos, layout, imagens e gráficos, além das falas dos apresentadores quando você pede. Tudo pode
              ser ajustado no editor visual ou conversando com o assistente de edição.
            </p>
            <p>
              A apresentação pode ser exibida em tela cheia, compartilhada por um link público ou exportada em PowerPoint
              (.pptx), PDF e imagem. Para começar mais rápido, há <Link to="/templates" className="text-primary underline underline-offset-2">modelos prontos</Link> de
              pitch deck, TCC, aula, relatório e outros formatos.
            </p>
          </div>
        </section>

        <section className="mt-12" aria-labelledby="ia">
          <h2 id="ia" className="font-display text-2xl font-bold tracking-tight">Como usamos a inteligência artificial</h2>
          <div className="mt-4 space-y-4 text-muted-foreground leading-relaxed">
            <p>
              Os textos, as falas e parte das imagens são gerados por modelos de IA de provedores como OpenAI e Google
              (Gemini). As fotos vêm do banco de imagens Pexels. Os provedores e os dados que cada um recebe estão
              listados na <Link to="/privacidade" className="text-primary underline underline-offset-2">Política de Privacidade</Link>.
            </p>
            <p>
              Conteúdo gerado por IA pode conter imprecisões, por isso o resultado é sempre editável e recomendamos revisar
              números, datas e referências antes de apresentar. Não usamos as suas apresentações para treinar modelos de IA.
            </p>
          </div>
        </section>

        <section className="mt-12" aria-labelledby="compromissos">
          <h2 id="compromissos" className="font-display text-2xl font-bold tracking-tight">Nossos compromissos</h2>
          <ul className="mt-4 space-y-3 text-muted-foreground leading-relaxed list-disc pl-5">
            <li>O custo de cada apresentação aparece antes de gerar, e os créditos voltam se a geração falhar por um problema nosso.</li>
            <li>Você tem 7 dias para desistir da compra, com reembolso integral, como prevê o Código de Defesa do Consumidor.</li>
            <li>Tratamos os dados conforme a LGPD e não vendemos dados pessoais.</li>
            <li>O conteúdo que você cria é seu, inclusive para uso comercial, nos termos dos <Link to="/termos" className="text-primary underline underline-offset-2">Termos de Uso</Link>.</li>
            <li>Atendimento em português pelo e-mail <a href={`mailto:${LEGAL.supportEmail}`} className="text-primary underline underline-offset-2">{LEGAL.supportEmail}</a>, com resposta em {LEGAL.supportResponseTime}, e pela <Link to="/ajuda" className="text-primary underline underline-offset-2">Central de Ajuda</Link>.</li>
          </ul>
        </section>

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
