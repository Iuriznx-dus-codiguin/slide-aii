# Análise de prontidão para lançamento (29/09/2026)

> **Atualização (04/10/2026):**
> - P0-1: o webhook da Cakto foi corrigido pelo dono e testado.
> - P0-2, P0-3 e P0-4: textos da página inicial corrigidos, depoimentos removidos e nota da oferta de volta (uso justo no card do MAX; renovação, cancelamento e arrependimento abaixo dos planos).
> - P0-6: e-mails pela Resend com modelos próprios; os de login seguem a mesma identidade ([operacao/emails.md](../operacao/emails.md)).
> - P0-7: estorno automático de gerações interrompidas.
> - P0-8: alertas por e-mail aos administradores (pagamento, falhas de geração, estornos). Monitor de disponibilidade, Sentry e teto de gasto na OpenAI continuam pendentes.
> - P0-5 (dados da empresa e caixa de suporte) e P0-9 (advogado e nota fiscal) continuam com o dono.

Esta análise avalia se o SlideAI está pronto para ir ao mercado. Cobre produto e MVP, coerência entre promessa e entrega, profissionalismo, segurança, escalabilidade, previsibilidade de custos e operação.

**Base usada:**
- o banco de produção em 29/09/2026 (usuários, gerações, logs de custo e de tokens, eventos de pagamento, storage);
- o código em `main` (55f57d8), depois do deploy de 29/09 às 00:22 UTC;
- um build de produção medido localmente, inclusive em celular (390 px).

**Prioridades:**
- **P0** bloqueia o lançamento;
- **P1** deve ser feito em até 30 dias ou antes de investir em mídia paga;
- **P2** entra entre 60 e 90 dias, ou quando o volume pedir.

---

## Veredito

**O núcleo do produto está em nível profissional:**
- motor de geração;
- cobrança por créditos com débito e estorno no servidor;
- Termos e Política de Privacidade alinhados à LGPD e ao CDC;
- Central de Ajuda com 83 artigos;
- documentação técnica e runbooks.

**Ainda não está pronto para abrir vendas, por três motivos:**

1. **Os pagamentos não chegam.** O webhook da Cakto rejeita todos os eventos desde agosto. Quem pagar hoje não recebe créditos.
2. **A página inicial promete o que o produto não faz.** Exemplos: prévia grátis, "sem cartão", um modelo de IA inexistente, depoimentos fictícios e "ilimitado" sem a ressalva do uso justo. Isso gera risco jurídico (CDC, art. 37; CONAR) e de reputação logo nos primeiros clientes.
3. **Ninguém fica sabendo quando algo quebra.** Não há alertas. O problema do webhook tem sete semanas e só apareceu nesta análise.

Todos os P0 são pequenos: de 3 a 5 dias de código, mais algumas configurações que só o dono da conta pode fazer. **Com os P0 resolvidos, o SlideAI está pronto para um lançamento controlado de até cerca de 1.000 usuários.** Os P1 preparam a plataforma para crescer com mídia paga. A partir de uns 1.000 decks por dia, a arquitetura de geração precisa mudar (ver seção 6).

| Dimensão | Situação | Resumo |
|---|---|---|
| Produto (MVP) | 🟡 | Fluxo completo e de boa qualidade. Falta uma primeira experiência sem pagar e falta medição do funil. |
| Coerência | 🔴 | Mais de uma dezena de promessas públicas não correspondem ao produto (seções 1 e 3). |
| Profissionalismo | 🟡 | Visual e conteúdo fortes. Faltam os dados da empresa, sobram vestígios da Lovable e o carregamento é pesado. |
| Segurança | 🟡 | Base sólida (RLS, cobrança no servidor, webhook idempotente). Faltam limites no storage, MFA nas contas internas e teto de gasto na IA. |
| Escalabilidade | 🟡 | Aguenta o lançamento. Os tetos são o limite de tokens por minuto (TPM) da OpenAI e a geração síncrona. |
| Previsibilidade de custo | 🟢 | Custo real de US$ 0,02 a 0,23 por deck. O risco está nas imagens de IA do plano MAX. |
| Operação | 🔴 | Sem alertas, sem staging e sem CI. Hoje os testes rodam em produção. |

---

## Números de produção (29/09/2026)

| Indicador | Valor |
|---|---|
| Usuários | 6 (2 ativos nos últimos 30 dias). Todos internos. |
| Clientes pagantes / transações de crédito | 0 / 0 |
| Apresentações | 52 (50 ativas, todas publicadas), 693 slides |
| Gerações registradas | 35, todas de desenvolvedores, 100% com sucesso |
| Duração da geração | média 47,1 s · p95 81 s · máximo 97 s |
| Custo real por deck (recentes) | US$ 0,016 (6 slides) a US$ 0,23 (20 slides + 5 imagens de IA) |
| Banco de dados | 27 MB |
| Storage | `slide-images`: 15 arquivos, 25 MB (≈1,7 MB cada, PNG) · `avatars`: 1 |
| Webhook de pagamento | 50 rejeições `webhook_invalid_secret`, a última em 28/09. O último evento processado é de 09/08. |
| Erros de interface | 18 × UI-001 (canal Realtime, corrigido em 17/09) · 6 × SUP-999 |
| Registros legais | `legal_acceptances` 2 · `access_logs` 4 · retenção rodou em 27/09 |

