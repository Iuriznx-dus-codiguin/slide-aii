# Auditoria completa do SlideAI (17/10/2026)

> **Situação em 20/10/2026.** A auditoria abaixo foi feita sem alterar o repositório. As correções vieram depois, na branch `claude/serene-cerf-cxlhuc`, em commits separados por lote, cada um com testes, typecheck, lint comparado e build. As migrações novas (0010 a 0014) foram aplicadas duas vezes num Postgres local com todo o histórico e passaram por cenários de teste.

## Situação dos achados

| Commit | Lote | Achados |
| --- | --- | --- |
| `2970f53` | 1 · Dinheiro | A1, A2, A4, M-4, M-5, M-6, M-10, M-13, M-15, B-9, B-10, B-32 a B-35 |
| `d125bd0` | Privacidade | A3, M-2, M-17, B-1, B-3, B-6, B-7, B-8 (decks nascem privados, API fechada) |
| `af1774a` | Analytics | A5 (Política e Termos declaram GA4 e Google Ads, sem banner, por decisão do controlador), CSP, URLs sem dados pessoais |
| `45b3392` | 2a · Compra e login | M-1, M-3, B-26, B-27 |
| `5b1b029` | 2b · Editor | M-7, M-8, M-9, M-11, M-12, M-14, B-13 a B-18 |
| `0f3733f` | 2c · Telas e suporte | M-18, B-12, B-19 a B-25 |
| `5bc7f3a` | 2d · Velocidade | M-16 (pacote inicial de 1,53 MB para 253 KB com gzip) |
| `5dab6f4` | 3 · Divulgação e SEO | M-19 (parcial, ver abaixo), B-28 |
| `7beccac` e seguinte | 4 · Limpeza | 22 arquivos sem uso, B-4, B-5 (fila), B-29, B-31, B-36 (parcial), B-37 |

**Encontrados e corrigidos durante as correções** (não estavam na lista original):
- o `PaymentGate` chamava a liberação de novo a cada render depois do pagamento; mascarado pelo redirecionamento a `/sucesso`, repetiria a geração e a cobrança ao ficar em `/gerar`;
- quem já tinha algum saldo via o pagamento "confirmado" sem pagar;
- `list_presentations` do MCP listava decks publicados de outros usuários (fechado junto com a API);
- título da apresentação ia para o Google Analytics (inclusive de decks privados);
- o `og-preview` montava o JSON-LD com o título do usuário sem escapar;
- o `ExportMenu` de visitantes dependia de ler as tabelas (agora usa o deck da tela).

**Não feito, com o motivo:**

| Item | Motivo |
| --- | --- |
| B-2 (`has_role` executável por anônimo) | As políticas RLS chamam `has_role` também como anônimo; tirar a permissão exige revisar política por política. Risco maior que o benefício agora. |
| B-11 (saldo no MCP) | `supabase/functions/mcp/index.ts` é gerado no build com a versão instalada de `@lovable.dev/mcp-js`; sem o lockfile do Bun não dá para regenerar com a versão certa. |
| B-30 e remoção das dependências sem uso | Mexem no `package.json`, e os lockfiles do Bun não podem ser regenerados neste ambiente (registro privado). Aguarda decisão. |
| M-3 (atualizar o react-router para 6.30.6) | Mesmo motivo. A correção do redirecionamento foi feita no código. |
| M-19 (prévia por apresentação) | O `og-preview` existe, mas os links `/slides/...` são servidos pelo app; mandar os robôs de prévia para a função exige configuração no domínio/hospedagem. A prévia padrão agora é própria (imagem e textos do SlideAI). |
| B-36 (CI e lint como portão) | Os E2E saíram do `npm test` (`npm run test:e2e`); CI e portão de lint dependem de configurar o GitHub Actions no repositório. |

---

## Relatório original (17/10/2026)

**Base:** branch `claude/serene-cerf-cxlhuc` = `main` no commit `46f835c` (16/10, "Corrigiu redireção OAuth Google").
**Escopo:**
- front-end (React/Vite);
- 12 edge functions (Deno);
- banco: 52 migrações, políticas RLS e funções SQL;
- dependências, build, testes e conteúdo público.

