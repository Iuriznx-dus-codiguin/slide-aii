# Issues para o GitHub — auditoria de segurança SlideAI (09/10/2026)

--- ISSUE 1 ---
Título: [Segurança] E-mail do perfil editável desvia pagamentos da Cakto
Labels: security, severidade:alta

## Descrição do problema

A coluna `profiles.email` pode ser alterada pelo próprio usuário: a política `profiles_update_own` não restringe colunas e o trigger `protect_billing_columns` não inclui `email`. O `cakto-webhook` resolve o dono da compra procurando primeiro esse e-mail em `profiles`. Um usuário que grave no próprio perfil o e-mail de outra pessoa recebe o plano ou os créditos quando ela compra sem ter perfil com aquele e-mail (compra antes do cadastro ou com outro e-mail).

## Por que é explorável

Com a chave anon (pública) e a própria sessão, supabase.from('profiles').update({ email: 'vitima@empresa.com' }).eq('id', meuId) passa pela RLS e pelo trigger. Quando a vítima compra com esse e-mail, o webhook encontra o perfil do atacante e libera nele o plano ou os créditos. Condições: O e-mail da compra não pode estar em outro perfil: com dois perfis iguais o maybeSingle falha e o webhook cai em auth.users, que resolve a vítima. Vale para quem compra antes de criar a conta ou com outro e-mail. É um ataque direcionado: o atacante precisa saber o e-mail com antecedência.

## Evidência

- `supabase/migrations/20260419011055_21b30c1d-4d93-4844-bbdf-d4be80e96700.sql:16` — `CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);`
- `supabase/migrations/20260827000346_68e8e98f-500b-4310-8345-f07ef89f505f.sql:206-224` — `protect_billing_columns()` não verifica `email`.
- `supabase/functions/cakto-webhook/index.ts:134-137` — `.from("profiles").select("id").ilike("email", escapeLike(email)).maybeSingle()` define o `userId`.
- Índice `profiles_email_lower_idx` não é único.
- `supabase/functions/_shared/lifecycle.ts:32` e `supabase/functions/send-email/index.ts:62,74,86` enviam e-mails para `profiles.email`.

## Impacto

Desvio de compras e assinaturas de terceiros, e e-mails da plataforma enviados para endereços escolhidos pelo atacante.

## Sugestão de correção

- Adicionar `email` à lista de colunas travadas (ou sincronizar `profiles.email` a partir de `auth.users` por trigger).
- No `cakto-webhook`, resolver primeiro por `auth.users` (`find_user_id_by_email`) e só depois pelo perfil.
- Criar índice único em `lower(email)` e tratar duplicados existentes.

## Critérios de aceite

- [ ] `update profiles set email = ...` feito pelo cliente retorna erro 42501.
- [ ] Teste do webhook com dois perfis com o mesmo e-mail credita a conta de `auth.users`.
- [ ] Índice único em `lower(email)` criado em produção.
- [ ] Lifecycle e send-email usam o e-mail de `auth.users`.

_Achados do relatório de auditoria de 09/10/2026: A1._
--- FIM ISSUE 1 ---

--- ISSUE 2 ---
Título: [Segurança] Rotacionar o segredo do webhook da Cakto e eliminar as exposições
Labels: security, severidade:média

## Descrição do problema

O segredo do webhook da Cakto foi exposto duas vezes:

1. O valor real em produção foi commitado em `supabase/functions/cakto-webhook/index.test.ts:13` (commit `1cdc8b0`, 01/08/2026). O repositório é público, e o valor foi aceito até a rotação em 28/09/2026 (impressão `46925c8066f7`).
2. O valor atual (impressão `2bf40c2c9acd`) foi colado em texto puro no chat do projeto na Lovable em 29/09/2026.

Com o segredo, qualquer pessoa pode forjar eventos de pagamento.

## Por que é explorável

