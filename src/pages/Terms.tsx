import { Link } from "react-router-dom";
import { Callout, Clause, LegalLayout, LegalList, LegalSection, LegalTable, Strong, type TocItem } from "@/components/legal/LegalLayout";
import { LEGAL, operatorName, supplierLines } from "@/lib/legal";
import {
  CREDITS_PER_SLIDE,
  DEPTH_CREDITS,
  PLAN_MONTHLY_CREDITS,
  PLAN_PRICES,
  PLAN_SIGNUP_BONUS,
  SINGLE_PURCHASE_CREDITS,
  SPEECHES_CREDITS,
} from "@/lib/cakto";
import {
  AI_IMAGES_PER_HOUR,
  CHAT_COMPLEX_EDITS_PER_PRESENTATION,
  CHAT_EDIT_MESSAGES_PER_PRESENTATION,
  FAIR_USE_HOURLY_GENERATIONS,
  FAIR_USE_MAX_MONTHLY_CREDITS,
  SPEECH_REGENS_PER_PRESENTATION,
} from "@/lib/fairUse";

const fmt = (n: number) => n.toLocaleString("pt-BR");

const TOC: TocItem[] = [
  { id: "resumo", label: "Resumo" },
  { id: "aceitacao", label: "1. Quem somos e aceitação" },
  { id: "definicoes", label: "2. Definições" },
  { id: "servico", label: "3. O serviço" },
  { id: "conta", label: "4. Cadastro e conta" },
  { id: "creditos", label: "5. Créditos" },
  { id: "planos", label: "6. Planos, preços e pagamento" },
  { id: "cancelamento", label: "7. Cancelamento" },
  { id: "arrependimento", label: "8. Arrependimento e reembolsos" },
  { id: "uso-justo", label: "9. Uso justo e limites técnicos" },
  { id: "ia", label: "10. Conteúdo gerado por IA" },
  { id: "propriedade", label: "11. Seu conteúdo e propriedade intelectual" },
  { id: "publicacao", label: "12. Publicação e portfólio" },
  { id: "condutas", label: "13. Condutas proibidas" },
  { id: "denuncias", label: "14. Denúncias e remoção de conteúdo" },
  { id: "integracoes", label: "15. Integrações e serviços de terceiros" },
  { id: "disponibilidade", label: "16. Disponibilidade e suporte" },
  { id: "encerramento", label: "17. Suspensão e encerramento" },
  { id: "responsabilidade", label: "18. Responsabilidades" },
  { id: "dados", label: "19. Privacidade e proteção de dados" },
  { id: "comunicacoes", label: "20. Comunicações" },
  { id: "alteracoes", label: "21. Alterações destes Termos" },
  { id: "foro", label: "22. Lei aplicável e foro" },
  { id: "gerais", label: "23. Disposições gerais" },
  { id: "contato", label: "24. Contato" },
];

