# Deploy dos avisos por e-mail (PR #7) — prompt para a Lovable

Cole o texto abaixo no chat da Lovable, de uma vez. As migrações 0006 e 0007 já estão no banco; este deploy aplica a 0008 e a 0009 e publica as funções e o site.

**Antes de colar:** crie na Cakto os cupons `COMECE10` (10%) e `VOLTA20` (20%).

---

```
Deploy do PR #7 (avisos por e-mail de ciclo de vida), que já está no main. Faça SOMENTE o que está abaixo, na ordem.

REGRAS
- NÃO edite nenhum arquivo do projeto (código, conteúdo, migrações, config) e NÃO crie, altere ou apague secrets.
- NÃO gere apresentações, NÃO chame IA de geração e NÃO envie e-mails de teste para outras pessoas.
- Se algum passo falhar, pare e me mostre o erro exato. Não tente "consertar" reescrevendo SQL ou código.

1) CÓDIGO
Confirme que o projeto está no commit do merge do PR #7 (ou posterior) e que existem:
- drizzle/migrations/0008_lifecycle_emails.sql
- drizzle/migrations/0009_help_center_emails.sql
- supabase/functions/email-dispatcher/index.ts
- supabase/functions/email-unsubscribe/index.ts

2) BANCO — aplique com o conteúdo EXATO dos arquivos, nesta ordem:
a) drizzle/migrations/0008_lifecycle_emails.sql
b) drizzle/migrations/0009_help_center_emails.sql
As duas são idempotentes. A 0009 é grande: se não couber numa chamada, divida entre comandos completos (cada INSERT ... ; inteiro), sem alterar nenhum texto, e aplique todas as partes.
Avisos (NOTICE) sobre pg_cron, pg_net ou Vault indisponíveis não são erro, mas me informe se aparecerem.

3) FUNÇÕES — faça o deploy destas edge functions:
- email-dispatcher (nova)
- email-unsubscribe (nova)
- cakto-webhook
- send-email
- generate-presentation
- support-chat
As duas novas precisam ficar com verify_jwt = false, como está em supabase/config.toml.

4) SITE — publique a versão atual do front-end (Publish / Update).

5) VERIFICAÇÃO — rode e me mostre o resultado de cada consulta:
- select to_regclass('public.billing_profiles'), to_regclass('public.pending_charges'), to_regclass('public.email_preferences'), to_regclass('public.email_schedule');
- select jobname, schedule, active from cron.job order by jobname;
  (devem aparecer slideai-email-dispatch a cada 10 min e slideai-stale-generations a cada 5 min)
- select count(*) as segredo_existe from vault.secrets where name = 'email_dispatch_secret';
  (NÃO mostre o valor do segredo)
- select public.plan_lifecycle_emails();
- select slug, updated_at from help_articles where slug in ('emails-e-preferencias', 'creditos-devolvidos');
- Espere 10 minutos e rode:
  select status_code, left(content::text, 200) as resposta, created from net._http_response order by created desc limit 3;
  (o esperado é status 200 com "ok": true; 401 indica problema no segredo e 404 indica que a função não foi publicada)
- select template, status, reason, send_at from email_schedule order by created_at desc limit 10;

Ao final, me responda com uma linha por passo (OK ou erro) e os resultados da verificação.
```

---

## Depois do deploy

- **Teste pessoal (opcional):** crie uma conta nova com um e-mail seu. Ao confirmar o e-mail e entrar, chega a mensagem de boas-vindas com a escolha de plano.
- **Termos e Política:** a versão mudou para 2026-10-04, então quem já tem conta verá o pedido de novo aceite no próximo acesso.
- **Se nada sair:** [runbooks.md → Avisos por e-mail não saem](runbooks.md#avisos-por-e-mail-não-saem).
