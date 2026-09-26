# Revisão geral do SlideAI — 26/09/2026

Escopo:
- o motor de cenas (v2) de ponta a ponta;
- como ficou a mesclagem com o motor antigo (v1);
- uma varredura geral da plataforma: lógica, segurança, pagamentos, código morto e padrões típicos de código gerado prompt a prompt.

Base usada:
- o código da `main` em `bfbc142`;
- **consultas somente-leitura ao banco de produção**, com números agregados e sem dados pessoais.

## Resumo em 30 segundos

| # | O que | Gravidade | Tipo de correção |
|---|---|---|---|
| 1 | Os webhooks da Cakto são **recusados** (o segredo do painel não bate com o do servidor). Hoje uma compra real não libera créditos. | **Crítico** | Configuração |
| 2 | Reembolso e chargeback de um pedido já aprovado são **descartados como "entrega duplicada"**, e o comprador fica com os créditos. | **Alto** | Código + índice |
| 3 | Qualquer usuário controla o orçamento de imagem (`max_budget_usd`, `budget_mode`). Contas sem plano geram imagens de IA em qualidade alta. | **Alto** | Código |
| 4 | Qualquer pessoa logada vê **plano, saldo e vencimento** de outro usuário (`can_user_generate`). | **Médio** | SQL |
| 4b | Reembolso de uma compra avulsa cancela a assinatura e zera **todos** os créditos do assinante. | **Médio** | Código + SQL |
| 5 | As **notas do orador** saem vazias na maioria dos slides depois do deploy, e nada as completa. | **Médio** | Código |
| 6 | As fotos só são buscadas quando o dono abre o **Editor**. O Viewer e o Dashboard nunca completam as imagens. | **Médio** | Código |
| 7 | O motor v1 **não foi removido**, e não há confirmação em dados de que o v2 está ativo para todos. | Informativo | Decisão |

A plataforma está em pré-lançamento: 5 usuários, 51 apresentações, nenhum perfil com plano pago e nenhuma transação de crédito. É o momento certo para corrigir os itens 1 a 4, antes do primeiro cliente pagante.

---

## 1. O motor v2 em produção, com dados reais

Gerações desde o deploy (25/09):

| Horário | Motor | Slides | Tempo | Tokens de saída/slide | Notas do orador | Imagens |
|---|---|---|---|---|---|---|
| 02:16 | v1 | 20 | 59 s | 270 | **1 de 20** | 5 IA + 3 fotos, todas resolvidas (US$ 0,0165) |
| 17:51 | v2 | 6 | 20 s | 154 | **1 de 6** | 1 foto (capa), **pendente** |
| 17:51 | v1 | 6 | 31 s | 336 | 6 de 6 | 1 foto, **pendente** |

O que os dados confirmam:
- **O pipeline v2 funciona.**
  - Plano visual determinístico com 5 comandos diferentes (LOOP, FEATURE_COMPARISON, CYCLE, WORKFLOW, GROWTH_VISUAL), todos nativos.
  - Nenhum fallback necessário.
  - Fração de slides só de texto: 0%.
  - Fundos e movimentos variados.
  - Tokens de saída por slide cerca de 50% menores que no v1.
- **A persistência no servidor funciona nos dois motores**, com `creative_brief`, tema e cota de ativos criados.
- **O Editor resolve os ativos.** O deck das 02:16 teve todas as imagens resolvidas e registradas na cota.
- **As fotos pendentes dos dois decks de 17:51 não são defeito do `fetch-image`.** Não houve nenhuma chamada a ele naquele horário (tabela `edge_rate_limits`), porque os decks não foram abertos no Editor depois de gerados. Ver o item 6.

### Notas do orador vazias (item 5)

Antes do deploy, **todos** os decks tinham notas em todos os slides: 20/20, 16/16, 15/15… em 12 gerações seguidas. Depois do deploy, 2 dos 3 decks ficaram quase sem notas.

- O código repassa o campo intacto nos dois motores. Verifiquei: prompt do v1 idêntico, schema idêntico, resolvedor, `persist` e Editor.
- A IA está devolvendo `speaker_notes` vazio. No v2, o schema pede "1-2 frases" e o prompt enxuto incentiva a brevidade: foram 154 tokens por slide.
- **Correção recomendada:** completar notas vazias de forma determinística, nos dois motores, a partir do conteúdo do slide (título, subtítulo, bullets, número, citação). É a mesma técnica que `synthSpeech` já usa para as falas (`generate-presentation/speeches.ts`). No prompt v2, trocar a descrição para algo como "2-3 frases com o que o orador deve dizer; nunca vazio".