**Método:**
1. Leitura do código seguindo as chamadas, das telas às funções SQL, com as skills anexadas:
   - *audit-context-building*;
   - *sharp-edges*;
   - *supabase-postgres-best-practices*;
   - *react-performance*;
   - *supply-chain-risk-auditor*;
   - *verification-before-completion* / *fp-check*.
2. Três varreduras independentes complementares: banco, front-end e motor/e-mails.
3. **Cada um dos 75 achados passou por um verificador separado, instruído a refutá-lo.** Nenhum foi refutado; 11 foram rebaixados para "parcial", com o impacto corrigido. Os ajustes já estão no texto abaixo.
4. Os 5 achados de severidade alta foram conferidos pessoalmente no código.

**Limites:** não houve acesso de rede à produção (slideai.com.br e o Supabase de produção ficam bloqueados neste ambiente). O que depende do ambiente real está marcado como **"a confirmar"**.

**Nenhum arquivo do repositório foi alterado.** O único efeito colateral foi o build regenerar `supabase/functions/mcp/index.ts`; revertido na hora (ver B-30).

---

## Resumo

**O núcleo continua bem construído:**
- débito antes da IA e estorno idempotente por tentativa;
- webhook com idempotência e comparação de segredo em tempo constante;
- RLS em todas as tabelas;
- limites de uso nas funções caras;
- documentação LGPD;
- 416 testes de unidade passando.

**A auditoria encontrou três problemas que mudam o quadro:**

1. **As redes de segurança da cobrança não funcionam.**
   - O estorno automático de gerações travadas (o P0-7 de 29/09) é bloqueado pelo próprio gatilho de proteção de créditos e **nunca devolveu nada** (A2).
   - Uma falha ao creditar uma compra fica sem alerta (A1).
2. **Privacidade dos decks.** Toda apresentação nasce publicada, e qualquer pessoa com a chave pública do site lista pela API **todos os decks de todos os clientes**, com notas e falas. A Política diz que a publicação é "por escolha sua" (A3).
3. **Perda de recurso pago.** Uma mensagem qualquer no chat de IA do editor apaga as falas dos apresentadores (A4).

O restante são bugs de fluxo e de integridade no editor, contornos de cobrança pela API, desempenho, pendências de marketing e SEO e limpeza.

| Prioridade | Qtde | Exemplos |
|---|---|---|
| 🔴 Alta | 5 | Estorno automático quebrado; decks públicos e enumeráveis; chat apaga falas; webhook silencioso; GA4/Ads contra a Política |
| 🟠 Média | 19 | Compra em `/gerar` quebrada pelo redirecionamento a `/sucesso`; open redirect no login; contornos de cobrança; editor perde edições; IA sem timeout; bundle de 5,3 MB |
| 🟡 Baixa | 30+ | Contadores infláveis, painéis com números errados, acessibilidade, docs, código morto |

### Estado das verificações

| Verificação | Resultado |
|---|---|
| `vitest run` | ✅ 416 passam · ❌ 8 falham, todos nos 2 arquivos `*.e2e.test.ts`, que precisam de rede até o Supabase de produção |
| `tsc --noEmit` | ✅ sem erros (com `strict: false`) |
| `eslint .` | ❌ 279 erros (257 são `no-explicit-any`) e 37 avisos; nenhum é bug real |
| `vite build` | ✅ · ⚠️ bundle principal de **5,35 MB (1,58 MB gzip)**, maior que os 5,16 MB de 29/09 |
| `npm audit` (produção) | ⚠️ avisos no react-router (ver M-3) e em ferramentas de build |
| CI | Não existe (`.github/` ausente) |

---

## 🔴 Alta

### A1 · O estorno automático de gerações travadas nunca funciona

**Onde:** gatilho `protect_billing_columns` (`supabase/migrations/20260827000346_*.sql:206-224`); `refund_stale_generations` e `record_access` (`drizzle/migrations/0006_*.sql:215`, `:327-353` e `:425`).

