# Créditos e pagamentos — regras vigentes

Referência do comportamento atual. Os textos para o cliente estão nos [Termos de Uso](../src/pages/Terms.tsx) (seções 5 a 9) e na Central de Ajuda (categoria `planos`). Qualquer mudança aqui exige atualizar os dois e o `LEGAL.termsVersion`.

## Constantes

| Constante | Valor | Fonte |
| --- | --- | --- |
| Créditos por slide | 10 (5 a 20 slides) | `src/lib/cakto.ts`, `generate-presentation` |
| Profundidade | curto 10 · equilibrado 20 · longo 30 | idem |
| Falas dos apresentadores | 50 | idem |
| Compra avulsa | R$ 14,90 → 500 créditos de bônus | `cakto-webhook/lib.ts` |
| Cota PRO | 1.700 por ciclo mensal (≈ 10 apresentações de 10 slides com falas) | `plan_monthly_credits` |
| Teto MAX (uso justo) | 8.500 por ciclo mensal (5x o PRO, ≈ 50 apresentações) | `plan_monthly_credits` |
| Bônus de ativação | Não há (removido na tabela de 10/2026) | — |
| Apresentação de referência das estimativas | 170 (10 slides, equilibrada, com falas) | `REFERENCE_DECK_CREDITS` |
| Gerações por hora | 12 (dev: 5/h e 5/dia) | `generate-presentation` |
| Assistente de edição | 10 mensagens e 3 edições complexas por apresentação | `chat-editor` |
| Regenerar falas | 5 por apresentação | `regenerate-speeches` |
| Imagens por IA no editor | 15/h | `fetch-image` |

`src/lib/fairUse.ts` reúne os limites citados nos Termos. Os testes de paridade (`src/test/plansParity.test.ts`) conferem preços, créditos e custo da geração entre o front, as edge functions, o webhook e a função `plan_monthly_credits` da migração mais recente.

## Tabela de preços (10/2026)

Fonte: `PLAN_PRICE_CENTS` em `src/lib/cakto.ts` (espelhado em `supabase/functions/_shared/plans.ts`). **O valor cobrado é o da oferta no painel da Cakto**: mudar um preço aqui exige mudar a oferta lá.

| Plano | Preço | Equivale a | Desconto sobre o mensal | Antes (exibido riscado) | Créditos |
| --- | --- | --- | --- | --- | --- |
| Avulso | R$ 14,90 | — | — | — | 500 permanentes |
| PRO mensal | R$ 34,90/mês | — | — | R$ 49,90 | 1.700/mês |
| PRO trimestral | R$ 88,90/trimestre | R$ 29,63/mês | 15% | R$ 127,90 | 1.700/mês |
| PRO anual | R$ 276,90/ano | R$ 23,08/mês | 34% | R$ 397,90 | 1.700/mês |
| MAX mensal | R$ 147,00/mês | — | — | R$ 147,90 | 8.500/mês (uso justo) |
| MAX trimestral | R$ 375,00/trimestre | R$ 125,00/mês | 15% | R$ 377,90 | 8.500/mês (uso justo) |
| MAX anual | R$ 1.164,00/ano | R$ 97,00/mês | 34% | R$ 1.175,00 | 8.500/mês (uso justo) |

O anual tem 34% (e não 33%) para que o MAX anual fique abaixo do preço anterior. Os cards só mostram o selo de redução sobre o preço anterior a partir de 5% (o MAX caiu cerca de 1%; ele aparece só riscado).

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
| Assinatura criada ou renovada | Plano ativo, `renews_at` = agora + período, cota redefinida (reancora o ciclo). Sem bônus de ativação |
| Cancelamento | `subscription_status = canceled`; acesso e cota até `renews_at` |
| Reembolso / chargeback | Estorna só o que o pedido concedeu (idempotente por pedido): avulso, até 500 de bônus. Assinatura: encerra na hora (`plan = free`) e zera a cota. Caso ambíguo: vai para revisão manual (`webhook_refund_review`) |
| Recusa, Pix/boleto gerado, abandono | Ignorado |

## Ciclo mensal

A cota renova um mês depois de `credits_cycle_anchor` (data da ativação ou da última renovação). A renovação é preguiçosa: acontece no próximo débito. A interface calcula o mesmo valor (`isMonthlyCycleDue`).

## Pontos de atenção

- Geração que trava (queda da função ou tempo esgotado) é estornada automaticamente em até 15 minutos (`generation_attempts` + `refund_stale_generations`): [runbook](operacao/runbooks.md#créditos-de-geração-que-travou).
- Imagens de IA não consomem créditos: é a principal alavanca de custo (ver revisão de 27/09/2026, decisão B1).