const Terms = () => {
  const supplier = supplierLines();
  const maxDecksAtFairUse = Math.floor(FAIR_USE_MAX_MONTHLY_CREDITS / (10 * CREDITS_PER_SLIDE + DEPTH_CREDITS.balanced));

  return (
    <LegalLayout
      title="Termos de Uso"
      seoTitle="Termos de Uso — SlideAI"
      description="Condições de uso do SlideAI: créditos, planos, renovação, cancelamento, direito de arrependimento, uso justo, conteúdo gerado por IA, propriedade intelectual e responsabilidades."
      path="/termos"
      version={LEGAL.termsVersion}
      effectiveDate={LEGAL.effectiveDateLabel}
      toc={TOC}
      intro={
        <>
          <p>
            Estes Termos de Uso regulam o acesso e o uso do {LEGAL.brand}, plataforma que cria apresentações com
            inteligência artificial, disponível em {LEGAL.site.replace("https://", "")}. Leia com atenção: ao criar uma
            conta, comprar créditos ou assinar um plano, você concorda com estas condições e com a{" "}
            <Link to="/privacidade" className="text-primary hover:underline">Política de Privacidade</Link>.
          </p>
          <p>
            As cláusulas que limitam direitos estão destacadas, como exige o Código de Defesa do Consumidor (art. 54, § 4º).
          </p>
        </>
      }
    >
      <section id="resumo" className="scroll-mt-28">
        <Callout title="Resumo das condições principais">
          <LegalList>
            <li>
              Cada apresentação custa <Strong>{CREDITS_PER_SLIDE} créditos por slide</Strong>, mais a profundidade do texto
              (curto {DEPTH_CREDITS.short}, equilibrado {DEPTH_CREDITS.balanced}, longo {DEPTH_CREDITS.long}) e{" "}
              {SPEECHES_CREDITS} créditos se você ativar as falas dos apresentadores. O custo aparece antes de gerar.
            </li>
            <li>Se uma geração falhar por problema nosso, os créditos voltam para a sua conta.</li>
            <li>
              <Strong>Assinaturas renovam automaticamente</Strong> ao fim de cada período. Você pode cancelar quando quiser,
              sem multa, e mantém o acesso até o fim do período pago.
            </li>
            <li>
              <Strong>Direito de arrependimento:</Strong> até 7 dias corridos após a compra, com reembolso integral.
            </li>
            <li>
              <Strong>O plano MAX é de uso ilimitado dentro da Política de Uso Justo</Strong>: até{" "}
              {fmt(FAIR_USE_MAX_MONTHLY_CREDITS)} créditos por ciclo mensal e {FAIR_USE_HOURLY_GENERATIONS} gerações por hora.
            </li>
            <li>
              <Strong>Conteúdo gerado por IA pode conter erros.</Strong> Revise antes de apresentar ou publicar; o uso que
              você faz do resultado é de sua responsabilidade.
            </li>
            <li>O que você envia continua seu, e você pode usar o que gerar, inclusive comercialmente.</li>
            <li>Suas apresentações são privadas até você decidir publicá-las.</li>
          </LegalList>
        </Callout>
      </section>

      <LegalSection id="aceitacao" title="1. Quem somos e aceitação">
        <Clause n="1.1">
          O {LEGAL.brand} é operado por <Strong>{operatorName()}</Strong>
          {supplier.length > 1 && <> ({supplier.slice(1).join(", ")})</>}, que neste documento chamamos de
          "{LEGAL.brand}", "nós" ou "nosso". Nosso canal de atendimento é{" "}
          <a href={`mailto:${LEGAL.supportEmail}`} className="text-primary hover:underline">{LEGAL.supportEmail}</a>.
        </Clause>
        <Clause n="1.2">
          Ao marcar a caixa de aceite no cadastro, confirmar o aviso de atualização destes Termos ou concluir um pagamento,
          você declara que leu, entendeu e concorda com estes Termos. Registramos a versão aceita, a data, a hora e o
          endereço IP do aceite, como prova da contratação eletrônica.
        </Clause>
        <Clause n="1.3">
          Se você usa o {LEGAL.brand} em nome de uma empresa ou instituição, declara ter poderes para aceitar estes Termos
          em nome dela, que também fica obrigada por eles.
        </Clause>
        <Clause n="1.4">
          Se você não concorda com estes Termos, não use o serviço.
        </Clause>
      </LegalSection>

      <LegalSection id="definicoes" title="2. Definições">
        <LegalList>
          <li><Strong>Conta:</Strong> seu cadastro pessoal e intransferível no {LEGAL.brand}.</li>
          <li><Strong>Apresentação:</Strong> o conjunto de slides criado, editado ou armazenado na sua Conta.</li>
          <li><Strong>Conteúdo do Usuário:</Strong> tudo o que você envia ao serviço, como temas, descrições, textos, nomes, links de imagens e mensagens.</li>
          <li><Strong>Resultado:</Strong> o que o serviço gera a partir do Conteúdo do Usuário, como textos, estrutura, falas, imagens e layout.</li>
          <li><Strong>Créditos:</Strong> unidades de uso consumidas nas gerações, conforme a seção 5.</li>
          <li><Strong>Cota mensal:</Strong> créditos que um plano de assinatura concede a cada ciclo mensal.</li>
          <li><Strong>Bônus:</Strong> créditos permanentes, vindos de compras avulsas, do bônus de ativação ou de promoções.</li>
          <li><Strong>Período pago:</Strong> o intervalo coberto pelo último pagamento de uma assinatura (um mês, um trimestre ou um ano).</li>
        </LegalList>
      </LegalSection>

      <LegalSection id="servico" title="3. O serviço">
        <Clause n="3.1">
          O {LEGAL.brand} gera apresentações a partir das instruções que você fornece, usando modelos de inteligência
          artificial de terceiros, bancos de imagens e recursos próprios de design. Você pode editar o resultado, apresentar
          pelo navegador, exportar (PowerPoint, PDF e imagem) e publicar por link.
        </Clause>
        <Clause n="3.2">
          O serviço é oferecido "como está disponível". Melhoramos a plataforma continuamente e podemos alterar, incluir ou
          retirar funcionalidades. Mudanças que reduzam de forma relevante o que você contratou seguem a seção 21.
        </Clause>
        <Clause n="3.3">
          Não garantimos que o Resultado atenda a uma finalidade específica, como aprovação em avaliação, banca, concurso ou
          negociação. Você escolhe como usar o Resultado.
        </Clause>
      </LegalSection>

      <LegalSection id="conta" title="4. Cadastro e conta">
        <Clause n="4.1">
          Para gerar apresentações é preciso criar uma Conta com dados verdadeiros e atualizados, por e-mail e senha ou pelo
          login do Google.
        </Clause>
        <Clause n="4.2">
          <Strong>Idade mínima.</Strong> O {LEGAL.brand} não se destina a menores de 12 anos. Adolescentes de 12 a 17 anos só
          podem usar o serviço com autorização e supervisão dos pais ou responsáveis legais, a quem cabe qualquer compra ou
          assinatura. Se soubermos que uma Conta pertence a uma criança, ela será encerrada e os dados, eliminados.
        </Clause>
        <Clause n="4.3">
          A Conta é pessoal. <Strong>Não é permitido compartilhar o acesso, vender ou transferir a Conta</Strong>, nem usar
          uma única Conta para várias pessoas.
        </Clause>
        <Clause n="4.4">
          Você é responsável por manter sua senha em sigilo e pelas atividades feitas na sua Conta. Avise-nos imediatamente
          em caso de suspeita de acesso indevido. Nunca pedimos senha, código de verificação ou dados completos de cartão por
          e-mail ou chat.
        </Clause>
      </LegalSection>

      <LegalSection id="creditos" title="5. Créditos">
        <Clause n="5.1">
          <Strong>Natureza.</Strong> Créditos são unidades de uso do serviço. Não são moeda, não têm valor monetário, não
          rendem juros e não podem ser transferidos para outra Conta, trocados por dinheiro ou revendidos.
        </Clause>
        <Clause n="5.2">
          <Strong>Custo de uma geração.</Strong> O custo é calculado e exibido antes de você confirmar:
        </Clause>
        <LegalTable
          head={["Item", "Créditos"]}
          rows={[
            ["Cada slide (de 5 a 20 por apresentação)", fmt(CREDITS_PER_SLIDE)],
            ["Profundidade do texto: curto", fmt(DEPTH_CREDITS.short)],
            ["Profundidade do texto: equilibrado", fmt(DEPTH_CREDITS.balanced)],
            ["Profundidade do texto: longo", fmt(DEPTH_CREDITS.long)],
            ["Falas dos apresentadores (opcional)", fmt(SPEECHES_CREDITS)],
          ]}
        />
        <p className="text-sm">
          Exemplos: 5 slides com texto curto custam {5 * CREDITS_PER_SLIDE + DEPTH_CREDITS.short} créditos; 10 slides
          equilibrados, {10 * CREDITS_PER_SLIDE + DEPTH_CREDITS.balanced}; 10 slides equilibrados com falas,{" "}
          {10 * CREDITS_PER_SLIDE + DEPTH_CREDITS.balanced + SPEECHES_CREDITS}. Hoje, edições manuais, exportações, imagens e
          as edições pelo assistente de IA, dentro dos limites da seção 9, não consomem créditos.
        </p>
        <Clause n="5.3">
          <Strong>Momento da cobrança.</Strong> Os créditos são debitados quando a geração começa. Se a geração falhar por
          problema técnico nosso, os créditos daquela tentativa são devolvidos automaticamente. Se a devolução não aparecer
          no seu extrato, peça ao suporte, que fará o acerto.
        </Clause>
        <Clause n="5.4">
          <Strong>Ordem de consumo.</Strong> A cota mensal é usada primeiro e o bônus por último.
        </Clause>
        <Clause n="5.5">
          <Strong>A cota mensal não acumula.</Strong> A cada ciclo mensal ela volta ao valor do plano, e o saldo que sobrou
          do ciclo anterior não é somado. O ciclo começa na data da ativação ou da última renovação da assinatura. Nos planos
          trimestral e anual, a cota também renova todo mês.
        </Clause>
        <Clause n="5.6">
          <Strong>O bônus é permanente.</Strong> Créditos de compras avulsas, o bônus de ativação e créditos promocionais não
          expiram enquanto a Conta existir. Eles continuam utilizáveis depois do fim de uma assinatura. São perdidos com a
          exclusão da Conta, e os de um pedido reembolsado são cancelados (seção 8).
        </Clause>
        <Clause n="5.7">
          Podemos ajustar a tabela de custos. Aumentos serão comunicados com pelo menos 30 dias de antecedência e não se
          aplicam a gerações já iniciadas.
        </Clause>
        <Clause n="5.8">
          O saldo e o extrato completo de créditos ficam em Perfil → Créditos.
        </Clause>
      </LegalSection>

      <LegalSection id="planos" title="6. Planos, preços e pagamento">
        <Clause n="6.1">Oferecemos as seguintes modalidades:</Clause>
        <LegalTable
          head={["Plano", "Preço", "Créditos"]}
          rows={[
            ["Geração única (avulso)", PLAN_PRICES.single, `${fmt(SINGLE_PURCHASE_CREDITS)} créditos permanentes, sem renovação`],
            ["PRO mensal", PLAN_PRICES.mensal, `${fmt(PLAN_MONTHLY_CREDITS.mensal)} por mês + bônus de ativação de ${fmt(PLAN_SIGNUP_BONUS.mensal)}`],
            ["PRO trimestral", PLAN_PRICES.trimestral, `${fmt(PLAN_MONTHLY_CREDITS.trimestral)} por mês + bônus de ativação de ${fmt(PLAN_SIGNUP_BONUS.trimestral)}`],
            ["PRO anual", PLAN_PRICES.anual, `${fmt(PLAN_MONTHLY_CREDITS.anual)} por mês + bônus de ativação de ${fmt(PLAN_SIGNUP_BONUS.anual)}`],
            ["MAX mensal", PLAN_PRICES.max_mensal, "Uso ilimitado dentro do uso justo (seção 9)"],
            ["MAX trimestral", PLAN_PRICES.max_trimestral, "Uso ilimitado dentro do uso justo (seção 9)"],
            ["MAX anual", PLAN_PRICES.max_anual, "Uso ilimitado dentro do uso justo (seção 9)"],
          ]}
        />
        <Clause n="6.2">
          Os preços estão em reais e são confirmados na página de pagamento antes da compra. O preço contratado vale até o
          fim do período pago.
        </Clause>
        <Clause n="6.3">
          <Strong>Intermediador de pagamento.</Strong> Os pagamentos são processados pela Cakto, com os meios exibidos no
          checkout (como cartão de crédito e Pix). As condições do meio de pagamento, como parcelamento e prazos de
          compensação, são as informadas pela Cakto. O {LEGAL.brand} não recebe nem armazena o número do seu cartão.
        </Clause>
        <Clause n="6.4">
          <Strong>Renovação automática.</Strong> As assinaturas renovam automaticamente ao fim de cada período, pelo mesmo
          meio de pagamento, até que você cancele. Avisamos na plataforma quando faltam 5 dias ou menos para a renovação.
        </Clause>
        <Clause n="6.5">
          <Strong>Reajuste.</Strong> Mudanças de preço serão comunicadas com pelo menos 30 dias de antecedência e só valem a
          partir da renovação seguinte. Se não concordar, você pode cancelar antes da renovação.
        </Clause>
        <Clause n="6.6">
          <Strong>Pagamento não aprovado.</Strong> Se a renovação não for paga, o acesso à cota do plano termina no fim do
          período pago. Seu bônus e suas apresentações continuam na Conta.
        </Clause>
        <Clause n="6.7">
          <Strong>Bônus de ativação.</Strong> O bônus de ativação das assinaturas PRO é concedido uma única vez por Conta,
          na primeira assinatura. Renovações, trocas de plano e novas assinaturas não geram um novo bônus.
        </Clause>
        <Clause n="6.8">
          <Strong>Troca de plano.</Strong> Ao contratar outro plano, a cota passa a ser a do novo plano a partir da
          confirmação do pagamento. <Strong>A assinatura anterior não é cancelada automaticamente</Strong>: cancele-a para
          evitar uma nova cobrança (seção 7).
        </Clause>
        <Clause n="6.9">
          O comprovante de pagamento é enviado pela Cakto. A nota fiscal, quando aplicável, é emitida conforme a legislação
          tributária e pode ser solicitada ao suporte.
        </Clause>
      </LegalSection>

      <LegalSection id="cancelamento" title="7. Cancelamento">
        <Clause n="7.1">
          Você pode cancelar a renovação da assinatura a qualquer momento, sem multa e sem fidelidade mínima, pela área do
          cliente da Cakto, pelo botão "Cancelar" em Perfil → Assinatura ou pelo e-mail{" "}
          <a href={`mailto:${LEGAL.supportEmail}`} className="text-primary hover:underline">{LEGAL.supportEmail}</a>.
          Confirmamos o pedido pelo mesmo canal.
        </Clause>
        <Clause n="7.2">
          <Strong>Com o cancelamento, a assinatura não renova mais</Strong>, mas você continua com o acesso e a cota mensal
          até o fim do período pago. Depois disso, o bônus continua disponível e as apresentações continuam na Conta.
        </Clause>
        <Clause n="7.3">
          <Strong>O período em curso não é reembolsado de forma proporcional</Strong>. As exceções são o direito de
          arrependimento (seção 8), a falha na prestação do serviço e o encerramento do serviço por iniciativa nossa (seção
          16.4).
        </Clause>
      </LegalSection>

      <LegalSection id="arrependimento" title="8. Direito de arrependimento e reembolsos">
        <Clause n="8.1">
          <Strong>Arrependimento.</Strong> Como a contratação é feita pela internet, você pode desistir em até{" "}
          <Strong>7 dias corridos</Strong> contados da compra avulsa ou do primeiro pagamento de uma assinatura, sem precisar
          justificar (Código de Defesa do Consumidor, art. 49). O reembolso é integral.
        </Clause>
        <Clause n="8.2">
          Para exercer o direito, escreva para{" "}
          <a href={`mailto:${LEGAL.supportEmail}`} className="text-primary hover:underline">{LEGAL.supportEmail}</a> ou abra
          um atendimento no suporte. Informe o e-mail da Conta e, se tiver, o código do pedido. Confirmamos o recebimento de
          imediato e processamos o pedido com a Cakto.
        </Clause>
        <Clause n="8.3">
          O reembolso é feito pelo mesmo meio de pagamento. No cartão de crédito, o estorno aparece conforme o calendário da
          operadora, geralmente em até duas faturas.
        </Clause>
        <Clause n="8.4">
          <Strong>Efeitos do reembolso.</Strong> Os créditos concedidos pelo pedido reembolsado são cancelados. No caso de
          assinatura, ela é encerrada na hora, com a cota mensal. Os créditos daquele pedido que você já tiver usado não
          geram cobrança adicional.
        </Clause>
        <Clause n="8.5">
          <Strong>Outros reembolsos.</Strong> Cobranças duplicadas, indevidas ou não reconhecidas são analisadas pelo suporte
          e, se confirmadas, devolvidas integralmente. Falhas de geração seguem a cláusula 5.3.
        </Clause>
        <Clause n="8.6">
          <Strong>Contestação no cartão (chargeback).</Strong> Recomendamos falar primeiro com o suporte, que resolve mais
          rápido. Uma contestação aberta tem os mesmos efeitos de um reembolso sobre os créditos do pedido. Se houver indício
          de fraude, a Conta pode ser suspensa preventivamente durante a análise.
        </Clause>
      </LegalSection>

      <LegalSection id="uso-justo" title="9. Uso justo e limites técnicos">
        <Clause n="9.1">
          Os limites abaixo existem para manter a plataforma estável e disponível para todos. Eles valem para todas as
          Contas, com as ressalvas indicadas.
        </Clause>
        <LegalTable
          head={["Recurso", "Limite"]}
          rows={[
            ["Novas gerações", `${FAIR_USE_HOURLY_GENERATIONS} por hora, por Conta`],
            ["Plano MAX (uso ilimitado)", `Até ${fmt(FAIR_USE_MAX_MONTHLY_CREDITS)} créditos por ciclo mensal, cerca de ${fmt(maxDecksAtFairUse)} apresentações de 10 slides`],
            ["Assistente de edição por IA", `${CHAT_EDIT_MESSAGES_PER_PRESENTATION} mensagens e ${CHAT_COMPLEX_EDITS_PER_PRESENTATION} edições complexas por apresentação`],
            ["Regenerar falas", `${SPEECH_REGENS_PER_PRESENTATION} vezes por apresentação, só em apresentações com falas contratadas`],
            ["Imagens por IA sob demanda, no editor", `${AI_IMAGES_PER_HOUR} por hora, por Conta`],
          ]}
        />
        <Clause n="9.2">
          <Strong>O plano MAX é de uso ilimitado para uma pessoa</Strong>, dentro do limite de uso justo acima. Ele é dez
          vezes maior que a cota do PRO e cobre com folga o uso profissional intenso. Atingido o limite, novas gerações ficam
          pausadas até a próxima renovação da cota, e a plataforma mostra a data. Você pode continuar usando créditos
          avulsos, se tiver. Nunca cobramos valor extra automaticamente.
        </Clause>
        <Clause n="9.3">
          Uso automatizado não autorizado, compartilhamento de Conta ou revenda de acesso violam estes Termos (seção 13) e
          podem levar à suspensão. Os limites da seção 9.1 podem ser revistos, com aviso prévio de 30 dias quando a mudança
          for para menos.
        </Clause>
      </LegalSection>

      <LegalSection id="ia" title="10. Conteúdo gerado por inteligência artificial">
        <Callout tone="warning" title="Revise sempre o Resultado">
          <p>
            Modelos de IA geram texto e imagens por probabilidade. O Resultado pode conter <Strong>informações erradas,
            desatualizadas ou inventadas</Strong>, como dados, citações, datas e referências. Ele também pode refletir vieses
            ou se parecer com conteúdos gerados para outras pessoas.
          </p>
        </Callout>
        <Clause n="10.1">
          Você é responsável por revisar o Resultado antes de apresentá-lo, publicá-lo ou usá-lo em qualquer decisão. O
          Resultado <Strong>não é aconselhamento profissional</Strong> (jurídico, médico, financeiro, contábil ou de outra
          natureza).
        </Clause>
        <Clause n="10.2">
          Para gerar o Resultado, o Conteúdo do Usuário é enviado a provedores de IA contratados por nós, nos termos da
          Política de Privacidade. <Strong>Não envie dados pessoais sensíveis</Strong> (saúde, religião, orientação sexual,
          biometria etc.), dados de terceiros sem base legal nem informações confidenciais que você não possa compartilhar
          com esses provedores.
        </Clause>
        <Clause n="10.3">
          O {LEGAL.brand} não usa o seu Conteúdo nem suas apresentações para treinar modelos de IA.
        </Clause>
        <Clause n="10.4">
          Os provedores de IA aplicam filtros de segurança, e alguns temas podem ser recusados. Uma recusa desse tipo não é
          falha do serviço, e os créditos da tentativa são devolvidos.
        </Clause>
        <Clause n="10.5">
          Não há exclusividade: pedidos parecidos, seus ou de outras pessoas, podem gerar resultados semelhantes.
        </Clause>
      </LegalSection>

      <LegalSection id="propriedade" title="11. Seu conteúdo e propriedade intelectual">
        <Clause n="11.1">
          <Strong>O Conteúdo do Usuário é seu.</Strong> Você declara ter os direitos necessários sobre o que envia, incluindo
          textos, marcas, nomes e links de imagens de terceiros.
        </Clause>
        <Clause n="11.2">
          <Strong>O Resultado pode ser usado por você</Strong> para qualquer finalidade lícita, inclusive comercial. Na medida
          em que o {LEGAL.brand} tenha direitos sobre o Resultado, eles são cedidos a você, sem custo adicional. A legislação
          de direitos autorais (Lei 9.610/1998) protege criações humanas, e o Resultado gerado automaticamente pode não ter
          proteção autoral própria.
        </Clause>
        <Clause n="11.3">
          <Strong>Elementos de terceiros no Resultado</Strong> seguem as licenças de origem:
        </Clause>
        <LegalList>
          <li>
            Fotos e vídeos do Pexels seguem a licença do Pexels. Ela permite uso gratuito e comercial, mas não permite vender
            a imagem sem alteração nem usar pessoas identificáveis de forma ofensiva ou como se endossassem algo.
          </li>
          <li>Imagens geradas por IA seguem os termos do provedor que as gerou.</li>
          <li>Fontes tipográficas seguem suas licenças, em geral de uso livre (como as do Google Fonts).</li>
          <li>Imagens que você insere por link são de sua responsabilidade.</li>
        </LegalList>
        <Clause n="11.4">
          <Strong>Licença que você nos concede.</Strong> Para operar o serviço, você nos concede uma licença gratuita, não
          exclusiva e mundial para hospedar, processar, reproduzir, adaptar (por exemplo, converter para PowerPoint ou PDF) e
          transmitir o Conteúdo do Usuário e o Resultado aos nossos fornecedores, apenas para prestar o serviço a você. Se
          você publicar uma apresentação, a licença inclui exibi-la publicamente, com prévia de link, enquanto ela estiver
          publicada. Não usamos seu conteúdo em publicidade sem a sua autorização. A licença termina com a exclusão do
          conteúdo, ressalvadas cópias de segurança por prazo limitado e as obrigações legais.
        </Clause>
        <Clause n="11.5">
          <Strong>A plataforma é nossa.</Strong> O software, a marca {LEGAL.brand}, o design, os temas, os templates e a
          documentação pertencem a {operatorName()} ou a seus licenciantes. Você recebe uma licença pessoal, limitada, não
          exclusiva, intransferível e revogável para usar a plataforma conforme estes Termos. Isso não inclui copiar,
          descompilar ou fazer engenharia reversa do software.
        </Clause>
      </LegalSection>

      <LegalSection id="publicacao" title="12. Publicação, links públicos e portfólio">
        <Clause n="12.1">
          As apresentações são <Strong>privadas por padrão</Strong>. Ao publicar, a apresentação fica acessível a qualquer
          pessoa com o link, <Strong>incluindo as notas e as falas dos apresentadores</Strong> (é assim que coapresentadores
          acompanham suas partes). Ela pode aparecer no seu portfólio público e ser indexada por buscadores, e seu título e
          capa aparecem na prévia do link em aplicativos de mensagem e redes sociais. Não publique apresentações com
          informações confidenciais.
        </Clause>
        <Clause n="12.2">
          Você pode despublicar a qualquer momento, e o link deixa de abrir na hora. Não controlamos cópias que terceiros
          tenham feito nem prévias guardadas em cache por outras plataformas.
        </Clause>
        <Clause n="12.3">
          Ao abrir uma apresentação publicada, registramos a visita (data, hora e tipo de navegador) para mostrar ao autor o
          número de visualizações, sem identificar o visitante.
        </Clause>
        <Clause n="12.4">
          O perfil público e o portfólio são opcionais. Mostram apenas o que você preencher e as apresentações que você
          publicar, e podem ser tornados privados a qualquer momento.
        </Clause>
      </LegalSection>

      <LegalSection id="condutas" title="13. Condutas proibidas">
        <p>Não é permitido usar o {LEGAL.brand} para:</p>
        <LegalList>
          <li>criar ou divulgar conteúdo ilegal, incluindo qualquer conteúdo que sexualize crianças ou adolescentes;</li>
          <li>promover ódio, discriminação, violência, terrorismo, assédio ou ameaça contra pessoas ou grupos;</li>
          <li>criar desinformação capaz de causar dano, fraudes, golpes, phishing ou spam;</li>
          <li>
            criar conteúdo que se passe por outra pessoa ou organização, ou montagens enganosas de pessoas reais sem
            consentimento;
          </li>
          <li>violar direitos autorais, marcas, imagem, privacidade ou outros direitos de terceiros;</li>
          <li>inserir dados pessoais de terceiros sem base legal, ou dados sensíveis, em apresentações;</li>
          <li>
            burlar limites, cobranças ou controles de segurança, explorar falhas, sobrecarregar a infraestrutura ou acessar
            dados de outros usuários;
          </li>
          <li>
            automatizar o uso (robôs, scripts, raspagem de dados), exceto pelas integrações oficiais autorizadas por você
            (seção 15);
          </li>
          <li>compartilhar, alugar ou revender o acesso à Conta ou aos créditos;</li>
          <li>violar as políticas de uso dos provedores de IA que viabilizam o serviço.</li>
        </LegalList>
      </LegalSection>

      <LegalSection id="denuncias" title="14. Denúncias e remoção de conteúdo">
        <Clause n="14.1">
          Qualquer pessoa pode denunciar uma apresentação ou perfil público que viole a lei ou estes Termos pelo e-mail{" "}
          <a href={`mailto:${LEGAL.supportEmail}`} className="text-primary hover:underline">{LEGAL.supportEmail}</a>.
          Informe o link, o motivo e, se for o titular do direito violado, dados que permitam confirmar essa condição.
        </Clause>
        <Clause n="14.2">
          Analisamos as denúncias e podemos despublicar ou remover o conteúdo e, conforme a gravidade, suspender a Conta,
          observado o Marco Civil da Internet (Lei 12.965/2014) e a interpretação do Supremo Tribunal Federal. Conteúdo
          íntimo divulgado sem consentimento é removido após notificação do participante ou de seu representante (art. 21).
        </Clause>
        <Clause n="14.3">
          Sempre que possível e permitido por lei, avisamos o autor do conteúdo removido e o motivo, e ele pode pedir revisão
          da decisão pelo mesmo canal.
        </Clause>
        <Clause n="14.4">Cumprimos ordens judiciais e requisições de autoridades competentes nos termos da lei.</Clause>
      </LegalSection>

      <LegalSection id="integracoes" title="15. Integrações e serviços de terceiros">
        <Clause n="15.1">
          O serviço depende de terceiros, como o login do Google, a Cakto nos pagamentos, provedores de IA, o banco de imagens
          Pexels e a infraestrutura de nuvem. O uso desses serviços pode estar sujeito também aos termos deles.
        </Clause>
        <Clause n="15.2">
          <Strong>Aplicativos conectados.</Strong> Você pode autorizar assistentes de IA e outros aplicativos compatíveis a
          acessar sua Conta, por uma tela de consentimento do {LEGAL.brand}. Com isso eles podem listar, ler e atualizar suas
          apresentações e consultar seu saldo. O aplicativo age em seu nome e segue os termos do próprio fornecedor. Você
          pode revogar a autorização a qualquer momento.
        </Clause>
        <Clause n="15.3">
          Não respondemos por falhas ou indisponibilidade de serviços de terceiros fora do nosso controle. Quando houver
          impacto na sua cobrança ou nos seus créditos, faremos os acertos previstos nestes Termos.
        </Clause>
      </LegalSection>

      <LegalSection id="disponibilidade" title="16. Disponibilidade, suporte e mudanças no serviço">
        <Clause n="16.1">
          Buscamos manter o serviço disponível de forma contínua, mas podem ocorrer interrupções por manutenção, atualização,
          falhas de fornecedores, caso fortuito ou força maior.
        </Clause>
        <Clause n="16.2">
          O suporte funciona pelo chat de atendimento da plataforma, com assistente de IA e encaminhamento para a equipe, e
          pelo e-mail {LEGAL.supportEmail}. Respondemos em {LEGAL.supportResponseTime} e, em qualquer caso, dentro do prazo
          legal de 5 dias (Decreto 7.962/2013, art. 4º).
        </Clause>
        <Clause n="16.3">
          Recomendamos exportar periodicamente as apresentações importantes. O serviço não é um sistema de backup.
        </Clause>
        <Clause n="16.4">
          <Strong>Encerramento do serviço.</Strong> Se decidirmos encerrar o {LEGAL.brand}, avisaremos com pelo menos 30 dias
          de antecedência para você exportar suas apresentações. Também reembolsaremos, proporcionalmente, o período pago não
          utilizado das assinaturas.
        </Clause>
      </LegalSection>

      <LegalSection id="encerramento" title="17. Suspensão e encerramento da conta">
        <Clause n="17.1">
          <Strong>Por você.</Strong> Você pode pedir a exclusão da Conta pelo suporte ou pelo e-mail {LEGAL.privacyEmail}. A
          exclusão não cancela automaticamente uma assinatura: cancele-a antes (seção 7). Créditos e bônus restantes são
          perdidos com a exclusão.
        </Clause>
        <Clause n="17.2">
          <Strong>Por nós.</Strong> Em caso de violação destes Termos, podemos advertir, despublicar conteúdo, limitar
          funcionalidades ou suspender a Conta. Exceto em casos graves (atividade ilegal, fraude, risco a terceiros ou à
          plataforma), você será notificado antes e poderá corrigir a situação ou apresentar sua defesa.
        </Clause>
        <Clause n="17.3">
          O encerramento por violação grave não dá direito a reembolso do período em curso, ressalvados os direitos
          garantidos por lei.
        </Clause>
        <Clause n="17.4">
          Após o encerramento, os dados são eliminados ou guardados pelos prazos descritos na Política de Privacidade.
        </Clause>
      </LegalSection>

      <LegalSection id="responsabilidade" title="18. Responsabilidades">
        <Clause n="18.1">
          Respondemos pela prestação do serviço nos termos do Código de Defesa do Consumidor. Nada nestes Termos exclui ou
          limita direitos que a lei garante ao consumidor.
        </Clause>
        <Clause n="18.2">Não somos responsáveis por:</Clause>
        <LegalList>
          <li>o Conteúdo do Usuário e o uso que você faz do Resultado, inclusive decisões tomadas sem revisá-lo (seção 10);</li>
          <li>conteúdo de terceiros que você insere, como imagens por link, marcas e dados pessoais;</li>
          <li>acessos à sua Conta por falta de cuidado com as suas credenciais;</li>
          <li>falhas no seu equipamento, navegador ou conexão com a internet;</li>
          <li>caso fortuito ou força maior.</li>
        </LegalList>
        <Clause n="18.3">
          <Strong>Contratação por empresas.</Strong> Quando o serviço é contratado por pessoa jurídica para uso em sua
          atividade, sem vulnerabilidade técnica ou econômica que caracterize relação de consumo, nossa responsabilidade total
          fica limitada ao valor pago nos 12 meses anteriores ao fato, e excluídos lucros cessantes e danos indiretos, na
          máxima extensão permitida em lei.
        </Clause>
        <Clause n="18.4">
          Você responde pelos danos que causar ao {LEGAL.brand} ou a terceiros por violar estes Termos ou a lei, incluindo
          reclamações sobre o conteúdo que você enviou ou publicou.
        </Clause>
      </LegalSection>

      <LegalSection id="dados" title="19. Privacidade e proteção de dados">
        <Clause n="19.1">
          O tratamento de dados pessoais segue a Lei Geral de Proteção de Dados (Lei 13.709/2018) e está descrito na{" "}
          <Link to="/privacidade" className="text-primary hover:underline">Política de Privacidade</Link>, que faz parte
          destes Termos.
        </Clause>
        <Clause n="19.2">
          Para os dados da sua Conta, do pagamento e do uso da plataforma, o {LEGAL.brand} é o <Strong>controlador</Strong>.
        </Clause>
        <Clause n="19.3">
          Se você inserir dados pessoais de terceiros nas apresentações (por exemplo, nomes de clientes ou alunos), você é o
          controlador desses dados e deve ter base legal para usá-los. O {LEGAL.brand} atua como <Strong>operador</Strong>,
          tratando esses dados só para prestar o serviço e seguindo suas instruções expressas no uso da plataforma.
        </Clause>
      </LegalSection>

      <LegalSection id="comunicacoes" title="20. Comunicações">
        <Clause n="20.1">
          Os avisos sobre a Conta, cobranças e mudanças nestes Termos são enviados para o e-mail cadastrado e exibidos na
          plataforma, e valem como comunicação formal. Mantenha seu e-mail atualizado.
        </Clause>
        <Clause n="20.2">Não enviamos comunicações de marketing sem o seu consentimento.</Clause>
      </LegalSection>

      <LegalSection id="alteracoes" title="21. Alterações destes Termos">
        <Clause n="21.1">
          Podemos atualizar estes Termos. Mudanças relevantes serão avisadas com pelo menos 15 dias de antecedência, por
          e-mail e na plataforma. Quando necessário, pediremos um novo aceite no seu próximo acesso.
        </Clause>
        <Clause n="21.2">
          <Strong>As alterações não prejudicam o período já pago.</Strong> Se você não concordar com uma mudança que reduza
          seus direitos, pode cancelar a assinatura e receber o reembolso proporcional do período não utilizado.
        </Clause>
        <Clause n="21.3">
          A versão vigente fica sempre nesta página, com a data e o número da versão no topo.
        </Clause>
      </LegalSection>

      <LegalSection id="foro" title="22. Lei aplicável e foro">
        <Clause n="22.1">Estes Termos seguem as leis da República Federativa do Brasil.</Clause>
        <Clause n="22.2">
          Nas relações de consumo, é competente o foro do domicílio do consumidor (Código de Defesa do Consumidor, art. 101,
          I). Nas demais relações, fica eleito o foro da comarca da sede do {LEGAL.brand}
          {LEGAL.seatCity && <> ({LEGAL.seatCity})</>}.
        </Clause>
        <Clause n="22.3">
          Antes de medidas judiciais, pedimos que fale com o suporte. A maioria das questões se resolve rapidamente. Você
          também pode recorrer aos órgãos de defesa do consumidor.
        </Clause>
      </LegalSection>

      <LegalSection id="gerais" title="23. Disposições gerais">
        <Clause n="23.1">
          Estes Termos, a Política de Privacidade e as condições exibidas na contratação formam o acordo completo entre você
          e o {LEGAL.brand} sobre o serviço.
        </Clause>
        <Clause n="23.2">
          Se alguma cláusula for considerada inválida, as demais continuam valendo. Deixar de exigir um direito não significa
          renunciar a ele.
        </Clause>
        <Clause n="23.3">
          Podemos transferir este contrato em caso de reorganização societária, venda ou incorporação do negócio, mantidas as
          condições contratadas e com aviso prévio a você.
        </Clause>
        <Clause n="23.4">
          A contratação e o aceite eletrônicos são válidos e têm a mesma força de um documento assinado (MP 2.200-2/2001, art.
          10, § 2º).
        </Clause>
      </LegalSection>

      <LegalSection id="contato" title="24. Contato">
        <p>
          Dúvidas, pedidos e reclamações:{" "}
          <a href={`mailto:${LEGAL.supportEmail}`} className="text-primary hover:underline">{LEGAL.supportEmail}</a>, ou pelo
          chat de suporte dentro da plataforma. Assuntos de dados pessoais:{" "}
          <a href={`mailto:${LEGAL.privacyEmail}`} className="text-primary hover:underline">{LEGAL.privacyEmail}</a>.
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

export default Terms;