**O problema:**
1. O pg_cron roda `SELECT public.refund_stale_generations()` a cada 5 min, sem JWT.
2. O estorno faz `UPDATE profiles SET credits_bonus…`.
3. O gatilho exige `auth.role() = 'service_role'`. No cron, `auth.role()` é nulo, então ele lança 42501 e desfaz a varredura inteira: nem estorno, nem log, nem alerta, nem e-mail "devolvemos seus créditos".
4. O mesmo acontece quando a varredura roda dentro de `record_access`, onde o papel é `authenticated`.
5. A tentativa fica `running` para sempre, então o problema não se resolve sozinho.

**Agravante (Marco Civil):** enquanto houver uma tentativa travada, a cada 5 min algum `record_access` aborta e desfaz o registro de acesso (art. 15) e a retenção feita na mesma transação. O front ignora o erro.

**Impacto:** toda geração que morrer por timeout ou queda do worker, sem passar por `failGeneration`, fica sem estorno. O cliente paga e não recebe, e o sistema diz que devolve. **A confirmar** em produção: `SELECT count(*) FROM generation_attempts WHERE status='running' AND created_at < now()-interval '15 min'`.

**Correção proposta:**
- deixar as funções internas de crédito escreverem com uma marca local de transação (`set_config('slideai.billing_write','on',true)`) aceita pelo gatilho;
- isolar a manutenção dentro de `record_access` (`BEGIN … EXCEPTION`);
- criar um teste SQL do cenário.

### A2 · Webhook da Cakto: falha ao conceder créditos é silenciosa

**Onde:** `supabase/functions/cakto-webhook/index.ts:247-376`.

**O problema:**
- Erros das RPCs `grant_bonus_credits` (:261), `set_monthly_credits` (:255/:281), `grant_bonus_credits_once` (:298) e `revoke_order_credits` (:349), e dos `.update()` em `profiles`, só vão para o log.
- Em seguida `:376` marca o evento como processado, sem `error_message`, e a resposta é 200.
- O `catch` com alerta só pega exceções, e o supabase-js não lança.
- A Cakto não reenvia, e um reenvio manual seria descartado como duplicado.

**Impacto:** numa falha transitória do banco, o cliente paga e não recebe créditos, sem ninguém ser avisado. É raro, mas é o pior tipo de falha para quem vende.

**Correção proposta (pequena):** lançar exceção em qualquer `error` (o `catch` já grava e alerta), devolver 5xx e permitir reprocessar quando `processed = false`.

### A3 · Toda apresentação nasce pública e todas podem ser listadas pela API anônima

**Onde:**
- `generate-presentation/persist.ts:82` e `src/lib/legacyPersist.ts:88` gravam `is_published: true`, que também é o padrão da coluna;
- as policies `presentations_public_read` e `slides_public_read` (`supabase/migrations/20260419011055_*.sql:44` e `:66`) não exigem slug.

**O problema:**
- Com a chave anon que vem no site, `GET /rest/v1/presentations?select=*,slides(*)` devolve os decks de **todos** os clientes: título, `user_id`, `creative_brief`, nomes dos apresentadores, notas e falas.
- O "portfólio privado" é contornado filtrando por `user_id`.
- A Privacidade (`Privacy.tsx:182`) diz que decks publicados são acessíveis "por escolha sua", mas não há escolha: já nascem publicados.

**Relacionado:**
- A ferramenta MCP `list_presentations` (`src/lib/mcp/tools/list-presentations.ts:21`) lista os decks públicos de **outras pessoas** como se fossem do usuário.
- `get_profile_for_viewer` devolve o `id` mesmo quando o acesso é negado.

**Impacto:** LGPD (finalidade e segurança), confiança e conteúdo sensível de clientes (pitch, dados internos) exposto. **A confirmar** com um `curl` à API (bloqueado aqui).

**Correção proposta:**
1. Ler a apresentação pública por slug via RPC `SECURITY DEFINER`, devolvendo só as colunas do visualizador.
2. Remover a leitura pública direta das tabelas.
3. Corrigir o MCP.
4. Decidir o padrão de publicação e o que fazer com os decks existentes. **Precisa da sua decisão (pergunta 3).**