**A2** — Entre 01/08 e 28/09/2026, qualquer pessoa com o histórico podia enviar eventos falsos (purchase_approved, subscription_created…) com o segredo válido e liberar planos ou créditos para qualquer e-mail. Condições: Hoje o valor não é mais aceito: o segredo foi rotacionado e a lista esperada só tem 2bf40c2c9acd. Forense: os 7 eventos de pagamento entre 01/08 e 29/09 não foram creditados a nenhuma conta (user_id nulo).

**A3** — Quem tem acesso ao histórico do projeto (membros do workspace; visibilidade workspace_edit) ou ao armazenamento do fornecedor pode forjar eventos de pagamento válidos. Condições: É preciso ter acesso ao projeto na Lovable. O segredo continua válido.

## Evidência

- `git show 1cdc8b0:supabase/functions/cakto-webhook/index.test.ts` — linha 13 (`const SECRET = "[oculto]"`).
- `security_events` (cakto-webhook): impressão esperada `46925c8066f7` até 28/09/2026 e `2bf40c2c9acd` depois.
- Forense: nenhum dos 7 eventos de pagamento entre 01/08 e 29/09/2026 foi creditado a uma conta.

## Impacto

Liberação indevida de planos e créditos e reembolsos falsos.

## Sugestão de correção

- Gerar um novo segredo na Cakto e atualizar `CAKTO_WEBHOOK_SECRET` só pela tela de Secrets da Lovable.
- Conferir que a lista aceita contém apenas o novo valor.
- Usar só valores fictícios em testes e adicionar gitleaks ao fluxo de PR.
- (Opcional) Reescrever o histórico para remover o valor antigo.

## Critérios de aceite

- [ ] A impressão esperada em `security_events` muda para o novo valor.
- [ ] Um evento de teste da Cakto com o novo segredo é aceito; com os dois antigos, recebe 401.
- [ ] Workflow de varredura de segredos ativo no repositório.

_Achados do relatório de auditoria de 09/10/2026: A2, A3._
--- FIM ISSUE 2 ---

--- ISSUE 3 ---
Título: [Segurança] Apresentações publicadas são listáveis por qualquer pessoa e furam o portfólio privado
Labels: security, severidade:média

## Descrição do problema

A política `presentations_public_read` permite que anônimos leiam todas as colunas de todas as apresentações publicadas, e toda apresentação gerada nasce com `is_published: true`. Com a chave anon é possível listar todas as apresentações de um perfil privado (o `user_id` vem de `get_profile_for_viewer`), incluindo `creative_brief` e `brand_identity`, ignorando `can_view_portfolio`. A ferramenta `list_presentations` do MCP também devolve as apresentações publicadas de todos os usuários.

## Por que é explorável

Com a chave anon: GET /rest/v1/presentations?select=*&is_published=eq.true&user_id=eq.<id> lista todas as apresentações de um portfólio privado, incluindo creative_brief, brand_identity e presenters_names. A verificação can_view_portfolio só existe na RPC get_portfolio_presentations. A ferramenta list_presentations do MCP também mistura as apresentações publicadas de todos os usuários. Condições: Basta a chave anon pública. Em produção, 50 de 52 apresentações estão publicadas, hoje todas de uma única conta.

## Evidência

- `supabase/migrations/20260419011055_21b30c1d-4d93-4844-bbdf-d4be80e96700.sql:44` e `:66` (presentations_public_read, slides_public_read).
- `src/lib/legacyPersist.ts:88` e `supabase/functions/generate-presentation/persist.ts:82` — `is_published: true`.
- `supabase/functions/mcp/index.ts:81` / `src/lib/mcp/tools/list-presentations.ts:22-23` — consulta sem filtro por `user_id`.

## Impacto

Exposição do conteúdo e dos metadados de marca de todos os usuários e quebra do portfólio privado.

## Sugestão de correção

- Criar apresentações como não publicadas por padrão (o usuário publica explicitamente).
- Trocar a leitura pública direta por RPC ou view por slug, com colunas mínimas e sem listagem aberta.
- Fazer a listagem por dono respeitar `can_view_portfolio`.
- Filtrar por `user_id = ctx.getUserId()` no MCP.

