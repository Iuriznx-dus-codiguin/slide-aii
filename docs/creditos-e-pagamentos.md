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
| Assistente de edição | 10 mensagens e 3 edições complexas por apresentação gerada (40/h e 150/dia por conta) | `chat-editor` |
| Regenerar falas | 5 por apresentação | `regenerate-speeches` |
| Imagens por IA no editor | 15/h; plano avulso só com saldo | `fetch-image` |

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

A conta do evento é achada pela assinatura registrada no perfil, por um evento anterior do mesmo pedido, pelo e-mail atual da conta, por um e-mail de compra anterior e pelo cliente da Cakto, nessa ordem (`resolveUserId`). Trocar o e-mail da conta não desliga a assinatura dos eventos seguintes.

| Evento | Efeito |
| --- | --- |
| Compra avulsa | +500 de bônus, uma vez por pedido (`grant_order_bonus_credits`); pedido já reembolsado não credita. Sem assinatura vigente: plano vira `single` e a sobra mensal é zerada. Evento sem id de pedido: nada é creditado, alerta `payment_without_order_id` para acerto manual |
| Assinatura criada ou renovada | Plano ativo, `renews_at` = agora + período, cota redefinida uma vez por pedido (`grant_monthly_for_order`, reancora o ciclo), bônus de ativação uma vez por conta, guardando pedido e assinatura que o concederam |
| Cobrança de outra assinatura com a vigente ativa (renovação da antiga) | Nada muda; alerta `payment_other_subscription`. Assinatura nova (troca de plano) continua valendo, inclusive paga por Pix/boleto |
| Pagamento de pedido já reembolsado (reenvio tardio) | Nada é reativado; alerta `payment_after_refund` |
| Cancelamento | `subscription_status = canceled`; acesso e cota até `renews_at`. Cancelar uma assinatura que não é a vigente não muda nada |
| Reembolso / chargeback | Estorna só o que aquela compra concedeu (idempotente por pedido): avulso, os 500 do pedido; assinatura, encerra na hora (`plan = free`), zera a cota e retira o bônus de ativação só se foi aquela assinatura que o deu e só uma vez (`order_granted_bonus`). Créditos já gastos não ficam negativos: alerta `refund_after_consumption`. Caso ambíguo: vai para revisão manual (`webhook_refund_review`) |
| Recusa, Pix/boleto gerado, abandono | Ignorado |

## Ciclo mensal

A cota renova um mês depois de `credits_cycle_anchor` (data da ativação ou da última renovação). A renovação é preguiçosa: acontece no próximo débito. A interface calcula o mesmo valor (`isMonthlyCycleDue`).

## Pontos de atenção

- Geração que trava (queda da função ou tempo esgotado) é estornada automaticamente em até 15 minutos (`generation_attempts` + `refund_stale_generations`): [runbook](operacao/runbooks.md#créditos-de-geração-que-travou). Até a migração 0010 esse estorno era barrado pelo gatilho de cobrança; confira as tentativas presas de antes (runbook). A parte que saiu da cota mensal só volta se o débito é do ciclo atual e até a alocação do plano.
- Cotas por apresentação (falas: 5; chat: 10 mensagens ou 3 edições complexas) são reservadas no banco antes da chamada de IA (`reserve_speech_regen`, `reserve_ai_edit_usage`) e devolvidas se ela falhar; os contadores não são graváveis pelo cliente. Só decks gerados pelo servidor (`is_paid`) têm cota de chat: um INSERT direto na API nasce com `is_paid = false`.
- Imagens de IA não consomem créditos: é a principal alavanca de custo (ver revisão de 27/09/2026, decisão B1).
