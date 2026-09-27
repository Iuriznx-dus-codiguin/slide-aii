import { Link } from "react-router-dom";
import { Callout, Clause, LegalLayout, LegalList, LegalSection, LegalTable, Strong, type TocItem } from "@/components/legal/LegalLayout";
import { LEGAL, operatorName, supplierLines } from "@/lib/legal";

const TOC: TocItem[] = [
  { id: "resumo", label: "Resumo" },
  { id: "controlador", label: "1. Quem é o controlador" },
  { id: "abrangencia", label: "2. A quem esta política se aplica" },
  { id: "dados", label: "3. Dados, finalidades e bases legais" },
  { id: "terceiros-nas-apresentacoes", label: "4. Dados de terceiros nas apresentações" },
  { id: "compartilhamento", label: "5. Com quem compartilhamos" },
  { id: "transferencia", label: "6. Transferência internacional" },
  { id: "retencao", label: "7. Por quanto tempo guardamos" },
  { id: "direitos", label: "8. Seus direitos" },
  { id: "decisoes-automatizadas", label: "9. Decisões automatizadas" },
  { id: "seguranca", label: "10. Segurança e incidentes" },
  { id: "criancas", label: "11. Crianças e adolescentes" },
  { id: "cookies", label: "12. Cookies e armazenamento local" },
  { id: "alteracoes", label: "13. Alterações desta política" },
  { id: "contato", label: "14. Contato e encarregado" },
];