### A4 · Qualquer mensagem no chat de IA apaga as falas pagas

**Onde:** `src/pages/Editor.tsx:571-581`; save em `:443-453`.

**O problema:** ao aplicar a resposta do chat, o editor monta os slides sem `presenters_data`. O `save()` grava `s.presenters_data ?? []`. Basta uma mensagem, mesmo uma que não mude nada ("Não identifiquei nenhuma alteração"), e no próximo autosave ou ao sair do editor **as falas dos apresentadores (+50 créditos) somem de todos os slides**, no banco e no link público.

**Correção proposta (uma linha, mais o ideal):** preservar `presenters_data` ao montar `updated`. O ideal é aplicar só os slides em `changed_slides` sobre o estado atual (resolve também o M-7).

### A5 · GA4 e Google Ads sem consentimento, contra a Política de Privacidade

**Onde:** `src/lib/analytics.ts`, `src/main.tsx:4-6`, `src/components/AnalyticsTracker.tsx`; política em `src/pages/Privacy.tsx:49` e `:291`; CSP em `public/_headers:22`.

**O problema:**
- Desde 14/10 todas as páginas carregam o gtag com GA4 (`G-YGVZGP56FC`) e Google Ads (`AW-18513941668`), para todos os visitantes, sem banner nem Consent Mode.
- A política publicada diz: *"Não usamos cookies de publicidade nem ferramentas de rastreamento de terceiros"*.
- **Agravante:** o tracker envia a URL com a query string, então o token `?t=` de `/emails/preferencias` (a credencial de descadastro) vai para o Google.
- `trackEvent` nunca é chamado: não há conversão de compra para o Ads.
- **A confirmar:** a CSP não libera os domínios do Google. Se o host aplicar o `_headers`, o GA está bloqueado e não mede nada. Se não aplicar, nenhuma proteção da CSP vale em produção. Dá para ver no DevTools → Network.

**Correção proposta:** depende de você (pergunta 1).

---

## 🟠 Média

### Fluxo de compra e conta

**M-1 · Comprar dentro de `/gerar` agora tira o usuário do fluxo.**
- **Onde:** `PaymentNotifications.tsx:56-61` (de 14/10), `PaymentGate.tsx:42-47`, `Generate.tsx:847-850`.
- **Problema:** `celebratePayment` navega para `/sucesso` em todo pagamento detectado. No caso mais provável, o Realtime chega antes, `/gerar` é desmontado, **a geração prometida não começa e o formulário preenchido se perde**. No outro caso, a geração começa e, cerca de 1 min depois, o usuário é jogado no editor.
- **Também:** renovações e "assinatura retomada" mandam para "Obrigado pela sua compra!" no meio do editor.
- **Decisão:** pergunta 2.

**M-2 · `profiles.email` é editável pelo usuário e o webhook confia nele primeiro.**
- **Onde:** gatilho sem `email`, `generations_count` e `total_views`; `cakto-webhook/index.ts:133-147`.
- **Problema:** quem gravar no próprio perfil o e-mail de alguém que ainda não tem conta recebe os créditos quando essa pessoa pagar. É um ataque dirigido e improvável. Os e-mails da plataforma usam esse campo, então dá para enviar a endereços arbitrários. Somado a `profile_access_requests` sem checagem de `allow_access_requests` nem limite de texto (`send-email/index.ts:68`), dá para fazer a plataforma mandar e-mail com texto livre a qualquer usuário (phishing em texto; o HTML é escapado).
- **Correção:**
  - proteger as colunas;
  - no webhook, usar primeiro `auth.users`;
  - validar os pedidos de acesso no banco.

**M-3 · Open redirect no login.**
- **Onde:** `Auth.tsx:41/49`.
- **Problema:** o filtro `/^\/(?!\/)/` aceita `/\evil.com` (vira `https://evil.com/`), e quem já está logado é levado para fora com um clique. O react-router 6.30.1 tem avisos para esse vetor sem correção na linha 6, então a correção é no código.
- **Correção:** validar com `new URL()` e mesma origem, e atualizar para 6.30.6 pelos outros avisos.