Como não há usuários reais, **não existe ainda nenhum dado de conversão, ativação ou retenção.** A seção 10 propõe o que medir desde o primeiro dia.

---

## 1. Bloqueadores de lançamento (P0)

### P0-1 · Pagamentos: o webhook da Cakto rejeita todos os eventos

- **Evidência:**
  - 50 rejeições por segredo inválido, a última em 28/09 às 00:49.
  - Os eventos de teste também foram rejeitados (`purchase_approved`, `subscription_canceled`, `purchase_refused`, `subscription_paused`).
  - O segredo enviado tem impressão `2bf40c2c9acd`; o esperado tem `46925c8066f7`.
  - O último evento processado é de 09/08.
- **Impacto:** o cliente paga e não recebe créditos nem plano. Pelo CDC, é serviço pago e não prestado.
- **Correção (dono da conta):**
  1. Copie o segredo do webhook no painel da Cakto para o secret `CAKTO_WEBHOOK_SECRET` da Lovable Cloud, ou o contrário, para os dois ficarem iguais.
  2. Envie um evento de teste pela Cakto.
  3. Confirme que ele aparece como processado em `payment_events`.
  4. Faça uma compra real de R$ 14,90 e peça reembolso. É o único teste de ponta a ponta confiável.

  O procedimento está em [../operacao/runbooks.md](../operacao/runbooks.md).

### P0-2 · Afirmações falsas na página inicial

O CDC proíbe publicidade enganosa, inclusive por omissão (art. 37). Cada item abaixo pode virar reclamação no Procon ou no Reclame Aqui já na primeira semana.

| Onde | Texto | Realidade | Correção |
|---|---|---|---|
| `Hero.tsx` (selo) | "Powered by Chatgpt 5.6 Pro" | O modelo não existe. O produto usa gpt-4.1, gpt-4.1-mini e Gemini (reserva). "ChatGPT" é marca da OpenAI, e a API não é o ChatGPT. | Trocar por "IA de última geração" ou remover. |
| `Hero.tsx` | "Sem cartão de crédito · Pré-visualize gratuitamente" | Não há camada grátis nem prévia: a primeira geração exige pagamento. | Remover, ou criar a primeira geração grátis (seção 2, P1-1). |
| `CTA.tsx` | "Pré-visualize gratuitamente." | Idem. | Idem. |
| `Hero.tsx` | "Pronto em menos de um minuto" | A média é 47 s, mas o p95 é 81 s e decks de 20 slides passam de 1 minuto. | "Pronto em cerca de um minuto", ou reduzir o tempo (seção 6). |
| `Features.tsx` | "Acesso a milhões de fotos via Unsplash" | O banco de imagens é o Pexels. | Trocar para Pexels. |
| `UseCases.tsx` | "Citações e referências", "com referências" | Não existe mecanismo de fontes. Referências escritas pela IA podem ser **inventadas**, o que é grave para quem usa em TCC ou dissertação. | Remover, ou gerar só a partir de fontes fornecidas pelo usuário. |
| `UseCases.tsx` | "visual profissional alinhado à sua marca" | A identidade de marca (logo e cores próprias) foi retirada do produto. | "visual profissional e consistente". |

### P0-3 · Depoimentos fictícios com nomes e empresas reais

`Testimonials.tsx` mostra pessoas com cinco estrelas, como "Mariana Costa, Estudante de Mestrado · USP", "Rafael Lima, Gerente de Marketing · Stone" e "Diego Almeida, Founder… Series A". Não há nenhum cliente real ainda.

- O Código do CONAR (Anexo Q) exige que depoimentos sejam reais e comprováveis.
- Usar nomes de instituições e empresas sem autorização expõe a riscos de marca.
- **Correção:** remova a seção até existirem depoimentos reais, coletados com autorização por escrito. Enquanto isso, mostre um exemplo real de apresentação gerada, que convence mais do que um depoimento.

### P0-4 · "Ilimitado*" sem a nota, e avisos da oferta removidos

Os commits `55f57d8` e `eacca5f` (feitos na Lovable) removeram o rodapé da tabela de preços. Com ele saíram:
- a explicação do uso justo do MAX (16.000 créditos por ciclo e 12 gerações por hora);
- as regras de renovação e cancelamento;
- o direito de arrependimento de 7 dias.

