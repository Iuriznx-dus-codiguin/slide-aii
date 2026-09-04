import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Seo } from "@/components/Seo";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-8">
    <h2 className="font-display text-xl font-bold mb-2">{title}</h2>
    <div className="space-y-3 text-muted-foreground leading-relaxed">{children}</div>
  </section>
);

const Privacy = () => (
  <div className="min-h-screen flex flex-col bg-background">
    <Seo
      title="Política de Privacidade — SlideAI"
      description="Como o SlideAI coleta, usa, armazena e protege os seus dados pessoais e o conteúdo das suas apresentações, em conformidade com a LGPD."
      path="/privacidade"
    />
    <Navbar />
    <main className="flex-1 pt-28 pb-20">
      <div className="container mx-auto px-6 max-w-3xl">
        <h1 className="font-display text-4xl font-bold tracking-tight">Política de Privacidade</h1>
        <p className="mt-3 text-sm text-muted-foreground">Última atualização: setembro de 2026.</p>

        <Section title="1. Dados que coletamos">
          <p>
            Coletamos os dados de cadastro (nome, e-mail e foto de perfil, quando informada), os
            dados necessários para processar pagamentos (tratados pelo nosso provedor de pagamentos,
            sem que armazenemos dados completos de cartão) e o conteúdo que você envia para gerar
            apresentações.
          </p>
        </Section>

        <Section title="2. Como usamos os dados">
          <p>
            Usamos seus dados para autenticar o acesso, gerar e armazenar suas apresentações,
            controlar créditos e assinatura, prestar suporte e melhorar a plataforma. Os textos
            enviados para geração são processados por provedores de inteligência artificial
            exclusivamente para produzir o resultado solicitado.
          </p>
        </Section>

        <Section title="3. Compartilhamento">
          <p>
            Não vendemos dados pessoais. Compartilhamos apenas o necessário com prestadores de
            serviço essenciais à operação: infraestrutura em nuvem, provedores de IA, provedor de
            pagamentos e ferramentas de comunicação de suporte.
          </p>
        </Section>

        <Section title="4. Apresentações públicas">
          <p>
            Apresentações são privadas por padrão. Ao publicar uma apresentação ou tornar seu
            perfil público, o conteúdo passa a ser acessível por qualquer pessoa com o link e pode
            ser indexado por buscadores. Você pode despublicar a qualquer momento.
          </p>
        </Section>

        <Section title="5. Retenção e exclusão">
          <p>
            Mantemos seus dados enquanto a conta existir. Você pode excluir apresentações a qualquer
            momento e solicitar a exclusão definitiva da conta e dos dados associados pelo e-mail de
            contato, respeitadas as obrigações legais de guarda fiscal.
          </p>
        </Section>

        <Section title="6. Seus direitos (LGPD)">
          <p>
            Você pode solicitar acesso, correção, portabilidade, anonimização ou exclusão dos seus
            dados, além de revogar consentimentos. Basta escrever para suporte@slideai.com.br.
          </p>
        </Section>

        <Section title="7. Segurança">
          <p>
            Usamos criptografia em trânsito, controle de acesso por linha no banco de dados e
            registros de auditoria. Nenhum sistema é infalível, mas tratamos qualquer incidente
            relevante com comunicação transparente aos usuários afetados.
          </p>
        </Section>

        <Section title="8. Cookies">
          <p>
            Utilizamos cookies estritamente necessários para manter sua sessão autenticada e
            preferências de uso. Não usamos cookies de publicidade de terceiros.
          </p>
        </Section>

        <Section title="9. Contato">
          <p>
            Dúvidas sobre esta política: <a className="text-primary hover:underline" href="mailto:suporte@slideai.com.br">suporte@slideai.com.br</a>.
          </p>
        </Section>
      </div>
    </main>
    <Footer />
  </div>
);

export default Privacy;