### Outros pontos do v2

- **As fotos dependem do Editor (item 6).**
  - `useProgressiveAssets` só roda em `src/pages/Editor.tsx`.
  - Se o dono gerar, fechar a aba e compartilhar o link, o Viewer (`/slides/:slug`) e o Dashboard mostram a capa sem foto até alguém abrir o Editor.
  - **Correção:** rodar o mesmo hook no Viewer quando quem abre é o dono. Visitantes não disparam buscas.
- **O Editor não verifica o dono (`src/pages/Editor.tsx:196`).**
  - Um usuário logado que abrir `/editor/<slug>` de um deck **público de outra pessoa** carrega o Editor.
  - Salvar é bloqueado pelo RLS, mas o resolvedor dispara `fetch-image` para os ativos pendentes. A cota por apresentação recusa (não é o dono), e o pedido cai no limite genérico, com custo para a plataforma.
  - **Correção:** incluir `user_id` no select e redirecionar para `/slides/:slug` quando não for o dono.
- **Contador de tentativas (`src/hooks/useProgressiveAssets.ts:83`):** grava `attempts + 2` mesmo quando a primeira tentativa deu certo. É só cosmético, mas engana quem lê as métricas.
- **O slide de fechamento recebeu um gráfico (GROWTH_VISUAL).** O planner trata o fechamento como slide de conteúdo quando o roteiro marca `SHOW_DATA`. Sugestão: no papel `closing`, preferir `textFirst` (citação ou chamada para ação) ou `STAT_HIGHLIGHT`.
- **O interruptor do Dev Mode não força o v1 (`src/pages/Generate.tsx:246`).** Desligado, ele não envia nada, e quem decide é o rollout. Com `ENGINE_V2_ROLLOUT_PERCENT=100` não dá mais para gerar um v1 de comparação. **Correção:** enviar `engineVersion: 1` quando desligado para desenvolvedores.

---

## 2. Mesclagem e "remoção" do motor antigo

**Como foi a mesclagem.**
- O PR #3 entrou por merge commit (`fe8e925`), sem conflitos. A `main` ficou idêntica à branch.
- Depois disso, o Lovable fez 5 commits próprios:
  - copiou a migração do v2 para `drizzle/migrations/0001_scene_engine_v2.sql` (com um `GRANT ALL … TO service_role` a mais, inofensivo);
  - ajustou `src/integrations/supabase/previewAuthStorage.ts` (autenticação do preview, sem relação com o motor).

**O motor antigo não foi removido.** Todo o v1 continua no código e alcançável:

| Parte do v1 | Onde | Ainda é usada quando… |
|---|---|---|
| Prompt, schema e pós-processamento do v1 (cerca de 450 linhas) | `generate-presentation/index.ts` (`SYSTEM_PROMPT` e ramo `else` de `engine === 2`) | o rollout sorteia v1; o pedido envia `engineVersion: 1`; um cliente não envia `persist: "server"` |
| Resposta legada (`slides` sem `slug`) | `generate-presentation/index.ts`, fim do handler | um cliente antigo ou integração chama sem `persist: "server"` |
| Persistência no cliente | `src/lib/legacyPersist.ts` e o fallback em `Generate.tsx` | o servidor não devolve `slug` (não deve mais acontecer) |
| Busca de imagem legada (sem receita) | `fetch-image/index.ts` | ativos de decks v1 e a aba Imagem do Editor |
| Renderização clássica | `SlideRenderer.tsx` e componentes | **sempre**: os 50 decks antigos dependem dela |

**Não há prova nos dados de que o v2 está ativo para todos.** A última geração com o interruptor desligado (25/09, 17:51) saiu **v1**, então naquele momento o rollout não estava em 100%. Se o secret foi criado depois, ainda não houve geração que comprove. Para confirmar, gere uma apresentação **sem** o Dev Mode ligado e verifique `presentations.engine_version = 2`.

**Plano recomendado para remover o v1:**
1. Deixar `ENGINE_V2_ROLLOUT_PERCENT=100` por 2 a 4 semanas, observando o painel de métricas.
2. Remover o ramo v1 da geração, a resposta legada, `legacyPersist.ts` e o interruptor do Dev Mode.
3. **Manter** a renderização clássica e o caminho legado do `fetch-image`, porque decks antigos e ativos v1 pendentes dependem deles.