## Critérios de aceite

- [ ] `GET /rest/v1/presentations?is_published=eq.true` com a chave anon não lista apresentações.
- [ ] O visualizador público por slug continua funcionando.
- [ ] Portfólio privado sem acesso aprovado não expõe apresentações por nenhuma rota.
- [ ] `list_presentations` devolve só as apresentações do usuário autenticado.

_Achados do relatório de auditoria de 09/10/2026: A4._
--- FIM ISSUE 3 ---

--- ISSUE 4 ---
Título: [Segurança] Flags pagas e cotas de IA controladas pelo cliente
Labels: security, severidade:média

## Descrição do problema

`include_speeches` (recurso de +50 créditos) e `presenters_*` são gravados pelo navegador (`legacyPersist.ts`), e a RLS permite alterá-los. O `regenerate-speeches` confia em `include_speeches` e não limita o número de slides. As cotas do `chat-editor` e do `regenerate-speeches` são contadas por apresentação, uma unidade que o cliente cria livremente pela API.

## Por que é explorável

Um usuário com plano ativo (ou bônus) cria pela API apresentações com include_speeches=true (sem pagar os +50 créditos) e com quantos slides quiser, depois chama regenerate-speeches até 5 vezes em cada uma. Cada apresentação nova também zera a cota do chat-editor, cujo limite real é o rate limit de 40/h. Condições: Exige conta autenticada com direito de uso (can_user_generate com custo 0).

## Evidência

- `src/lib/legacyPersist.ts:86-90` — insert com `include_speeches: form.includeSpeeches`.
- `supabase/migrations/20260927000100_platform_review_fixes.sql:233-251` — o trigger protege só os contadores.
- `supabase/functions/regenerate-speeches/index.ts:16,67,88` — 5 regenerações por apresentação, confia no flag, escopo `all` sem teto.
- `supabase/functions/chat-editor/index.ts:198-211` — cota por apresentação.

## Impacto

Custo de IA sem cobrança e contorno do preço das falas.

## Sugestão de correção

- Travar `include_speeches`, `is_paid` e `presenters_*` por trigger (só service role grava).
- Contar as cotas de edição e de regeneração por usuário e período.
- Limitar o número de slides enviados ao modelo em `regenerate-speeches`.

## Critérios de aceite

- [ ] O cliente não consegue mudar `include_speeches` (erro 42501).
- [ ] Criar apresentações novas não renova a cota de IA.
- [ ] `regenerate-speeches` recusa decks acima do limite de slides.

_Achados do relatório de auditoria de 09/10/2026: A5._
--- FIM ISSUE 4 ---

--- ISSUE 5 ---
Título: [Segurança] Usuário forja mensagens da equipe e altera o estado dos próprios chamados
Labels: security, severidade:baixa

## Descrição do problema

`msg_own_insert` não restringe `role` nem `metadata`: o dono do chamado insere mensagens `role=assistant` com `metadata.source=human_agent`, o mesmo formato da resposta humana. `conv_own_update` permite alterar `state`, `escalated_at`, `resolved_by_human`, `reopen_count` e `rating`.

## Por que é explorável

**A6** — Via PostgREST, o dono do chamado insere role="assistant" e metadata.source="human_agent" (por exemplo, "reembolso aprovado"). A mensagem aparece como resposta da equipe e entra no contexto do modelo. Condições: Afeta só o próprio chamado.

**A7** — O usuário grava state='escalated', escalated_at, resolved_by_human, reopen_count ou rating direto pela API. Condições: Afeta só as conversas do próprio usuário.

## Evidência

- `supabase/migrations/20260716013934_90aa6f03-b7f6-4313-b724-57a99fea27f7.sql:135-137` (msg_own_insert) e `:109-110` (conv_own_update).
- `src/pages/AdminSupport.tsx:154-158` — formato da resposta humana.
- `supabase/functions/support-chat/index.ts:243-245` — mensagens assistant do histórico vão ao modelo.

## Impacto