### Contornos de cobrança e de cota pela API

**M-4 · Falas de graça.**
- **Onde:** `include_speeches` é editável pelo dono (gatilho em `drizzle/migrations/0002_*.sql:240`).
- **Problema:** basta um PATCH `include_speeches: true` para liberar `regenerate-speeches` sem pagar os 50 créditos. Além disso, `speech_regen_count` é lido, calculado e gravado sem trava e sem rate limit, então requisições paralelas passam do limite de 5 (`regenerate-speeches/index.ts:214`).

**M-5 · Cota do chat de IA renovável à vontade.**
- **Problema:** a cota de 10 mensagens / 3 edições complexas é por linha de `presentations`, e o usuário pode criar linhas vazias pela API (cerca de 960 chamadas de IA por dia por conta, com o rate limit atual).
- **Também:** a cota é lida no início e só gravada no fim, então requisições simultâneas passam juntas; e a edição sem slide em escopo consome a cota sem mudar nada (`editDirector.ts:215`).

**M-6 · Motor v1 cobra pelo número pedido e entrega menos.**
- **Onde:** `generate-presentation/index.ts:1047`.
- **Problema:** um pedido de 20 slides cobra 270 créditos. Se a IA devolver 14, o retry não dispara (14 ≥ 70%), e o deck é salvo com 14 slides sem estorno da diferença.

### Integridade do editor

**M-7 · Edições feitas enquanto o chat de IA responde são sobrescritas.**
- **Onde:** `Editor.tsx:571`.
- **Problema:** a resposta substitui o deck inteiro pelo estado de antes do envio.

**M-8 · O salvamento não é serializado nem atômico.**
- **Onde:** `Editor.tsx:463`.
- **Problema:** um autosave e um Ctrl+S ao mesmo tempo podem apagar um slide recém-criado. Uma exclusão que falhou mostra "Salvo!" e deixa posições duplicadas.

**M-9 · O editor reaproveita o estado ao trocar de apresentação.**
- **Onde:** `Editor.tsx:204`.
- **Problema:** se uma geração termina enquanto o usuário edita outro deck, a URL muda na mesma instância. Um Ctrl+Z pode gravar os slides de A dentro de B e apagar os de B. É improvável, mas o pior caso perde dois decks.

**M-10 · Regenerar falas aplica no slide errado.**
- **Onde:** `Editor.tsx:365`.
- **Problema:** se houver reordenação ou texto não salvo, a fala vai para o slide errado (o servidor usa a posição do banco).

**M-11 · Exportar PDF/PPTX ignora alterações não salvas.**
- **Onde:** `ExportMenu.tsx:26`.
- **Problema:** o arquivo sai sem as alterações ainda não salvas. Além disso, o PPTX falha inteiro se uma única imagem não carregar (`exportPptx.ts:489`).

**M-12 · Pedido de cores ao chat é descartado e gasta a cota.**
- **Onde:** `Editor.tsx:589`.
- **Problema:** o tema dinâmico calculado pelo servidor nunca é aplicado.

### Confiabilidade e custo

**M-13 · Chamadas de IA sem timeout.**
- **Onde:** conteúdo v1/v2, chat, falas e imagens (`generate-presentation/index.ts:964/1051`, `contentV2.ts:293`, `chat-editor/index.ts:281`, `regenerate-speeches/index.ts:157`, `fetch-image`).
- **Problema:** com o provedor lento, a função é morta pelo limite da plataforma, o usuário vê um erro genérico e o estorno depende da varredura, que hoje está quebrada (A1).
- **Correção:** `AbortSignal.timeout()` com orçamento total, mais estorno imediato.

**M-14 · Imagens resolvidas em dobro.**
- **Onde:** `SlideViewer.tsx:74`.
- **Problema:** editor e visualizador do dono buscam as mesmas imagens pendentes em paralelo. O custo de IA dobra e a cota da apresentação se esgota.

