# Runbooks de operação

Consultas SQL rodam no SQL editor da Lovable Cloud. Nunca altere colunas de cobrança à mão sem registrar a movimentação em `credit_transactions`: use as funções.

**Operações que mexem em créditos ou no plano** são barradas pelo gatilho `protect_billing_columns`, a menos que rodem como servidor. No SQL editor, envolva-as assim:

```sql
begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
-- comando aqui
commit;
```

## Pagamento aprovado, mas não liberado

1. Ache o evento:
   ```sql
   select created_at, event_type, processed, error_message, user_email, cakto_id
   from payment_events order by created_at desc limit 20;
   ```
2. `user not found by email`: a compra foi feita com outro e-mail. Confirme com o cliente e aplique manualmente (passo 3).
3. Nenhum evento: veja `security_events` (`webhook_invalid_secret`) e confira o segredo ([abaixo](#segredo-do-webhook)). Para liberar manualmente um avulso: `select grant_bonus_credits('<USER_ID>', 500, 'single_purchase');`. Para assinatura, peça à Cakto o reenvio do webhook (preferível), para o fluxo completo rodar.

## Reembolso em revisão manual

Eventos com `error_message like 'refund_needs_review:%'` não retiraram nada automaticamente. Decida o escopo e use:

```sql
select revoke_order_credits('<USER_ID>', '<ID_DO_PEDIDO>', <bonus_a_retirar>, <zerar_cota: true|false>, 'refund_revoke');
```

Idempotente por pedido. Se for reembolso de assinatura, também: `update profiles set subscription_status = 'canceled', plan = 'free', cakto_subscription_id = null where id = '<USER_ID>';` (service role).

## Créditos de geração que travou

**É automático.** Cada geração cobrada vira uma linha em `generation_attempts` (criada junto com o débito por `charge_generation`). Tentativas que ficam `running` por mais de 10 minutos são estornadas por `refund_stale_generations()`. A varredura roda a cada 5 minutos pelo pg_cron (job `slideai-stale-generations`, quando disponível) e também a cada acesso ao app (`record_access` → `refund_stale_generations_if_due`). Cada estorno gera uma linha `stale_timeout` em `generation_logs` e um alerta `generation_stale`.

Conferir:

```sql
select status, count(*) from generation_attempts where created_at > now() - interval '7 days' group by 1;
select * from generation_attempts where status = 'running' order by created_at;
select * from maintenance_runs where task = 'stale_generations';
select * from cron.job where jobname = 'slideai-stale-generations';  -- se houver pg_cron
```

Forçar agora: `select refund_stale_generations();` (service role). Débitos antigos, sem tentativa registrada, seguem pelo caminho manual: `select refund_generation_credits('<USER_ID>', <creditos>, 'manual:<data-hora>', 'stuck_generation');` (idempotente pela referência).

## Alertas

Os alertas chegam por e-mail às contas com papel `admin` (e aos endereços do secret opcional `OPS_ALERT_EMAILS`, separados por vírgula). Ficam em `ops_alerts`; `notified_at` vazio significa ainda não enviado. O mesmo alerta não se repete na mesma hora.

```sql
select created_at, severity, kind, title, details, notified_at from ops_alerts order by created_at desc limit 20;
select created_at, recipient, status, error from email_log where event = 'ops_alert' order by created_at desc limit 20;
```

| Tipo (`kind`) | O que significa | O que fazer |
| --- | --- | --- |
| `webhook_invalid_secret` | A Cakto mandou um evento com segredo diferente do configurado. Pagamentos não estão sendo processados. | [Segredo do webhook](#segredo-do-webhook). Depois, peça à Cakto o reenvio dos eventos recusados. |
| `webhook_not_configured` | `CAKTO_WEBHOOK_SECRET` não existe. | Crie o secret. |
| `payment_user_not_found` | Pagamento, estorno ou cancelamento com e-mail que não tem conta. | [Pagamento aprovado, mas não liberado](#pagamento-aprovado-mas-não-liberado). Eventos de teste da Cakto também disparam: confira o e-mail. |
| `payment_plan_not_resolved` | Pagamento de produto ou oferta fora do mapa de planos. | Inclua o id em `PLAN_BY_CHECKOUT_ID`/`PLAN_BY_PRODUCT_ID` (`cakto-webhook/lib.ts`) e peça o reenvio. |
| `payment_process_error` | Erro ao aplicar um evento. | Veja `payment_events.error_message` e os logs da função. |
| `generation_errors` | 25% ou mais das gerações falharam na última hora (mínimo de 3). | Veja `generation_logs` (campo `reason`) e o status dos provedores de IA. |
| `generation_refund_failed` | Uma geração falhou e o estorno não rodou. | A varredura tenta de novo em até 15 minutos. Se o alerta se repetir, veja os logs de `generate-presentation`. |
| `generation_stale` | Gerações interrompidas foram estornadas pela varredura. | Esporádico é normal. Frequente indica tempo limite: veja a duração em `generation_logs`. |

Sem nenhum admin com e-mail no perfil e sem `OPS_ALERT_EMAILS`, os alertas ficam pendentes (aparece `ops_alert_no_recipients` nos logs).

## Avisos por e-mail não saem

1. O agendador está ativo? `select jobname, schedule, active from cron.job where jobname = 'slideai-email-dispatch';`
2. O despachante responde? `select status_code, content, created from net._http_response order by created desc limit 5;` (401 = segredo do Vault diferente; 404 = função não implantada).
3. A fila anda? `select template, status, reason, send_at from email_schedule order by created_at desc limit 20;`
   - `skipped` com motivo é normal: a situação mudou (`purchased`, `due_changed`, `unsubscribed`, `internal_account`…).
   - `pending` com `send_at` no futuro: relacionamento adiado pelo horário (9 h–20 h) ou pela frequência (1/dia, 3/semana).
4. O envio falhou? `select event, recipient, status, error from email_log where status = 'failed' order by created_at desc limit 20;`
5. Forçar uma rodada: `select public.plan_lifecycle_emails();` e chamar o `email-dispatcher` com o cabeçalho `x-dispatch-secret` (valor em `vault.decrypted_secrets`, nome `email_dispatch_secret`).

Uma pessoa pediu para não receber mais? `select set_email_preferences_by_token(token, false) from email_preferences where user_id = '<USER_ID>';` (avisos de conta continuam).

## Segredo do webhook

Sintoma: `security_events` com `webhook_invalid_secret` e nenhum `payment_events` novo.

1. No painel da Cakto, copie o segredo do webhook.
2. Em Lovable Cloud → Secrets, cole o valor exato em `CAKTO_WEBHOOK_SECRET`.
3. Na Cakto, envie um evento de teste e confira `payment_events`.

## Retenção de dados

A eliminação por prazo roda uma vez por dia, disparada pelos acessos (`record_access`). Para conferir ou forçar:

```sql
select * from maintenance_runs;
select purge_expired_data();   -- forçar agora
```

Sem acessos por vários dias, a rotina fica parada (e também não há dados novos). Se houver agendador (pg_cron), agende `select run_data_retention_if_due();` diariamente. A mesma rotina apaga `ops_alerts` e `generation_attempts` com mais de 12 meses.

## Pedido do titular (LGPD)

Veja [atendimento-ao-titular.md](../lgpd/atendimento-ao-titular.md).

## Checklist pós-deploy

- [ ] Migrações novas aplicadas (confira `pg_proc` e `pg_tables`).
- [ ] Edge functions alteradas implantadas.
- [ ] Gerar uma apresentação curta com conta de desenvolvedor.
- [ ] `/termos`, `/privacidade` e `/ajuda` abrem.
- [ ] Com uma conta comum, o diálogo de aceite aparece uma vez e registra em `legal_acceptances`.
- [ ] `access_logs` recebe registros com IP.
- [ ] `select refund_stale_generations();` responde sem erro, e `generation_attempts` recebe linhas nas gerações cobradas.
- [ ] `npm run email:preview` e conferência visual dos e-mails, se `_shared/email.ts` mudou.