const Privacy = () => {
  const supplier = supplierLines();
  return (
    <LegalLayout
      title="Política de Privacidade"
      seoTitle="Política de Privacidade — SlideAI"
      description="Como o SlideAI coleta, usa, compartilha, guarda e protege dados pessoais, com bases legais, prazos de retenção, fornecedores e como exercer seus direitos pela LGPD."
      path="/privacidade"
      version={LEGAL.privacyVersion}
      effectiveDate={LEGAL.effectiveDateLabel}
      toc={TOC}
      intro={
        <p>
          Esta Política explica, de forma direta, quais dados pessoais o {LEGAL.brand} trata, para quê, com base em qual
          hipótese da Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018), com quem compartilha, por quanto tempo guarda
          e como você exerce seus direitos. Ela complementa os{" "}
          <Link to="/termos" className="text-primary hover:underline">Termos de Uso</Link>.
        </p>
      }
    >
      <section id="resumo" className="scroll-mt-28">
        <Callout title="Resumo">
          <LegalList>
            <li>Tratamos só o necessário para criar sua conta, gerar e guardar suas apresentações, cobrar, dar suporte e manter a plataforma segura.</li>
            <li><Strong>Não vendemos dados pessoais</Strong> e não usamos suas apresentações para treinar modelos de IA ou para publicidade.</li>
            <li>O texto que você envia para gerar ou editar slides é processado por provedores de IA, em servidores fora do Brasil.</li>
            <li>Não usamos cookies de publicidade nem ferramentas de rastreamento de terceiros.</li>
            <li>Você pode pedir acesso, correção, portabilidade ou exclusão dos seus dados pelo e-mail {LEGAL.privacyEmail}.</li>
          </LegalList>
        </Callout>
      </section>

      <LegalSection id="controlador" title="1. Quem é o controlador">
        <Clause n="1.1">
          O controlador dos dados pessoais tratados no {LEGAL.brand} é <Strong>{operatorName()}</Strong>
          {supplier.length > 1 && <> ({supplier.slice(1).join(", ")})</>}.
        </Clause>
        <Clause n="1.2">
          Canal do titular de dados:{" "}
          <a href={`mailto:${LEGAL.privacyEmail}`} className="text-primary hover:underline">{LEGAL.privacyEmail}</a>
          {LEGAL.dpoName ? <>, sob responsabilidade do encarregado <Strong>{LEGAL.dpoName}</Strong></> : null}.
        </Clause>
      </LegalSection>

      <LegalSection id="abrangencia" title="2. A quem esta política se aplica">
        <LegalList>
          <li><Strong>Usuários:</Strong> pessoas com conta no {LEGAL.brand}.</li>
          <li><Strong>Visitantes do site:</Strong> quem navega nas páginas públicas, como a inicial, os preços e a Central de Ajuda.</li>
          <li><Strong>Espectadores:</Strong> quem abre uma apresentação publicada por um usuário ou visita um portfólio público.</li>
          <li><Strong>Pessoas que entram em contato</Strong> com o suporte ou fazem denúncias.</li>
        </LegalList>
      </LegalSection>

      <LegalSection id="dados" title="3. Dados que tratamos, finalidades e bases legais">
        <LegalTable
          head={["Dados", "Para quê", "Base legal (LGPD)"]}
          rows={[
            [
              <><Strong>Cadastro:</Strong> nome, e-mail e senha (guardada só em forma criptografada pelo provedor de autenticação). No login pelo Google, recebemos nome, e-mail e foto da conta Google. Também guardamos o perfil de uso escolhido no primeiro acesso.</>,
              "Criar e autenticar sua conta, personalizar o formulário de geração e comunicar assuntos da conta.",
              "Execução de contrato (art. 7º, V).",
            ],
            [
              <><Strong>Perfil público (opcional):</Strong> nome de usuário, foto, bio, site, localização, redes sociais e pedidos de acesso ao portfólio.</>,
              "Exibir seu portfólio quando você o ativa e gerenciar quem pode vê-lo.",
              "Execução de contrato — recurso ativado por você (art. 7º, V).",
            ],
            [
              <><Strong>Conteúdo das apresentações:</Strong> títulos, descrições, textos, falas, nomes de apresentadores, escolhas de estilo, imagens e notas.</>,
              "Gerar, editar, guardar, exportar e, se você publicar, exibir suas apresentações.",
              "Execução de contrato (art. 7º, V).",
            ],
            [
              <><Strong>Pagamento e créditos:</Strong> plano, situação e datas da assinatura, identificadores de cliente e de assinatura na Cakto, extrato de créditos e os dados do pedido enviados pela Cakto (nome, e-mail, telefone, CPF/CNPJ e valor, conforme informado no checkout). <Strong>Não recebemos o número do cartão.</Strong></>,
              "Liberar planos e créditos, controlar consumo e renovação, processar reembolsos, cumprir obrigações fiscais e nos defender em disputas.",
              "Execução de contrato (art. 7º, V), cumprimento de obrigação legal (art. 7º, II) e exercício regular de direitos (art. 7º, VI).",
            ],
            [
              <><Strong>Registros de acesso:</Strong> endereço IP, data, hora e navegador de cada sessão.</>,
              "Guarda obrigatória dos registros de acesso a aplicações de internet.",
              "Cumprimento de obrigação legal (art. 7º, II; Marco Civil da Internet, art. 15).",
            ],
            [
              <><Strong>Aceites:</Strong> versão dos Termos e da Política aceita, data, hora, IP e navegador.</>,
              "Comprovar a contratação e o aceite das condições vigentes.",
              "Execução de contrato e exercício regular de direitos (art. 7º, V e VI).",
            ],
            [
              <><Strong>Suporte:</Strong> mensagens do chat de atendimento, número do atendimento, avaliação e códigos de erro relacionados.</>,
              "Responder suas solicitações, diagnosticar problemas e melhorar a Central de Ajuda.",
              "Execução de contrato (art. 7º, V) e legítimo interesse (art. 7º, IX).",
            ],
            [
              <><Strong>Diagnóstico e segurança:</Strong> registros de erro (página, código, trecho técnico e identificador da sessão, com remoção automática de e-mails, senhas e tokens), eventos de segurança com o IP apenas em forma de resumo criptográfico (hash) e contadores de limite de uso.</>,
              "Corrigir falhas, prevenir abusos e fraudes, aplicar limites de uso e proteger contas.",
              "Legítimo interesse (art. 7º, IX e art. 10) e segurança (art. 46).",
            ],
            [
              <><Strong>Registros de geração:</Strong> título, tipo, modelo usado, duração, custo estimado, créditos debitados e resultado de cada geração.</>,
              "Operar e aprimorar o motor de geração, controlar custos e estornar créditos em falhas.",
              "Execução de contrato (art. 7º, V) e legítimo interesse (art. 7º, IX).",
            ],
            [
              <><Strong>Espectadores de apresentações publicadas:</Strong> data, hora e tipo de navegador da visita. Não guardamos o IP nem identificamos quem assistiu.</>,
              "Mostrar ao autor quantas visualizações a apresentação teve.",
              "Legítimo interesse (art. 7º, IX).",
            ],
          ]}
        />
        <Clause n="3.1">
          Quando o tratamento se baseia em legítimo interesse, usamos só os dados necessários, avaliamos o impacto sobre seus
          direitos e você pode se opor pelo canal do titular (seção 8).
        </Clause>
        <Clause n="3.2">
          Não tratamos dados pessoais sensíveis de forma intencional. Não os inclua nas apresentações nem nas mensagens de
          suporte.
        </Clause>
      </LegalSection>

      <LegalSection id="terceiros-nas-apresentacoes" title="4. Dados de terceiros nas suas apresentações">
        <p>
          Se você incluir dados de outras pessoas nas apresentações, como nomes de clientes, alunos ou colegas, <Strong>você
          é o controlador desses dados</Strong> e precisa ter base legal para usá-los. Nesses casos o {LEGAL.brand} atua como
          operador: trata os dados só para prestar o serviço, conforme as suas ações na plataforma, com as proteções desta
          Política.
        </p>
      </LegalSection>

      <LegalSection id="compartilhamento" title="5. Com quem compartilhamos">
        <p>
          Compartilhamos dados apenas com fornecedores essenciais para operar o serviço, que atuam como operadores ou como
          controladores independentes, cada um com suas obrigações de proteção:
        </p>
        <LegalTable
          head={["Fornecedor", "Função", "Dados envolvidos"]}
          rows={[
            ["Lovable Cloud (infraestrutura baseada em Supabase)", "Hospedagem do site, banco de dados, autenticação, armazenamento de arquivos, funções de servidor e envio de e-mails da conta.", "Todos os dados da plataforma, armazenados em nuvem."],
            ["OpenAI e Google (Gemini), acessados diretamente ou pelo gateway de IA da Lovable", "Gerar e editar textos, falas e imagens e responder no chat de suporte.", "O que você escreve no formulário, no assistente de edição e no suporte, além do conteúdo das apresentações necessário para a tarefa."],
            ["Pexels", "Banco de fotos e vídeos.", "Termos de busca derivados do tema do slide, sem dados da sua conta."],
            ["Cakto", "Checkout, cobrança, renovação e reembolso.", "Dados do pedido e do pagamento. A Cakto é controladora dos dados que coleta no checkout."],
            ["Google", "Login com Google (se você escolher) e fontes tipográficas (Google Fonts).", "Dados de login e, ao carregar as fontes, o seu IP e navegador."],
            ["Aplicativos que você conectar", "Assistentes de IA e outros aplicativos que você autorizar a acessar sua conta (seção 15 dos Termos).", "Apresentações e saldo de créditos, no limite da autorização dada."],
          ]}
        />
        <Clause n="5.1">
          Também podemos compartilhar dados para cumprir obrigação legal, ordem judicial ou requisição de autoridade
          competente, e em operações societárias (fusão, aquisição), mantidas as proteções desta Política.
        </Clause>
        <Clause n="5.2">
          O acesso interno é restrito a pessoas autorizadas, para suporte, segurança e operação, e fica sujeito a dever de
          confidencialidade.
        </Clause>
        <Clause n="5.3">
          Apresentações publicadas e portfólios públicos são acessíveis a qualquer pessoa com o link, por escolha sua (Termos,
          seção 12).
        </Clause>
      </LegalSection>

      <LegalSection id="transferencia" title="6. Transferência internacional">
        <p>
          Os fornecedores de infraestrutura e de IA processam dados em servidores fora do Brasil, principalmente nos Estados
          Unidos. Essas transferências ocorrem para executar o contrato com você (LGPD, art. 33, IX) e com as garantias
          contratuais oferecidas por esses fornecedores (art. 33, II), observada a regulamentação da Autoridade Nacional de
          Proteção de Dados (ANPD).
        </p>
      </LegalSection>

      <LegalSection id="retencao" title="7. Por quanto tempo guardamos">
        <LegalTable
          head={["Dados", "Prazo"]}
          rows={[
            ["Conta, perfil e apresentações", "Enquanto a conta existir. Após a exclusão da conta, eliminados em até 30 dias, e as cópias de segurança são sobrescritas no ciclo seguinte."],
            ["Apresentações na lixeira", "Saem do painel e das áreas públicas. Continuam guardadas até a exclusão definitiva, que você pode pedir a qualquer momento, ou até a exclusão da conta."],
            ["Mensagens de suporte", "Enquanto a conta existir."],
            ["Registros de acesso (IP, data e hora)", "6 meses, como exige o Marco Civil da Internet. Depois são eliminados automaticamente."],
            ["Diagnóstico, eventos de segurança, registros de geração e visitas a apresentações publicadas", "12 meses. Depois são eliminados automaticamente; o número de visualizações continua na apresentação."],
            ["Pedidos e pagamentos recebidos da Cakto", "5 anos após a transação, para obrigações fiscais e defesa em processos."],
            ["Extrato de créditos", "Enquanto a conta existir."],
            ["Registros de aceite dos Termos e da Política", "Enquanto a conta existir e por até 5 anos após o seu encerramento."],
          ]}
        />
        <p className="text-sm">
          Guardar dados além desses prazos só ocorre quando a lei exige ou para cumprir ordem judicial.
        </p>
      </LegalSection>

      <LegalSection id="direitos" title="8. Seus direitos">
        <p>Pela LGPD (art. 18), você pode pedir a qualquer momento, sem custo:</p>
        <LegalList>
          <li>confirmação de que tratamos seus dados e acesso a eles;</li>
          <li>correção de dados incompletos, inexatos ou desatualizados (vários podem ser corrigidos no próprio Perfil);</li>
          <li>anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a lei;</li>
          <li>portabilidade dos dados a outro fornecedor, em formato estruturado;</li>
          <li>eliminação dos dados tratados com base no seu consentimento e exclusão da conta;</li>
          <li>informação sobre com quem compartilhamos seus dados;</li>
          <li>informação sobre a possibilidade de não consentir e suas consequências, e revogação do consentimento;</li>
          <li>oposição a tratamento feito com base em legítimo interesse, se descumprir a lei;</li>
          <li>revisão de decisões tomadas apenas com base em tratamento automatizado (seção 9).</li>
        </LegalList>
        <Clause n="8.1">
          <Strong>Como pedir:</Strong> escreva para{" "}
          <a href={`mailto:${LEGAL.privacyEmail}`} className="text-primary hover:underline">{LEGAL.privacyEmail}</a> a
          partir do e-mail da conta, ou abra um atendimento no suporte. Para proteger seus dados, podemos confirmar sua
          identidade antes de atender.
        </Clause>
        <Clause n="8.2">
          <Strong>Prazos:</Strong> confirmação e acesso em formato simplificado, de imediato. Declaração completa (origem,
          critérios e finalidade), em até 15 dias (LGPD, art. 19). Os demais pedidos são atendidos no menor prazo possível,
          e informamos se algum dado precisar ser mantido por obrigação legal.
        </Clause>
        <Clause n="8.3">
          Você também pode exportar suas apresentações a qualquer momento, em PowerPoint ou PDF, direto no editor.
        </Clause>
        <Clause n="8.4">
          Se não ficar satisfeito com nossa resposta, você pode apresentar petição à ANPD (gov.br/anpd).
        </Clause>
      </LegalSection>

      <LegalSection id="decisoes-automatizadas" title="9. Decisões automatizadas">
        <p>Alguns processos da plataforma são automáticos:</p>
        <LegalList>
          <li>a verificação de saldo e de limites de uso antes de uma geração;</li>
          <li>bloqueios temporários por excesso de tentativas ou suspeita de abuso;</li>
          <li>a triagem do chat de suporte, que decide quando encaminhar o atendimento a uma pessoa da equipe.</li>
        </LegalList>
        <p>
          Você pode pedir a revisão de qualquer uma dessas decisões por uma pessoa da equipe (LGPD, art. 20), pelo canal do
          titular.
        </p>
      </LegalSection>

      <LegalSection id="seguranca" title="10. Segurança e incidentes">
        <Clause n="10.1">
          Adotamos medidas técnicas e administrativas proporcionais aos riscos (LGPD, art. 46). Entre elas:
        </Clause>
        <LegalList>
          <li>criptografia em trânsito (HTTPS/TLS) e em repouso na infraestrutura de nuvem;</li>
          <li>controle de acesso por linha no banco de dados, para que cada conta veja só os próprios dados;</li>
          <li>senhas nunca guardadas em texto aberto;</li>
          <li>campos de cobrança protegidos contra alteração pelo navegador;</li>
          <li>remoção automática de dados sensíveis dos registros de erro;</li>
          <li>limites de uso e registro de eventos de segurança.</li>
        </LegalList>
        <Clause n="10.2">
          Nenhum sistema é totalmente imune a falhas. Se ocorrer um incidente de segurança que possa acarretar risco ou dano
          relevante, comunicaremos a ANPD e os titulares afetados nos prazos da regulamentação (LGPD, art. 48). A comunicação
          dirá o que aconteceu, quais dados foram envolvidos e o que está sendo feito.
        </Clause>
      </LegalSection>

      <LegalSection id="criancas" title="11. Crianças e adolescentes">
        <p>
          O {LEGAL.brand} não se destina a menores de 12 anos e não coleta intencionalmente dados de crianças. Adolescentes de
          12 a 17 anos só devem usar o serviço com autorização e supervisão dos pais ou responsáveis. O tratamento de dados
          de adolescentes considera o seu melhor interesse (LGPD, art. 14). Se identificarmos uma conta de criança, ela será
          encerrada e os dados eliminados. Responsáveis podem pedir a exclusão pelo canal do titular.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="12. Cookies e armazenamento local">
        <Clause n="12.1">
          O {LEGAL.brand} <Strong>não usa cookies de publicidade, de perfilamento nem ferramentas de análise de terceiros</Strong>.
          Usamos apenas o armazenamento do navegador necessário para o funcionamento do site:
        </Clause>
        <LegalTable
          head={["Item", "Tipo", "Para quê", "Duração"]}
          rows={[
            [<code key="a">sb-…-auth-token</code>, "Armazenamento local (necessário)", "Manter você conectado com segurança.", "Até sair da conta ou a sessão expirar"],
            [<code key="b">slideai_session_id</code>, "Armazenamento de sessão (necessário)", "Relacionar erros de uma mesma visita, para o suporte diagnosticar problemas.", "Até fechar a aba"],
            [<code key="c">slideai:edit-usage:…</code>, "Armazenamento local (funcional)", "Mostrar rapidamente quantas edições por IA você já usou em cada apresentação. O valor oficial fica no servidor.", "Até limpar os dados do navegador"],
            [<code key="d">slideai-renewal-…</code>, "Armazenamento local (funcional)", "Evitar repetir o aviso de renovação no mesmo dia.", "Até limpar os dados do navegador"],
            [<code key="e">slideai.devSettings</code>, "Armazenamento local (funcional)", "Preferências internas, só para contas da equipe.", "Até limpar os dados do navegador"],
          ]}
        />
        <Clause n="12.2">
          Como esses itens são estritamente necessários ou apenas funcionais, não pedimos consentimento para eles. Você pode
          apagá-los nas configurações do navegador, mas ficará desconectado.
        </Clause>
        <Clause n="12.3">
          Serviços de terceiros usados pelo site podem registrar dados de acesso sob suas próprias políticas: o Google Fonts
          ao carregar as fontes e a Cakto na página de pagamento, que fica no domínio dela.
        </Clause>
      </LegalSection>

      <LegalSection id="alteracoes" title="13. Alterações desta política">
        <p>
          Podemos atualizar esta Política para refletir mudanças no serviço ou na lei. Mudanças relevantes serão avisadas por
          e-mail e na plataforma e, quando necessário, pediremos um novo aceite. A versão e a data de vigência ficam no topo
          desta página.
        </p>
      </LegalSection>

      <LegalSection id="contato" title="14. Contato e encarregado">
        <p>
          Canal do titular:{" "}
          <a href={`mailto:${LEGAL.privacyEmail}`} className="text-primary hover:underline">{LEGAL.privacyEmail}</a>
          {LEGAL.dpoName && <> — encarregado: <Strong>{LEGAL.dpoName}</Strong></>}. Outros assuntos:{" "}
          <a href={`mailto:${LEGAL.supportEmail}`} className="text-primary hover:underline">{LEGAL.supportEmail}</a>.
        </p>
        {supplier.length > 0 && (
          <p className="text-sm">
            {supplier.map((line) => <span key={line} className="block">{line}</span>)}
          </p>
        )}
      </LegalSection>
    </LegalLayout>
  );
};

export default Privacy;
