# Runbooks de operação

Consultas SQL rodam no SQL editor da Lovable Cloud. Nunca altere colunas de cobrança à mão sem registrar a movimentação em `credit_transactions`: use as funções.

**Operações que mexem em créditos ou no plano** são barradas pelo gatilho `protect_billing_columns` só quando vêm direto da API (papéis `anon`/`authenticated`). Desde a migração `0010_security_hardening`, o SQL editor, o pg_cron e as funções do banco passam sem precisar forjar o JWT de `service_role` (o envelope antigo com `set_config('request.jwt.claims', …)` continua funcionando, mas não é mais necessário). Antes da 0010, o mesmo gatilho barrava o estorno automático de gerações travadas — veja [a auditoria](../revisao/2026-10-11-auditoria-de-seguranca.md).

## Pagamento aprovado, mas não liberado

1. Ache o evento:
   ```sql
   select created_at, event_type, processed, error_message, user_email, cakto_id
   from payment_events order by created_at desc limit 20;
   ```
2. `user not found by email`: nenhuma chave do evento achou a conta. O webhook procura, nesta ordem, pela assinatura registrada no perfil, por um evento anterior do mesmo pedido, pelo e-mail atual da conta, por um e-mail usado em compra anterior e pelo cliente da Cakto (`user_resolved` nos logs diz por onde achou). Se nada casou, a compra foi feita com outro e-mail: confirme com o cliente e aplique manualmente (passo 3).
3. Nenhum evento: veja `security_events` (`webhook_invalid_secret`) e confira o segredo ([abaixo](#segredo-do-webhook)). Para liberar manualmente um avulso: `select grant_order_bonus_credits('<USER_ID>', '<ID_DO_PEDIDO>', 500, 'single_purchase');` (uma vez por pedido; sem o id do pedido, `grant_bonus_credits('<USER_ID>', 500, 'single_purchase')`). O alerta `payment_without_order_id` também cai aqui. Para assinatura, peça à Cakto o reenvio do webhook (preferível), para o fluxo completo rodar.

## Reembolso em revisão manual

Eventos com `error_message like 'refund_needs_review:%'` não retiraram nada automaticamente. Decida o escopo e use:

```sql
select revoke_order_credits('<USER_ID>', '<ID_DO_PEDIDO>', <bonus_a_retirar>, <zerar_cota: true|false>, 'refund_revoke');
```

Idempotente por pedido. Para saber quanto bônus aquele pedido ou assinatura de fato concedeu (o webhook usa o mesmo teto): `select order_granted_bonus('<USER_ID>', '<ID_DO_PEDIDO>', '<ID_DA_ASSINATURA ou null>', 'subscription_signup_bonus');` (`'single_purchase'` para avulso). Se for reembolso de assinatura, também: `update profiles set subscription_status = 'canceled', plan = 'free', cakto_subscription_id = null where id = '<USER_ID>';`.

Depois de um estorno, a aprovação do mesmo pedido não credita mais (`already_refunded`), mesmo que a Cakto reenvie o evento.

## Créditos de geração que travou

**É automático.** Cada geração cobrada vira uma linha em `generation_attempts` (criada junto com o débito por `charge_generation`). Tentativas que ficam `running` por mais de 10 minutos são estornadas por `refund_stale_generations()`. A varredura roda a cada 5 minutos pelo pg_cron (job `slideai-stale-generations`, quando disponível) e também a cada acesso ao app (`record_access` → `refund_stale_generations_if_due`). Cada estorno gera uma linha `stale_timeout` em `generation_logs` e um alerta `generation_stale`.

Conferir:

```sql
select status, count(*) from generation_attempts where created_at > now() - interval '7 days' group by 1;
select * from generation_attempts where status = 'running' order by created_at;
select * from maintenance_runs where task = 'stale_generations';
select * from cron.job where jobname = 'slideai-stale-generations';  -- se houver pg_cron
```

Forçar agora: `select refund_stale_generations();`.

Depois da 0010, confira se sobrou tentativa presa de antes da correção (o gatilho de cobrança abortava a varredura):

```sql
select count(*), min(created_at) from generation_attempts
 where status = 'running' and created_at < now() - interval '10 minutes';
select * from cron.job_run_details
 where jobid = (select jobid from cron.job where jobname = 'slideai-stale-generations')
 order by start_time desc limit 5;  -- se houver pg_cron
```

Se houver, `select refund_stale_generations();` estorna todas (idempotente por tentativa). Estornos manuais feitos antes (referência `manual:...`, de mesmo valor e posteriores à tentativa) fecham a tentativa sem devolver de novo: o retorno mostra quantas em `manual`.

Estorno manual: se a tentativa existe, use o id dela como referência, que já a fecha: `select refund_generation_credits('<USER_ID>', <creditos>, '<ID_DA_TENTATIVA>', 'stuck_generation');`. Débitos antigos, sem tentativa registrada: `select refund_generation_credits('<USER_ID>', <creditos>, 'manual:<data-hora>', 'stuck_generation');` (idempotente pela referência).

A parte que saiu da cota mensal só volta se o débito é do ciclo atual e até a alocação do plano; o resto teria expirado com o ciclo e aparece em `expired_monthly` no retorno e na transação.

## Alertas

Os alertas chegam por e-mail às contas com papel `admin` (e aos endereços do secret opcional `OPS_ALERT_EMAILS`, separados por vírgula). Ficam em `ops_alerts`; `notified_at` vazio significa ainda não enviado. O mesmo alerta não se repete na mesma hora.

```sql
select created_at, severity, kind, title, details, notified_at from ops_alerts order by created_at desc limit 20;
select created_at, recipient, status, error from email_log where event = 'ops_alert' order by created_at desc limit 20;
```

| Tipo (`kind`) | O que significa | O que fazer |
| --- | --- | --- |
| `webhook_invalid_secret` | Chegou evento com segredo diferente do configurado e nenhuma entrega válida nas últimas 6 horas: provavelmente os pagamentos não estão sendo processados. (Com entregas válidas recentes, o POST inválido só vai para `security_events`.) | [Segredo do webhook](#segredo-do-webhook). Depois, peça à Cakto o reenvio dos eventos recusados. |
| `webhook_not_configured` | `CAKTO_WEBHOOK_SECRET` não existe. | Crie o secret. |
| `payment_user_not_found` | Pagamento, estorno ou cancelamento com e-mail que não tem conta. | [Pagamento aprovado, mas não liberado](#pagamento-aprovado-mas-não-liberado). Eventos de teste da Cakto também disparam: confira o e-mail. |
| `payment_plan_not_resolved` | Pagamento de produto ou oferta fora do mapa de planos. | Inclua o id em `PLAN_BY_CHECKOUT_ID`/`PLAN_BY_PRODUCT_ID` (`cakto-webhook/lib.ts`) e peça o reenvio. |
| `payment_process_error` | Erro ao aplicar um evento. | Veja `payment_events.error_message` e os logs da função. |
| `generation_errors` | 25% ou mais das gerações falharam na última hora (mínimo de 3). | Veja `generation_logs` (campo `reason`) e o status dos provedores de IA. |
| `generation_refund_failed` | Uma geração falhou e o estorno não rodou. | A varredura tenta de novo em até 15 minutos. Se o alerta se repetir, veja os logs de `generate-presentation`. |
| `generation_stale` | Gerações interrompidas foram estornadas pela varredura. | Esporádico é normal. Frequente indica tempo limite: veja a duração em `generation_logs`. |
| `refund_after_consumption` | Reembolso ou chargeback de créditos que o cliente já tinha usado: o estorno retirou menos do que o pedido concedeu. | Decida pela política de reembolso (auditoria, R7): reter o valor, contestar o chargeback ou aceitar. Não há saldo negativo. |
| `payment_other_subscription` | Cobrança de uma assinatura que não é a vigente da conta (o cliente trocou de plano e a antiga continuou ativa). Plano e cota não mudaram. | Confirme com o cliente, cancele a assinatura antiga na Cakto e reembolse a cobrança duplicada. |

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
- [ ] Secret `RATE_LIMIT_PEPPER` criado nas Edge Functions (valor aleatório longo): chave das contagens por IP e do `ip_hash` da telemetria. Sem ele, cai na chave `service_role`.
- [ ] `npm run email:preview` e conferência visual dos e-mails, se `_shared/email.ts` mudou.
- [ ] Mudou RLS, gatilho ou RPC: `supabase/tests/security/run.sh` num Postgres local passa, e numa janela anônima um deck publicado abre pelo link, um privado não, e `GET /rest/v1/presentations?select=id` com a chave `anon` devolve `[]`.