Engenharia social contra o suporte, indução do assistente e fura-fila ou métricas falsas.

## Sugestão de correção

- Exigir `role = 'user'` e `metadata` vazia no INSERT do dono (WITH CHECK).
- Remover o UPDATE do dono em `support_conversations` (as transições passam pela edge function) ou travar as colunas de staff por trigger.

## Critérios de aceite

- [ ] INSERT do dono com `role = 'assistant'` falha.
- [ ] UPDATE do dono em `state` falha; o fluxo do support-chat continua funcionando.

_Achados do relatório de auditoria de 09/10/2026: A6, A7._
--- FIM ISSUE 5 ---

--- ISSUE 6 ---
Título: [Segurança] Avatares: sem limite de tipo/tamanho no bucket e URL externa livre
Labels: security, severidade:baixa

## Descrição do problema

O bucket `avatars` não define `file_size_limit` nem `allowed_mime_types`. A validação existe só no navegador (`avatarUpload.ts`). `profiles.avatar_url` aceita qualquer URL externa, que é carregada por quem visita o portfólio.

## Por que é explorável

**A8** — Chamando a API do Storage direto, o usuário sobe arquivos de qualquer tipo e tamanho (HTML, SVG, binários grandes) na própria pasta. Eles ficam acessíveis por URL assinada de 10 anos e podem ser lidos por anônimos. Condições: Basta uma conta autenticada.

**A15** — Não executa script (img não roda javascript:), mas permite rastrear o IP e o navegador de quem visita o portfólio. Condições: Basta uma conta.

## Evidência

- `storage.buckets`: avatars com `file_size_limit = NULL` e `allowed_mime_types = NULL`.
- `src/lib/avatarUpload.ts:3-4,14-15,22` — validação só no cliente; `contentType: file.type`.
- `src/pages/PublicProfile.tsx:170` — `<AvatarImage src={profile.avatar_url} />`.

## Impacto

Hospedagem de conteúdo arbitrário no storage do projeto e rastreamento de visitantes.

## Sugestão de correção

- Configurar `file_size_limit = 4 MB` e `allowed_mime_types = png, jpeg, webp, gif` no bucket.
- Aceitar em `avatar_url` só URLs do próprio Storage (CHECK ou trigger).

## Critérios de aceite

- [ ] Upload de 10 MB ou de `text/html` pela API é recusado.
- [ ] Gravar `avatar_url` externa falha.

_Achados do relatório de auditoria de 09/10/2026: A8, A15._
--- FIM ISSUE 6 ---

--- ISSUE 7 ---
Título: [Segurança] Superfícies anônimas: enumeração de papéis/acessos e visualizações infláveis
Labels: security, severidade:baixa

## Descrição do problema

`has_role(uuid, app_role)` e `can_view_portfolio(_owner, _viewer)` podem ser executadas por anônimos com IDs arbitrários (revelam contas admin e acessos aprovados), e `get_profile_for_viewer` devolve o `id` de qualquer username. `views_published_insert` permite inserir visualizações em massa, inflando `view_count`.

## Por que é explorável

**A9** — Com IDs obtidos em presentations.user_id (público) ou em get_profile_for_viewer, um anônimo descobre quais contas são admin ou developer (has_role) e quem tem acesso aprovado a um portfólio privado (can_view_portfolio com _viewer arbitrário). Condições: Basta a chave anon.

**A14** — Um script com a chave anon insere linhas em massa, e o trigger bump_presentation_view_count infla view_count. Condições: Basta a chave anon.

## Evidência

- `supabase/migrations/20260806000729_867c7dc3-03da-4aea-aa55-d62f0694eb74.sql:38` — GRANT de has_role a anon.
- `supabase/migrations/20260814235606_fe2269e2-9079-4ffe-8ae8-2adfe259f9fa.sql:41,61-65,120-121`.
- `supabase/migrations/20260806000646_a3684224-f5cb-4467-ab32-3685b698016a.sql:23` — views_published_insert.

## Impacto

Enumeração de alvos privilegiados, vazamento de relações e métricas falsas.

