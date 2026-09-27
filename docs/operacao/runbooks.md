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

Débitos (`consume`) sem sucesso nem estorno em até 15 minutos:

```sql
select t.user_id, t.created_at, t.amount
from credit_transactions t
where t.type = 'consume' and t.created_at < now() - interval '15 minutes' and t.created_at > now() - interval '30 days'
  and not exists (select 1 from generation_logs g where g.user_id = t.user_id and g.created_at between t.created_at and t.created_at + interval '10 minutes')
order by t.created_at desc;
```

Para devolver: `select refund_generation_credits('<USER_ID>', <creditos>, 'manual:<data-hora>', 'stuck_generation');`. É idempotente pela referência.

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

Sem acessos por vários dias, a rotina fica parada (e também não há dados novos). Se houver agendador (pg_cron), agende `select run_data_retention_if_due();` diariamente.

## Pedido do titular (LGPD)

Veja [atendimento-ao-titular.md](../lgpd/atendimento-ao-titular.md).

## Checklist pós-deploy

- [ ] Migrações novas aplicadas (confira `pg_proc` e `pg_tables`).
- [ ] Edge functions alteradas implantadas.
- [ ] Gerar uma apresentação curta com conta de desenvolvedor.
- [ ] `/termos`, `/privacidade` e `/ajuda` abrem.
- [ ] Com uma conta comum, o diálogo de aceite aparece uma vez e registra em `legal_acceptances`.
- [ ] `access_logs` recebe registros com IP.