Os asteriscos de "Uso ilimitado*" e "Gerações ilimitadas*" continuam na tela, sem a nota a que se referem.

- **Fundamento legal:**
  - CDC, art. 31: a informação da oferta tem de ser clara e ostensiva.
  - Decreto 7.962/2013, art. 5º: o fornecedor deve informar "de forma clara e ostensiva" como exercer o arrependimento.

  Estar nos Termos não basta: a informação tem de estar na oferta.
- **Correção:**
  - Restaure o rodapé.
  - Melhor ainda, troque "ilimitado" por "até 16.000 créditos/mês (≈130 apresentações de 10 slides)". O número honesto convence mais e elimina o risco.

### P0-5 · Dados da empresa e canal de atendimento

Estes campos de `src/lib/legal.ts` estão vazios: `legalName`, `taxId`, `address` e `seatCity`.

- **Fundamento:** o Decreto 7.962/2013, art. 2º, exige nome empresarial, CNPJ e endereço físico em local de destaque para quem vende pela internet.
- **Comportamento hoje:** as páginas simplesmente omitem os campos vazios, então a obrigação fica descumprida sem aviso visível.
- **E-mail:** o endereço `suporte@slideai.com.br` aparece em todo lugar (atendimento e canal do titular, LGPD art. 41), mas não foi confirmado que a caixa existe e é lida.
- **Correção (dono):**
  - preencha os quatro campos;
  - crie a caixa de e-mail e responda a um teste;
  - peça a revisão dos Termos a um advogado (lista em [../juridico/README.md](../juridico/README.md)).

### P0-6 · E-mail transacional

- **Situação:** a confirmação de cadastro e a recuperação de senha dependem do SMTP padrão do Supabase, que tem limite baixo de envios por hora e remetente genérico.
- **Impacto:** num pico de cadastros, os e-mails deixam de sair e as pessoas não conseguem entrar. Os Termos também prometem avisos por e-mail (mudança de preço e de termos), e hoje não há como enviá-los.
- **Correção (dono):**
  1. Configure um SMTP próprio nas configurações de Auth. A Resend tem integração com a Lovable.
  2. Use o domínio `slideai.com.br`, com SPF, DKIM e DMARC.
  3. Personalize os modelos de e-mail em português.

### P0-7 · Geração que trava não devolve os créditos

Esta é a decisão B5 da [revisão de créditos](2026-09-27-sistema-de-creditos.md), ainda aberta.

- **Situação:** o débito acontece no início da geração. Se a função cai ou estoura o tempo, nenhum estorno roda.
- **Por que agora é P0:** com clientes pagantes, isso vira cobrança por serviço não entregue. O risco cresce com a duração: o p95 já está em 81 s (seção 6).
- **Correção (código, pequena):**
  - criar uma rotina que estorne débitos de geração sem registro de sucesso nem de falha depois de 15 minutos;
  - o estorno já é idempotente por tentativa;
  - a rotina pode rodar no mesmo gatilho diário da retenção (`run_data_retention_if_due`) ou por `pg_cron`.

### P0-8 · Alertas mínimos e teto de gasto

O webhook falhou por sete semanas sem que ninguém percebesse. Para lançar, o mínimo é:

- **Alerta de pagamento:** qualquer `webhook_invalid_secret` ou evento com erro envia e-mail ou mensagem na hora. Dá para fazer com um gatilho no banco que chama uma função de notificação.
- **Alerta de geração:** taxa de erro acima de 5% em 1 hora, ou p95 acima de 120 s.
- **Monitor de disponibilidade** da página inicial e de `/functions/v1/og-preview`. UptimeRobot e Better Stack têm plano gratuito.
- **Rastreamento de erros** no navegador e nas funções. O Sentry tem plano gratuito.
- **Teto de gasto na OpenAI e no gateway:**
  - limite mensal rígido e alertas em 50% e 80%, configurados no painel do provedor;
  - protege contra chave vazada e contra bug em loop;
  - leva 5 minutos.

---

## 2. Produto e MVP

### O que já está pronto e é diferencial

- **Fluxo completo:** cadastro → onboarding → geração → editor → apresentação → exportação (PDF, PPTX, PNG) → link público → portfólio.
- **Motor v2:**
  - direção criativa, plano visual e conteúdo;
  - gráficos a partir de dados;
  - imagens do Pexels e de IA;
  - falas do apresentador;
  - 100% de sucesso nas 35 gerações medidas.
- **Editor com assistente de IA**, com cotas por apresentação controladas no servidor.
- **Cobrança robusta:**
  - custo previsível e mostrado antes de gerar;
  - débito e estorno idempotentes;
  - uso justo no MAX;
  - acesso até o fim do período pago depois de cancelar;
  - bônus permanente.
