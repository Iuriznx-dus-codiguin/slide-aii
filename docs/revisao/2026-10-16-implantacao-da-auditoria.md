# Implantação da auditoria de segurança (PR #8)

Como levar para produção o que está na branch `claude/blissful-hamilton-v61rom` ([PR #8](https://github.com/Iuriznx-dus-codiguin/slide-aii/pull/8)): o estado da branch, o que só você faz no painel, o prompt para o Lovable e o que conferir depois. Os achados e as correções estão no [relatório da auditoria](2026-10-11-auditoria-de-seguranca.md).

---

## 1. Estado da branch e como ela chegou aqui

### Linha do tempo

| Data | Commit | O que entrou | Como foi validado |
| --- | --- | --- | --- |
| 11–12/10 | `0ce3aeb` | Auditoria: migração `0010_security_hardening`, Edge Functions, front, testes e relatório (C1, A1–A3, M1–M7, B1–B6) | Exploits reproduzidos no banco local antes e bloqueados depois; regressão dos fluxos legítimos; vitest; tsc; `deno check` das funções alteradas |
| 13–14/10 | `1a6177d` | Revisão adversarial do próprio diff: 27 achados (V1–V27), 24 corrigidos, 2 aceitos, 1 informativo | Os mesmos testes, ampliados (exploits 11–16, regressão 11, testes do webhook, dos prompts, do redirecionamento, do e-mail e da telemetria); build; lint sem erro novo |
| 14/10 | `7cb8dd5` | Merge da `main` (PR #9, seletor de motor) | Conflito em `Editor.tsx` resolvido mantendo as duas mudanças; 448 testes; tsc; `deno check` |
| 16/10 | `7b0ab7c`, `67e4d20` | Merge da `main` (login com Google, GA4, página de sucesso) e correção do destino guardado do login com Google | 448 testes; tsc; testes do banco |
| 16/10 | `87bfc33` | CI no GitHub, teste contra a volta da regex antiga em `Auth.tsx`, mensagem clara quando o portfólio não aceita pedidos, este documento | Os mesmos comandos que o CI roda |
| 16/10 | este commit | Revisão independente das correções da rodada 2 (V28–V39): 12 problemas corrigidos, entre eles troca de plano paga por Pix ignorada, reativação depois do reembolso, novo desvio do redirecionamento (`/.//`), token de descadastro enviado ao Google e prompt do chat sem teto | Cada problema reproduzido antes da correção; banco (exploits, regressão e o novo teste de atualização de banco com dados antigos), 459 testes, tsc, lint sem erro novo, CI |

### Interrupções e o que foi feito para que não deixassem rastro

A branch foi interrompida várias vezes por limite de uso (créditos), troca de contêiner e compactação de contexto. Para nenhuma interrupção deixar trabalho pela metade em produção ou no GitHub:

- **Nada foi publicado pela metade.** O trabalho em andamento ficou numa cópia isolada (worktree), com backup em patch, e só foi para a branch depois de passar inteiro: banco local, vitest, tsc, build e lint.
- **Um deslize, corrigido e registrado:** o merge `7b0ab7c` foi publicado sem a mudança de `Auth.tsx` que a mensagem dele descreve. Um comando anterior falhou e o arquivo não foi incluído. A mudança entrou logo em seguida em `67e4d20`, com a explicação na mensagem. O histórico não foi reescrito.
- **Conflitos com a `main` resolvidos pelo significado, não só pelo texto.** No segundo merge não houve conflito de texto, mas o código novo da `main` (login com Google) reintroduzia a validação que permitia o redirecionamento aberto (V19). Isso foi corrigido no merge, e um teste agora impede a volta da regex antiga.

### O que ainda não foi verificado, e por quê

- **Revisão independente das correções da rodada 2.** As duas primeiras tentativas pararam no limite de uso. Na terceira, 4 dos 5 revisores concluíram: pagamentos, banco, Edge Functions e front-end. Juntos, acharam os 12 problemas V28–V39, todos reproduzidos e corrigidos (relatório, seção 6, rodada 3). O quinto revisor (afirmações do relatório e da implantação) e a verificação cruzada de cada achado também pararam no limite. A repetição está registrada na descrição do PR.
- **Testes e2e contra a produção:** não rodam neste ambiente (sem rede para o projeto). A etapa 6 do prompt roda os testes anônimos lá.
- **Estado real do banco de produção** (políticas criadas pelo painel, buckets, configuração do Auth): só a verificação da etapa 5 mostra.
- **`deno check`** só nas funções alteradas. `chat-editor` e `support-chat` já tinham três erros de tipo, que continuam lá.

### Princípios mantidos em todas as rodadas

- **Preços e política de créditos intocados.** Mudou a contabilidade errada (estornos e concessões duplicadas), não o que o cliente paga nem o que recebe.
- **Todo fluxo legítimo tocado tem teste.** Gerar, editar, publicar, compartilhar, regenerar falas, chat, compra, renovação, cancelamento, reembolso, suporte e portfólio.
- **Compatível nas duas direções durante o deploy.** O código novo funciona com o banco antigo, e a migração é idempotente.
- **Cada mudança documentada.** Relatório, runbook e regras de créditos.

---

## 2. Antes de colar o prompt (você, no painel)

1. **Secret `RATE_LIMIT_PEPPER`** (Lovable → Cloud → Secrets): um valor aleatório longo, por exemplo o resultado de `openssl rand -hex 32`. É a chave que pseudonimiza IPs nos limites de uso e na telemetria. Sem ele, as funções usam a chave `service_role` (funciona, mas não é o ideal).
2. **Configurações do Auth** (Lovable → Cloud → Auth, ou Supabase → Authentication). Detalhes em R3 do relatório:
   - proteção contra senhas vazadas e mínimo de 8 caracteres;
   - "Secure password change" (trocar senha exige reautenticação), se disponível;
   - lista de URLs de redirecionamento só com os domínios do produto;
   - MFA para contas admin/developer;
   - registro dinâmico de clientes OAuth (MCP) fechado, se não for usado.
3. **Segredos que o código já usa:** confira que existem `CAKTO_WEBHOOK_SECRET`, `OPENROUTER_API_KEY` (a `main` trocou o provedor de texto), a chave da Resend e a da Pexels. Nada muda neles.
4. **Duas decisões suas**, que não dependem do deploy (R1 e R2 do relatório):
   - o que fazer com os decks que nasceram públicos por engano;
   - registrar a avaliação de incidente (LGPD, art. 48).

---

## 3. Prompt para o Lovable (depois do merge do PR #8 na `main`)

Cole o bloco inteiro:

```text
Contexto: a main recebeu o PR #8, "Auditoria de segurança". O código está
pronto, revisado e testado (banco local, vitest, tsc, build). NÃO reescreva,
refatore nem "melhore" nenhum arquivo de código ou SQL. A tarefa é aplicar o
que não entra por commit, NA ORDEM ABAIXO, validar e me reportar. Se qualquer
etapa falhar ou der resultado diferente do esperado, PARE e me mostre o erro
exato. Não tente contornar.

ORDEM OBRIGATÓRIA: funções e site primeiro, migração depois. O código novo
funciona com o banco antigo; o site antigo NÃO funciona com o banco novo (o
link público de apresentações deixaria de abrir para visitantes). Se você já
tiver aplicado a migração 0010 automaticamente ao sincronizar, faça as etapas 2
e 3 imediatamente e me avise que a ordem foi invertida.

ETAPA 1 — Conferir a sincronização
Confirme que existem na main:
  - drizzle/migrations/0010_security_hardening.sql
  - supabase/migrations/20261011000100_security_hardening.sql (cópia idêntica)
  - src/lib/safeRedirect.ts e src/lib/sharedPresentation.ts
  - supabase/functions/_shared/clientIp.ts e supabase/functions/_shared/promptText.ts
Me diga se a migração 0010 JÁ foi aplicada no banco (sim/não), antes de qualquer
outra coisa.

ETAPA 2 — Deploy das Edge Functions
Faça o deploy destas 10 funções. Elas mudaram ou usam módulos de
supabase/functions/_shared que mudaram, e esses módulos vão junto no bundle:
  cakto-webhook, chat-editor, email-dispatcher, fetch-image,
  generate-presentation, mcp, og-preview, regenerate-speeches, send-email,
  support-chat
Não altere verify_jwt nem o supabase/config.toml. Me mostre a lista das
funções publicadas com a data do deploy.

ETAPA 3 — Publicar o site
Publique o front-end atual da main. Confirme a URL publicada.

ETAPA 4 — Migração
Aplique drizzle/migrations/0010_security_hardening.sql exatamente como está no
arquivo (é idempotente; pode rodar de novo sem efeito colateral). Não edite o
SQL. Se der erro, me mostre a mensagem completa e a linha.

ETAPA 5 — Verificação do banco (rode e me mostre cada resultado)
5.1 Leitura pública removida (esperado: 0 linhas)
  select policyname from pg_policies
   where schemaname = 'public'
     and policyname in ('presentations_public_read','slides_public_read','profiles_insert_own',
                        'conv_own_insert','views_anyone_insert','views_published_insert');
5.2 Funções novas (esperado: 16 linhas)
  select proname from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname in ('accepts_access_requests','get_content_metrics','get_shared_presentation',
       'grant_monthly_for_order','grant_order_bonus_credits','order_granted_bonus',
       'protect_access_request_fields','protect_presentation_server_fields',
       'protect_support_conversation_fields','rate_limit_subject','record_presentation_view',
       'release_ai_edit_usage','release_speech_regen','reserve_ai_edit_usage',
       'reserve_speech_regen','sync_profile_email')
   order by 1;
5.3 Bônus de ativação e estorno com um único formato cada (esperado: 2 linhas,
    grant_bonus_credits_once | "_uid uuid, _amount integer, _type text, _metadata jsonb" e
    revoke_order_credits | "_uid uuid, _order_id text, _revoke_bonus integer, _zero_monthly boolean, _type text, _subscription_id text")
  select proname, pg_get_function_identity_arguments(oid) from pg_proc
   where proname in ('grant_bonus_credits_once','revoke_order_credits')
     and pronamespace = 'public'::regnamespace
   order by 1;
5.4 Permissões (esperado na ordem: false, true, false, false, true, true, false, false)
  select
    has_function_privilege('anon', 'public.has_role(uuid, public.app_role)', 'EXECUTE'),
    has_function_privilege('authenticated', 'public.has_role(uuid, public.app_role)', 'EXECUTE'),
    has_function_privilege('authenticated', 'public.grant_order_bonus_credits(uuid,text,integer,text)', 'EXECUTE'),
    has_function_privilege('authenticated', 'public.grant_monthly_for_order(uuid,text,text,integer,text)', 'EXECUTE'),
    has_function_privilege('anon', 'public.get_shared_presentation(text)', 'EXECUTE'),
    has_function_privilege('anon', 'public.record_presentation_view(uuid)', 'EXECUTE'),
    has_table_privilege('authenticated', 'public.support_conversations', 'INSERT'),
    has_table_privilege('authenticated', 'public.profiles', 'INSERT');
5.5 Gatilhos (esperado: 5 linhas)
  select tgname from pg_trigger
   where not tgisinternal
     and tgname in ('on_auth_user_email_changed','trg_protect_access_request_fields',
       'trg_protect_billing_columns','trg_protect_presentation_server_fields',
       'trg_protect_support_conversation_fields')
   order by 1;
5.6 Restrições novas (esperado: 3 linhas, convalidated = true: a migração corrige
    as linhas antigas que passavam dos limites e valida as restrições)
  select conname, convalidated from pg_constraint
   where conname in ('presentations_ai_usage_nonnegative','presentations_prompt_field_sizes',
                     'profile_access_requests_message_len');
5.7 Segredo da pseudonimização de IP no Vault (esperado: 1)
  select count(*) from vault.secrets where name = 'rate_limit_pepper';
5.8 Decks novos nascem privados (esperado: false)
  select column_default from information_schema.columns
   where table_schema = 'public' and table_name = 'presentations' and column_name = 'is_published';
5.9 Limites dos buckets (esperado: avatars 4194304, slide-images 12582912)
  select id, file_size_limit, allowed_mime_types from storage.buckets
   where id in ('avatars','slide-images');
5.10 Gerações presas de antes da correção (o gatilho antigo barrava o estorno)
  select count(*), min(created_at) from public.generation_attempts
   where status = 'running' and created_at < now() - interval '10 minutes';
  select public.refund_stale_generations();
  -- me mostre as duas saídas; a segunda devolve quantas foram estornadas
  -- (refunded), quantas coincidem com um estorno manual e foram para conferência
  -- (possible_duplicates, alerta generation_refund_possible_duplicate) e falhas
  -- (refund_failed).
5.11 Números de chamado de suporte (esperado: proximo_numero maior que maior_ocupado)
  select (select last_value from public.support_ticket_seq) as proximo_numero,
         (select max(substring(ticket_id from 5)::bigint) from public.support_conversations
           where ticket_id ~ '^TCK-[0-9]{1,18}$') as maior_ocupado;

ETAPA 6 — Build e testes
  1. npm run build → sem erro.
  2. npx vitest run → todas as suítes passam. Agora, com a migração aplicada,
     os testes anônimos de src/test/public-portfolio.e2e.test.ts e
     src/test/support-history.e2e.test.ts também precisam passar: eles
     conferem, no banco real, que um visitante não lista apresentações nem
     conversas de suporte. Os testes autenticados só rodam se existirem
     E2E_USER_A_EMAIL/E2E_USER_A_PASSWORD; não crie essas variáveis.
  Me mostre o resumo (arquivos e testes aprovados/reprovados).

ETAPA 7 — Relatório
Me devolva: (a) se a migração já estava aplicada na etapa 1; (b) as funções
publicadas; (c) a saída de cada consulta da etapa 5, marcando o que divergiu
do esperado; (d) o resumo dos testes. Não mude nada além do que foi pedido.
```

---

## 4. Depois do deploy (você)

1. **Confira com uma janela anônima:**
   - um deck publicado abre pelo link;
   - um deck privado não abre;
   - exportar PDF como visitante funciona.
2. **Faça o percurso completo com uma conta comum:**
   - gere uma apresentação: ela aparece como **Privada** no painel;
   - publique-a, regenere as falas e use o chat de edição.
3. **Confira o redirecionamento:** logado, abra `https://slideai.com.br/auth?next=/%5Cexample.com` e `https://slideai.com.br/auth?next=/.//example.com`. Nos dois você deve cair no painel, não em outro site. Faça o mesmo login com Google a partir de `/auth?next=/perfil`: a volta deve ser em `/perfil`.
4. **Pagamento:** faça uma compra avulsa real com uma conta de teste e o reembolso dela. Confira em `credit_transactions`:
   - a concessão traz o `order_id`;
   - o estorno retira só os 500 daquele pedido.
5. **Leitura anônima da API:** `curl "https://<projeto>.supabase.co/rest/v1/presentations?select=id" -H "apikey: <chave anon>"` precisa devolver `[]`.
6. **IPs antigos na telemetria** (R13): `update security_events set ip_hash = null where created_at < '<data do deploy>';`.
7. **CSP × GA4:** a `main` passou a carregar o Google Analytics/Ads (`googletagmanager.com`), mas a CSP de `public/_headers` não libera esse domínio. Rode `curl -sI https://slideai.com.br | grep -i content-security-policy`:
   - **Sem saída:** o host não aplica o `_headers`, e o GA4 funciona como está.
   - **Com saída:** o navegador está bloqueando o GA4 e o Ads. Peça ao Lovable para incluir:
     - `https://www.googletagmanager.com` em `script-src`;
     - `https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.doubleclick.net` em `connect-src`.

     Depois, confira os eventos no painel do GA4.
8. **Acompanhe os alertas** nas primeiras semanas. Os tipos novos são:
   - `refund_after_consumption`;
   - `payment_other_subscription`;
   - `payment_after_refund`;
   - `webhook_invalid_secret_partial`;
   - `generation_refund_possible_duplicate`.

   O que fazer em cada um está no [runbook](../operacao/runbooks.md#alertas).

---

## 5. O que muda para os usuários

- **Apresentações nascem privadas,** como os Termos já prometiam. O dono publica para compartilhar, e o painel avisa quando o link ainda é privado. As antigas continuam como estão até a sua decisão em R1.
- **Ninguém lista as apresentações de outra pessoa pela API.** Quem tem o link de um deck publicado continua abrindo normalmente.
- **Senha nova com no mínimo 8 caracteres,** na troca e na redefinição.
- **Chat de edição:**
  - continua com 10 mensagens ou 3 edições complexas por apresentação gerada;
  - ganhou um limite de 40 por hora e 150 por dia por conta.
- **Imagem de IA avulsa no editor** (fora da cota da apresentação) exige créditos no plano avulso. Assinantes não mudam.
- **Pedidos de acesso ao portfólio:**
  - só chegam a quem aceita pedidos;
  - o e-mail tem assunto fixo e limite de 10 por hora por conta.
- **Pagamentos:**
  - trocar o e-mail da conta não desliga mais a assinatura dos eventos da Cakto;
  - cancelar a assinatura antiga depois de assinar outra não cancela a nova;
  - o reembolso tira só o que aquela compra deu;
  - estornos de geração interrompida voltam a acontecer sozinhos.

---

## 6. Se algo der errado

- **Não reverta a migração inteira.** Ela fecha brechas reais, e as funções e o site novos dependem dela para várias proteções. Mande o erro exato (consulta, função, horário) para análise.
- **Funções:** voltar uma Edge Function para a versão anterior é seguro com o banco migrado. Todas as versões antigas continuam funcionando, com as proteções do banco valendo.
- **Site:** não volte o front para uma versão anterior ao PR #8 com a migração aplicada. O visualizador antigo lê as tabelas direto e deixa de abrir decks publicados para visitantes.
- **Chat recusado num deck legítimo** ("O chat de edição vale para apresentações geradas pelo SlideAI"): só decks criados pelo cliente depois da migração ficam com `is_paid = false`. Confira com `select id, is_paid, created_at from presentations where slug = '<slug>';` e mande o resultado.
