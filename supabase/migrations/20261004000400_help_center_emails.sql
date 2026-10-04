-- GERADO por scripts/help-center.ts a partir de docs/central-de-ajuda/artigos.
-- Não edite à mão: altere os arquivos .md e rode
--   node --experimental-strip-types scripts/help-center.ts
--
-- Publica a Central de Ajuda revisada (upsert por slug), retira artigos
-- fundidos em outros e corrige os links do catálogo de erros. Idempotente.

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$apresentar-em-projetor$ha$, $ha$Apresentar em projetor, TV ou reunião online$ha$, $ha$apresentacao$ha$, $ha$## Checklist antes de apresentar

1. Abra a apresentação no **modo apresentação** e passe por todos os slides — assim as imagens já ficam carregadas.
2. Entre em tela cheia (**F**) e confira o contraste no projetor da sala.
3. Em reuniões online (Zoom, Meet, Teams), compartilhe **a aba do navegador**, não a tela inteira: a animação fica mais fluida.
4. Tenha o **PDF exportado** como plano B se a internet cair.
5. Em computador de terceiros, abra pelo link publicado, sem precisar entrar na sua conta.

## Sem internet

O visualizador precisa de conexão. Para apresentar offline, exporte em **PowerPoint** ou **PDF** antes. Veja [Exportar em PDF ou PPTX](/ajuda/exportar-pdf-pptx).

## Desempenho