**Duas pastas de migração.** Desde 21/09, o Lovable aplica o que está em `drizzle/migrations/`. A pasta `supabase/migrations/` virou histórico. Qualquer migração nova feita fora do Lovable precisa ir para `drizzle/migrations/` (ou ser aplicada pelo Lovable), senão não roda.

---

## 3. Segurança e pagamentos

### Crítico — o webhook da Cakto recusa os eventos reais (item 1)

A tabela `security_events` tem 39 recusas `webhook_invalid_secret`:
- **Desde 07/08, a Cakto envia sempre o mesmo segredo** (impressão `2bf40c2c…`), e o servidor espera outro (`46925c80…`).
- O "enviar teste de todos os eventos" de 09/08 foi recusado inteiro: purchase_approved, refund, chargeback, subscription_* e pix/boleto gerado.
- A última recusa foi em 12/09.
- Os 16 eventos **aceitos** (até 09/08) eram todos de teste (`example.com`, `exemplo.com`, ids de diagnóstico).
- Resultado: **o fluxo compra → crédito nunca rodou de ponta a ponta**. Não há nenhum perfil com plano pago nem nenhuma linha em `credit_transactions`.

**Correção (configuração):**
1. Copiar o segredo do webhook do painel da Cakto para o secret `CAKTO_WEBHOOK_SECRET` (ou o inverso).
2. Reenviar o teste.
3. Confirmar em `payment_events` que os eventos entram.
4. Fazer uma compra real de ponta a ponta com uma conta de teste antes de abrir vendas.

### Alto — reembolso e chargeback descartados como duplicata (item 2)

- A idempotência usa `payment_events.cakto_id`, com índice único, e o id vem de `data.id` (`cakto-webhook/lib.ts:146`).
- Nos payloads reais da Cakto (lote de 28/07), `data` é o **objeto do pedido** (`id`, `refundedAt`, `chargedbackAt`, `parent_order`…). Um reembolso real chega com o **mesmo `data.id`** da compra aprovada.
- O insert falha por unicidade e o handler responde `duplicate delivery ignored` sem processar. **O estorno de créditos nunca acontece.**
- Os testes (`index.test.ts`) não pegam isso porque usam um id diferente por evento.

**Correção:**
- A chave de idempotência passa a ser `evento + data.id` (e, se preciso, também `status`).
- O índice único vai para `(event_type, cakto_id)`.
- Acrescentar um teste com compra e reembolso do mesmo pedido.

### Alto — o orçamento de imagem vem do navegador (item 3)

- **Na geração:** `generate-presentation` (`index.ts:602` e `:657`) usa o `max_budget_usd` enviado pelo cliente para escolher o modo (economia, equilibrado, premium) e, no v2, **quantas imagens de IA o deck pode gerar**.
  - O `Generate.tsx` envia o valor do Dev Mode para todos os usuários, e ele é editável no `localStorage` (`slideai.devSettings`).
  - Um usuário comum que coloque `100` ganha modo premium e até uma imagem de IA de alta qualidade por slide técnico. Para decks de 20 slides, isso passa do preço do crédito cobrado.
- **No `fetch-image`:**
  - `budget_mode` também vem do cliente (`fetch-image/index.ts:279`) e decide a qualidade (premium = alta, cerca de US$ 0,12 por imagem).
  - Qualquer conta **logada, mesmo sem plano**, pode pedir `strategy: "ai"` até 15 vezes por hora pelo limite genérico (`:319`). Isso já existia, mas o motor v2 encareceu cada imagem.
- **Correção:**
  - No servidor, ignorar `max_budget_usd` e `budget_mode` para quem não é desenvolvedor. O modo passa a vir do plano (por exemplo, `balanced` para todos e `premium` só para planos MAX).
  - No `fetch-image`, exigir plano ativo (`can_user_generate`) ou cota da apresentação para qualquer imagem de IA.

### Médio — reembolso de compra avulsa derruba a assinatura inteira

Quando o item 2 for corrigido e os reembolsos passarem a ser processados, o ramo `refund` do webhook (`cakto-webhook/index.ts`, bloco `action === "refund"`) faz três coisas, **qualquer que seja o pedido reembolsado**:
- põe `plan = "free"`;
- põe `subscription_status = "canceled"`;
- chama `revoke_credits`, que zera `credits_bonus` **e** `credits_monthly` (função SQL conferida no banco).