## Sugestão de correção

- Revogar EXECUTE de anon e authenticated em `has_role` e `can_view_portfolio` (as políticas continuam funcionando como definer).
- Fazer `can_view_portfolio` usar só `auth.uid()`; `get_profile_for_viewer` sem `id` quando não houver acesso.
- Registrar visualizações por RPC com deduplicação.

## Critérios de aceite

- [ ] `rpc('has_role', …)` com a chave anon retorna erro de permissão.
- [ ] Inserir 100 visualizações seguidas da mesma origem conta uma.

_Achados do relatório de auditoria de 09/10/2026: A9, A14._
--- FIM ISSUE 7 ---

--- ISSUE 8 ---
Título: [Segurança] HTML montado sem escape no roteiro de falas e no JSON-LD do og-preview
Labels: security, severidade:baixa

## Descrição do problema

`PresenterNotesPanel.printScript` interpola título, headlines, nomes e falas direto em HTML escrito com `document.write` numa janela do mesmo domínio. O `og-preview` insere `JSON.stringify(...)` dentro de `<script>` sem neutralizar `</script>`.

## Por que é explorável

**A10** — Uma fala ou título com <img src=x onerror=…> executa script na origem slideai.com.br quando o usuário clica em imprimir o roteiro. Condições: O painel só aparece no Editor do dono, então hoje é self-XSS. Passa a afetar outros usuários se o conteúdo vier de terceiros (duplicar ou importar apresentações, templates) ou de uma IA manipulada.

**A11** — Um título publicado com </script><script>…</script> fecha o bloco e injeta script na página. Condições: A função hoje não está publicada (404 na verificação de 04/10) e o site não a referencia. Vira explorável se for publicada e servida como HTML.

## Evidência

- `src/components/PresenterNotesPanel.tsx:86-114`.
- `supabase/functions/og-preview/index.ts:63-70`.

## Impacto

Execução de script na origem do app (hoje self-XSS) e XSS armazenado no preview, caso a função seja publicada.

## Sugestão de correção

- Escapar todos os campos com `escapeHtml` (ou usar `textContent`) no roteiro.
- No JSON-LD, `JSON.stringify(obj).replace(/</g, "\\u003c")`.

## Critérios de aceite

- [ ] Fala contendo `<img src=x onerror=alert(1)>` aparece como texto no roteiro impresso.
- [ ] Título com `</script>` não quebra o HTML do og-preview (teste unitário).

_Achados do relatório de auditoria de 09/10/2026: A10, A11._
--- FIM ISSUE 8 ---

--- ISSUE 9 ---
Título: [Segurança] Higiene: .env versionado e papel admin concedido por migração
Labels: security, severidade:informativa

## Descrição do problema

O `.env` com a chave anon (pública por design) está versionado e fora do `.gitignore`. Uma migração concede `admin` e `developer` a um UUID fixo, expondo o ID da conta administradora num repositório público.

## Por que é explorável

**A12** — Não é um segredo, porque a segurança vem da RLS. O risco é alguém acrescentar uma chave real (service role, OpenAI) a esse arquivo já rastreado.

**A13** — Expõe o ID da conta administradora, facilitando ataques direcionados junto com A9. Todo ambiente criado a partir do repositório herda esse admin.

## Evidência

- `.env:1-3` e `.env.example:1-6`.
- `supabase/migrations/20260517133059_9502e9f2-1012-4cec-8021-84c751280b72.sql:38-41`.

## Impacto

Risco de uma chave real ir parar num arquivo já rastreado e alvo administrativo conhecido.

## Sugestão de correção

- Adicionar `.env` ao `.gitignore` (git rm --cached .env) e manter `.env.example`.
- Documentar a concessão de papéis como procedimento manual, fora das migrações.

## Critérios de aceite

- [ ] `git ls-files .env` vazio.
- [ ] Nenhuma migração nova concede papel a UUID fixo.

_Achados do relatório de auditoria de 09/10/2026: A12, A13._
--- FIM ISSUE 9 ---