- **Conformidade:**
  - Termos (24 seções), Privacidade e Cookies;
  - aceite versionado com IP e navegador;
  - registro de acesso do Marco Civil (6 meses);
  - retenção automática;
  - documentos LGPD (registro de operações, atendimento ao titular, resposta a incidentes).
- **Central de Ajuda** com 83 artigos versionados no repositório e testados contra as regras de cobrança.

### Lacunas do MVP

| # | Lacuna | Por que importa | Recomendação | Prioridade |
|---|---|---|---|---|
| P1-1 | **Não há como experimentar antes de pagar.** A primeira geração custa R$ 14,90. | Marca nova, sem depoimentos e sem prova social: pedir pagamento antes de qualquer resultado derruba a conversão. | **Primeira geração grátis**, limitada a 6 slides, sem imagens de IA e sem falas, com marca d'água na exportação. Custo real: ≈ US$ 0,02 (R$ 0,10) por cadastro. Mil cadastros custam cerca de R$ 100. Isso também torna verdadeira a frase "pré-visualize gratuitamente". | P1 (antes de mídia paga) |
| P1-2 | **Nenhuma medição do funil.** | Sem dados, não dá para saber onde as pessoas desistem nem se o preço está certo. | Analytics de produto (PostHog ou Plausible) com os eventos da seção 10. | P1 (antes de mídia paga) |
| P1-3 | **Espera longa com progresso simulado.** O progresso avança por tempo e, em decks grandes, fica 30 a 60 s parado na penúltima etapa. | É o momento de maior ansiedade do usuário. | Curto prazo: mensagens reais de etapa. Médio prazo: geração assíncrona com progresso real (seção 6). | P1 / P2 |
| P1-4 | **Não há painel administrativo.** Créditos, reembolsos e ajustes são feitos por SQL (runbooks). | Com clientes reais, o atendimento fica lento e sujeito a erro manual. | Painel para dev ou admin com busca de usuário, ledger, ajuste de saldo com motivo, reenvio de evento e histórico. Toda ação fica registrada. | P1 |
| P1-5 | **A exclusão de conta é manual.** | A LGPD permite atender por pedido, mas o volume cresce. | Botão "excluir conta" em Configurações, com confirmação, rodando o mesmo procedimento do runbook. | P2 |
| P2-1 | **Sete opções de compra** (avulso + PRO × 3 + MAX × 3) com créditos, bônus e uso justo. | Excesso de escolhas atrasa a decisão. | Mostrar mensal e anual e esconder o trimestral, ou destacar só um PRO e um MAX. Decisão de negócio. | P2 |
| P2-2 | **Fontes e referências.** | O público acadêmico é o principal caso de uso da página. | Permitir colar texto ou anexar PDF e gerar citando só essas fontes. É um diferencial real sobre concorrentes. | P2 |

---

## 3. Coerência: promessa × entrega

Os itens P0-2 a P0-4 estão acima. Seguem os demais pontos em que a página, o checkout e os documentos não falam a mesma língua.

| Ponto | Onde | Situação | Correção | Prioridade |
|---|---|---|---|---|
| Nome do plano avulso | Card de preço: "Pagamento único" (nome **e** botão). Checkout (`PaymentGate`): "Geração única". Termos e Ajuda: "avulso". | Três nomes para a mesma coisa. | Escolher um nome, por exemplo "Avulso — 500 créditos", e usar em tudo. | P1 |
| "Suporte prioritário" | Listado em **todos** os planos. | Se todos têm prioridade, ninguém tem. Também é uma promessa de prazo sem estrutura por trás. | Remover, ou deixar só no MAX com um prazo concreto (ex.: resposta em 1 dia útil). | P1 |
| "Geração em segundos" | Preços, Features e "Como funciona". | O tempo real é de 20 a 97 s. | "Em cerca de um minuto". | P1 |
| "estilo Canva" | `Features.tsx` | Comparação com marca de terceiro. Desnecessária e arriscada. | "Editor visual, simples de usar". | P1 |
| `twitter:site` = `@Lovable` e imagem de compartilhamento hospedada em `gpt-engineer-file-uploads` | `index.html` | Compartilhamentos atribuídos à Lovable. A imagem depende de um bucket de terceiros. | Criar o perfil do SlideAI (ou remover a tag) e servir `og-image.png` de `public/`. | P1 |
| Bônus de ativação é um por conta | Página de planos | Quem sai do mensal para o anual não ganha de novo, e a página não diz isso (B4). | Uma linha na nota da oferta. | P1 |

---

## 4. Profissionalismo

**Pontos fortes:**
- Identidade visual consistente.
- Tipografia forte e bom contraste.
- Página inicial responsiva: sem rolagem horizontal em 390 px e sem erros de página.
- Documentos legais e ajuda acima da média de produtos em fase de lançamento.