Um assinante que peça reembolso de uma compra **avulsa** perde a assinatura ativa e todos os créditos, inclusive os de outras compras.

**Correção:**
- Estornar só os créditos concedidos por **aquele** pedido (o ledger `credit_transactions` pode guardar o `cakto_id` de cada concessão).
- Só rebaixar o plano quando o pedido reembolsado for o da assinatura vigente.

### Médio — vazamento de plano e saldo de outros usuários (item 4)

- `can_user_generate(_uid, _credits_cost)` é `SECURITY DEFINER`, executável por `authenticated`, e aceita **qualquer `_uid`**.
- `get_profile_for_viewer(username)` devolve o `id` de qualquer usuário a partir do nome público.
- Juntando as duas, qualquer pessoa logada descobre **plano, saldo de créditos, cota mensal e vencimento da assinatura** de outra pessoa.
- **Correção (SQL):** no início da função, `IF auth.role() <> 'service_role' THEN _uid := auth.uid(); END IF;`.

### Baixo

- **Webhook:** `ilike("email", email)` em `cakto-webhook/index.ts:129` trata `_` e `%` como curingas. `joao_silva@x.com` também casa com `joaoXsilva@x.com`. Usar comparação exata em minúsculas.
- **`presentersCount` sem teto no servidor (`generate-presentation/index.ts:594`):** o `while` da linha 634 roda até o valor enviado. Um pedido com `presentersCount: 100000000` trava a função depois de cobrar os créditos. Limitar a 1–10.
- **`profiles`:** o trigger `protect_billing_columns` protege plano, assinatura e créditos (correto). `generations_count`, `role` (persona do onboarding) e `email` continuam editáveis pelo próprio usuário. Nenhum é usado para autorização, então o risco é baixo.
- **O que está correto:** todas as funções de dinheiro (`consume_credits`, `refund_generation_credits`, `grant_*`, `revoke_credits`, `set_monthly_credits`) só executam como `service_role`. O RLS de apresentações, slides, suporte, cota e logs está correto. O `og-preview` escapa o HTML. O `.env` versionado só tem chaves públicas. O `mcp` usa o token OAuth do usuário, com RLS.

---

## 4. Front-end

| Achado | Onde | Correção |
|---|---|---|
| **As miniaturas do Dashboard saem com o tema errado.** O Dashboard lê o tema de `slides[0].content.dynamic_theme`, mas as gerações atuais gravam em `presentations.dynamic_theme`, e o select não traz essa coluna. As capas dos decks novos com tema automático aparecem com as cores padrão. | `src/pages/Dashboard.tsx:35` e `:123` | Incluir `dynamic_theme` no select e usar `p.dynamic_theme ?? cover.content.dynamic_theme` |
| **O Dashboard faz 1 consulta por apresentação** para buscar a capa (N+1). | `src/pages/Dashboard.tsx:40` | Uma consulta só para os slides `position = 0` de todas as apresentações, ou uma view/RPC |
| **Nenhuma rota usa carregamento sob demanda**, e `pptxgenjs`, `jspdf` e `html2canvas` são importados de forma estática. A landing page baixa o Editor e as libs de export. | `src/App.tsx:13-16`, `src/components/ExportMenu.tsx:7-10` | `React.lazy` por rota e `import()` dinâmico das libs de export no clique |
| **Mensagem de sucesso de pagamento em `window.confirm`** (botões OK/Cancelar para uma confirmação). | `src/components/PaymentNotifications.tsx:57` | Toast ou modal próprio |
| **Erro de realtime em `/gerar`** ("cannot add callbacks after subscribe", 8 ocorrências). | `src/hooks/useEntitlement.tsx` | **Já corrigido** em 18/09 (tópico único); a última ocorrência é de 17/09 |
| **Erro no `/dashboard`** (10 ocorrências até 16/09). O stack está minificado, mas é provavelmente a mesma causa, porque o Dashboard monta os mesmos painéis de saldo. | — | Acompanhar: se voltar depois de 18/09, é outra causa |
| **4 slides antigos (abril/maio) com imagem em base64** no `content` (1,2 a 2 MB cada). Três estão em layouts que nem exibem imagem. | tabela `slides` | Limpar (`image_url = null`) ou migrar para o storage |

---

