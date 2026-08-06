# Auditoria completa: fluxo de geração + blindagem de segurança

Auditoria feita lendo o banco real (políticas RLS, grants, buckets, triggers) e todas as edge functions. Abaixo o que está correto, o que está quebrado e o plano de correção em camadas — sem alterar comportamento visível para o usuário legítimo.

## O que já está sólido (não mexer)

- Todas as 15 tabelas com RLS ativa e políticas por dono/role; `has_role` é SECURITY DEFINER em tabela separada (sem escalada de privilégio).
- `generate-presentation` e `chat-editor` exigem token válido e chamam `can_user_generate` no servidor — o Modo Dev do frontend (localStorage) não consegue burlar cobrança.
- `fetch-image`: estratégia "ai" exige login + 15/h; pexels/video com 60/h por IP.
- Webhook Cakto fail-closed sem `CAKTO_WEBHOOK_SECRET` e idempotente por `cakto_id`.
- Nenhum caminho de SSRF ativo: não há mais fetch de URL fornecida pelo usuário (identidade de marca foi removida).
- Bucket `slide-images` é privado, upload só via service role.

## Falhas e inconsistências encontradas

### Segurança

1. **Vazamento de `password_hash` (alto).** `presentations_public_read` permite ao anônimo ler **todas as colunas** de apresentações publicadas, incluindo `password_hash` e `is_password_protected`. A funcionalidade de senha nem é usada na interface — é uma coluna morta exposta.
2. **Grants amplos demais (defesa em profundidade).** `anon` e `authenticated` têm INSERT/UPDATE/DELETE em **todas** as tabelas, incluindo `user_roles`, `payment_events`, `generation_logs` e `edge_rate_limits`. Hoje só a RLS segura isso; qualquer política futura mal escrita vira falha crítica imediata.
3. **`slide_views` aberta a qualquer um (`WITH CHECK true`).** Um script anônimo pode inflar métricas de visualização de qualquer apresentação, inclusive não publicada, e inflar a tabela sem limite.
4. **`error_occurrences` aceita insert anônimo com `user_id NULL`** sem limite — canal de inserção de lixo/poluição de logs de suporte.
5. **Segredo do webhook aceito via query string** (`?token=`/`?secret=`) e comparado sem tempo constante. Query strings aparecem em logs de proxy.
6. **Prompt injection.** `title`/`description` do usuário e o histórico do chat entram nos prompts sem delimitação nem limite de tamanho em `generate-presentation`, `chat-editor` e `support-chat`. O risco é baixo (a saída é forçada por schema de tool call), mas o modelo pode ser induzido a ignorar limites de custo/idioma e a gastar tokens.
7. **Sem limite por hora na geração completa.** `generate-presentation` valida plano, mas não tem `check_rate_limit` — um assinante MAX pode disparar gerações em rajada e queimar orçamento de IA.
8. **Bucket sem teto.** `slide-images` não tem `file_size_limit` nem `allowed_mime_types`; URLs assinadas de 10 anos são eternamente compartilháveis.

### Fluxo de geração / lógica de negócio

9. **`view_count` nunca é incrementado.** O visualizador insere em `slide_views`, mas nada atualiza `presentations.view_count` — o Dashboard mostra sempre 0.
10. **`profiles.is_public` + `username` (portfólio público) não funcionam:** não existe política que permita leitura pública de perfis, então a página de portfólio nunca carrega para visitantes.
11. **`increment_own_generations_count` é chamado pelo cliente** depois da geração; é um contador autodeclarado, divergente de `generation_logs` (a fonte real). Métricas do painel dev ficam inconsistentes.
12. **`can_user_generate` retorna `system_error` para o teto oculto do MAX** — correto por decisão de produto, mas hoje devolve 503 e o suporte cataloga como falha real. Precisa ficar distinguível internamente (log/metadata) sem revelar ao usuário.
13. **Contagem mensal usa `date_trunc('month')` no servidor** enquanto o frontend calcula o mês em horário local — divergência de fuso pode mostrar quota diferente da aplicada.
14. **`consume_single_credit` roda após a geração**, sem transação com o registro do log: uma falha entre os dois passos entrega slide sem debitar crédito.

## Plano de correção

### Camada 1 — Banco (uma migration)
- Revogar de `anon`/`authenticated` os privilégios de escrita em `user_roles`, `payment_events`, `generation_logs`, `error_catalog_history` e `edge_rate_limits`; manter exatamente os grants que as telas usam hoje.
- Substituir `presentations_public_read` por uma **view pública** (ou coluna revogada) que não exponha `password_hash`; o visualizador passa a ler apenas as colunas necessárias.
- `slide_views`: restringir o INSERT a apresentações publicadas e não excluídas; adicionar trigger que incrementa `presentations.view_count` (corrige o item 9).
- Adicionar política de leitura pública em `profiles` limitada a `is_public = true` e apenas colunas de portfólio (corrige o item 10) — via view segura, sem expor e-mail/campos de billing.
- Fixar `search_path` e revisar `SECURITY DEFINER` de todas as funções (já verificado; ajustes pontuais se houver).

### Camada 2 — Edge functions
- `cakto-webhook`: parar de aceitar segredo por query string, usar comparação em tempo constante, e limitar tamanho do corpo.
- `generate-presentation`: adicionar `check_rate_limit` (ex.: 12/h por usuário, dev isento), sanitizar/limitar `title` e `description`, envolvê-los em delimitadores explícitos com instrução anti-injeção, e registrar `reason` real do bloqueio em `generation_logs.metadata` mesmo quando a mensagem exibida for genérica.
- `chat-editor` e `support-chat`: mesma blindagem de prompt (delimitação, limite de caracteres e de histórico).
- `fetch-image`: validar `avoid_urls` (tamanho/quantidade) e limitar tamanho de `ai_prompt`.
- Alinhar o débito do crédito `single` com o registro de sucesso, para não entregar geração sem debitar.

### Camada 3 — Storage
- Aplicar `file_size_limit` e `allowed_mime_types` (imagens) ao bucket `slide-images` e adicionar políticas explícitas em `storage.objects` negando escrita a `anon`/`authenticated` (hoje é implícito).

### Camada 4 — Frontend (sem mudança visual)
- Remover a chamada cliente de `increment_own_generations_count` e passar a derivar o contador de `generation_logs` (fonte única).
- Alinhar o cálculo de mês do `useEntitlement` ao UTC usado pelo servidor.

### Verificação
- Reexecutar o linter de segurança do banco e o scanner do projeto.
- Testar logado: gerar apresentação (dentro e fora da quota), abrir link público, contar visualização subindo, editar por chat, e reexecutar a suíte de testes do webhook.

## Escopo explícito
Nenhuma funcionalidade é removida; tudo é endurecimento + correção de bugs já existentes. Cada mudança de banco vai numa migration revisável por você antes de rodar.