**O que tira pontos:**

| Ponto | Evidência | Correção | Prioridade |
|---|---|---|---|
| **Carregamento pesado** | O bundle principal tem 5,16 MB (1,5 MB com gzip) e 359 arquivos JS. As 23 páginas entram no primeiro carregamento, inclusive editor, suporte e bibliotecas de markdown e diagramas. Num celular médio em 4G, são vários segundos antes da primeira interação. Isso pesa no SEO (Core Web Vitals) e no custo por clique de anúncios. | `React.lazy` por rota no `App.tsx`. A página inicial deve cair para uma fração do tamanho atual. | P1 |
| Título do hero no celular | Em 390 px, "apresentações" encosta na borda direita da tela. | Reduzir o tamanho do `h1` em telas pequenas (ex.: `text-4xl` abaixo de `sm`) ou usar `clamp()`. | P1 |
| Sinais de confiança | Não há CNPJ no rodapé (P0-5), página de status nem menção ao pagamento seguro no checkout. | CNPJ e endereço no rodapé; "Pagamento processado pela Cakto" no checkout; página de status pública (o Better Stack tem uma grátis). | P1 |
| Imagens em PNG | Cerca de 1,7 MB por imagem de slide. Um deck com 5 imagens de IA pesa uns 8,5 MB para quem abre o link público. | Converter para WebP no momento de salvar, com qualidade de 80 a 85. Reduz o tamanho em ≈ 80%. | P1 |

---

## 5. Segurança

### Já está bem resolvido

- RLS em todas as tabelas de usuário. O Editor só abre para o dono.
- **A autorização e a cobrança acontecem no servidor:** `can_user_generate` usa `auth.uid()`, e `consume_credits` e o estorno são idempotentes. A interface apenas espelha a decisão.
- **Webhook:**
  - segredo compartilhado;
  - idempotência por evento + pedido;
  - eventos de recusa ignorados antes de qualquer regra de pagamento;
  - estorno restrito ao que o pedido deu.
- **Limites de uso:**
  - 12 gerações por hora por usuário;
  - uso justo no MAX;
  - cotas do assistente de IA guardadas no banco;
  - orçamento de imagens de IA controlado no servidor.
- **Cabeçalhos:** CSP e HSTS em `public/_headers`. CORS `*` é aceitável, porque a autenticação usa token no cabeçalho e não cookie.
- **`verify_jwt = false` justificado:** só em `cakto-webhook` (autenticado pelo segredo) e `og-preview` (público).
- **LGPD:** aceite versionado, registro de acesso, retenção automática, canal do titular e plano de resposta a incidentes.

### Lacunas

| # | Lacuna | Risco | Correção | Prioridade |
|---|---|---|---|---|
| S1 | Os buckets `avatars` e `slide-images` não têm `file_size_limit` nem `allowed_mime_types`. O limite de 4 MB do avatar existe só no navegador. | Um usuário autenticado pode subir arquivos enormes ou de qualquer tipo pela API, gerando custo e abuso. | Definir no bucket: `avatars` com 4 MB e `image/png`, `image/jpeg`, `image/webp`; `slide-images` com limite compatível e só imagens. | P1 |
| S2 | As URLs assinadas das imagens valem 10 anos. | Funcionam, na prática, como links públicos permanentes. Se o segredo JWT do projeto for trocado (por exemplo, após um incidente), todas as imagens de todos os decks quebram. | Imagens de decks publicados em caminho público não adivinhável, servidas por CDN, ou URLs de curta duração geradas na leitura. No mínimo, documentar o efeito no runbook de incidentes. | P2 |
| S3 | As contas de desenvolvedor geram sem custo e acessam o suporte administrativo, sem MFA. | Uma senha vazada dá acesso a dados de clientes e a geração gratuita. | MFA obrigatório para dev e admin; registro das ações administrativas. | P1 |
| S4 | A proteção contra senhas vazadas do Auth não está ativada. | Contas com senhas conhecidas de vazamentos ficam expostas a *credential stuffing*. | Ativar nas configurações de Auth (HaveIBeenPwned). Oferecer MFA opcional aos clientes. | P1 |
| S5 | Não há auditoria de dependências. O repositório só tem `bun.lockb`, então `npm audit` não roda. | Vulnerabilidades conhecidas passam sem aviso. | Dependabot no GitHub e auditoria no CI. | P1 |
| S6 | `avatars_read_auth` exige login para ler avatares. | O avatar pode não aparecer em portfólios públicos para visitantes. | Confirmar o comportamento. Se for o caso, liberar leitura pública só dos avatares de perfis públicos. | P2 |
| S7 | Backup e recuperação (PITR) não foram verificados na Lovable Cloud. | Sem teste de restauração, o backup é só uma suposição. | Confirmar a política de backup do plano e fazer um teste de restauração num projeto separado. | P1 |
| S8 | Não há moderação do tema digitado. | Conteúdo proibido pelos Termos pode ser gerado. O modelo de imagem modera sozinho; o texto, não. | Passar o tema pela API de moderação da OpenAI (gratuita) antes de debitar. | P2 |

