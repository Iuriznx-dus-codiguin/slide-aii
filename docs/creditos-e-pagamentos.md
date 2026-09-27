# Créditos e pagamentos — regras vigentes

Referência do comportamento atual. Os textos para o cliente estão nos [Termos de Uso](../src/pages/Terms.tsx) (seções 5 a 9) e na Central de Ajuda (categoria `planos`). Qualquer mudança aqui exige atualizar os dois e o `LEGAL.termsVersion`.

## Constantes

| Constante | Valor | Fonte |
| --- | --- | --- |
| Créditos por slide | 10 (5 a 20 slides) | `src/lib/cakto.ts`, `generate-presentation` |
| Profundidade | curto 10 · equilibrado 20 · longo 30 | idem |
| Falas dos apresentadores | 50 | idem |
| Compra avulsa | R$ 14,90 → 500 créditos de bônus | `cakto-webhook/lib.ts` |
| Cota PRO | 3.200 por ciclo mensal | `plan_monthly_credits` |
| Teto MAX (uso justo) | 16.000 por ciclo mensal | `plan_monthly_credits` |
| Bônus de ativação PRO | 800 / 1.200 / 2.000 (mensal/trimestral/anual), uma vez por conta | `grant_bonus_credits_once` |
| Gerações por hora | 12 (dev: 5/h e 5/dia) | `generate-presentation` |
| Assistente de edição | 10 mensagens e 3 edições complexas por apresentação | `chat-editor` |
| Regenerar falas | 5 por apresentação | `regenerate-speeches` |
| Imagens por IA no editor | 15/h | `fetch-image` |

`src/lib/fairUse.ts` reúne os limites citados nos Termos. Os testes de paridade conferem as constantes de preço entre o front e o webhook.

## Acesso (`can_user_generate` / `decideEntitlement`)

| Situação | Resultado |
| --- | --- |
| Desenvolvedor/admin | Liberado (`dev`) |
| Assinatura vigente (ativa, ou cancelada antes de `subscription_renews_at`) | Saldo = bônus + cota do ciclo. Faltou saldo: PRO → `insufficient_credits`; MAX → `fair_use_limit` (com `resets_at`) |
| Avulso | Saldo = bônus (+ mensal residual, normalmente 0) |
| Sem assinatura vigente (vencida, cancelada após o período, inadimplente, sem plano) | **Bônus continua valendo** (`bonus_only`); sem bônus suficiente → `subscription_canceled` / `subscription_expired` / `insufficient_credits` / `no_plan` |

Com a assinatura encerrada, a sobra da cota mensal não vale mais (`consume_credits` ignora a cota e `ensure_monthly_credits` não renova).

## Eventos de pagamento (`cakto-webhook`)

| Evento | Efeito |
| --- | --- |
| Compra avulsa | +500 de bônus. Sem assinatura vigente: plano vira `single` e a sobra mensal é zerada |
| Assinatura criada ou renovada | Plano ativo, `renews_at` = agora + período, cota redefinida (reancora o ciclo), bônus de ativação uma vez por conta |
| Cancelamento | `subscription_status = canceled`; acesso e cota até `renews_at` |
| Reembolso / chargeback | Estorna só o que o pedido concedeu (idempotente por pedido). Assinatura: encerra na hora (`plan = free`) e zera a cota. Caso ambíguo: vai para revisão manual (`webhook_refund_review`) |
| Recusa, Pix/boleto gerado, abandono | Ignorado |

## Ciclo mensal

A cota renova um mês depois de `credits_cycle_anchor` (data da ativação ou da última renovação). A renovação é preguiçosa: acontece no próximo débito. A interface calcula o mesmo valor (`isMonthlyCycleDue`).

## Pontos de atenção

- Estorno de geração que trava (queda da função) não é automático: [runbook](operacao/runbooks.md#créditos-de-geração-que-travou).
- Imagens de IA não consomem créditos: é a principal alavanca de custo (ver revisão de 27/09/2026, decisão B1).