**M-15 · Alertas e e-mails perdidos em falha transitória.**
- **Onde:** `opsAlerts.ts:55`.
- **Problema:** o "já enviado" é gravado **antes** do envio e não há nova tentativa. Uma instabilidade do Resend apaga o alerta crítico.

**M-16 · Bundle de 5,3 MB carregado já na landing.**
- **Onde:** `App.tsx` importa as 25 páginas de forma estática.
- **Composição (pelo sourcemap):**

| Origem | Peso aprox. |
|---|---|
| Chat de `/suporte`: mermaid, KaTeX, shiki, streamdown | ~1,1 MB |
| Exportações: docx, jsPDF, pptxgenjs, html2canvas, jszip | ~1,3 MB |
| recharts | 277 KB |
| `motion` (segunda cópia do framer-motion) | ~126 KB |

- **Correção:** `React.lazy` nas rotas, `import()` das exportações no clique e tirar os plugins do chat.

### Suporte

**M-17 · Mensagens forjadas e chamados bloqueáveis.**
- **Onde:** policies de suporte (`20260716013934_*.sql:135`).
- **Problema:** pela API, o dono da conversa pode inserir mensagens como `assistant`, reescrever estado, `resolved_*` e `rating`, e criar `ticket_id` adiantados. Isso faz o próximo chamado de outros clientes falhar com 500 (DoS barato).

**M-18 · O assistente perde a pergunta em conversas longas.**
- **Onde:** `support-chat/index.ts:169`.
- **Problema:** ele lê as 30 **primeiras** mensagens. Depois de cerca de 15 trocas, a pergunta atual nem chega ao modelo, que muda o estado do chamado às cegas.
- **Também:** responder num chamado escalado desfaz o escalonamento (`:281`).

### Divulgação e SEO

**M-19 · Prévia de links e promessas pendentes desde 29/09.**
- **Prévia de links:** o `og-preview` não é usado por nada, então todo link compartilhado no WhatsApp ou LinkedIn mostra o título "SlideAI", a imagem num bucket da Lovable e `twitter:site @Lovable`.
- **Promessas:**
  - "Geração em segundos" aparece em 7 lugares (o real é ~47 s, p95 81 s);
  - "Suporte prioritário" aparece em todos os planos;
  - o FAQ do `index.html` ainda fala em "plano Ilimitado";
  - o `<title>` da home virou só "SlideAI".
- **Decisão:** perguntas 3 e 4.

---

## 🟡 Baixa

### Banco e API

| # | Achado | Onde |
|---|---|---|
| B-1 | `view_count` inflável por qualquer anônimo (insert sem deduplicação) e gravável pelo dono | `20260806000646_*.sql:23` |
| B-2 | `has_role` e `can_view_portfolio` executáveis por anônimo com IDs arbitrários: mapeiam as contas da equipe | `20260806000729_*.sql:38` |
| B-3 | `generation_logs` legível pelo cliente: custo real em USD, modelos e erros internos | `20260519001144_*.sql:35` |
| B-4 | `refund_generation_credits` não confere o status da tentativa (só o service_role chama) | `0006_*.sql:153` |
| B-5 | Índices que não atendem à fila de e-mails e à busca de pagador, mais índices duplicados; linha presa em `processing` nunca volta | `0008_*.sql:357` |
| B-6 | Storage sem `file_size_limit`/`allowed_mime_types`; avatar aceita qualquer arquivo, e o bucket pode ser listado por anônimo (expõe UUIDs) | `20260814235606_*.sql:130-144` |
| B-7 | "Remover foto" não apaga o arquivo; a URL antiga vale 10 anos | `Profile.tsx:178` |
| B-8 | Painel `/__dev` com contagens erradas (staff sem policy de leitura) e Realtime que nunca dispara | `DevDashboard.tsx:44` |
| B-9 | Se registrar o sucesso da geração falhar (update e log), a varredura estornaria um deck entregue | `generate-presentation/index.ts:1259-1269` |
| B-10 | `fetch-image` consome a cota de IA antes do cache e em falha | `fetch-image/index.ts:337/457` |
| B-11 | MCP `get_credit_balance` mostra saldo diferente do que o servidor aceita | `src/lib/mcp/tools/get-credit-balance.ts:35` |