---

## 6. Escalabilidade

### Quanto uma geração consome (medido nos logs)

| Deck | Tokens de entrada | Tokens de saída | Chamada de conteúdo (gpt-4.1) | Total |
|---|---|---|---|---|
| 6 slides | 4.519 | 2.000 | 9,0 s | 19,9 s |
| 6 slides | 6.567 | 2.779 | 23,3 s | 31,1 s |
| 20 slides + 5 imagens de IA | 7.458 | 7.050 | 41,9 s | 59,2 s |
| 20 slides, texto longo | 7.785 | 10.271 | 52,8 s | 68,3 s |

**Leitura:**
- Um deck consome de **6.500 a 18.000 tokens**.
- A maior parte do tempo (de 45% a 77%, mais nos decks grandes) é uma única chamada ao gpt-4.1, que escreve todos os slides de uma vez, a ≈ 160 tokens por segundo.
- As etapas de direção e roteiro (gpt-4.1-mini) somam de 4 a 12 s.

### Os tetos, na ordem em que estouram

**1. Limite de tokens por minuto (TPM) da conta OpenAI.** É o primeiro teto. Estimativa de pico, supondo 15% das gerações do dia na hora de pico e ≈ 12.000 tokens por deck:

   | Decks por dia | Decks por minuto no pico | TPM no pico |
   |---|---|---|
   | 100 | 0,25 | ≈ 3 mil |
   | 1.000 | 2,5 | ≈ 30 mil |
   | 10.000 | 25 | ≈ 300 mil |
   | 50.000 | 125 | ≈ 1,5 milhão |

   **Confira o tier da conta** no painel da OpenAI (*Limits*). Em tiers iniciais, o limite do gpt-4.1 fica na casa das dezenas de milhares de TPM, ou seja, no nível de 1.000 decks por dia. O tier sobe com o gasto acumulado. A reserva no Gemini (via gateway) já existe em `modelRegistry` e segura picos, mas não deve ser o caminho normal.

**2. Tempo da requisição.** A geração inteira acontece dentro de uma única requisição HTTP.
   - As funções do Supabase encerram a requisição que fica 150 s sem responder.
   - O máximo medido é 97 s, uma folga de só 1,5×.
   - Quando o provedor fica lento no pico, os decks grandes passam do limite. Sem o P0-7, o crédito se perde.

**3. Conexões Realtime.** Cada aba aberta mantém um canal de saldo, e o plano tem uma cota de conexões simultâneas.
   - Não preocupa no lançamento.
   - Em escala, assine o canal só enquanto o checkout está aberto e use leitura simples no resto do tempo.

**4. Storage e tráfego.**
   - 10 mil decks por mês com 5 imagens em PNG somam ≈ 85 GB de storage novo por mês, mais o tráfego dos links públicos.
   - Em WebP (P1), o volume cai para ≈ 17 GB.

**5. Banco de dados.** Longe do limite. Hoje tem 27 MB. As operações quentes (`consume_credits` e as leituras de perfil) são por usuário, com índice, e aguentam dezenas de milhares de usuários no plano atual.

### Capacidade por fase

| Fase | Volume | Arquitetura | O que precisa estar feito |
|---|---|---|---|
| **1. Lançamento** | até ~1.000 usuários, ~100 decks por dia | A atual | P0 + tier OpenAI conferido + teto de gasto |
| **2. Tração** | 1 mil a 10 mil usuários, até ~1.000 decks por dia | Geração assíncrona | Fila de jobs (tabela `generation_jobs` ou Supabase Queues/pgmq). A requisição só cria o job e responde na hora; um worker processa, e a tela acompanha o progresso real por Realtime. O conteúdo passa a ser gerado em lotes paralelos (ex.: 4 × 5 slides), o que corta a espera de ~50 s para ~15–20 s. Também: WebP + CDN, staging, CI, Sentry e painel admin. |
| **3. Escala** | 10 mil+ usuários, 10 mil+ decks por dia | Workers dedicados | Workers fora das edge functions (ex.: Cloud Run ou Fly) consumindo a fila, com concorrência controlada por provedor. Roteamento entre provedores com orçamento. Testes de carga antes de campanhas. Plano de banco com PITR e réplicas de leitura. |

### Lovable Cloud ou Supabase próprio

A Lovable Cloud é ótima para o MVP: deploy simples e banco gerenciado. Antes da fase 2, avalie migrar para um projeto Supabase próprio (Pro ou Team), por três motivos:
- **PITR e SLA** documentados;
- **branching**, ou seja, um staging de verdade;
- **log drains e métricas** para alertas.