## 5. Código morto e dívida técnica

- **Componentes nunca usados:** 23 componentes `src/components/ui/*` do scaffold do shadcn (sidebar, chart, carousel, menubar, form…, cerca de 2.600 linhas), mais `src/components/NavLink.tsx` e `src/hooks/use-mobile.tsx`. Levantado pelo grafo de imports do bundle.
- **Dependências sem uso:**
  - `@ai-sdk/react`, `@hookform/resolvers` e `date-fns` não são usadas em lugar nenhum. `@types/flubber` está em `dependencies` em vez de `devDependencies`.
  - Outras 17 (`@radix-ui/react-{alert-dialog,aspect-ratio,checkbox,collapsible,context-menu,menubar,navigation-menu,progress,radio-group,toggle,toggle-group}`, `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-hook-form`, `react-resizable-panels`, `vaul`) só existem por causa dos componentes mortos.
- **Regras de preço e crédito em 4 lugares:** `src/lib/cakto.ts`, `generate-presentation/index.ts:67-83`, `cakto-webhook/index.ts:22-36` e a função SQL `plan_monthly_credits`. Hoje os valores batem, mas o próximo ajuste de preço vai divergir. Levar para `supabase/functions/_shared/pricing.ts` (como os outros catálogos) com um teste de paridade.
- **Regras de acesso duplicadas.** `useEntitlement.tsx` reimplementa no cliente a lógica de `can_user_generate`, e as duas já diferem: o cliente libera com saldo > 0, o servidor exige saldo ≥ custo. O servidor protege, mas a tela pode prometer algo que o servidor nega. Chamar a RPC (já corrigida pelo item 4) em vez de recalcular.
- **Motor v1 e caminho legado:** ver a seção 2.

## 6. Padrões típicos de código gerado prompt a prompt

- **Comentários que narram o histórico dos prompts** ("Bloco 12.2", "Fase 4", "PASSO F" — 14 ocorrências em `generate-presentation`, 8 no Editor, 6 no SlideRenderer…). Explicam a conversa que gerou o código, não o código. Vale limpar aos poucos, ao mexer em cada arquivo.
- **Arquivos-deus:** `Editor.tsx` (1.106 linhas), `generate-presentation/index.ts` (1.270), `SlideRenderer.tsx` (833), `Generate.tsx` (778). Cada novo prompt acrescenta mais um bloco no mesmo arquivo.
- **229 usos de `any`** fora de `ui/` e dos tipos gerados. A maior parte fica na fronteira com o banco (`content: any`). Um tipo `SlideContent` único, gerado a partir de `aiSlide.ts` e `sceneMedia.ts`, eliminaria a maioria.
- **Soluções empilhadas em vez de substituídas:** o tema dinâmico existe em dois lugares (`presentations.dynamic_theme` e `slides[0].content.dynamic_theme`), e cada tela lê um. Há duas pastas de migração. Há o cálculo de acesso no cliente e no servidor.
- **Testes que confirmam a suposição em vez de testá-la:** os fixtures do webhook usam um id diferente por evento, justamente o que esconde o item 2.

## 7. Aprimoramentos sugeridos (depois das correções)

1. **Viewer do dono resolve os ativos pendentes** e o Dashboard mostra "preparando imagens" (item 6).
2. **Notas do orador nunca vazias** (item 5).
3. **Code splitting** por rota e das libs de export: ganho direto no carregamento da landing.
4. **Painel de saúde de pagamentos** no DevDashboard: últimos eventos, recusas por segredo e eventos sem usuário. O problema do item 1 teria aparecido em minutos.
5. **Fechamento com chamada para ação** no v2 (planner), em vez de gráfico.
6. **Remover o v1** conforme o plano da seção 2, depois que o rollout estiver estável em 100%.
7. **Tipo único de `content` do slide**, compartilhado entre Deno e Vite, para reduzir os `any` e os campos duplicados.

## Ordem sugerida

1. **Hoje (configuração):** alinhar o segredo da Cakto e testar uma compra real. Confirmar com uma geração sem Dev Mode que o v2 está ativo.
2. **Antes de abrir vendas (código):** itens 2, 3, 4 e 4b, mais o teto de `presentersCount`.
3. **Em seguida:**
   - itens 5 e 6;
   - Editor restrito ao dono;
   - tema das miniaturas do Dashboard.
4. **Depois:** limpeza (seção 5), code splitting e remoção do v1.