### Editor, telas e acessibilidade

| # | Achado | Onde |
|---|---|---|
| B-12 | Tela de erro global: "Abrir suporte" não faz nada, e "Já registramos o problema" é falso para visitantes | `ErrorBoundary.tsx:43` |
| B-13 | Acessibilidade do editor: botões de ícone sem nome, inclusive "excluir", e reordenação impossível por teclado (LBI) | `Editor.tsx:119` |
| B-14 | Imagem que chega em segundo plano sobrescreve a escolha mais recente do usuário | `useProgressiveAssets.ts:88` |
| B-15 | Autosave "a cada 30 s" só dispara depois de 30 s **sem** edição | `Editor.tsx:491` |
| B-16 | Impressão do roteiro com HTML cru (self-XSS; só no editor do dono) | `PresenterNotesPanel.tsx:101` |
| B-17 | Exportar pelo Dashboard ignora a fonte do deck | `Dashboard.tsx:185` |
| B-18 | Excluir mostra sucesso sem checar erro; o editor abre decks da lixeira com autosave | `Dashboard.tsx:63` |
| B-19 | "Sair" encerra as sessões em todos os dispositivos | `Dashboard.tsx:88` |
| B-20 | Widget de suporte mostra a conversa do usuário anterior depois de trocar de conta | `SupportWidget.tsx:167` |
| B-21 | `/suporte`: em erro de rede diz "mensagem preservada", mas a caixa já foi limpa | `Support.tsx:97` |
| B-22 | "Consumidos nos últimos 30 dias" conta estornos e reembolsos | `CreditsPanel.tsx:61` |
| B-23 | Feedback 👍/👎 dos artigos de ajuda não é gravado | `HelpArticle.tsx:214` |
| B-24 | Visualizador: impressão com o tema padrão e todos os slides montados em toda visita | `SlideViewer.tsx:271` |
| B-25 | O vídeo de fundo do visualizador chama a Pexels a cada visitante e pode esgotar a cota do projeto inteiro | `AmbientBackdrop.tsx:91` |
| B-26 | `ProtectedRoute` sem `next`: login cai no `/dashboard`; os CTAs "Assinar" abrem o formulário em vez dos planos | `ProtectedRoute.tsx:14`, `Pricing.tsx:183` |
| B-27 | `useEntitlement` por componente: até 4 canais e consultas repetidas; o polling do `PaymentGate` nunca para | `useEntitlement.tsx`, `PaymentGate.tsx:28` |

### Motor, configuração e regras

| # | Achado | Onde |
|---|---|---|
| B-28 | **Regra do AGENTS.md não seguida:** a estimativa do PRO está fixa em 20. Derivada (3.200 ÷ 500 × 3) dá **≈19**. Os e-mails dizem "~26" e o suporte diz 20 | `Pricing.tsx:55`, `lifecycleTemplates.ts:276` |
| B-29 | Docs desatualizadas: o texto usa OpenRouter (`OPENROUTER_API_KEY`, numa variável chamada `OPENAI_API_KEY`) e o README não lista essa chave. O modelo de imagem padrão `gpt-image-2.5-flare` é "estimado" e não dá para confirmar daqui | `modelRegistry.ts:25/205`, `README.md:81` |
| B-30 | O build reescreve `supabase/functions/mcp/index.ts` com a versão instalada de `@lovable.dev/mcp-js`; sem o `bun.lock`, 2.0.4 vira 2.3.0 em silêncio (aconteceu nesta auditoria e foi revertido) | `vite.config.ts` |
| B-31 | Retry do motor v2 posiciona errado faltantes não contíguos (só com v2 ativo) | `contentV2.ts:353` |
| B-32 | Brief da IA mesclado sem validar tipos: `null` num grau derruba a geração v1 e o chat | `creativeDirector.ts:269` |
| B-33 | `applyEdits` descarta um patch quando a IA manda dois para o mesmo slide | `editDirector.ts:417` |
| B-34 | `chat-editor` aceita slides do cliente sem limite de tamanho no prompt | `editDirector.ts:278` |
| B-35 | Regeneração de falas: o fallback `get(pos+1) ?? get(pos)` duplica a fala do slide anterior | `regenerate-speeches/index.ts:190` |
| B-36 | Testes e lint: `npm test` roda os e2e contra a produção (com rede); lint sem portão; sem CI | `vitest.config.ts`, `eslint.config.js` |
| B-37 | Migração `0005_email_log` sem cópia em `supabase/migrations` e não idempotente | `drizzle/migrations/0005_email_log.sql` |