A troca fica mais fácil enquanto o banco é pequeno. As migrações já estão versionadas em `supabase/migrations`.

---

## 7. Previsibilidade de custos

### Custo variável por deck (real)

| Deck | Custo de IA |
|---|---|
| 6 slides, motor v2 | US$ 0,016 |
| 6 slides, motor v1 | US$ 0,028 |
| 20 slides + 9 fotos Pexels | US$ 0,084 |
| 20 slides + 5 imagens de IA | US$ 0,23 |
| **Estimativa conservadora para planejamento** | **US$ 0,30** |

O texto custa de US$ 0,003 a 0,006 por slide. A imagem de IA custa ≈ US$ 0,035 cada, e é ela que move o custo.

### Cenários mensais de custo de IA

US$ 1 = R$ 5,40.

| Decks por mês | Uso típico (US$ 0,05 por deck) | Pior caso (US$ 0,30 por deck) |
|---|---|---|
| 1.000 | US$ 50 (R$ 270) | US$ 300 (R$ 1.620) |
| 10.000 | US$ 500 (R$ 2.700) | US$ 3.000 (R$ 16.200) |
| 50.000 | US$ 2.500 (R$ 13.500) | US$ 15.000 (R$ 81.000) |

**Para a projeção financeira ficar completa, falta incluir:**
- **Taxa da Cakto** por transação: confirme o percentual do contrato.
- **Impostos sobre a receita:** no Simples Nacional, depende do anexo e da faixa (confirme com o contador).
- **IOF e spread cambial** sobre os gastos em dólar com OpenAI e outros fornecedores.
- **Custos fixos:** plano da Lovable ou Supabase, domínio, e-mail transacional e monitoramento. No lançamento, quase tudo cabe em planos gratuitos ou básicos.

### Margem e salvaguardas

- **Avulso e PRO têm margem** mesmo no pior caso (ver a [revisão de créditos](2026-09-27-sistema-de-creditos.md)).
- **MAX anual e trimestral podem dar prejuízo** com um cliente intenso que usa o teto de imagens de IA e gasta toda a cota. **Decida o B1 antes de vender o MAX.** A opção mais simples não exige deploy: criar o secret `IMAGE_MODEL_PRIMARY=gpt-image-1-mini`, que custa menos da metade por imagem.
- **Salvaguardas:**
  - teto de gasto no provedor (P0-8);
  - uso justo e limite por hora (já existem);
  - painel diário de custo com `generation_logs.actual_cost_usd` somado por dia e por plano;
  - alerta quando o custo por deck passar de US$ 0,30.

---

## 8. Operação

| Ponto | Situação | Recomendação | Prioridade |
|---|---|---|---|
| Ambiente de staging | Não existe. Todas as 35 gerações registradas foram de desenvolvedores em produção. | Um projeto separado (ou branch do Supabase) com a mesma estrutura, secrets de teste e Cakto em modo sandbox. | P1 |
| CI nos PRs | Não existe. | GitHub Actions rodando typecheck, lint, `vitest`, build, o teste de conteúdo da Central de Ajuda e a auditoria de dependências. | P1 |
| Alertas e monitoramento | Não existem (P0-8). | Ver P0-8. Depois, um painel semanal com os indicadores da seção 10. | P0 / P1 |
| Runbooks | Existem ([../operacao/runbooks.md](../operacao/runbooks.md)): créditos, reembolso, webhook e exclusão. | Manter atualizados e treinar quem for atender. | ✅ |
| Resposta a incidentes (LGPD) | Documentada ([../lgpd/resposta-a-incidentes.md](../lgpd/resposta-a-incidentes.md)). | Fazer um exercício simulado antes do lançamento. | P1 |
| Atendimento | E-mail e suporte no app (`AdminSupport`). | Definir um prazo de resposta público (o Decreto 7.962 exige até 5 dias) e quem cobre fins de semana. | P1 |
| Deploy | Pela Lovable, sem registro de versão por deploy. | Anotar cada deploy de função (data, commit e quem fez) e ter um rollback testado. | P2 |

---

## 9. Plano de ação

### Antes do lançamento (P0)

| # | Ação | Quem | Esforço |
|---|---|---|---|
| 1 | Alinhar o segredo do webhook da Cakto e testar uma compra real com reembolso | Dono | 30 min |
| 2 | Corrigir as afirmações falsas da página inicial (tabela do P0-2) | Código | 2 h |
| 3 | Remover os depoimentos fictícios | Código | 15 min |
| 4 | Restaurar a nota da oferta (uso justo, renovação, cancelamento, 7 dias) ou trocar "ilimitado" por números | Código | 1 h |
| 5 | Preencher razão social, CNPJ, endereço e foro em `src/lib/legal.ts`; confirmar a caixa `suporte@` | Dono + Código | 1 h |
| 6 | Configurar SMTP próprio com domínio verificado (SPF, DKIM, DMARC) e modelos em português | Dono | 1–2 h |
| 7 | Rotina de estorno de gerações travadas (B5) | Código | 0,5–1 dia |
| 8 | Alertas de pagamento e de geração, monitor de disponibilidade, Sentry e teto de gasto na OpenAI | Dono + Código | 1 dia |
| 9 | Revisão dos Termos e da Política por advogado; emissão de nota fiscal definida com o contador | Dono | externo |