Em computadores antigos, as transições clássicas consomem menos recursos que o Slide Dinâmico. Veja [Clássico ou Magic Move](/ajuda/classico-vs-magic-move).
$ha$, ARRAY[$ha$projetor$ha$, $ha$tv$ha$, $ha$zoom$ha$, $ha$meet$ha$, $ha$teams$ha$, $ha$apresentar$ha$, $ha$reunião online$ha$, $ha$offline$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$classico-vs-magic-move$ha$, $ha$Clássico ou Magic Move — qual animação escolher$ha$, $ha$apresentacao$ha$, $ha$Os dois estilos seguem linguagens diferentes, e a escolha feita na geração orienta a apresentação inteira.

| | Clássico | Magic Move (Slide Dinâmico) |
| --- | --- | --- |
| Como é | Transições tradicionais entre slides | Elementos mudam de posição, escala e forma entre slides |
| Indicado para | Apresentações formais, bancas, leitura linear | Narrativas visuais, lançamentos, pitches |
| Desempenho | Leve em qualquer computador | Pede um computador com boa capacidade gráfica |

## Como escolher

- Na geração: ligue ou desligue **Slide Dinâmico (Magic Move)** no formulário.
- No editor: ajuste a transição de cada slide na aba **Animação**.

Confira o ritmo no modo apresentação antes de compartilhar.

## Relacionados

- [O que é o Slide Dinâmico](/ajuda/slide-dinamico)
$ha$, ARRAY[$ha$clássico$ha$, $ha$magic move$ha$, $ha$dinâmico$ha$, $ha$animação$ha$, $ha$morph$ha$, $ha$transição$ha$, $ha$estilo$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$compartilhar-apresentacao$ha$, $ha$Compartilhar uma apresentação$ha$, $ha$apresentacao$ha$, $ha$## Pelo link

1. [Publique a apresentação](/ajuda/publicar-e-despublicar) no painel.
2. Abra-a no visualizador e use **Compartilhar → Copiar link**.
3. Envie o link por WhatsApp, e-mail ou onde quiser. Quem recebe abre no navegador, sem login.

O link mostra sempre a versão mais recente: alterações feitas no editor aparecem para quem abrir depois.

## Por arquivo

Prefere enviar um arquivo? Exporte em **PDF** (leitura e impressão) ou **PowerPoint** (para a pessoa editar). Veja [Formatos de saída](/ajuda/exportar-imagens-e-web).

## A pessoa não consegue abrir

- Confira se a apresentação está **publicada** (ícone de globo no painel).
- Se você a tornou privada ou a moveu para a lixeira, o link não abre mais.

## Relacionados

- [Prévia do link compartilhado](/ajuda/link-publico-preview)
$ha$, ARRAY[$ha$compartilhar$ha$, $ha$link$ha$, $ha$público$ha$, $ha$share$ha$, $ha$enviar$ha$, $ha$whatsapp$ha$, $ha$e-mail$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$estatisticas-de-visualizacao$ha$, $ha$Visualizações — como são contadas$ha$, $ha$apresentacao$ha$, $ha$O painel mostra, em cada apresentação, o número de **visualizações** (ícone de olho).

## Como contamos

- Cada abertura de uma apresentação publicada no visualizador conta uma visualização.
- Registramos só a data, a hora e o tipo de navegador da visita, para o contador. **Não guardamos o IP nem identificamos quem assistiu.**
- Os registros individuais das visitas são eliminados após 12 meses; o total continua no contador.

## O que não dá para saber

Por privacidade, o SlideAI não mostra quem viu a apresentação, de onde, nem por quanto tempo.

## Relacionados

- [Publicar e tornar privada](/ajuda/publicar-e-despublicar)
- [Política de Privacidade](/privacidade)
$ha$, ARRAY[$ha$visualizações$ha$, $ha$views$ha$, $ha$estatísticas$ha$, $ha$contador$ha$, $ha$audiência$ha$, $ha$quem viu$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$link-publico-preview$ha$, $ha$Prévia do link compartilhado (WhatsApp, LinkedIn, e-mail)$ha$, $ha$apresentacao$ha$, $ha$Ao enviar o link de uma apresentação **publicada**, o SlideAI monta automaticamente a prévia com o **título** e a **imagem da capa**. Funciona em WhatsApp, LinkedIn, Telegram, Slack e clientes de e-mail.

## A prévia não aparece ou está desatualizada

- Confirme que a apresentação está publicada: não há prévia de apresentação privada.
- Aguarde alguns minutos: as redes guardam a prévia em cache.
- Reenvie com um parâmetro no fim da URL (ex.: `?v=2`) para forçar uma nova leitura.
- A prévia usa a capa: mantenha a capa como primeiro slide.

## Ao tornar privada

O link deixa de abrir. Prévias já exibidas em conversas antigas podem continuar visíveis, porque ficam guardadas pelo aplicativo de mensagens.
$ha$, ARRAY[$ha$link$ha$, $ha$preview$ha$, $ha$prévia$ha$, $ha$og$ha$, $ha$compartilhar$ha$, $ha$whatsapp$ha$, $ha$linkedin$ha$, $ha$miniatura$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$modo-apresentacao$ha$, $ha$Modo apresentação (visualizador)$ha$, $ha$apresentacao$ha$, $ha$O visualizador mostra a apresentação com todas as animações, pronta para projetar.

## Como abrir

- No painel, clique em **Ver** na apresentação.
- Ou acesse o endereço `/slides/<nome-da-apresentação>`.

Clique em **Apresentar** (ou tecle **F**) para entrar em tela cheia.

## Navegação

| Tecla | Ação |
| --- | --- |
| → , Espaço, Page Down | Próximo slide |
| ← , Page Up | Slide anterior |
| Home / End | Primeiro / último slide |
| F | Tela cheia |
| Esc | Sair da tela cheia |

Passadores de slide (clickers) funcionam normalmente.

## Painel de falas

Se a apresentação foi gerada com as [falas dos apresentadores](/ajuda/falas-dos-apresentadores), um botão de apresentadores abre o roteiro do slide atual — inclusive em tela cheia.

## Outras ações no topo

- **Compartilhar:** copia o link da apresentação.
- **Exportar:** PowerPoint, PDF ou imagem PNG do slide exibido.

## Relacionados

- [Apresentar em projetor, TV ou reunião online](/ajuda/apresentar-em-projetor)
- [Atalhos do editor e do modo apresentação](/ajuda/atalhos-editor)
$ha$, ARRAY[$ha$apresentar$ha$, $ha$visualizador$ha$, $ha$viewer$ha$, $ha$tela cheia$ha$, $ha$fullscreen$ha$, $ha$atalhos$ha$, $ha$clicker$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$notas-do-apresentador$ha$, $ha$Usar as notas do apresentador$ha$, $ha$apresentacao$ha$, $ha$Cada slide pode ter notas com o que dizer durante a apresentação. Elas **não aparecem nos slides**.

## Onde ficam

- **Editor:** aba **Slide** do painel direito — você pode escrever ou editar à mão, sem custo.
- **Painel de falas:** em apresentações geradas com as [falas dos apresentadores](/ajuda/falas-dos-apresentadores), as notas vêm preenchidas e aparecem no painel do editor e do visualizador.

## Notas x falas

- **Notas:** anotações livres por slide. Sempre disponíveis para escrever à mão.
- **Falas dos apresentadores:** roteiro completo gerado pela IA, dividido entre os apresentadores. Opção paga (+50 créditos).

## Como aproveitar melhor

- Escreva frases curtas: notas servem de gatilho, não de leitura.
- Anote transições ("aqui abrir o exemplo do cliente X").
- Marque um tempo por slide para controlar a duração.

## Privacidade

Em apresentações publicadas, quem tem o link pode abrir o painel de falas. Não coloque nas notas nada que não possa ser visto pela plateia se for publicar.

## Relacionados

- [Exportar o roteiro de falas](/ajuda/exportar-roteiro)
$ha$, ARRAY[$ha$notas$ha$, $ha$roteiro$ha$, $ha$fala$ha$, $ha$presenter notes$ha$, $ha$anotações$ha$, $ha$orador$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$publicar-e-despublicar$ha$, $ha$Publicar, tornar privada e controlar uma apresentação$ha$, $ha$apresentacao$ha$, $ha$Toda apresentação nasce **privada**: só você vê.

## Publicar

No painel (Minhas apresentações), clique no ícone de **globo** da apresentação. Ela passa a mostrar "Pública" e fica acessível a qualquer pessoa com o link, sem login.

Quando publicada, a apresentação:

- abre pelo link `/slides/…`;
- pode aparecer no seu portfólio, se ele estiver ativo;
- mostra título e capa na prévia do link em redes e aplicativos de mensagem;
- pode ser indexada por buscadores;
- tem o conteúdo inteiro acessível, **incluindo notas e falas dos apresentadores**.

## Tornar privada de novo

Clique no ícone de **cadeado**. O link deixa de abrir na hora. Não controlamos cópias que outras pessoas tenham feito, nem prévias guardadas por outras plataformas.

## Antes de publicar

1. Revise textos, números e imagens.
2. Confira todos os slides no modo apresentação.
3. **Não publique informações confidenciais** nem dados pessoais de terceiros.

## Relacionados

- [Compartilhar uma apresentação](/ajuda/compartilhar-apresentacao)
- [Perfil e portfólio público](/ajuda/perfil-e-portfolio-publico)
- [Visualizações](/ajuda/estatisticas-de-visualizacao)
$ha$, ARRAY[$ha$publicar$ha$, $ha$despublicar$ha$, $ha$privada$ha$, $ha$pública$ha$, $ha$link$ha$, $ha$portfólio$ha$, $ha$visibilidade$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$confirmar-email$ha$, $ha$Não recebi o e-mail de confirmação$ha$, $ha$autenticacao$ha$, $ha$Contas criadas com e-mail e senha precisam ser confirmadas antes do primeiro login.

## O que fazer

1. Procure o e-mail nas pastas de **spam**, **promoções** e **atualizações**.
2. Confira se o endereço foi digitado corretamente.
3. Na tela de confirmação, use **Reenviar email**. Aguarde alguns minutos entre um pedido e outro: pedidos seguidos são bloqueados temporariamente.
4. Clique no link do e-mail mais recente. Links antigos podem ter expirado.

## Ainda não chegou?

- Tente **Continuar com Google**, se o endereço for do Gmail.
- Abra um atendimento informando o e-mail usado.

## Relacionados

- [Criar sua conta](/ajuda/criar-conta)
- [Não consigo acessar minha conta](/ajuda/problemas-de-acesso)
$ha$, ARRAY[$ha$confirmar email$ha$, $ha$confirmação$ha$, $ha$email não chegou$ha$, $ha$ativar conta$ha$, $ha$AUTH-002$ha$, $ha$spam$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$criar-conta$ha$, $ha$Criar sua conta$ha$, $ha$autenticacao$ha$, $ha$## Com e-mail e senha

1. Clique em **Entrar** e depois na aba **Criar conta**.
2. Informe nome completo, e-mail e uma senha com **pelo menos 8 caracteres**.
3. Marque que leu e aceita os [Termos de Uso](/termos) e a [Política de Privacidade](/privacidade).
4. Clique em **Criar conta** e confirme o e-mail pelo link que enviamos. Veja [Não recebi o e-mail de confirmação](/ajuda/confirmar-email).

## Com o Google

Clique em **Continuar com Google** e escolha a conta. No primeiro acesso, confirme o aceite dos Termos e da Política.

## Primeiro acesso

Escolha como você usa o SlideAI (estudante, professor, profissional ou criador de conteúdo). Isso só pré-preenche o formulário de geração.

## Idade

Menores de 12 anos não podem ter conta. Dos 12 aos 17 anos, só com autorização dos pais ou responsáveis. Veja [Uso por estudantes menores de 18 anos](/ajuda/menores-de-idade).
$ha$, ARRAY[$ha$cadastro$ha$, $ha$criar conta$ha$, $ha$registrar$ha$, $ha$inscrever$ha$, $ha$senha$ha$, $ha$termos$ha$, $ha$google$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$login-google-email$ha$, $ha$Como fazer login$ha$, $ha$autenticacao$ha$, $ha$Em **Entrar**, há duas opções:

- **Continuar com Google:** um clique, sem senha. Recomendado se o seu e-mail é do Google.
- **E-mail e senha:** para contas criadas pelo formulário de cadastro. O e-mail precisa estar confirmado.

Use sempre o **mesmo método** do cadastro: se criou a conta com o Google, entre com o Google.

## Erros comuns

| Código | Significado | O que fazer |
| --- | --- | --- |
| AUTH-001 | E-mail ou senha incorretos | Confira os dados ou [recupere a senha](/ajuda/recuperar-senha) |
| AUTH-002 | E-mail não confirmado | Veja [Não recebi o e-mail de confirmação](/ajuda/confirmar-email) |
| AUTH-005 | Sessão expirada | Recarregue a página e entre de novo |
| AUTH-007 | Muitas tentativas | Aguarde alguns minutos |
| AUTH-008 | E-mail já cadastrado | Entre com esse e-mail ou recupere a senha |

## Relacionados

- [Não consigo acessar minha conta](/ajuda/problemas-de-acesso)
$ha$, ARRAY[$ha$login$ha$, $ha$entrar$ha$, $ha$conta$ha$, $ha$google$ha$, $ha$email$ha$, $ha$senha$ha$, $ha$acessar$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$problemas-de-acesso$ha$, $ha$Não consigo acessar minha conta$ha$, $ha$autenticacao$ha$, $ha$## Diagnóstico rápido

1. **E-mail não reconhecido:** talvez a conta tenha sido criada com o Google. Tente **Continuar com Google**.
2. **Senha incorreta:** use **Esqueci minha senha**. Veja [Recuperar senha](/ajuda/recuperar-senha).
3. **E-mail de recuperação não chegou:** confira spam e promoções e aguarde alguns minutos antes de pedir outro.
4. **E-mail não confirmado:** veja [Não recebi o e-mail de confirmação](/ajuda/confirmar-email).
5. **A sessão cai sozinha:** limpe os dados do site no navegador ou teste em uma janela anônima.
6. **Extensões e bloqueadores** podem atrapalhar o login. Desative-os temporariamente.

## Nada funcionou?

Abra um atendimento pelo e-mail suporte@slideai.com.br informando o e-mail cadastrado e o método de login usado (Google ou e-mail e senha).

## Suspeita de invasão

Veja [Proteger sua conta](/ajuda/seguranca-da-conta).
$ha$, ARRAY[$ha$login$ha$, $ha$acesso$ha$, $ha$bloqueio$ha$, $ha$email$ha$, $ha$não consigo entrar$ha$, $ha$sessão caiu$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$recuperar-senha$ha$, $ha$Recuperar senha$ha$, $ha$autenticacao$ha$, $ha$1. Em **Entrar**, clique em **Esqueci minha senha**.
2. Digite o e-mail da conta. Você recebe um link em alguns minutos (confira o spam).
3. Abra o link e defina a nova senha, com **pelo menos 8 caracteres**.
4. Entre com a nova senha.

## O e-mail não chegou

- Confirme o endereço e se a conta existe.
- Se você criou a conta com o **Google**, não há senha: use **Continuar com Google**.
- Aguarde alguns minutos entre pedidos: pedidos seguidos são bloqueados temporariamente.

Persistindo, abra um atendimento informando o e-mail cadastrado.

## Já está logado e quer trocar a senha?

Use **Perfil → Segurança**. Veja [Proteger sua conta](/ajuda/seguranca-da-conta).
$ha$, ARRAY[$ha$senha$ha$, $ha$esqueci$ha$, $ha$reset$ha$, $ha$recuperar$ha$, $ha$redefinir$ha$, $ha$password$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$como-gerar-apresentacao$ha$, $ha$Como gerar uma apresentação, passo a passo$ha$, $ha$comecar$ha$, $ha$Toda apresentação nasce no formulário **Criar apresentação** (menu do painel ou botão na página inicial).

## Passo a passo

1. **Título / Tema (obrigatório).** O assunto central, em uma frase. Ex.: "Energia solar para pequenas empresas".
2. **Descrição (recomendada).** Público, objetivo, tópicos que não podem faltar, dados reais e tom. É o campo que mais melhora o resultado.
3. **Número de slides.** De 5 a 20. Cada slide custa 10 créditos.
4. **Tipo e idioma.** O tipo (acadêmico, escolar, corporativo, marketing, criativo, científico ou pitch de negócios) orienta a estrutura. Idiomas: português, inglês e espanhol.
5. **Tema visual.** Deixe em **automático** para o Tema inteligente escolher cores e fontes pelo assunto, ou escolha um tema fixo.
6. **Opções de conteúdo.** Gráficos e dados, imagens reais (fotos e imagens por IA) e Slide Dinâmico (animações de continuidade).
7. **Profundidade do texto.** Curto (+10), equilibrado (+20) ou longo (+30 créditos).
8. **Persona do orador e apresentadores.** Tom de voz (educador, autoridade técnica, líder inspiracional ou vendedor) e de 1 a 8 apresentadores.
9. **Falas dos apresentadores (opcional, +50 créditos).** Gera o roteiro do que cada apresentador vai dizer em cada slide. Veja [Falas dos apresentadores](/ajuda/falas-dos-apresentadores).
10. **Gerar.** O resumo mostra o custo total e o saldo depois da geração.

## Quanto tempo leva

Normalmente entre 20 segundos e 1 minuto. Não feche a aba; se fechar, a apresentação continua sendo criada no servidor e aparece no painel ao terminar. Veja [A geração está demorando](/ajuda/geracao-lenta).

## Se algo der errado

Se a geração falhar por problema nosso, os créditos voltam automaticamente para o seu saldo. Veja [Créditos devolvidos](/ajuda/creditos-devolvidos).

## Relacionados

- [Todas as opções do formulário](/ajuda/configurar-geracao-inteligente)
- [Como escrever um bom tema](/ajuda/escrever-bom-prompt)
- [Quanto custa cada apresentação](/ajuda/custo-por-apresentacao)
$ha$, ARRAY[$ha$gerar$ha$, $ha$criar$ha$, $ha$apresentação$ha$, $ha$slides$ha$, $ha$como fazer$ha$, $ha$novo$ha$, $ha$começar$ha$, $ha$formulário$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$escrever-bom-prompt$ha$, $ha$Como escrever um bom tema (prompt) para a IA$ha$, $ha$comecar$ha$, $ha$O resultado depende principalmente do que você escreve no **título** e na **descrição**. A IA não conhece o seu contexto: quanto mais claro o objetivo, melhor a estrutura, os textos e as imagens.

## Uma estrutura que funciona

```
[Assunto] para [público], com foco em [objetivo].
Incluir: [tópicos obrigatórios, dados reais, nomes].
Tom: [formal / didático / comercial / inspirador].
Encerrar com: [conclusão, chamada para ação, próximos passos].
```

## Exemplos

| Fraco | Forte |
| --- | --- |
| Marketing | Marketing digital para pequenos comércios, focado em Instagram e WhatsApp, com 3 exemplos práticos e um plano de 30 dias |
| Espanha | História da Espanha do século XV ao XX para alunos do 9º ano, destacando Reconquista, Império e Guerra Civil |
| Vendas | Treinamento de objeções em vendas B2B, com scripts prontos e um slide final de chamada para ação |

## Dicas

- **Dê os números.** Se a apresentação tem dados (faturamento, metas, resultados), escreva-os na descrição. Sem eles, a IA cria exemplos genéricos — e você precisa revisá-los.
- **Diga o que não quer.** "Sem jargão técnico", "sem imagens de pessoas", "sem citar concorrentes".
- **Um assunto por apresentação.** Misturar temas sem relação prejudica a narrativa.
- **Ajuste o número de slides ao conteúdo.** Poucos tópicos em muitos slides geram repetição; muitos tópicos em poucos slides geram textos longos.

## O que evitar

- Temas de uma palavra só.
- Dados pessoais sensíveis ou informações confidenciais: o texto é processado por provedores de IA. Veja [O que acontece com o texto que você envia](/ajuda/privacidade-conteudo-e-ia).

## Relacionados

- [Todas as opções do formulário](/ajuda/configurar-geracao-inteligente)
- [Quantos slides escolher](/ajuda/escolher-numero-de-slides)
$ha$, ARRAY[$ha$prompt$ha$, $ha$tema$ha$, $ha$descrição$ha$, $ha$qualidade$ha$, $ha$instruções$ha$, $ha$resultado melhor$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$glossario$ha$, $ha$Glossário do SlideAI$ha$, $ha$comecar$ha$, $ha$Os termos usados na plataforma, nos Termos de Uso e na Central de Ajuda.

| Termo | O que significa |
| --- | --- |
| **Crédito** | Unidade de uso consumida ao gerar uma apresentação. Não é dinheiro e não pode ser transferido. |
| **Cota mensal** | Créditos que a assinatura PRO ou MAX concede a cada ciclo mensal. Não acumula: renova para o valor do plano a cada mês. |
| **Bônus** | Créditos permanentes: compras avulsas, bônus de ativação e promoções. Não expiram e continuam valendo depois que a assinatura termina. |
| **Ciclo mensal** | Período de um mês contado da ativação ou da última renovação da assinatura. |
| **Período pago** | Intervalo coberto pelo último pagamento (mês, trimestre ou ano). Ao cancelar, o acesso continua até o fim dele. |
| **Profundidade do texto** | Quanto contexto e detalhe cada slide traz: curto, equilibrado ou longo. |
| **Falas dos apresentadores** | Roteiro do que cada apresentador vai dizer em cada slide. Opção paga (+50 créditos). |
| **Notas do apresentador** | Anotações por slide, visíveis no editor e no painel de falas. |
| **Tema inteligente** | Escolha automática de cores e fontes de acordo com o assunto. |
| **Slide Dinâmico (Magic Move)** | Animação em que título e imagem "viajam" de um slide para o outro. |
| **Uso justo** | Limite do plano MAX (16.000 créditos por ciclo mensal) e limites técnicos de frequência. |
| **Publicar** | Tornar a apresentação acessível por link público. |
| **Lixeira** | Onde ficam as apresentações excluídas do painel. |
| **Direito de arrependimento** | Desistir da compra em até 7 dias, com reembolso integral. |

## Relacionados

- [Como funcionam os créditos](/ajuda/creditos-consumo)
- [Termos de Uso em linguagem simples](/ajuda/termos-de-uso-resumo)
$ha$, ARRAY[$ha$glossário$ha$, $ha$termos$ha$, $ha$significado$ha$, $ha$crédito$ha$, $ha$cota$ha$, $ha$bônus$ha$, $ha$falas$ha$, $ha$uso justo$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$primeiros-passos-slideai$ha$, $ha$Primeiros passos no SlideAI$ha$, $ha$comecar$ha$, $ha$O SlideAI transforma uma descrição em português (ou inglês e espanhol) em uma apresentação completa: roteiro, textos, layout, imagens, gráficos e animações. Este guia mostra o caminho do cadastro à primeira apresentação publicada.

## 1. Crie sua conta

Acesse **Entrar** no topo do site e escolha **Criar conta** (nome, e-mail e senha de pelo menos 8 caracteres) ou **Continuar com Google**. No cadastro por e-mail, confirme o endereço pelo link que enviamos. Veja [Criar sua conta](/ajuda/criar-conta).

No primeiro acesso, escolha como você usa o SlideAI (estudante, professor, profissional ou criador de conteúdo). Essa escolha só pré-preenche o formulário de geração e pode ser mudada a qualquer momento.

## 2. Descreva a apresentação

Clique em **Criar apresentação**. Preencha o **título/tema** e, de preferência, a **descrição**: público, objetivo, tópicos obrigatórios e tom. Ajuste o número de slides (5 a 20), o tipo, o idioma, o tema visual e a profundidade do texto. Veja [Como escrever um bom tema](/ajuda/escrever-bom-prompt).

## 3. Confira o custo e gere

O formulário mostra o custo em créditos antes de gerar: 10 por slide, mais a profundidade do texto e, se quiser, 50 pelas falas dos apresentadores. Se você ainda não tem créditos, o botão leva ao pagamento e a geração começa sozinha quando ele é confirmado. Veja [Quanto custa cada apresentação](/ajuda/custo-por-apresentacao).

## 4. Revise no editor

A apresentação abre no editor. Revise textos, números e imagens — conteúdo gerado por IA pode ter imprecisões. Ajuste o que quiser à mão ou peça mudanças ao assistente de edição. Veja [Revise o conteúdo gerado](/ajuda/revisar-conteudo-gerado).

## 5. Apresente, exporte ou publique

- **Apresentar:** abra o visualizador e use a tela cheia.
- **Exportar:** PowerPoint, PDF ou imagem.
- **Publicar:** gere um link público para enviar a quem quiser.

## Relacionados

- [Como gerar uma apresentação, passo a passo](/ajuda/como-gerar-apresentacao)
- [Glossário do SlideAI](/ajuda/glossario)
- [Planos e preços](/ajuda/planos-e-precos)
$ha$, ARRAY[$ha$começar$ha$, $ha$tutorial$ha$, $ha$iniciante$ha$, $ha$primeira apresentação$ha$, $ha$como usar$ha$, $ha$visão geral$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$aplicativos-conectados$ha$, $ha$Conectar assistentes de IA e outros aplicativos à sua conta$ha$, $ha$conta$ha$, $ha$Assistentes de IA e aplicativos compatíveis podem se conectar ao SlideAI com a sua autorização, para trabalhar com as suas apresentações.

## O que um aplicativo conectado pode fazer

- Listar e ler suas apresentações.
- Atualizar apresentações a pedido seu.
- Consultar seu saldo de créditos.
- Pesquisar a Central de Ajuda.

## Como autorizar

Ao conectar, o aplicativo abre uma **tela de consentimento do SlideAI** com o nome dele. Entre na sua conta, confira o nome e clique em aprovar ou recusar. Nada é compartilhado sem essa aprovação.

## Cuidados

- Autorize só aplicativos que você conhece. Eles agem em seu nome e seguem os termos do próprio fornecedor.
- Você pode revogar a autorização a qualquer momento, pelo próprio aplicativo ou pelo suporte do SlideAI.

Mais detalhes nos [Termos de Uso](/termos#integracoes).
$ha$, ARRAY[$ha$integração$ha$, $ha$mcp$ha$, $ha$conectar$ha$, $ha$assistente de ia$ha$, $ha$aplicativo$ha$, $ha$oauth$ha$, $ha$autorizar$ha$, $ha$api$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$emails-e-preferencias$ha$, $ha$E-mails do SlideAI e como escolher o que receber$ha$, $ha$conta$ha$, $ha$O SlideAI envia dois tipos de e-mail.

## Avisos da conta

Fazem parte do serviço e chegam sempre:

- **Compras e assinatura:** créditos liberados, plano ativado, upgrade, renovação confirmada, cancelamento, reembolso.
- **Lembretes de renovação:** 5, 3 e 1 dia antes da data.
  - **Cartão de crédito e Pix Automático** renovam sozinhos; o lembrete só confirma a data e a forma de pagamento.
  - **Pix, boleto e outras formas** não renovam sozinhas; o lembrete traz o link para renovar.
- **Cobrança recusada ou em atraso**, com o link para resolver.
- **Pix ou boleto em aberto**, para você concluir o pagamento.
- **Saldo baixo**, **créditos devolvidos** e **primeira apresentação criada**.
- **Suporte e portfólio:** respostas de chamados e pedidos de acesso.

A Cakto, que processa os pagamentos, também envia o comprovante e os lembretes dela. Por isso, você pode receber dois e-mails sobre o mesmo pagamento: o da Cakto é o recibo; o do SlideAI conta o que muda na sua conta.

## Dicas, ideias e ofertas

E-mails de relacionamento, assinados por uma pessoa do nosso time:

- ideias de apresentação para o seu perfil;
- como aproveitar os recursos;
- um lembrete se você começou uma compra e não terminou;
- de vez em quando, um cupom de desconto.

Chegam no máximo **um por dia**, entre 9 h e 20 h.

### Como parar de receber

- Clique em **Descadastrar**, no rodapé de qualquer um desses e-mails.
- Ou desligue em **Perfil → Conta → E-mails**.

O descadastro vale na hora e não afeta os avisos da conta.

## Não estou recebendo

1. Procure "SlideAI" nas pastas **Spam**, **Promoções** e **Atualizações**.
2. Adicione `contato@slideai.com.br` aos seus contatos.
3. Confira se o e-mail da conta está certo em **Perfil → Conta**.

No pagamento, use o **mesmo e-mail da sua conta**: é por ele que o plano e os créditos chegam até você. Veja [Pagamento aprovado, mas não liberado](/ajuda/pagamento-aprovado-nao-liberou).
$ha$, ARRAY[$ha$e-mail$ha$, $ha$emails$ha$, $ha$notificação$ha$, $ha$aviso$ha$, $ha$descadastrar$ha$, $ha$cancelar inscrição$ha$, $ha$newsletter$ha$, $ha$spam$ha$, $ha$lembrete$ha$, $ha$renovação$ha$, $ha$cupom$ha$, $ha$preferências$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$excluir-conta$ha$, $ha$Excluir a conta e apagar seus dados$ha$, $ha$conta$ha$, $ha$## Antes de excluir

1. **Exporte** em PDF ou PowerPoint as apresentações que quiser guardar. A exclusão é definitiva.
2. **Cancele a assinatura**, se houver. Excluir a conta não cancela cobranças sozinho. Veja [Cancelar a assinatura](/ajuda/cancelar-assinatura).
3. Saiba que créditos e bônus restantes são perdidos.

## Como pedir

Escreva para **suporte@slideai.com.br** a partir do e-mail da conta, ou abra um atendimento pedindo a exclusão. Podemos confirmar sua identidade antes de prosseguir. O pedido é concluído em até 15 dias.

## O que é apagado

Conta, perfil, apresentações (inclusive as da lixeira), extrato de créditos e conversas de suporte.

## O que é mantido por obrigação legal

| Dado | Prazo |
| --- | --- |
| Pedidos e pagamentos | 5 anos (obrigações fiscais) |
| Registros de acesso (IP, data e hora) | 6 meses (Marco Civil da Internet) |
| Registro de aceite dos Termos | Até 5 anos (defesa em eventuais processos) |

Esses dados ficam guardados com acesso restrito e são eliminados ao fim do prazo. Veja a [Política de Privacidade](/privacidade#retencao).
$ha$, ARRAY[$ha$excluir conta$ha$, $ha$deletar conta$ha$, $ha$apagar dados$ha$, $ha$lgpd$ha$, $ha$encerrar conta$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$foto-de-perfil$ha$, $ha$Foto de perfil: enviar, trocar e remover$ha$, $ha$conta$ha$, $ha$## Enviar

Em **Perfil**, clique na foto e escolha uma imagem.

- **Formatos:** PNG, JPG, WEBP ou GIF.
- **Tamanho máximo:** 4 MB.
- **Recomendado:** imagem quadrada, a partir de 400 × 400 px.

Arquivos de outro tipo ou maiores são recusados por segurança.

## Trocar ou remover

Enviar uma nova imagem substitui a anterior. Sem foto, o perfil mostra as iniciais do seu nome.

## Login com Google

Se você entrou com o Google, a foto da conta Google pode aparecer no início. Você pode trocá-la aqui a qualquer momento.

## Onde a foto aparece

No menu da conta, no portfólio público (se ativo) e nos atendimentos de suporte.
$ha$, ARRAY[$ha$avatar$ha$, $ha$foto$ha$, $ha$imagem de perfil$ha$, $ha$upload$ha$, $ha$trocar foto$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$gerenciar-apresentacoes-dashboard$ha$, $ha$Organizar apresentações no painel$ha$, $ha$conta$ha$, $ha$O painel (**Minhas apresentações**) reúne tudo o que você criou, da mais recente para a mais antiga. Cada cartão mostra a capa, o número de slides, se é pública ou privada e as visualizações.

## Ações de cada apresentação

| Ação | O que faz |
| --- | --- |
| **Ver** | Abre no modo apresentação |
| **Editar** | Abre no editor |
| **Globo / cadeado** | Publica ou torna privada |
| **Exportar** | PowerPoint, PDF ou imagem |
| **Lixeira** | Tira a apresentação do painel e das áreas públicas |

Use o campo **Buscar** para filtrar pelo título.

## Relacionados

- [Lixeira](/ajuda/lixeira)
- [Publicar e tornar privada](/ajuda/publicar-e-despublicar)
$ha$, ARRAY[$ha$painel$ha$, $ha$dashboard$ha$, $ha$minhas apresentações$ha$, $ha$buscar$ha$, $ha$lixeira$ha$, $ha$visualizações$ha$, $ha$publicar$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$lixeira$ha$, $ha$Lixeira: o que acontece ao excluir uma apresentação$ha$, $ha$conta$ha$, $ha$Ao clicar na **lixeira** de uma apresentação no painel (e confirmar):

- ela sai do painel;
- deixa de abrir pelo link público e sai do portfólio;
- os créditos usados nela não voltam.

## Recuperar

A apresentação continua guardada. Para recuperá-la, abra um atendimento com o título e a data aproximada de criação.

## Excluir definitivamente

Para apagar de vez uma apresentação da lixeira, peça pelo suporte ou pelo e-mail suporte@slideai.com.br. Ela também é apagada junto com a conta. Veja [Excluir a conta](/ajuda/excluir-conta).

## Relacionados

- [Organizar apresentações no painel](/ajuda/gerenciar-apresentacoes-dashboard)
$ha$, ARRAY[$ha$lixeira$ha$, $ha$excluir$ha$, $ha$apagar$ha$, $ha$deletar apresentação$ha$, $ha$recuperar$ha$, $ha$restaurar$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$nome-de-usuario$ha$, $ha$Escolher e alterar o nome de usuário$ha$, $ha$conta$ha$, $ha$O nome de usuário define o endereço do seu portfólio: `slideai.com.br/u/seu-usuario`.

## Regras

- De 3 a 30 caracteres.
- Letras minúsculas sem acento, números, hífen (-) e sublinhado (_).
- Precisa ser único na plataforma.

## Alterar

Em **Perfil → Dados**, edite o campo **Nome de usuário** e salve.

**Atenção:** ao trocar, o link antigo para de funcionar. Atualize-o nas suas redes e nos materiais já enviados.

## Se o nome já estiver em uso

Tente variações com a sua área ou as suas iniciais, como `ana-design` ou `ana_r`.
$ha$, ARRAY[$ha$username$ha$, $ha$usuário$ha$, $ha$nome de usuário$ha$, $ha$link do perfil$ha$, $ha$@$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$perfil-e-portfolio-publico$ha$, $ha$Criar um perfil e portfólio público profissional$ha$, $ha$conta$ha$, $ha$O portfólio público reúne as apresentações que você publicou em uma página com o seu nome: `slideai.com.br/u/seu-usuario`.

## Como montar

1. Em **Perfil → Dados**, preencha nome, nome de usuário, bio, localização, site e redes sociais, e envie uma foto.
2. Em **Perfil → Portfólio**, ative o portfólio e escolha se ele é público ou privado.
3. [Publique](/ajuda/publicar-e-despublicar) as apresentações que quer mostrar. Só as publicadas aparecem.

## Recomendações

- Use uma foto nítida e uma bio curta e específica.
- Mantenha só apresentações que representam bem o seu trabalho.
- Confira os links das redes sociais antes de salvar.
- Não publique apresentações com informações confidenciais ou dados de terceiros.

## Privacidade

O perfil público mostra só o que você preencher. Você pode deixá-lo privado ou desativá-lo a qualquer momento. Veja [Perfil privado e solicitações de acesso](/ajuda/portfolio-privado-solicitacoes).
$ha$, ARRAY[$ha$perfil$ha$, $ha$portfólio$ha$, $ha$username$ha$, $ha$usuário$ha$, $ha$público$ha$, $ha$bio$ha$, $ha$redes sociais$ha$, $ha$vitrine$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$portfolio-privado-solicitacoes$ha$, $ha$Perfil privado e solicitações de acesso$ha$, $ha$conta$ha$, $ha$Em **Perfil → Portfólio** você decide quem vê o seu portfólio.

- **Público:** qualquer pessoa com o link vê as apresentações publicadas.
- **Privado:** visitantes veem só um aviso de que o portfólio é restrito. Se você permitir, eles podem **solicitar acesso** com uma mensagem.

## Gerenciar solicitações

Na aba **Perfil → Acessos**, veja quem pediu acesso (o número aparece na aba) e aprove ou recuse.

## Importante

- Só apresentações **publicadas** aparecem no portfólio.
- Uma apresentação publicada continua acessível pelo link direto, mesmo com o portfólio privado. Para restringir de verdade, torne a apresentação privada.
$ha$, ARRAY[$ha$privado$ha$, $ha$portfólio$ha$, $ha$acesso$ha$, $ha$solicitação$ha$, $ha$aprovar$ha$, $ha$recusar$ha$, $ha$privacidade$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$seguranca-da-conta$ha$, $ha$Proteger sua conta SlideAI$ha$, $ha$conta$ha$, $ha$## Boas práticas

- Use uma senha exclusiva, com pelo menos 8 caracteres. Um gerenciador de senhas ajuda.
- Prefira o login com Google se sua conta Google tem verificação em duas etapas.
- Saia da conta em computadores compartilhados.
- Mantenha o e-mail da conta acessível: é por ele que você recupera o acesso.

## Trocar a senha

Em **Perfil → Segurança**, digite a nova senha (mínimo 8 caracteres) e clique em **Alterar senha**. Na mesma tela, **Sair de todas as sessões** encerra o acesso neste navegador.

## Atividade incomum

Se perceber algo estranho (apresentações que não criou, mudanças no perfil):

1. Troque a senha imediatamente.
2. Abra um atendimento contando o que aconteceu e o horário aproximado.

**O SlideAI nunca pede sua senha, código de verificação ou dados completos de cartão** por e-mail, chat ou telefone.

## Relacionados

- [Recuperar senha](/ajuda/recuperar-senha)
- [Aplicativos conectados](/ajuda/aplicativos-conectados)
$ha$, ARRAY[$ha$segurança$ha$, $ha$senha$ha$, $ha$conta$ha$, $ha$sessão$ha$, $ha$atividade incomum$ha$, $ha$hackeado$ha$, $ha$sair$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$atalhos-editor$ha$, $ha$Atalhos do editor e do modo apresentação$ha$, $ha$editor$ha$, $ha$## Editor

| Atalho | Ação |
| --- | --- |
| **Ctrl/Cmd + S** | Salvar agora (o salvamento automático roda a cada 30 s) |
| **Ctrl/Cmd + Z** | Desfazer |
| **Ctrl/Cmd + Y** ou **Ctrl/Cmd + Shift + Z** | Refazer |
| **Enter** (no assistente) | Enviar a mensagem |
| **Shift + Enter** (no assistente) | Quebrar linha |
| **Esc** | Fechar janelas e menus |

## Modo apresentação (visualizador)

| Atalho | Ação |
| --- | --- |
| **→**, **Espaço** ou **Page Down** | Próximo slide |
| **←** ou **Page Up** | Slide anterior |
| **Home** / **End** | Primeiro / último slide |
| **F** | Entrar ou sair da tela cheia |
| **Esc** | Sair da tela cheia |

Controles de passador de slides (clicker) que enviam Page Up/Page Down funcionam no modo apresentação.

## Relacionados

- [Modo apresentação](/ajuda/modo-apresentacao)
- [Salvamento, desfazer e refazer](/ajuda/salvamento-e-desfazer)
$ha$, ARRAY[$ha$atalhos$ha$, $ha$teclado$ha$, $ha$shortcut$ha$, $ha$ctrl$ha$, $ha$cmd$ha$, $ha$desfazer$ha$, $ha$refazer$ha$, $ha$salvar$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$duplicar-e-versionar$ha$, $ha$Criar variações de uma apresentação$ha$, $ha$editor$ha$, $ha$Quer adaptar a mesma apresentação para públicos diferentes (por exemplo, uma versão para a diretoria e outra para o time)? Hoje o SlideAI não tem um botão de duplicar. Estas são as alternativas:

## 1. Gerar de novo com o público ajustado

Use o mesmo título e descrição, mudando o público, o tom ou a profundidade. É o melhor caminho quando a estrutura precisa mudar. Custa uma nova geração. Veja [Quanto custa cada apresentação](/ajuda/custo-por-apresentacao).

## 2. Exportar e editar a cópia fora do SlideAI

Exporte em **PowerPoint (.pptx)** e faça a variação no PowerPoint, Keynote ou Google Slides. A original continua intacta no SlideAI.

## 3. Ajustar a mesma apresentação

Para mudanças pequenas e temporárias, edite direto e desfaça depois. Antes, exporte um PDF como registro da versão original.

## Relacionados

- [Exportar em PDF ou PPTX](/ajuda/exportar-pdf-pptx)
- [Editar slides conversando com a IA](/ajuda/editar-com-ia-chat)
$ha$, ARRAY[$ha$duplicar$ha$, $ha$cópia$ha$, $ha$versão$ha$, $ha$variação$ha$, $ha$reutilizar$ha$, $ha$adaptar$ha$, $ha$público diferente$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$editar-com-ia-chat$ha$, $ha$Editar slides conversando com a IA$ha$, $ha$editor$ha$, $ha$O editor tem um assistente que aplica mudanças descritas em linguagem natural.

## Exemplos de pedidos

- "Deixe o título do slide 3 mais curto e impactante."
- "Troque a imagem do slide 5 por algo mais corporativo."
- "Reescreva os slides 2 a 4 em tom mais formal."
- "Resuma o slide 7 em três tópicos."
- "Atualize o gráfico do slide 6 com os valores 12, 18 e 25."

Seja específico e cite o número do slide. Pedidos vagos ("melhore tudo") geram resultados imprevisíveis.

## Limites por apresentação

Cada apresentação permite até **10 mensagens** ao assistente e até **3 edições complexas**. Uma edição é complexa quando refaz conteúdo, vale para a apresentação inteira ou mexe em 3 ou mais slides de uma vez.

Os limites existem para controlar o custo de IA e são contados no servidor. Ao atingi-los, você continua editando à mão normalmente. Para mudanças profundas, gerar uma nova apresentação costuma dar um resultado melhor.

As edições pelo assistente **não consomem créditos**.

## Dicas

- Revise o resultado de cada pedido: se não gostar, use **Ctrl/Cmd + Z** para desfazer.
- Não envie dados pessoais sensíveis ou confidenciais: as mensagens são processadas por provedores de IA.

## Relacionados

- [Limites de uso e uso justo](/ajuda/limites-de-uso)
- [Salvamento, desfazer e refazer](/ajuda/salvamento-e-desfazer)
$ha$, ARRAY[$ha$chat$ha$, $ha$ia$ha$, $ha$editar$ha$, $ha$assistente$ha$, $ha$pedido$ha$, $ha$limite$ha$, $ha$edições complexas$ha$, $ha$mensagens$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$editar-slide$ha$, $ha$Como editar um slide$ha$, $ha$editor$ha$, $ha$O editor tem três áreas: a **lista de slides** à esquerda, o **slide** ao centro (com zoom) e o **painel de propriedades** à direita.

## Abas do painel

| Aba | O que você ajusta |
| --- | --- |
| **Texto** | Título, subtítulo, tópicos, destaques numéricos e citações |
| **Visual** | Elementos visuais do slide: ícones, gráficos, blocos e cores |
| **Imagem** | Imagem do slide: busca de foto, imagem por IA ou link próprio |
| **Animação** | Transição e coreografia de entrada dos elementos |
| **Layout** | Disposição do conteúdo no slide |
| **Slide** | Tipo do slide e notas do apresentador |

## Passo a passo

1. Clique no slide na lista da esquerda.
2. Escolha a aba e altere o que precisar. O slide central mostra o resultado na hora.
3. O salvamento é automático a cada 30 segundos, e você pode salvar a qualquer momento com **Ctrl/Cmd + S**. O topo mostra "Salvando…", "Não salvo" ou "Salvo" com o horário.

Prefere descrever a mudança? Use o [assistente de edição por IA](/ajuda/editar-com-ia-chat).

## Relacionados

- [Salvamento, desfazer e refazer](/ajuda/salvamento-e-desfazer)
- [Reordenar, adicionar e remover slides](/ajuda/reordenar-e-remover-slides)
- [Atalhos do editor](/ajuda/atalhos-editor)
$ha$, ARRAY[$ha$editar$ha$, $ha$editor$ha$, $ha$mudar$ha$, $ha$alterar$ha$, $ha$texto$ha$, $ha$título$ha$, $ha$layout$ha$, $ha$visual$ha$, $ha$animação$ha$, $ha$painel$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$problemas-imagem$ha$, $ha$Imagens não carregam, demoram ou saem borradas$ha$, $ha$editor$ha$, $ha$## A imagem ainda não apareceu

As imagens de uma apresentação nova são buscadas e geradas depois que ela abre. Espere alguns segundos com a apresentação aberta no editor. Se continuar sem imagem, troque-a manualmente na aba **Imagem**.

## A imagem não carrega para quem recebe o link

Geralmente é bloqueio de rede, antivírus ou extensão de bloqueio de anúncios no computador do espectador. Peça para testar em janela anônima ou outra rede.

## A imagem está borrada

A foto encontrada tem resolução baixa para o tamanho do slide. Busque outra com um termo mais específico ou gere uma por IA.

## A imagem não combina com o tema

Refine o termo de busca ou o prompt, com o objeto, o lugar e o estilo desejados. Ex.: em vez de "tecnologia", "equipe trabalhando com notebooks em escritório iluminado".

## Relacionados

- [Como trocar a imagem de um slide](/ajuda/trocar-imagem)
- [Diagnóstico de conexão](/ajuda/diagnostico-de-conexao)
$ha$, ARRAY[$ha$imagem$ha$, $ha$borrada$ha$, $ha$não carrega$ha$, $ha$demora$ha$, $ha$pexels$ha$, $ha$qualidade$ha$, $ha$ruim$ha$, $ha$fora do tema$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$regenerar-falas$ha$, $ha$Regenerar as falas no editor$ha$, $ha$editor$ha$, $ha$Em apresentações geradas **com falas dos apresentadores**, o painel de falas do editor permite pedir um novo roteiro — por exemplo, depois de reescrever vários slides.

## Como funciona

- Abra o painel de falas no editor e use a opção de regenerar.
- As falas são refeitas com base no conteúdo atual dos slides e nos nomes dos apresentadores.
- Cada apresentação permite até **5 regenerações**. O painel mostra quantas restam.
- A regeneração não consome créditos: ela faz parte das falas contratadas na geração.

## Apresentações sem falas

Se a apresentação foi gerada sem as falas, a regeneração não está disponível. Você pode escrever as notas à mão na aba **Slide** ou gerar uma nova apresentação com as falas ativadas.

## Relacionados

- [Falas dos apresentadores](/ajuda/falas-dos-apresentadores)
- [Exportar o roteiro de falas](/ajuda/exportar-roteiro)
$ha$, ARRAY[$ha$regenerar falas$ha$, $ha$refazer roteiro$ha$, $ha$falas$ha$, $ha$apresentadores$ha$, $ha$limite$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$reordenar-e-remover-slides$ha$, $ha$Reordenar, adicionar e remover slides$ha$, $ha$editor$ha$, $ha$- **Reordenar:** arraste o slide na lista da esquerda até a nova posição.
- **Adicionar:** clique no **+** no topo da lista para criar um slide em branco e preencha título, texto e imagem.
- **Remover:** use a opção de excluir do próprio slide. Se se arrepender, desfaça com **Ctrl/Cmd + Z** antes de sair do editor.

## Cuidados

- Mantenha a **capa como primeiro slide**: ela é usada na prévia do link compartilhado.
- No **Slide Dinâmico (Magic Move)**, elementos repetidos entre slides vizinhos criam o efeito de continuidade. Reordenar pode mudar esse encadeamento — confira no modo de apresentação.
- Se a apresentação tem **falas dos apresentadores**, revise as falas dos slides que você moveu ou criou.

## Relacionados

- [Como editar um slide](/ajuda/editar-slide)
- [O que é o Slide Dinâmico](/ajuda/slide-dinamico)
$ha$, ARRAY[$ha$ordem$ha$, $ha$reordenar$ha$, $ha$arrastar$ha$, $ha$excluir slide$ha$, $ha$adicionar slide$ha$, $ha$novo slide$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$salvamento-e-desfazer$ha$, $ha$Salvamento automático, desfazer e refazer$ha$, $ha$editor$ha$, $ha$## Como o editor salva

- **Automático:** a cada 30 segundos, se houver alterações.
- **Manual:** **Ctrl/Cmd + S** a qualquer momento.
- **Indicador no topo:** "Salvando…", "Não salvo" (há alterações pendentes) ou "Salvo" com o horário.
- **Proteção ao sair:** se você tentar fechar a aba ou sair com alterações não salvas, o navegador pede confirmação.

## Desfazer e refazer

Use **Ctrl/Cmd + Z** para desfazer e **Ctrl/Cmd + Y** (ou **Ctrl/Cmd + Shift + Z**) para refazer. Vale também para mudanças feitas pelo assistente de IA.

## "A última alteração não foi salva"

1. Verifique a internet e clique em salvar de novo (**Ctrl/Cmd + S**).
2. Não feche a aba enquanto o indicador mostrar "Não salvo".
3. Se o erro continuar, copie o texto alterado, recarregue a página e cole de novo. Abra um atendimento com o código exibido (**EDIT-001**).

## Relacionados

- [Diagnóstico de conexão](/ajuda/diagnostico-de-conexao)
- [Atalhos do editor](/ajuda/atalhos-editor)
$ha$, ARRAY[$ha$salvar$ha$, $ha$salvamento automático$ha$, $ha$autosave$ha$, $ha$desfazer$ha$, $ha$refazer$ha$, $ha$perdi alterações$ha$, $ha$não salvou$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$slide-dinamico$ha$, $ha$O que é o Slide Dinâmico (Magic Move)$ha$, $ha$editor$ha$, $ha$No **Slide Dinâmico**, título e imagem principal "viajam" de um slide para o outro — mudam de posição, tamanho e forma — em vez de a tela simplesmente trocar. O efeito dá continuidade à narrativa e acabamento de apresentação premium.

## Como ativar

- **Na geração:** deixe ligada a opção **Slide Dinâmico (Magic Move)** no formulário. O motor planeja a apresentação para aproveitar o efeito.
- **No editor:** na aba **Animação**, escolha a transição de cada slide.

## Quando funciona melhor

- Slides seguidos com a mesma imagem ou com títulos curtos e relacionados.
- Telas grandes e computadores com boa capacidade gráfica.

## Quando preferir o clássico

Em computadores antigos ou em bancas e avaliações formais, transições clássicas são mais leves e sóbrias. Veja [Clássico ou Magic Move](/ajuda/classico-vs-magic-move).
$ha$, ARRAY[$ha$dinâmico$ha$, $ha$dynamic$ha$, $ha$magic move$ha$, $ha$transição$ha$, $ha$animação$ha$, $ha$continuidade$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$texto-nao-cabe$ha$, $ha$O texto está estourando ou muito pequeno no slide$ha$, $ha$editor$ha$, $ha$O layout é dimensionado para o volume de texto gerado. Textos colados ou ampliados manualmente podem ultrapassar a área útil, e o slide reduz a fonte para caber.

## Como resolver

1. **Enxugue o texto.** Regra prática: até 6 linhas por bloco.
2. **Divida o conteúdo** em dois slides.
3. **Troque o layout** na aba **Layout**, para um formato com mais área de texto.
4. **Peça ao assistente:** "resuma o slide 4 em 3 tópicos".
5. Em novas gerações, use a profundidade **Curto** ou **Equilibrado**.

Se o problema aparece em um slide gerado sem nenhuma edição, abra um atendimento com o código de erro exibido e o link da apresentação.

## Relacionados

- [Profundidade do texto](/ajuda/profundidade-dos-textos)
- [Como editar um slide](/ajuda/editar-slide)
$ha$, ARRAY[$ha$texto$ha$, $ha$overflow$ha$, $ha$fonte pequena$ha$, $ha$layout quebrado$ha$, $ha$texto grande$ha$, $ha$cortado$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$trocar-imagem$ha$, $ha$Como trocar a imagem de um slide$ha$, $ha$editor$ha$, $ha$1. No editor, selecione o slide e abra a aba **Imagem**.
2. Escolha a estratégia:
   - **Pexels (foto real):** informe um termo de busca. Termos em inglês costumam trazer mais resultados (ex.: "spanish flag sunset").
   - **Gerar com IA:** descreva a imagem que você quer no campo de prompt.
   - **Imagem própria:** cole o endereço (URL) de uma imagem na internet.
3. Clique no botão para buscar ou gerar. A nova imagem entra no slide na hora.

## Custo e limites

Trocar imagens **não consome créditos**. Imagens por IA pedidas no editor têm limite de **15 por hora** por conta, e exigem plano ativo ou créditos disponíveis.

## Direitos das imagens

- Fotos do Pexels seguem a licença do Pexels: uso gratuito, inclusive comercial, com algumas restrições.
- Ao colar o link de uma imagem, **você é responsável por ter o direito de usá-la**.

Veja [Direitos sobre as apresentações e uso comercial](/ajuda/direitos-autorais-e-uso-comercial).

## Relacionados

- [Imagens não carregam ou saem borradas](/ajuda/problemas-imagem)
- [Fotos ou imagens geradas por IA](/ajuda/imagens-ia-vs-pexels)
$ha$, ARRAY[$ha$imagem$ha$, $ha$foto$ha$, $ha$trocar imagem$ha$, $ha$pexels$ha$, $ha$ia$ha$, $ha$link$ha$, $ha$url$ha$, $ha$banner$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$exportar-imagens-e-web$ha$, $ha$Formatos de saída: qual usar em cada situação$ha$, $ha$exportacao$ha$, $ha$| Situação | Melhor formato | Por quê |
| --- | --- | --- |
| Apresentar com todas as animações | **Link publicado** | Mantém transições e é sempre a versão mais recente |
| Enviar por e-mail ou entregar trabalho | **PDF** | Abre em qualquer lugar, com o visual fiel |
| Imprimir | **PDF** | Um slide por página |
| Continuar editando em outro programa | **PowerPoint (.pptx)** | Editável no PowerPoint, Keynote e Google Slides |
| Postar um slide em rede social | **PNG** | Imagem do slide exibido |
| Ensaiar a fala ou dividir com o grupo | **Roteiro** (PDF, Word ou texto) | Disponível em apresentações com falas |
| Apresentar sem internet | **PDF** ou **PowerPoint** | O link precisa de conexão |

## Relacionados

- [Como exportar em PDF, PowerPoint ou imagem](/ajuda/exportar-pdf-pptx)
- [Compartilhar uma apresentação](/ajuda/compartilhar-apresentacao)
$ha$, ARRAY[$ha$formatos$ha$, $ha$pdf$ha$, $ha$pptx$ha$, $ha$png$ha$, $ha$roteiro$ha$, $ha$link$ha$, $ha$qual usar$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$exportar-pdf-pptx$ha$, $ha$Como exportar em PDF, PowerPoint ou imagem$ha$, $ha$exportacao$ha$, $ha$O botão **Exportar** fica no editor, no visualizador e no painel (Minhas apresentações).

| Formato | O que gera | Observações |
| --- | --- | --- |
| **PowerPoint (.pptx)** | Arquivo editável no PowerPoint, Keynote ou Google Slides | Animações avançadas viram estáticas; veja [PPTX diferente do editor](/ajuda/pptx-diferente-do-editor) |
| **PDF (alta fidelidade)** | Um slide por página, com a paleta e as fontes da apresentação | Ideal para enviar, imprimir e arquivar |
| **Imagem (.png)** | Imagem do slide que está na tela | Funciona no visualizador: abra o slide desejado e exporte |

As exportações **não consomem créditos** e podem ser feitas quantas vezes você quiser.

## Roteiro de falas

Com as falas dos apresentadores, o painel de falas exporta o roteiro em PDF, Word e texto. Veja [Exportar o roteiro de falas](/ajuda/exportar-roteiro).

## Se a exportação falhar

Veja [Resolver falhas ao exportar](/ajuda/resolver-falha-na-exportacao).
$ha$, ARRAY[$ha$exportar$ha$, $ha$pdf$ha$, $ha$pptx$ha$, $ha$powerpoint$ha$, $ha$png$ha$, $ha$imagem$ha$, $ha$download$ha$, $ha$baixar$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$exportar-roteiro$ha$, $ha$Exportar o roteiro de falas (PDF, Word e texto)$ha$, $ha$exportacao$ha$, $ha$Apresentações geradas com as [falas dos apresentadores](/ajuda/falas-dos-apresentadores) têm um roteiro completo, slide a slide, pronto para ensaiar.

## Como exportar

No editor, abra o **painel de falas** e escolha:

- **PDF:** roteiro formatado, com numeração dos slides e contagem de palavras.
- **Word (.docx):** para editar ou dividir com o grupo.
- **Texto (.txt):** simples, para qualquer programa.
- **Imprimir:** versão pronta para papel.

## Dica para grupos

Cada apresentador aparece identificado pelo nome. Envie o arquivo Word ao grupo para cada pessoa marcar a sua parte.
$ha$, ARRAY[$ha$roteiro$ha$, $ha$falas$ha$, $ha$script$ha$, $ha$exportar$ha$, $ha$docx$ha$, $ha$word$ha$, $ha$txt$ha$, $ha$imprimir$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$pptx-diferente-do-editor$ha$, $ha$O PowerPoint exportado ficou diferente do editor$ha$, $ha$exportacao$ha$, $ha$## Por que acontece

O PowerPoint não suporta todos os recursos do SlideAI: animações de elementos, alguns efeitos de composição e fontes que não estão instaladas no computador que abre o arquivo.

## Como reduzir as diferenças

1. **Fontes trocadas:** instale as fontes da apresentação (são do Google Fonts, gratuitas) ou abra o arquivo no Google Slides, que as carrega sozinho.
2. Prefira o **PDF** quando o objetivo é apenas distribuir: o visual é fiel.
3. Ajuste posições pontuais direto no PowerPoint.
4. Para apresentar com o visual completo e as animações, use o **link publicado**.
$ha$, ARRAY[$ha$pptx$ha$, $ha$powerpoint$ha$, $ha$diferente$ha$, $ha$fonte$ha$, $ha$trocada$ha$, $ha$layout$ha$, $ha$animação$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$resolver-falha-na-exportacao$ha$, $ha$Resolver falhas ao exportar$ha$, $ha$exportacao$ha$, $ha$1. Abra a apresentação e espere todos os slides e imagens carregarem.
2. Tente de novo com a aba em primeiro plano (sem trocar de aba durante a exportação).
3. Verifique se o navegador **bloqueou o download** — procure o aviso na barra de endereço e permita downloads do site.
4. Se uma imagem específica causa o erro, troque-a no editor e repita.
5. Teste em outro navegador (Chrome ou Edge atualizados) ou em janela anônima.

Persistindo, abra um atendimento com o título da apresentação, o formato escolhido e o código exibido (**UI-003** para PDF, **UI-004** para PowerPoint).

## Relacionados

- [Navegadores e dispositivos suportados](/ajuda/navegadores-suportados)
$ha$, ARRAY[$ha$exportar$ha$, $ha$pdf$ha$, $ha$pptx$ha$, $ha$falha$ha$, $ha$download$ha$, $ha$erro$ha$, $ha$bloqueado$ha$, $ha$UI-003$ha$, $ha$UI-004$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$capas-de-apresentacao$ha$, $ha$Como o SlideAI cria a capa da apresentação$ha$, $ha$geracao$ha$, $ha$A capa é tratada de forma diferente dos demais slides: o motor busca um elemento **altamente representativo** do assunto.

- "História da Espanha" → bandeira, arquitetura icônica ou mapa histórico.
- "Fotossíntese" → folha em close com luz.
- "Startup de fintech" → composição gráfica com elementos financeiros.

## Formatos de capa

- **Tela cheia:** imagem ocupando todo o slide, com o título sobreposto.
- **Composição parcial:** imagem em bloco lateral ou diagonal, com área dedicada ao texto.
- **Gráfica:** fundo com formas e cores do tema, quando uma imagem não ajudaria.

## Capa e compartilhamento

A capa também é a imagem da prévia do link publicado: ao enviar a URL no WhatsApp, LinkedIn ou e-mail, aparecem o título e a capa. Por isso, mantenha a capa como primeiro slide. Veja [Prévia do link compartilhado](/ajuda/link-publico-preview).

## Trocar a imagem da capa

No editor, selecione o primeiro slide e use a aba **Imagem**. Veja [Como trocar a imagem de um slide](/ajuda/trocar-imagem).
$ha$, ARRAY[$ha$capa$ha$, $ha$cover$ha$, $ha$primeira página$ha$, $ha$preview$ha$, $ha$imagem de capa$ha$, $ha$título$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$configurar-geracao-inteligente$ha$, $ha$Todas as opções do formulário de geração$ha$, $ha$geracao$ha$, $ha$Referência completa de cada campo da tela **Criar apresentação** e do que ele muda no resultado.

| Campo | Opções | Efeito | Custo |
| --- | --- | --- | --- |
| Título / Tema | Texto livre (obrigatório) | Assunto central e título da capa | — |
| Descrição | Texto livre (recomendado) | Público, objetivo, dados e tom — o campo que mais melhora o resultado | — |
| Número de slides | 5 a 20 | Tamanho da apresentação | 10 créditos por slide |
| Tipo | Acadêmico, Escolar, Corporativo, Marketing, Criativo, Científico, Pitch de negócios | Estrutura narrativa e linguagem | — |
| Idioma | Português, English, Español | Idioma de todo o conteúdo | — |
| Tema visual | Automático (Tema inteligente) ou um tema fixo | Cores, fontes e estilo | — |
| Gráficos e dados | Ligado/desligado | Cria gráficos quando o conteúdo tem números | — |
| Imagens reais | Ligado/desligado | Fotos do Pexels e imagens geradas por IA | — |
| Slide Dinâmico | Ligado/desligado | Título e imagem migram entre slides (Magic Move) | — |
| Profundidade do texto | Curto, Equilibrado, Longo | Quantidade de contexto e detalhe por slide | +10, +20 ou +30 |
| Persona do orador | Educador, Autoridade técnica, Líder inspiracional, Vendedor | Tom de voz dos textos | — |
| Apresentadores | 1 a 8, com nomes | Divide a apresentação entre as pessoas | — |
| Falas dos apresentadores | Ligado/desligado | Roteiro do que cada pessoa diz em cada slide | +50 |

## Resumo de custo

Antes de gerar, o formulário mostra a soma dos créditos e o saldo que vai sobrar. Se o saldo não cobrir, o botão vira **Continuar para pagamento** — sua configuração fica salva.

No plano MAX o custo não aparece, porque o uso é ilimitado dentro da Política de Uso Justo. Veja [Limites de uso e uso justo](/ajuda/limites-de-uso).

## Pré-preenchimento

- A escolha feita no primeiro acesso (estudante, professor, profissional ou criador) sugere tipo, persona e profundidade.
- Os [templates](/templates) preenchem título e descrição de modelos prontos.

Você pode alterar tudo antes de gerar.

## Relacionados

- [Profundidade do texto](/ajuda/profundidade-dos-textos)
- [Tipo de apresentação e persona do orador](/ajuda/tipos-e-personas)
- [Falas dos apresentadores](/ajuda/falas-dos-apresentadores)
$ha$, ARRAY[$ha$gerar$ha$, $ha$configuração$ha$, $ha$opções$ha$, $ha$formulário$ha$, $ha$tema inteligente$ha$, $ha$descrição$ha$, $ha$profundidade$ha$, $ha$gráficos$ha$, $ha$imagens$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$conteudo-recusado$ha$, $ha$Tema recusado ou conteúdo não permitido$ha$, $ha$geracao$ha$, $ha$Os provedores de IA que usamos aplicam filtros de segurança, e os [Termos de Uso](/termos#condutas) proíbem alguns tipos de conteúdo. Quando um tema é recusado, a geração não acontece e **os créditos da tentativa são devolvidos**.

## O que costuma ser recusado

- Conteúdo sexual envolvendo menores (proibido em qualquer contexto).
- Incitação ao ódio, à violência ou à discriminação.
- Instruções para atividades ilegais, fraudes ou golpes.
- Montagens enganosas de pessoas reais.

## Temas legítimos recusados por engano

Às vezes, assuntos educativos ou jornalísticos sobre temas sensíveis (saúde, crimes, guerras) são barrados por palavras isoladas. Para contornar:

- Deixe claro o objetivo na descrição: "aula de história para o ensino médio sobre…", "apresentação de conscientização sobre prevenção de…".
- Evite detalhes explícitos desnecessários.

Se o problema continuar, abra um atendimento com o código **GEN-007**.

## Relacionados

- [Termos de Uso em linguagem simples](/ajuda/termos-de-uso-resumo)
- [Denunciar uma apresentação ou perfil](/ajuda/denunciar-conteudo)
$ha$, ARRAY[$ha$recusado$ha$, $ha$política de conteúdo$ha$, $ha$bloqueado$ha$, $ha$não permitido$ha$, $ha$filtro$ha$, $ha$GEN-007$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$escolher-numero-de-slides$ha$, $ha$Quantos slides escolher para cada tipo de apresentação$ha$, $ha$geracao$ha$, $ha$Cada geração tem de **5 a 20 slides**. A capa conta como slide.

## Referência rápida

| Situação | Slides | Duração aproximada |
| --- | --- | --- |
| Pitch relâmpago | 5 a 7 | 3 a 5 min |
| Reunião de resultados | 8 a 12 | 10 a 20 min |
| Trabalho escolar | 8 a 12 | 10 a 15 min |
| Aula ou treinamento | 12 a 16 | 20 a 30 min |
| Palestra ou workshop | 16 a 20 | 30 a 45 min |

Conte de 1 a 2 minutos por slide quando há fala.

## Precisa de mais de 20 slides?

Divida o conteúdo em partes (por exemplo, "Módulo 1" e "Módulo 2") e gere uma apresentação para cada. Isso também melhora o foco de cada bloco.

## Veio com menos slides do que o pedido?

Acontece raramente, quando o tema é curto demais para o número de slides. Detalhe mais a descrição (tópicos, exemplos, dados) ou reduza o número de slides. Você também pode adicionar slides no editor. Se o problema se repetir, fale com o suporte informando o código de erro exibido.

## Relacionados

- [Como escrever um bom tema](/ajuda/escrever-bom-prompt)
- [Reordenar, adicionar e remover slides](/ajuda/reordenar-e-remover-slides)
$ha$, ARRAY[$ha$quantidade$ha$, $ha$slides$ha$, $ha$duração$ha$, $ha$tempo$ha$, $ha$limite$ha$, $ha$20 slides$ha$, $ha$menos slides$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$falas-dos-apresentadores$ha$, $ha$Falas dos apresentadores: o que são e quanto custam$ha$, $ha$geracao$ha$, $ha$As **falas dos apresentadores** são o roteiro do que cada pessoa vai dizer em cada slide. É uma etapa opcional do formulário de geração, com custo adicional de **50 créditos** por apresentação.

## O que você recebe

- Texto de fala para cada slide, dividido entre os apresentadores que você cadastrou (de 1 a 8, com nomes).
- Notas do apresentador sempre preenchidas em todos os slides.
- Painel de falas no editor e no visualizador, com exportação do roteiro em PDF, Word (.docx) e texto (.txt), além de impressão.
- Até 5 regenerações das falas por apresentação, no editor. Veja [Regenerar as falas](/ajuda/regenerar-falas).

## Como ativar

No formulário, em **Apresentadores**, defina quantas pessoas vão apresentar e os nomes. Depois ative **Gerar falas dos apresentadores**. O resumo de custo passa a mostrar a linha "Falas dos apresentadores: 50".

Se o saldo não cobrir a geração com falas, a opção fica desativada e o formulário avisa.

## Sem as falas

A apresentação é gerada normalmente, com os textos dos slides. As notas do apresentador podem ficar vazias ou curtas, e você pode escrevê-las à mão no editor, sem custo.

## Quem vê as falas

Você, no editor e no visualizador. Em apresentações **publicadas**, quem tem o link também pode abrir o painel de falas — é assim que coapresentadores acompanham suas partes. Se as falas tiverem algo confidencial, mantenha a apresentação privada.

## Relacionados

- [Usar as notas do apresentador](/ajuda/notas-do-apresentador)
- [Exportar o roteiro de falas](/ajuda/exportar-roteiro)
- [Quanto custa cada apresentação](/ajuda/custo-por-apresentacao)
$ha$, ARRAY[$ha$falas$ha$, $ha$roteiro$ha$, $ha$script$ha$, $ha$apresentadores$ha$, $ha$notas$ha$, $ha$orador$ha$, $ha$50 créditos$ha$, $ha$speaker notes$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$geracao-lenta$ha$, $ha$A geração está demorando ou falhou$ha$, $ha$geracao$ha$, $ha$O normal é a apresentação ficar pronta **entre 20 segundos e 1 minuto**. Apresentações com 20 slides, texto longo e falas podem levar um pouco mais.

## Se estiver demorando

1. **Não gere de novo em seguida.** A primeira geração continua no servidor, mesmo que você feche a aba.
2. Depois de 3 minutos, abra o **painel** (Minhas apresentações): se a geração terminou, ela estará lá.
3. Se não estiver, tente novamente com menos slides ou com a descrição mais curta.

## Se a geração falhar

- Quando a falha é nossa, os créditos daquela tentativa **voltam automaticamente** para o seu saldo, e a mensagem de erro informa quanto foi devolvido. Confira em **Perfil → Créditos**, no extrato ("Devolução de geração com falha").
- Se a geração for interrompida sem mensagem nenhuma (uma queda no meio do processo, por exemplo), os créditos voltam sozinhos em até 15 minutos. Veja [Créditos devolvidos](/ajuda/creditos-devolvidos).

## Outras mensagens

- **"Muitas gerações em pouco tempo":** o limite é de 12 gerações por hora por conta. Aguarde alguns minutos.
- **Tema recusado:** veja [Tema recusado ou conteúdo não permitido](/ajuda/conteudo-recusado).
- **Créditos insuficientes:** ajuste as opções ou adquira créditos.

## Relacionados

- [Entendendo os códigos de erro](/ajuda/codigos-de-erro)
- [Limites de uso](/ajuda/limites-de-uso)
$ha$, ARRAY[$ha$lento$ha$, $ha$demora$ha$, $ha$travou$ha$, $ha$geração$ha$, $ha$esperando$ha$, $ha$loading$ha$, $ha$erro$ha$, $ha$timeout$ha$, $ha$falhou$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$gerar-para-aula$ha$, $ha$Apresentações para aulas e trabalhos escolares$ha$, $ha$geracao$ha$, $ha$## Configuração recomendada

| Campo | Aula expositiva | Trabalho de aluno |
| --- | --- | --- |
| Tipo | Escolar ou Acadêmico | Escolar |
| Persona | Educador (didático) | Educador (didático) |
| Profundidade | Equilibrado (ou Longo, se for material de estudo) | Equilibrado |
| Slides | 12 a 16 | 8 a 12 |
| Falas | Úteis para ensaiar | Úteis para dividir entre o grupo (até 8 apresentadores) |

## Boas práticas

1. Cite a série, o curso ou a faixa etária na descrição — a linguagem se ajusta.
2. Peça exemplos, perguntas para a turma ou exercícios de fixação.
3. Em trabalhos em grupo, cadastre os nomes dos integrantes em **Apresentadores** e ative as falas: cada um recebe sua parte.
4. **Confira datas, nomes e dados.** A IA pode errar. Para trabalhos avaliados, cite suas fontes e revise o conteúdo com atenção. Veja [Revise o conteúdo gerado](/ajuda/revisar-conteudo-gerado).
5. Exporte em PDF para entregar pelo portal da escola.

## Estudantes menores de 18 anos

O uso por adolescentes deve ter autorização e supervisão dos pais ou responsáveis, que fazem as compras. Veja [Uso por estudantes menores de 18 anos](/ajuda/menores-de-idade).

## Relacionados

- [Tipo de apresentação e persona](/ajuda/tipos-e-personas)
- [Falas dos apresentadores](/ajuda/falas-dos-apresentadores)
$ha$, ARRAY[$ha$escola$ha$, $ha$aula$ha$, $ha$professor$ha$, $ha$trabalho$ha$, $ha$estudante$ha$, $ha$seminário$ha$, $ha$faculdade$ha$, $ha$TCC$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$gerar-para-negocios$ha$, $ha$Apresentações comerciais, pitches e reuniões de resultados$ha$, $ha$geracao$ha$, $ha$## Configuração recomendada

- **Tipo:** Pitch de negócios, Corporativo ou Marketing.
- **Persona:** Vendedor (propostas), Líder inspiracional (investidores) ou Autoridade técnica (resultados).
- **Profundidade:** Curto ou Equilibrado — slides de negócio funcionam melhor com poucas palavras e forte apoio visual.
- **Slides:** 7 a 12 para pitch; 10 a 15 para reunião de resultados.
- **Gráficos e dados:** ligado, com os números reais na descrição.

## Estrutura que costuma funcionar

1. Capa com a proposta de valor
2. Problema
3. Solução
4. Como funciona
5. Diferenciais
6. Prova (dados, casos, depoimentos)
7. Oferta e próximos passos

## Cuidados

- **Coloque números e nomes reais na descrição** para o motor usá-los em vez de criar exemplos.
- **Revise tudo antes de enviar a clientes ou investidores:** valores, projeções, nomes de empresas e marcas. Você é responsável pelo uso do conteúdo. Veja [Revise o conteúdo gerado](/ajuda/revisar-conteudo-gerado).
- Não inclua informações confidenciais em apresentações publicadas.

## Uso comercial

Você pode usar as apresentações que gerar em negócios, propostas e vendas. Veja [Direitos sobre as apresentações](/ajuda/direitos-autorais-e-uso-comercial).
$ha$, ARRAY[$ha$pitch$ha$, $ha$comercial$ha$, $ha$vendas$ha$, $ha$reunião$ha$, $ha$negócios$ha$, $ha$investidores$ha$, $ha$resultados$ha$, $ha$proposta$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$graficos-e-dados$ha$, $ha$Gráficos e dados: como a IA cria visualizações$ha$, $ha$geracao$ha$, $ha$Com a opção **Gráficos e dados** ligada, o SlideAI transforma conteúdo numérico em visualizações: gráficos, números em destaque, comparações e linhas do tempo.

## Como aproveitar

- **Informe os números reais na descrição.** Ex.: "Faturamento 2025: R$ 1,2 mi; 2026: R$ 1,8 mi; meta 2027: R$ 2,5 mi." A IA usa esses valores nos gráficos.
- **Sem números, a IA pode criar exemplos ilustrativos.** Eles servem de estrutura, mas **precisam ser substituídos ou conferidos** antes de você apresentar. Veja [Revise o conteúdo gerado](/ajuda/revisar-conteudo-gerado).
- Desligue a opção em apresentações puramente conceituais, se preferir slides só com texto e imagens.

## Editar os dados

No editor, selecione o slide do gráfico e ajuste valores e rótulos na aba **Texto** ou **Visual**. Você também pode pedir ao assistente: "atualize o gráfico do slide 4 com estes valores: …".

## Relacionados

- [Apresentações comerciais e reuniões de resultados](/ajuda/gerar-para-negocios)
- [Editar slides conversando com a IA](/ajuda/editar-com-ia-chat)
$ha$, ARRAY[$ha$gráfico$ha$, $ha$dados$ha$, $ha$números$ha$, $ha$chart$ha$, $ha$visualização$ha$, $ha$indicadores$ha$, $ha$estatística$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$imagens-ia-vs-pexels$ha$, $ha$Fotos ou imagens geradas por IA: como o SlideAI escolhe$ha$, $ha$geracao$ha$, $ha$Com a opção **Imagens reais** ligada, o motor decide, slide a slide, qual é a melhor fonte visual.

| Fonte | Quando é usada | Exemplos |
| --- | --- | --- |
| **Foto do Pexels** | Existe uma foto real e representativa do assunto | Lugares, pessoas, objetos, natureza, cidades |
| **Imagem gerada por IA** | O conceito é abstrato, precisa de composição específica ou não há foto adequada | Conceitos, diagramas ilustrados, cenas específicas |
| **Elemento gráfico nativo** | O slide pede ícones, números em destaque, gráficos ou formas | Indicadores, comparações, linhas do tempo |

Um mesmo deck pode misturar fotos, ilustrações e composições gráficas. Isso é intencional e dá ritmo visual.

## Custo

Imagens **não consomem créditos** hoje: o custo da apresentação é só o dos slides, da profundidade e das falas. Existem limites de frequência para gerar imagens por IA no editor. Veja [Limites de uso](/ajuda/limites-de-uso).

## As imagens aparecem aos poucos

As fotos e imagens são buscadas e geradas depois que a apresentação abre. É normal ver um fundo ou degradê por alguns segundos antes da imagem aparecer, principalmente no primeiro acesso.

## Direitos de uso

Fotos do Pexels podem ser usadas gratuitamente, inclusive em uso comercial, mas não podem ser vendidas sem alteração nem usadas de forma ofensiva com pessoas identificáveis. Veja [Direitos sobre as apresentações](/ajuda/direitos-autorais-e-uso-comercial).

## Se a imagem não combinar

No editor, use **Trocar imagem**: informe um termo de busca mais específico, peça uma imagem por IA ou cole o link de uma imagem sua. Veja [Como trocar a imagem de um slide](/ajuda/trocar-imagem).
$ha$, ARRAY[$ha$imagem$ha$, $ha$ia$ha$, $ha$pexels$ha$, $ha$foto$ha$, $ha$banco de imagens$ha$, $ha$ilustração$ha$, $ha$custo$ha$, $ha$créditos$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$profundidade-dos-textos$ha$, $ha$Profundidade do texto: curto, equilibrado e longo$ha$, $ha$geracao$ha$, $ha$A profundidade define quanta contextualização, exemplos e detalhes cada slide traz — não só o número de palavras.

| Profundidade | Como fica o slide | Quando usar | Custo |
| --- | --- | --- | --- |
| **Curto** | Uma ideia afiada por slide, frases de impacto | Pitches, palestras, telas grandes, quando você vai falar muito | +10 créditos |
| **Equilibrado** | Clareza com substância: contexto suficiente para entender sozinho | A maioria das apresentações | +20 créditos |
| **Longo** | Contexto, causa, exemplo e implicação | Aulas, material de estudo, relatórios que serão lidos | +30 créditos |

O custo da profundidade é cobrado uma vez por apresentação, somado aos 10 créditos por slide.

## Dicas

- Slides com muito texto funcionam mal em projetores. Se a apresentação vai ser **lida** (enviada por e-mail ou usada como apostila), o longo faz sentido; se vai ser **falada**, prefira curto ou equilibrado e use as [falas dos apresentadores](/ajuda/falas-dos-apresentadores) para o roteiro.
- Você pode encurtar ou ampliar textos depois, no editor ou pedindo ao [assistente de edição](/ajuda/editar-com-ia-chat).

## Relacionados

- [Quanto custa cada apresentação](/ajuda/custo-por-apresentacao)
- [O texto está estourando ou muito pequeno](/ajuda/texto-nao-cabe)
$ha$, ARRAY[$ha$profundidade$ha$, $ha$texto$ha$, $ha$curto$ha$, $ha$equilibrado$ha$, $ha$longo$ha$, $ha$médio$ha$, $ha$conteúdo$ha$, $ha$densidade$ha$, $ha$custo$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$revisar-conteudo-gerado$ha$, $ha$Revise o conteúdo gerado por IA: checklist antes de apresentar$ha$, $ha$geracao$ha$, $ha$Modelos de IA escrevem por probabilidade. O resultado costuma ser bom, mas **pode conter informações erradas, desatualizadas ou inventadas** — inclusive dados, datas, citações e referências que parecem verdadeiros. Os [Termos de Uso](/termos#ia) deixam claro que a revisão é sua.

## Checklist

- [ ] **Números:** valores, porcentagens e projeções batem com as suas fontes?
- [ ] **Datas e nomes:** pessoas, empresas, eventos e lugares estão corretos?
- [ ] **Citações:** frases atribuídas a alguém foram realmente ditas? Na dúvida, remova.
- [ ] **Fontes:** trabalhos acadêmicos exigem referências verificáveis. A IA não substitui a pesquisa.
- [ ] **Temas técnicos:** conteúdo jurídico, médico, financeiro ou de engenharia deve ser validado por um profissional.
- [ ] **Imagens:** combinam com o assunto e não mostram marcas ou pessoas de forma inadequada?
- [ ] **Tom:** a linguagem é adequada ao público?
- [ ] **Dados pessoais:** a apresentação não expõe informações de outras pessoas sem necessidade?

## Como corrigir rápido

- Edite o texto direto no slide.
- Peça ao [assistente de edição](/ajuda/editar-com-ia-chat) mudanças pontuais: "corrija o dado do slide 5 para 32%".
- Para refazer a estrutura inteira, gere de novo com uma descrição mais detalhada.

## Relacionados

- [Como escrever um bom tema](/ajuda/escrever-bom-prompt)
- [Direitos sobre as apresentações](/ajuda/direitos-autorais-e-uso-comercial)
$ha$, ARRAY[$ha$revisar$ha$, $ha$erros$ha$, $ha$alucinação$ha$, $ha$conferir$ha$, $ha$dados$ha$, $ha$fontes$ha$, $ha$responsabilidade$ha$, $ha$precisão$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$tema-inteligente-cores$ha$, $ha$Tema inteligente: como as cores e fontes são escolhidas$ha$, $ha$geracao$ha$, $ha$Com o **tema visual em Automático**, o SlideAI analisa o assunto e define a direção de arte da apresentação.

## O que é decidido

- **Paleta de cores** coerente com o tema — tons terrosos para história, azuis para tecnologia e finanças, cores vivas para marketing e criatividade.
- **Par de fontes** com personalidade: títulos de impacto e corpo legível, escolhidos pelo tipo de apresentação e pelo assunto.
- **Contraste e hierarquia** pensados para leitura em projetor e em tela de celular.

## Quando escolher um tema fixo

Se você precisa de um visual padronizado (por exemplo, uma sequência de aulas com a mesma cara), escolha um dos temas da lista em vez do automático. O tema escolhido vale para todos os slides.

## Depois da geração

No editor você pode trocar cores e elementos visuais de cada slide na aba **Visual**. A exportação para PDF e PowerPoint mantém a paleta e as fontes da apresentação.

## Relacionados

- [Como o SlideAI cria a capa](/ajuda/capas-de-apresentacao)
- [Como editar um slide](/ajuda/editar-slide)
$ha$, ARRAY[$ha$tema inteligente$ha$, $ha$cores$ha$, $ha$paleta$ha$, $ha$fonte$ha$, $ha$tipografia$ha$, $ha$visual$ha$, $ha$estilo$ha$, $ha$automático$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$tipos-e-personas$ha$, $ha$Tipo de apresentação e persona do orador$ha$, $ha$geracao$ha$, $ha$Dois campos do formulário definem **como** o conteúdo é contado.

## Tipo de apresentação

Orienta a estrutura narrativa e o vocabulário.

| Tipo | Estrutura típica |
| --- | --- |
| Acadêmico | Problema, fundamentação, método, resultados, conclusão |
| Escolar | Conceitos explicados passo a passo, exemplos e fixação |
| Corporativo | Contexto, indicadores, análise, decisões e próximos passos |
| Marketing | Público, mensagem, canais, campanha e métricas |
| Criativo | Narrativa livre, com mais impacto visual |
| Científico | Hipótese, dados, discussão e limitações |
| Pitch de negócios | Problema, solução, mercado, modelo, tração, time e pedido |

## Persona do orador

Define o tom de voz dos textos e das falas.

- **Educador (didático):** explica com calma, usa analogias e exemplos.
- **Autoridade técnica:** precisa, com termos da área e dados.
- **Líder inspiracional:** visão, propósito e mobilização.
- **Vendedor (dor → solução):** parte do problema do público e conduz até a oferta.

## Combinações que funcionam

- Aula: tipo **Escolar** + persona **Educador**.
- Resultados trimestrais: **Corporativo** + **Autoridade técnica**.
- Captação de investimento: **Pitch de negócios** + **Líder inspiracional**.
- Reunião comercial: **Marketing** ou **Pitch de negócios** + **Vendedor**.

## Relacionados

- [Apresentações para aulas](/ajuda/gerar-para-aula)
- [Apresentações comerciais e pitches](/ajuda/gerar-para-negocios)
$ha$, ARRAY[$ha$tipo$ha$, $ha$persona$ha$, $ha$tom$ha$, $ha$educador$ha$, $ha$vendedor$ha$, $ha$autoridade técnica$ha$, $ha$líder$ha$, $ha$acadêmico$ha$, $ha$corporativo$ha$, $ha$pitch$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$assinatura-encerrada$ha$, $ha$O que acontece quando a assinatura termina$ha$, $ha$planos$ha$, $ha$Uma assinatura termina quando você cancela e o período pago acaba, ou quando a renovação não é paga.

## Você continua com

- **Todas as apresentações:** para ver, editar, exportar e publicar.
- **O bônus permanente:** créditos avulsos e o bônus de ativação continuam valendo e podem ser usados em novas gerações.
- **A conta e o perfil**, com todos os dados.

## O que deixa de valer

- A **cota mensal** do plano: ela não renova mais e a sobra do último ciclo deixa de valer.
- No MAX, o uso ilimitado.

## Para voltar a gerar

- Use o bônus, se tiver.
- Compre créditos avulsos.
- Ou contrate um plano de novo. A liberação é automática quando o pagamento é confirmado.

## Relacionados

- [Cota mensal x bônus permanente](/ajuda/bonus-e-cota-mensal)
- [Cancelar a assinatura](/ajuda/cancelar-assinatura)
$ha$, ARRAY[$ha$assinatura encerrada$ha$, $ha$venceu$ha$, $ha$expirou$ha$, $ha$cancelada$ha$, $ha$o que perco$ha$, $ha$créditos bônus$ha$, $ha$apresentações$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$bonus-e-cota-mensal$ha$, $ha$Cota mensal x bônus permanente$ha$, $ha$planos$ha$, $ha$Seu saldo tem duas partes, e elas se comportam de forma diferente.

| | Cota mensal | Bônus |
| --- | --- | --- |
| De onde vem | Assinatura PRO ou MAX | Compras avulsas, bônus de ativação, promoções |
| Renovação | A cada ciclo mensal, volta ao valor do plano | Não renova; soma a cada compra |
| Acumula? | Não: o que sobra no mês não passa para o próximo | Sim |
| Expira? | Termina com a assinatura | Não expira enquanto a conta existir |
| Ordem de consumo | Usada primeiro | Usada por último |

## O ciclo mensal

O ciclo começa na data em que a assinatura foi ativada ou renovada e dura um mês. Nos planos trimestral e anual, a cota também renova todo mês.

## Exemplo

Você assina o PRO mensal no dia 10 (cota de 3.200 + bônus de ativação de 800) e compra um avulso (+500). Saldo: 3.200 de cota + 1.300 de bônus. As gerações gastam primeiro a cota; no dia 10 do mês seguinte, a cota volta a 3.200 e o bônus que sobrou continua lá.

## Relacionados

- [O que acontece quando a assinatura termina](/ajuda/assinatura-encerrada)
- [Como funcionam os créditos](/ajuda/creditos-consumo)
$ha$, ARRAY[$ha$bônus$ha$, $ha$cota mensal$ha$, $ha$permanente$ha$, $ha$acumula$ha$, $ha$expira$ha$, $ha$ordem de consumo$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$cancelar-assinatura$ha$, $ha$Cancelar a assinatura$ha$, $ha$planos$ha$, $ha$Você pode cancelar a qualquer momento, **sem multa e sem fidelidade**.

## Como cancelar

Escolha um dos caminhos:

- **Perfil → Assinatura → Cancelar:** abre um e-mail pronto para o suporte com os dados da sua conta.
- **Área do cliente da Cakto:** botão **Gerenciar**, na mesma tela.
- **E-mail:** escreva para suporte@slideai.com.br pedindo o cancelamento.

Confirmamos o cancelamento pelo mesmo canal.

## O que acontece depois

- **A assinatura não renova mais.** Nenhuma nova cobrança é feita.
- **O acesso e a cota continuam até o fim do período já pago.** O painel mostra a data.
- Depois dessa data, as gerações com a cota do plano param. O **bônus** continua disponível, e as **apresentações** continuam na conta para ver, editar e exportar.

## Reembolso

O período em curso não é reembolsado de forma proporcional, exceto em três casos: direito de arrependimento (até 7 dias após a compra), falha do serviço ou encerramento do serviço por nossa iniciativa. Veja [Política de reembolso](/ajuda/reembolso).

## Relacionados

- [O que acontece quando a assinatura termina](/ajuda/assinatura-encerrada)
- [Trocar de plano](/ajuda/trocar-plano)
$ha$, ARRAY[$ha$cancelar$ha$, $ha$cancelamento$ha$, $ha$assinatura$ha$, $ha$encerrar$ha$, $ha$parar de cobrar$ha$, $ha$sair$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$creditos-consumo$ha$, $ha$Como funcionam os créditos$ha$, $ha$planos$ha$, $ha$Créditos são as unidades de uso do SlideAI: cada apresentação gerada consome uma quantidade que depende das opções escolhidas.

## De onde vêm os créditos

| Origem | Quantidade | Validade |
| --- | --- | --- |
| Compra avulsa (R$ 14,90) | 500 créditos | Permanentes |
| Cota mensal do PRO | 3.200 por ciclo mensal | Renova a cada mês, não acumula |
| Bônus de ativação do PRO | 800 (mensal), 1.200 (trimestral) ou 2.000 (anual) | Permanentes, uma vez por conta |
| Plano MAX | Uso ilimitado dentro da Política de Uso Justo | Enquanto a assinatura estiver vigente |

## Como são gastos

- **Custo da apresentação:** 10 créditos por slide + profundidade do texto (curto 10, equilibrado 20, longo 30) + 50 se você ativar as falas. Veja [Quanto custa cada apresentação](/ajuda/custo-por-apresentacao).
- **Ordem:** primeiro a cota mensal, depois o bônus.
- **Momento:** o débito acontece quando a geração começa. Se ela falhar por problema nosso, os créditos voltam. Veja [Créditos devolvidos](/ajuda/creditos-devolvidos).
- **Não consomem créditos:** editar à mão, usar o assistente de edição (dentro dos limites), trocar imagens, exportar e publicar.

## Regras importantes

- **A cota mensal não acumula:** a cada ciclo ela volta ao valor do plano.
- **O bônus é permanente:** continua valendo mesmo depois que a assinatura termina.
- **Créditos não são dinheiro:** não podem ser transferidos, trocados por dinheiro ou revendidos.

## Onde acompanhar

Em **Perfil → Créditos** você vê o saldo (cota mensal e bônus), o consumo dos últimos 30 dias e o extrato de cada movimentação.

## Relacionados

- [Cota mensal x bônus permanente](/ajuda/bonus-e-cota-mensal)
- [Planos e preços](/ajuda/planos-e-precos)
$ha$, ARRAY[$ha$crédito$ha$, $ha$créditos$ha$, $ha$saldo$ha$, $ha$consumo$ha$, $ha$cota mensal$ha$, $ha$bônus$ha$, $ha$extrato$ha$, $ha$limite$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$creditos-devolvidos$ha$, $ha$Créditos devolvidos quando a geração falha$ha$, $ha$planos$ha$, $ha$Os créditos são debitados quando a geração começa — assim, fechar a aba no meio não cancela a cobrança. Mas **se a geração falhar por problema nosso, os créditos daquela tentativa voltam automaticamente**.

## Como conferir

Em **Perfil → Créditos**, o extrato mostra a linha "Devolução de geração com falha", com o mesmo valor do débito. A mensagem de erro também informa quanto foi devolvido.

## Geração interrompida

Em casos raros — uma queda no meio do processo, por exemplo — a geração termina sem resposta nenhuma na tela. Os créditos também voltam sozinhos: **em até 15 minutos**, o sistema identifica a tentativa sem conclusão e faz a devolução. No extrato, ela aparece como "Devolução de geração com falha".

Passou desse prazo e o valor não voltou? Abra um atendimento informando:

- o horário aproximado da tentativa;
- o título usado;
- o código de erro, se apareceu.

Conferimos o extrato e acertamos o saldo.

## Tema recusado

Quando o provedor de IA recusa um tema, a geração é interrompida e os créditos também voltam. Veja [Tema recusado](/ajuda/conteudo-recusado).
$ha$, ARRAY[$ha$devolução$ha$, $ha$estorno de créditos$ha$, $ha$falha$ha$, $ha$erro$ha$, $ha$perdi créditos$ha$, $ha$reembolso de créditos$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$custo-por-apresentacao$ha$, $ha$Quanto custa cada apresentação (tabela e exemplos)$ha$, $ha$planos$ha$, $ha$## A fórmula

**Créditos = slides × 10 + profundidade do texto + falas (opcional)**

| Item | Créditos |
| --- | --- |
| Cada slide (5 a 20) | 10 |
| Profundidade curto | 10 |
| Profundidade equilibrado | 20 |
| Profundidade longo | 30 |
| Falas dos apresentadores | 50 |

O formulário de geração mostra o cálculo antes de você confirmar.

## Exemplos

| Apresentação | Créditos |
| --- | --- |
| 5 slides, texto curto | 60 |
| 8 slides, equilibrado | 100 |
| 10 slides, equilibrado | 120 |
| 10 slides, equilibrado, com falas | 170 |
| 12 slides, longo | 150 |
| 15 slides, longo | 180 |
| 20 slides, equilibrado, com falas | 270 |
| 20 slides, longo, com falas | 280 (o máximo) |

## Quantas apresentações cabem no meu plano?

- **Compra avulsa (500 créditos):** de 3 a 4 apresentações de 10 slides equilibrados (com falas, 2 a 3), ou 1 de 20 slides com falas e ainda sobra saldo.
- **PRO (3.200 por mês):** cerca de 26 apresentações de 10 slides equilibrados por mês.
- **MAX:** uso ilimitado dentro do uso justo (16.000 créditos por ciclo mensal, cerca de 130 apresentações de 10 slides).

## O que não é cobrado

Edições manuais, assistente de edição, troca de imagens, exportações e publicação.

## Relacionados

- [Como funcionam os créditos](/ajuda/creditos-consumo)
- [Profundidade do texto](/ajuda/profundidade-dos-textos)
$ha$, ARRAY[$ha$custo$ha$, $ha$preço$ha$, $ha$créditos por slide$ha$, $ha$quanto custa$ha$, $ha$tabela$ha$, $ha$exemplos$ha$, $ha$calcular$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$formas-de-pagamento$ha$, $ha$Formas de pagamento aceitas$ha$, $ha$planos$ha$, $ha$O pagamento é feito no checkout da **Cakto**, que abre em uma nova aba. Os meios disponíveis (como cartão de crédito e Pix) aparecem na própria tela de pagamento, com as condições de cada um.

## Tempo de liberação

- **Cartão:** segundos após a aprovação.
- **Pix:** logo após a confirmação bancária, normalmente em poucos minutos.

Depois de pagar, volte à aba do SlideAI. Se você estava gerando uma apresentação, ela começa sozinha quando o pagamento é confirmado. Também há o botão **Já paguei** para verificar na hora.

## Use o mesmo e-mail

Pague com o **mesmo e-mail da sua conta SlideAI**. É por ele que identificamos a compra.

## Segurança

O SlideAI não recebe nem guarda o número do seu cartão: todo o processamento acontece no ambiente da Cakto.

## Relacionados

- [Pagamento aprovado, mas não liberou](/ajuda/pagamento-aprovado-nao-liberou)
- [Nota fiscal e comprovante](/ajuda/nota-fiscal)
$ha$, ARRAY[$ha$pagamento$ha$, $ha$pix$ha$, $ha$cartão$ha$, $ha$boleto$ha$, $ha$cakto$ha$, $ha$checkout$ha$, $ha$segurança$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$limites-de-uso$ha$, $ha$Limites de uso e Política de Uso Justo$ha$, $ha$planos$ha$, $ha$Os limites existem para manter a plataforma estável e disponível para todos. Eles estão nos [Termos de Uso](/termos#uso-justo).

| Recurso | Limite |
| --- | --- |
| Novas gerações | 12 por hora, por conta (todos os planos) |
| Plano MAX | Até 16.000 créditos por ciclo mensal — cerca de 130 apresentações de 10 slides |
| Assistente de edição por IA | 10 mensagens e 3 edições complexas por apresentação |
| Regenerar falas | 5 vezes por apresentação (só com falas contratadas) |
| Imagens por IA no editor | 15 por hora, por conta |
| Chat de suporte | 30 mensagens por hora |

## O plano MAX é ilimitado?

É de **uso ilimitado para uma pessoa**, dentro do teto de uso justo acima — dez vezes a cota do PRO, suficiente para uso profissional intenso. Se o teto for atingido, novas gerações ficam pausadas até a próxima renovação da cota, e a plataforma mostra a data. Nesse intervalo, você pode usar créditos avulsos. Nunca cobramos valor extra automaticamente.

## O que não é permitido

Compartilhar a conta, revender acesso ou automatizar o uso com robôs. Isso pode levar à suspensão da conta.

## Relacionados

- [Diferenças entre avulso, PRO e MAX](/ajuda/planos-pro-e-max)
- [Editar slides conversando com a IA](/ajuda/editar-com-ia-chat)
$ha$, ARRAY[$ha$limite$ha$, $ha$uso justo$ha$, $ha$fair use$ha$, $ha$gerações por hora$ha$, $ha$max ilimitado$ha$, $ha$quota$ha$, $ha$teto$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$nota-fiscal$ha$, $ha$Nota fiscal e comprovante de pagamento$ha$, $ha$planos$ha$, $ha$## Comprovante

O comprovante de pagamento é enviado pela **Cakto** para o e-mail usado na compra, logo após a aprovação. Confira também o spam.

## Nota fiscal

Quando aplicável, a nota fiscal é emitida conforme a legislação tributária. Para solicitar, abra um atendimento ou escreva para suporte@slideai.com.br com:

- e-mail da conta e data da compra;
- CPF ou CNPJ e razão social para a nota;
- endereço completo, se for empresa.

## Compras pela empresa

Se a sua empresa vai contratar, informe o CNPJ no checkout. Para condições de uso por empresas, veja os [Termos de Uso](/termos#responsabilidade).
$ha$, ARRAY[$ha$nota fiscal$ha$, $ha$recibo$ha$, $ha$nfe$ha$, $ha$comprovante$ha$, $ha$cnpj$ha$, $ha$faturamento$ha$, $ha$empresa$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$pagamento-aprovado-nao-liberou$ha$, $ha$Pagamento aprovado, mas o plano ou os créditos não foram liberados$ha$, $ha$planos$ha$, $ha$A liberação é automática e costuma levar segundos. Se não aconteceu:

1. **Confira o e-mail da compra.** Ele precisa ser o mesmo da conta SlideAI. Compras com outro e-mail não são reconhecidas automaticamente.
2. **Pix:** aguarde a confirmação do banco (normalmente poucos minutos).
3. **Atualize a página** ou clique em **Já paguei** na janela de pagamento.
4. Confira em **Perfil → Créditos** e **Perfil → Assinatura**.

## Ainda não liberou?

Abra um atendimento no suporte informando:

- o e-mail usado na compra;
- o horário aproximado;
- o código do pedido, se tiver (vem no e-mail da Cakto).

O atendimento é encaminhado à equipe, que libera o plano ou os créditos manualmente.

**Nunca envie senha, código de verificação ou número completo do cartão ao suporte.**

## Relacionados

- [Formas de pagamento](/ajuda/formas-de-pagamento)
- [Quando falar com um atendente](/ajuda/falar-com-humano)
$ha$, ARRAY[$ha$pagamento$ha$, $ha$aprovado$ha$, $ha$não liberou$ha$, $ha$plano não atualizou$ha$, $ha$créditos não caíram$ha$, $ha$cakto$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$planos-e-precos$ha$, $ha$Planos e preços$ha$, $ha$planos$ha$, $ha$## Compra avulsa

| Plano | Preço | Créditos |
| --- | --- | --- |
| Geração única | R$ 14,90 | 500 créditos permanentes, sem renovação |

## PRO — 3.200 créditos por mês

| Ciclo | Preço | Equivale a | Bônus de ativação |
| --- | --- | --- | --- |
| Mensal | R$ 49,90/mês | — | 800 |
| Trimestral | R$ 127,90/trimestre | R$ 42,63/mês | 1.200 |
| Anual | R$ 397,90/ano | R$ 33,16/mês | 2.000 |

## MAX — uso ilimitado*

| Ciclo | Preço | Equivale a |
| --- | --- | --- |
| Mensal | R$ 147,90/mês | — |
| Trimestral | R$ 377,90/trimestre | R$ 125,97/mês |
| Anual | R$ 1.175,00/ano | R$ 97,92/mês |

\* Uso ilimitado para uma pessoa, dentro da Política de Uso Justo: até 16.000 créditos por ciclo mensal e 12 gerações por hora. Veja [Limites de uso](/ajuda/limites-de-uso).

## Todos os planos incluem

Editor completo, assistente de edição por IA, exportação em PowerPoint, PDF e imagem, link público e suporte.

## Condições

- Assinaturas renovam automaticamente ao fim de cada período.
- Você pode cancelar quando quiser e mantém o acesso até o fim do período pago.
- Direito de arrependimento: 7 dias após a compra, com reembolso integral.
- O bônus de ativação vale uma vez por conta.

Condições completas nos [Termos de Uso](/termos#planos).

## Relacionados

- [Diferenças entre avulso, PRO e MAX](/ajuda/planos-pro-e-max)
- [Formas de pagamento](/ajuda/formas-de-pagamento)
$ha$, ARRAY[$ha$plano$ha$, $ha$preço$ha$, $ha$assinatura$ha$, $ha$mensal$ha$, $ha$trimestral$ha$, $ha$anual$ha$, $ha$avulso$ha$, $ha$pagar$ha$, $ha$comprar$ha$, $ha$pricing$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$planos-pro-e-max$ha$, $ha$Diferenças entre geração única, PRO e MAX$ha$, $ha$planos$ha$, $ha$Todos os planos dão acesso aos mesmos recursos. A diferença é o volume e a forma de pagar.

| | Geração única | PRO | MAX |
| --- | --- | --- | --- |
| Pagamento | Uma vez | Assinatura | Assinatura |
| Créditos | 500 permanentes | 3.200 por mês + bônus de ativação | Uso ilimitado* |
| Ideal para | Uma ou poucas apresentações | Uso frequente | Alto volume (agências, criadores, professores com muitas turmas) |
| Renovação | Não tem | Automática | Automática |

\* Dentro da Política de Uso Justo: 16.000 créditos por ciclo mensal e 12 gerações por hora.

## Como escolher

- **Até 3 ou 4 apresentações, de vez em quando:** geração única.
- **Algumas apresentações por semana:** PRO. O trimestral e o anual saem mais baratos por mês.
- **Várias apresentações por dia:** MAX.

## Posso combinar?

Sim. Um assinante pode comprar créditos avulsos a qualquer momento: eles entram como bônus permanente e são usados depois da cota mensal.

## Relacionados

- [Planos e preços](/ajuda/planos-e-precos)
- [Trocar de plano](/ajuda/trocar-plano)
$ha$, ARRAY[$ha$pro$ha$, $ha$max$ha$, $ha$geração única$ha$, $ha$avulso$ha$, $ha$qual plano$ha$, $ha$comparação$ha$, $ha$diferença$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$reembolso$ha$, $ha$Reembolso e direito de arrependimento$ha$, $ha$planos$ha$, $ha$## Direito de arrependimento (7 dias)

Pelo Código de Defesa do Consumidor (art. 49), você pode desistir em até **7 dias corridos** após a compra avulsa ou o primeiro pagamento de uma assinatura, **sem precisar justificar**. O reembolso é **integral**.

### Como pedir

Escreva para **suporte@slideai.com.br** ou abra um atendimento no suporte com:

- o e-mail da conta;
- o código do pedido, se tiver.

### O que acontece

- O valor volta pelo mesmo meio de pagamento. No cartão, o estorno aparece conforme a operadora, geralmente em até duas faturas.
- Os créditos daquela compra são cancelados, e a assinatura é encerrada na hora.
- Créditos daquela compra que você já usou não geram cobrança adicional.

## Outros casos

| Situação | O que fazemos |
| --- | --- |
| Geração falhou por problema nosso | Créditos devolvidos automaticamente ([saiba mais](/ajuda/creditos-devolvidos)) |
| Cobrança duplicada ou não reconhecida | Análise pelo suporte e devolução integral, se confirmada |
| Cancelamento depois de 7 dias | A renovação para; o período em curso não é reembolsado proporcionalmente |
| Encerramento do serviço por nossa iniciativa | Reembolso proporcional do período não utilizado |

## Contestação no cartão (chargeback)

Fale primeiro com o suporte, que resolve mais rápido. Uma contestação tem o mesmo efeito de um reembolso sobre os créditos do pedido.

Condições completas nos [Termos de Uso](/termos#arrependimento).
$ha$, ARRAY[$ha$reembolso$ha$, $ha$devolução$ha$, $ha$estorno$ha$, $ha$arrependimento$ha$, $ha$7 dias$ha$, $ha$chargeback$ha$, $ha$dinheiro de volta$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$renovacao-e-cobranca$ha$, $ha$Renovação, cobrança e avisos de vencimento$ha$, $ha$planos$ha$, $ha$## Como funciona a renovação

As assinaturas renovam **automaticamente** ao fim de cada período (mês, trimestre ou ano), pelo mesmo meio de pagamento, até você cancelar. Na renovação, a cota mensal volta ao valor do plano.

## Avisos

A partir de **5 dias antes** da renovação, o painel mostra quantos dias faltam. Quando um pagamento é aprovado, você recebe uma confirmação na tela.

## Mudança de preço

Reajustes são avisados com pelo menos 30 dias de antecedência e só valem a partir da renovação seguinte. Se não concordar, você pode cancelar antes.

## Se a cobrança falhar

- O acesso à cota do plano continua até o fim do período já pago.
- Depois disso, as gerações ficam pausadas, mas **seu bônus e suas apresentações continuam na conta**.
- Para voltar, contrate o plano de novo. A liberação é automática quando o pagamento é confirmado.

## Cobrança não reconhecida

Abra um atendimento com a data e o valor. Cobranças indevidas confirmadas são devolvidas integralmente.

## Relacionados

- [Cancelar a assinatura](/ajuda/cancelar-assinatura)
- [O que acontece quando a assinatura termina](/ajuda/assinatura-encerrada)
$ha$, ARRAY[$ha$renovação$ha$, $ha$cobrança$ha$, $ha$vencimento$ha$, $ha$aviso$ha$, $ha$cartão recusado$ha$, $ha$renova automático$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$trocar-plano$ha$, $ha$Trocar de plano (upgrade e downgrade)$ha$, $ha$planos$ha$, $ha$## Como trocar

1. Contrate o novo plano pelo checkout (em **Criar apresentação** ou nos [preços](/#pricing)).
2. Assim que o pagamento é confirmado, a cota passa a ser a do novo plano e o ciclo mensal recomeça.
3. **Cancele a assinatura anterior.** Ela não é cancelada automaticamente, e sem isso você pode ser cobrado de novo na renovação dela. Veja [Cancelar a assinatura](/ajuda/cancelar-assinatura).

## Situações comuns

- **PRO → MAX (upgrade):** contrate o MAX e cancele o PRO.
- **MAX → PRO (downgrade):** cancele o MAX; quando o período pago terminar, contrate o PRO.
- **Mensal → anual:** contrate o anual e cancele o mensal. O anual tem o menor preço por mês.

## Bônus de ativação

O bônus de ativação do PRO é concedido **uma vez por conta**, na primeira assinatura. Trocas de plano não geram um novo bônus. O bônus que você já tem continua valendo.

## Relacionados

- [Planos e preços](/ajuda/planos-e-precos)
$ha$, ARRAY[$ha$upgrade$ha$, $ha$downgrade$ha$, $ha$trocar plano$ha$, $ha$mudar plano$ha$, $ha$pro para max$ha$, $ha$mensal para anual$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$cookies-e-armazenamento$ha$, $ha$Cookies e armazenamento no navegador$ha$, $ha$privacidade$ha$, $ha$O SlideAI **não usa cookies de publicidade, de perfilamento nem ferramentas de análise de terceiros**. Por isso, não exibimos banner de consentimento de cookies.

## O que guardamos no seu navegador

| Item | Para quê |
| --- | --- |
| Sessão de login | Manter você conectado com segurança |
| Identificador da visita (até fechar a aba) | Relacionar erros de uma mesma visita, para o suporte diagnosticar |
| Contador de edições por IA | Mostrar rapidamente o uso do assistente (o valor oficial fica no servidor) |
| Aviso de renovação | Não repetir o aviso no mesmo dia |

Você pode apagar esses dados nas configurações do navegador, mas será desconectado.

## Serviços de terceiros

- **Google Fonts:** ao carregar as fontes, o Google recebe o endereço IP e o navegador.
- **Cakto:** a página de pagamento fica no domínio da Cakto, com a política dela.

Detalhes na [Política de Privacidade](/privacidade#cookies).
$ha$, ARRAY[$ha$cookies$ha$, $ha$armazenamento local$ha$, $ha$localstorage$ha$, $ha$rastreamento$ha$, $ha$publicidade$ha$, $ha$consentimento$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$denunciar-conteudo$ha$, $ha$Denunciar uma apresentação ou perfil$ha$, $ha$privacidade$ha$, $ha$Encontrou uma apresentação publicada ou um perfil que viola a lei ou os [Termos de Uso](/termos#condutas)? Por exemplo: conteúdo ofensivo, golpe, violação de direitos autorais ou exposição de dados pessoais.

## Como denunciar

Escreva para **suporte@slideai.com.br** com:

- o link da apresentação ou do perfil;
- o motivo da denúncia;
- se você é o titular do direito violado (autor, pessoa exposta, dono da marca), dados que permitam confirmar isso.

## O que acontece

1. Analisamos a denúncia.
2. Se houver violação, o conteúdo pode ser despublicado ou removido e, conforme a gravidade, a conta pode ser suspensa.
3. Sempre que possível, o autor é avisado do motivo e pode pedir revisão.

**Imagens íntimas divulgadas sem consentimento** são removidas após notificação da pessoa envolvida ou de seu representante (Marco Civil da Internet, art. 21).

## Relacionados

- [Termos de Uso em linguagem simples](/ajuda/termos-de-uso-resumo)
$ha$, ARRAY[$ha$denunciar$ha$, $ha$denúncia$ha$, $ha$conteúdo impróprio$ha$, $ha$remover$ha$, $ha$violação$ha$, $ha$direitos autorais$ha$, $ha$abuso$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$direitos-autorais-e-uso-comercial$ha$, $ha$Direitos sobre as apresentações e uso comercial$ha$, $ha$privacidade$ha$, $ha$## O conteúdo é seu

- **O que você envia** (temas, textos, dados) continua seu.
- **O que você gera** pode ser usado para qualquer finalidade lícita, **inclusive comercial**: vender cursos, apresentar a clientes, publicar em redes.
- O SlideAI não reivindica a propriedade das suas apresentações.

## Pontos de atenção

- **Direito autoral e IA:** a lei brasileira (Lei 9.610/1998) protege criações humanas. Textos e imagens gerados automaticamente podem não ter proteção autoral própria, e outras pessoas podem obter resultados parecidos com pedidos parecidos. Suas edições e escolhas criativas fortalecem a autoria.
- **Fotos do Pexels:** uso gratuito, inclusive comercial, **sem** vender a foto sem alteração e **sem** mostrar pessoas identificáveis de forma ofensiva ou como se endossassem um produto.
- **Imagens geradas por IA:** seguem os termos do provedor que as gerou, que em geral permitem uso comercial.
- **Imagens por link, marcas e logos de terceiros:** você é responsável por ter autorização.
- **Fontes:** são de uso livre (Google Fonts).

## A plataforma

O software, a marca SlideAI, os temas e os templates pertencem ao SlideAI. Você pode usá-los dentro da plataforma, conforme os [Termos de Uso](/termos#propriedade).
$ha$, ARRAY[$ha$direitos autorais$ha$, $ha$propriedade$ha$, $ha$uso comercial$ha$, $ha$copyright$ha$, $ha$pexels$ha$, $ha$imagens$ha$, $ha$licença$ha$, $ha$vender$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$menores-de-idade$ha$, $ha$Uso por estudantes menores de 18 anos$ha$, $ha$privacidade$ha$, $ha$O SlideAI é muito usado em trabalhos escolares. Por isso, as regras de idade são estas:

- **Menores de 12 anos:** não podem ter conta.
- **De 12 a 17 anos:** podem usar com **autorização e supervisão dos pais ou responsáveis legais**.
- **Compras e assinaturas** de menores devem ser feitas pelos responsáveis.

## Para pais e responsáveis

- Acompanhe o que é gerado e publicado. Apresentações são privadas até serem publicadas.
- Oriente o estudante a não incluir dados pessoais (endereço, telefone, fotos de colegas) nas apresentações.
- Você pode pedir a exclusão da conta e dos dados de um menor pelo e-mail suporte@slideai.com.br.

## Tratamento de dados

Os dados de adolescentes são tratados considerando o seu melhor interesse, conforme a LGPD (art. 14). Se identificarmos uma conta de criança, ela é encerrada e os dados eliminados.

## Relacionados

- [Apresentações para aulas e trabalhos escolares](/ajuda/gerar-para-aula)
$ha$, ARRAY[$ha$menor de idade$ha$, $ha$adolescente$ha$, $ha$estudante$ha$, $ha$pais$ha$, $ha$responsáveis$ha$, $ha$criança$ha$, $ha$idade mínima$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$meus-dados-lgpd$ha$, $ha$Seus dados e seus direitos (LGPD)$ha$, $ha$privacidade$ha$, $ha$O SlideAI trata dados pessoais de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018). O resumo está aqui; o texto completo está na [Política de Privacidade](/privacidade).

## Quais dados tratamos

- **Conta:** nome, e-mail, senha (guardada só de forma criptografada) e foto.
- **Apresentações:** o que você escreve e gera.
- **Pagamentos:** plano, créditos e dados do pedido enviados pela Cakto. **Não recebemos o número do cartão.**
- **Uso e segurança:** registros de acesso (IP, data e hora), erros e eventos de segurança.
- **Suporte:** as mensagens dos seus atendimentos.

## O que não fazemos

- Não vendemos dados pessoais.
- Não usamos suas apresentações para treinar modelos de IA nem para publicidade.
- Não usamos cookies de publicidade nem rastreadores de terceiros.

## Seus direitos

Você pode pedir, sem custo:

- confirmação e **acesso** aos seus dados;
- **correção** de dados errados (vários podem ser corrigidos no próprio Perfil);
- **portabilidade** em formato estruturado;
- **exclusão** da conta e dos dados ([veja como](/ajuda/excluir-conta));
- informação sobre com quem compartilhamos seus dados;
- **revisão** de decisões automatizadas;
- **oposição** a tratamentos baseados em legítimo interesse.

## Como pedir

Escreva para **suporte@slideai.com.br** a partir do e-mail da conta, ou abra um atendimento. Podemos confirmar sua identidade antes de atender.

- **Confirmação e acesso simplificado:** de imediato.
- **Declaração completa:** em até 15 dias.

Se não ficar satisfeito, você pode recorrer à Autoridade Nacional de Proteção de Dados (ANPD).

## Relacionados

- [O que acontece com o texto que você envia à IA](/ajuda/privacidade-conteudo-e-ia)
- [Cookies e armazenamento no navegador](/ajuda/cookies-e-armazenamento)
$ha$, ARRAY[$ha$dados$ha$, $ha$privacidade$ha$, $ha$lgpd$ha$, $ha$direitos$ha$, $ha$exportar dados$ha$, $ha$excluir$ha$, $ha$acesso$ha$, $ha$titular$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$privacidade-conteudo-e-ia$ha$, $ha$O que acontece com o texto que você envia à IA$ha$, $ha$privacidade$ha$, $ha$Para gerar e editar apresentações, o SlideAI envia o necessário a provedores de inteligência artificial contratados. Hoje são a **OpenAI** e o **Google (Gemini)**, acessados diretamente ou pelo gateway de IA da infraestrutura. O que é enviado:

- título, descrição e opções do formulário de geração;
- os pedidos ao assistente de edição e o conteúdo dos slides envolvidos;
- as mensagens do chat de suporte.

## O que isso significa para você

- Os provedores processam os dados em servidores fora do Brasil, principalmente nos Estados Unidos, só para gerar o resultado pedido. Veja [transferência internacional](/privacidade#transferencia).
- **O SlideAI não usa o seu conteúdo para treinar modelos de IA.**
- Não vendemos nem compartilhamos o conteúdo para publicidade.

## Boas práticas

- **Não envie dados pessoais sensíveis:** saúde, religião, opinião política, orientação sexual, biometria etc.
- **Não inclua dados de outras pessoas** sem necessidade e sem base legal (por exemplo, lista de alunos com notas).
- **Informações confidenciais da sua empresa:** avalie se podem ser compartilhadas com provedores de IA antes de usá-las.

## Relacionados

- [Seus dados e seus direitos](/ajuda/meus-dados-lgpd)
- [Política de Privacidade](/privacidade)
$ha$, ARRAY[$ha$ia$ha$, $ha$privacidade$ha$, $ha$dados$ha$, $ha$confidencial$ha$, $ha$treinamento$ha$, $ha$openai$ha$, $ha$google$ha$, $ha$provedores$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$termos-de-uso-resumo$ha$, $ha$Termos de Uso em linguagem simples$ha$, $ha$privacidade$ha$, $ha$Um resumo dos [Termos de Uso](/termos). Em caso de dúvida, vale o texto completo.

## O que você recebe

- Geração de apresentações com IA, editor, exportação e publicação por link.
- Créditos conforme o plano: 10 por slide + profundidade + falas (opcional). O custo aparece antes de gerar.
- Devolução automática dos créditos quando a geração falha por problema nosso.

## Pagamentos e assinaturas

- Assinaturas renovam automaticamente. Reajustes são avisados com 30 dias de antecedência.
- **Cancele quando quiser, sem multa.** O acesso continua até o fim do período pago.
- **Arrependimento:** até 7 dias após a compra, com reembolso integral.
- O plano MAX é de uso ilimitado dentro da **Política de Uso Justo** (16.000 créditos por ciclo mensal).
- O bônus é permanente; a cota mensal não acumula.

## Suas responsabilidades

- **Revisar o conteúdo gerado.** A IA pode errar, e o uso do resultado é seu.
- Não compartilhar a conta nem revender acesso.
- Não gerar conteúdo ilegal, ofensivo ou que viole direitos de terceiros.
- Ter os direitos sobre o que você envia (textos, marcas, imagens por link).

## Seus direitos sobre o conteúdo

- O que você envia continua seu.
- Você pode usar o que gerar, inclusive comercialmente.
- As apresentações são privadas até você publicar.

## Idade

Não é para menores de 12 anos. Dos 12 aos 17 anos, só com autorização e supervisão dos pais ou responsáveis.

## Mudanças nos termos

Mudanças relevantes são avisadas com 15 dias de antecedência e podem exigir um novo aceite. Elas não prejudicam o período que você já pagou.
$ha$, ARRAY[$ha$termos de uso$ha$, $ha$contrato$ha$, $ha$regras$ha$, $ha$condições$ha$, $ha$resumo$ha$, $ha$direitos$ha$, $ha$deveres$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$codigos-de-erro$ha$, $ha$Entendendo os códigos de erro$ha$, $ha$suporte$ha$, $ha$Quando algo falha, a plataforma mostra um código curto (ex.: `GEN-004`). Ele identifica exatamente o ponto da falha e acelera o atendimento.

## Prefixos

| Prefixo | Área |
| --- | --- |
| AUTH | Login e cadastro |
| GEN | Geração de apresentações |
| EDIT | Editor e assistente de edição |
| IMG / INT | Imagens e integrações |
| EXP / UI | Exportação e interface |
| PAY | Pagamentos |
| NET | Conexão |
| SUP | Suporte |

## O que fazer

1. **Copie o código** exibido.
2. Busque o código na Central de Ajuda: muitos têm solução direta.
3. Se persistir, abra o suporte e **cole o código** na primeira mensagem, com o que você estava fazendo.

## Informações que ajudam

- Data e hora aproximadas.
- Título da apresentação ou tema usado.
- Navegador, e se estava no celular ou no computador.

## Relacionados

- [Quando falar com um atendente](/ajuda/falar-com-humano)
- [Diagnóstico de conexão](/ajuda/diagnostico-de-conexao)
$ha$, ARRAY[$ha$erro$ha$, $ha$código$ha$, $ha$diagnóstico$ha$, $ha$falha$ha$, $ha$mensagem de erro$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$diagnostico-de-conexao$ha$, $ha$Diagnóstico de conexão e erros de carregamento$ha$, $ha$suporte$ha$, $ha$Mensagens como "Você parece estar sem internet" (**NET-001**) ou "Falha de conexão" (**UI-002**) indicam que o navegador não conseguiu falar com os nossos servidores.

## Passo a passo

1. **Teste a internet** abrindo outro site.
2. **Recarregue a página** (Ctrl/Cmd + R). No editor, confira antes se o indicador mostra "Salvo".
3. **Desative extensões** de bloqueio de anúncios, VPN ou antivírus com filtro web, e teste de novo.
4. **Teste em janela anônima** ou em outro navegador.
5. **Redes corporativas e escolares** podem bloquear o site ou as imagens. Teste com os dados do celular.

## "Algo quebrou visualmente" (UI-001)

Recarregue a página. Se o erro se repetir sempre no mesmo lugar, abra um atendimento com o código e o que você estava fazendo: o erro já é registrado para a equipe investigar.

## Relacionados

- [Navegadores e dispositivos suportados](/ajuda/navegadores-suportados)
- [Entendendo os códigos de erro](/ajuda/codigos-de-erro)
$ha$, ARRAY[$ha$conexão$ha$, $ha$internet$ha$, $ha$rede$ha$, $ha$não carrega$ha$, $ha$NET-001$ha$, $ha$UI-001$ha$, $ha$UI-002$ha$, $ha$página em branco$ha$, $ha$lento$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$falar-com-humano$ha$, $ha$Quando e como falar com um atendente$ha$, $ha$suporte$ha$, $ha$## Primeiro, o assistente

O balão de suporte (canto da tela, com a conta logada) tem um assistente de IA que resolve a maior parte das dúvidas na hora: uso, erros conhecidos, pagamentos e exportação.

## Quando o atendimento vai para a equipe

O assistente encaminha para uma pessoa da equipe quando:

- o assunto é **pagamento, reembolso ou segurança**;
- o erro é crítico ou não tem solução conhecida;
- a mesma questão continua sem solução depois de algumas tentativas.

Você também pode pedir o encaminhamento. A conversa fica registrada, e a resposta da equipe aparece no mesmo atendimento.

## Prazos

Respondemos em **até 1 dia útil**, dentro do prazo legal de 5 dias.

## Sem acesso à conta?

Escreva para **suporte@slideai.com.br**.

## Revisão de decisões automáticas

Se um bloqueio, limite ou resposta automática afetou você, peça a revisão por uma pessoa da equipe (LGPD, art. 20).

## Relacionados

- [Usar o histórico de atendimentos](/ajuda/historico-de-suporte)
$ha$, ARRAY[$ha$humano$ha$, $ha$atendente$ha$, $ha$equipe$ha$, $ha$suporte$ha$, $ha$contato$ha$, $ha$e-mail$ha$, $ha$prazo de resposta$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$historico-de-suporte$ha$, $ha$Usar o histórico de atendimentos$ha$, $ha$suporte$ha$, $ha$Cada assunto vira um atendimento separado, com número, situação e histórico próprios.

## No balão de suporte

- **Nova conversa:** para um assunto diferente.
- **Histórico:** para reabrir um atendimento anterior. As mensagens salvas são restauradas.

Na página **Suporte**, você vê todos os atendimentos da conta.

## Situações do atendimento

- **Em diagnóstico:** o assistente está ajudando.
- **Aguardando confirmação:** foi sugerida uma solução. Confirme se funcionou ou conte o resultado. Sem resposta em 72 horas, o atendimento é encerrado automaticamente.
- **Aguardando humano:** encaminhado para a equipe. Você pode complementar com mais detalhes.
- **Resolvido.**

## Privacidade

As conversas de suporte ficam guardadas enquanto a conta existir e são processadas pelo assistente de IA. **Não envie senhas, códigos de verificação nem dados completos de cartão.**
$ha$, ARRAY[$ha$suporte$ha$, $ha$histórico$ha$, $ha$conversa$ha$, $ha$ticket$ha$, $ha$atendimento$ha$, $ha$mensagens$ha$, $ha$protocolo$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)
VALUES ($ha$navegadores-suportados$ha$, $ha$Navegadores e dispositivos suportados$ha$, $ha$suporte$ha$, $ha$| Ambiente | Situação |
| --- | --- |
| Chrome, Edge e Brave atualizados | Recomendados |
| Firefox | Suportado |
| Safari (macOS e iOS) | Suportado |
| Navegadores antigos ou modo de economia extrema | Podem falhar em animações e exportações |

## Celular e tablet

Gerar, editar textos, apresentar e compartilhar funcionam no celular. Para ajustes finos de layout e para exportar, o computador oferece a melhor experiência.

## Se algo não aparece direito

Atualize o navegador, desative extensões de bloqueio e teste em janela anônima antes de abrir um atendimento. Veja [Diagnóstico de conexão](/ajuda/diagnostico-de-conexao).
$ha$, ARRAY[$ha$navegador$ha$, $ha$chrome$ha$, $ha$safari$ha$, $ha$firefox$ha$, $ha$celular$ha$, $ha$tablet$ha$, $ha$compatibilidade$ha$]::text[], true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,
  keywords = EXCLUDED.keywords, is_published = true, updated_at = now()
  WHERE (help_articles.title, help_articles.category, help_articles.content_md, help_articles.keywords, help_articles.is_published)
    IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.category, EXCLUDED.content_md, EXCLUDED.keywords, true);

UPDATE public.help_articles SET is_published = false, updated_at = now() WHERE slug IN ($ha$imagens-pexels-e-ia$ha$);

UPDATE public.error_catalog SET related_articles = ARRAY[$ha$excluir-conta$ha$, $ha$meus-dados-lgpd$ha$]::text[] WHERE code = $ha$ACC-001$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$login-google-email$ha$, $ha$recuperar-senha$ha$]::text[] WHERE code = $ha$AUTH-001$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$confirmar-email$ha$, $ha$criar-conta$ha$]::text[] WHERE code = $ha$AUTH-002$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$login-google-email$ha$, $ha$problemas-de-acesso$ha$]::text[] WHERE code = $ha$AUTH-003$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$criar-conta$ha$, $ha$seguranca-da-conta$ha$]::text[] WHERE code = $ha$AUTH-004$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$problemas-de-acesso$ha$, $ha$login-google-email$ha$]::text[] WHERE code = $ha$AUTH-005$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$recuperar-senha$ha$, $ha$confirmar-email$ha$]::text[] WHERE code = $ha$AUTH-006$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$problemas-de-acesso$ha$, $ha$recuperar-senha$ha$]::text[] WHERE code = $ha$AUTH-007$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$login-google-email$ha$, $ha$recuperar-senha$ha$]::text[] WHERE code = $ha$AUTH-008$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$gerenciar-apresentacoes-dashboard$ha$, $ha$lixeira$ha$]::text[] WHERE code = $ha$DB-002$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$limites-de-uso$ha$]::text[] WHERE code = $ha$DB-003$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$salvamento-e-desfazer$ha$, $ha$editar-slide$ha$]::text[] WHERE code = $ha$EDIT-001$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$editar-com-ia-chat$ha$, $ha$limites-de-uso$ha$]::text[] WHERE code = $ha$EDIT-002$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$resolver-falha-na-exportacao$ha$, $ha$exportar-pdf-pptx$ha$]::text[] WHERE code = $ha$EXP-001$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$pptx-diferente-do-editor$ha$, $ha$exportar-pdf-pptx$ha$]::text[] WHERE code = $ha$EXP-002$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$creditos-consumo$ha$, $ha$limites-de-uso$ha$]::text[] WHERE code = $ha$GEN-001$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$planos-e-precos$ha$, $ha$custo-por-apresentacao$ha$]::text[] WHERE code = $ha$GEN-002$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$geracao-lenta$ha$]::text[] WHERE code = $ha$GEN-003$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$escolher-numero-de-slides$ha$, $ha$escrever-bom-prompt$ha$]::text[] WHERE code = $ha$GEN-004$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$limites-de-uso$ha$]::text[] WHERE code = $ha$GEN-005$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$geracao-lenta$ha$, $ha$creditos-devolvidos$ha$]::text[] WHERE code = $ha$GEN-006$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$conteudo-recusado$ha$, $ha$escrever-bom-prompt$ha$]::text[] WHERE code = $ha$GEN-007$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$geracao-lenta$ha$, $ha$creditos-devolvidos$ha$]::text[] WHERE code = $ha$GEN-008$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$problemas-imagem$ha$, $ha$trocar-imagem$ha$]::text[] WHERE code = $ha$IMG-001$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$trocar-imagem$ha$, $ha$imagens-ia-vs-pexels$ha$]::text[] WHERE code = $ha$IMG-002$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$problemas-imagem$ha$, $ha$trocar-imagem$ha$]::text[] WHERE code = $ha$INT-001$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$editar-com-ia-chat$ha$, $ha$diagnostico-de-conexao$ha$]::text[] WHERE code = $ha$INT-002$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$diagnostico-de-conexao$ha$, $ha$navegadores-suportados$ha$]::text[] WHERE code = $ha$NET-001$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$pagamento-aprovado-nao-liberou$ha$]::text[] WHERE code = $ha$PAY-001$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$pagamento-aprovado-nao-liberou$ha$]::text[] WHERE code = $ha$PAY-002$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$pagamento-aprovado-nao-liberou$ha$, $ha$formas-de-pagamento$ha$]::text[] WHERE code = $ha$PAY-003$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$pagamento-aprovado-nao-liberou$ha$, $ha$creditos-consumo$ha$]::text[] WHERE code = $ha$PAY-004$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$cancelar-assinatura$ha$, $ha$assinatura-encerrada$ha$]::text[] WHERE code = $ha$PAY-005$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$falar-com-humano$ha$, $ha$historico-de-suporte$ha$]::text[] WHERE code = $ha$SUP-001$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$falar-com-humano$ha$, $ha$codigos-de-erro$ha$]::text[] WHERE code = $ha$SUP-002$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$falar-com-humano$ha$]::text[] WHERE code = $ha$SUP-003$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$codigos-de-erro$ha$, $ha$falar-com-humano$ha$]::text[] WHERE code = $ha$SUP-999$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$diagnostico-de-conexao$ha$, $ha$navegadores-suportados$ha$]::text[] WHERE code = $ha$UI-001$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$diagnostico-de-conexao$ha$]::text[] WHERE code = $ha$UI-002$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$resolver-falha-na-exportacao$ha$, $ha$exportar-pdf-pptx$ha$]::text[] WHERE code = $ha$UI-003$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$resolver-falha-na-exportacao$ha$, $ha$pptx-diferente-do-editor$ha$]::text[] WHERE code = $ha$UI-004$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$compartilhar-apresentacao$ha$, $ha$publicar-e-despublicar$ha$]::text[] WHERE code = $ha$VIEW-001$ha$;
UPDATE public.error_catalog SET related_articles = ARRAY[$ha$publicar-e-despublicar$ha$, $ha$compartilhar-apresentacao$ha$]::text[] WHERE code = $ha$VIEW-002$ha$;

UPDATE public.error_catalog SET user_description = $ha$A senha precisa ter ao menos 8 caracteres.$ha$ WHERE code = $ha$AUTH-004$ha$ AND user_description IS DISTINCT FROM $ha$A senha precisa ter ao menos 8 caracteres.$ha$;
UPDATE public.error_catalog SET user_description = $ha$Esta apresentação não está disponível: ela é privada ou foi despublicada pelo autor.$ha$ WHERE code = $ha$VIEW-001$ha$ AND user_description IS DISTINCT FROM $ha$Esta apresentação não está disponível: ela é privada ou foi despublicada pelo autor.$ha$;