---

## Código morto e dependências

Nada disso pesa no bundle, exceto `motion`. O custo é de manutenção, de instalação e de superfície de ataque.

- **22 arquivos sem uso:**
  - 20 componentes em `src/components/ui/`: aspect-ratio, breadcrumb, calendar, carousel, chart, collapsible, context-menu, drawer, form, input-otp, menubar, navigation-menu, pagination, progress, radio-group, resizable, sidebar, toggle-group, toggle e use-toast;
  - `NavLink.tsx`;
  - `use-mobile.tsx`.
- **18 dependências sem uso:** `@ai-sdk/react`, `@hookform/resolvers`, `react-hook-form`, `date-fns`, `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-resizable-panels`, `vaul` e 9 `@radix-ui` correspondentes.
- **Duplicada:** `motion` (só em `shimmer.tsx`) duplica o framer-motion no bundle.
- **Fora do lugar:** `@types/flubber` está em `dependencies`.
- **Cerca de 60 exports sem uso** em `src/lib` e `_shared`.

---

## O que já está bom (manter)

- Débito antes da IA, estorno idempotente por tentativa, orçamento de imagem decidido no servidor.
- Webhook: segredo em tempo constante, rotação com dois segredos, sem segredo na URL, estorno restrito ao que o pedido concedeu.
- Sanitização contra prompt injection; conteúdo do usuário delimitado como dado.
- E-mails com HTML escapado (coberto por teste); descadastro em um clique seguindo a RFC 8058.
- Editor com autosave, aviso ao sair e salvamento ao desmontar.
- Documentação, runbooks e LGPD muito acima da média; testes de paridade de regras entre front, banco e Central de Ajuda.

---

## Plano de correção sugerido (lotes revisáveis)

| Lote | Conteúdo | Risco | Depende de decisão? |
|---|---|---|---|
| 1. Dinheiro | A1, A2, A4, M-4, M-5, M-6, M-13, B-9 | Baixo (servidor, uma migração, 1 linha no editor) | Não |
| 2. Privacidade e segurança | A3, M-2, M-3, M-17, B-1 a B-3, B-6/B-7 | Médio (troca a leitura pública por RPC) | Sim (pergunta 3) |
| 3. Analytics | A5 | Baixo | Sim (pergunta 1) |
| 4. Compra e editor | M-1, M-7 a M-12, B-12 a B-27 | Médio (exige teste no navegador) | Sim (pergunta 2) |
| 5. Desempenho | M-16 | Médio (teste no navegador) | Não |
| 6. Divulgação | M-19, B-28 | Baixo | Sim (pergunta 4) |
| 7. Limpeza | código morto, deps, B-29 a B-37 | Baixo | Não |

Cada lote viraria um commit separado, com testes, lint, typecheck e build verificados antes do push. As migrações seguem a regra do repositório: idempotentes, em `drizzle/migrations` com cópia em `supabase/migrations`.

**O que só você pode fazer (fora do código):**
- confirmar na produção os itens "a confirmar": tentativas `running` antigas, cabeçalhos aplicados pelo host, limites dos buckets e logs do `gpt-image-2.5-flare`;
- itens da revisão anterior que continuam com o dono: dados da empresa em `legal.ts`, MFA das contas internas, teto de gasto nos provedores de IA e teste de restauração de backup.