### Primeiros 30 dias (P1)

- **Conversão e medição:**
  - primeira geração grátis e limitada (P1-1);
  - analytics com os eventos do funil (P1-2).
- **Desempenho:**
  - carregamento por rota (`React.lazy`);
  - WebP nas imagens;
  - título do hero no celular.
- **Coerência:** nomes de plano unificados, "suporte prioritário", "em segundos", `og-image` própria e `twitter:site`.
- **Segurança:**
  - limites nos buckets;
  - MFA para contas internas;
  - proteção contra senhas vazadas;
  - Dependabot.
- **Backup:** teste de restauração.
- **Operação:** staging e CI.
- **Atendimento:** painel administrativo de usuários e créditos.
- **Custo:** decisão B1 (imagens de IA) antes de vender o MAX.

### 60 a 90 dias (P2)

- Geração assíncrona com fila, progresso real e conteúdo em lotes paralelos.
- Decisão entre Lovable Cloud e Supabase próprio.
- Exclusão de conta self-service.
- Moderação do tema.
- Imagens servidas por CDN no lugar de URLs assinadas de 10 anos.
- Geração a partir de fontes do usuário (acadêmico).
- Simplificação da grade de planos.
- Testes de carga antes da primeira campanha grande.

---

## 10. Indicadores para acompanhar desde o primeiro dia

| Indicador | Como medir | Meta inicial | Alerta |
|---|---|---|---|
| Pagamentos processados | `payment_events` processados ÷ recebidos | 100% | qualquer rejeição |
| Sucesso de geração | `generation_logs` com sucesso ÷ total | ≥ 98% | < 95% em 1 h |
| Duração p95 da geração | `generation_logs.duration_ms` | < 90 s (< 30 s na fase 2) | > 120 s |
| Custo de IA por deck | `actual_cost_usd` médio por dia | ≤ US$ 0,10 | > US$ 0,30 |
| Ativação | cadastros que geram o 1º deck em 24 h | ≥ 40% | tendência de queda |
| Conversão | cadastros que compram em 7 dias | a definir após 4 semanas de dados | — |
| Tempo até o 1º deck | do cadastro ao 1º sucesso | < 5 min | — |
| Retenção de assinantes | assinantes ativos no mês seguinte | ≥ 85% | < 80% |
| Reembolsos | pedidos reembolsados ÷ pagos | < 5% | > 8% |
| Margem bruta | receita líquida − custo de IA − taxas | ≥ 70% | < 50% |
| Atendimento | tickets por 100 usuários ativos; tempo da 1ª resposta | < 5; < 1 dia útil | > 5 dias (limite legal) |

Eventos de analytics que sustentam o funil:
- `signup`
- `onboarding_completed`
- `generation_started`
- `generation_succeeded` e `generation_failed`
- `deck_exported`
- `deck_shared`
- `paywall_viewed`
- `checkout_clicked`
- `purchase_completed` (vindo do webhook)
- `subscription_canceled`

---

## Fontes desta análise

- **Banco de produção (29/09/2026):**
  - `profiles`;
  - `presentations` e `slides`;
  - `generation_logs` (status, duração, custo, tokens e latência por etapa);
  - `payment_events`;
  - `credit_transactions`;
  - `error_occurrences`;
  - `legal_acceptances`, `access_logs` e `maintenance_runs`;
  - `storage.buckets` e `storage.objects`.
- **Código em `main` (55f57d8):**
  - `src/components/landing/*`, `index.html`, `public/_headers`;
  - `src/App.tsx`, `src/pages/Generate.tsx`, `src/lib/legal.ts`;
  - `supabase/config.toml`;
  - `supabase/functions/generate-presentation` e `cakto-webhook`.
- **Build de produção** (`vite build`): tamanho dos pacotes. **Teste em celular** (390 px, Playwright): rolagem horizontal, erros de página e capturas da página inicial e de preços.
- **Revisões anteriores:**
  - [2026-09-26-revisao-geral.md](2026-09-26-revisao-geral.md);
  - [2026-09-27-sistema-de-creditos.md](2026-09-27-sistema-de-creditos.md);
  - [2026-09-27-correcoes-lovable.md](2026-09-27-correcoes-lovable.md).
