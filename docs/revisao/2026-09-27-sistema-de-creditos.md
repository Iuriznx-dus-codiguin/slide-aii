# Sistema de créditos — revisão de ponta a ponta (27/09/2026)

Revisão de todos os eventos que mexem em saldo: compra, assinatura, renovação, adição de créditos com plano ativo, cancelamento, reembolso, geração e recursos extras. A base foi o código, as funções SQL de produção (lidas direto do banco) e testes num PostgreSQL local. As correções estão no mesmo PR das correções da revisão geral.

## Como o saldo funciona

| Peça | Onde | Comportamento |
|---|---|---|
| `credits_bonus` | `profiles` | Permanente. Vem da compra avulsa (+500) e do bônus de ativação da assinatura (+800/+1.200/+2.000, uma vez por conta). |
| `credits_monthly` | `profiles` | Cota do plano (3.200 PRO / 16.000 MAX). É **redefinida**, não somada, a cada ciclo. |
| `credits_cycle_anchor` | `profiles` | Início do ciclo atual da cota. A renovação é preguiçosa: acontece no próximo débito (`ensure_monthly_credits`), e a tela calcula o mesmo valor. |
| Consumo | `consume_credits` | Gasta **primeiro a cota mensal**, depois o bônus. Tudo fica no ledger `credit_transactions`. |
| Cobrança da geração | `generate-presentation` | O débito acontece **no início** (fechar a aba não sai de graça). Qualquer falha do sistema estorna, de forma idempotente, por tentativa (`refund_generation_credits`). |
| Acesso | `can_user_generate` | Dev libera tudo. Assinatura cancelada ou vencida bloqueia. Avulso e PRO precisam de saldo ≥ custo. MAX sem saldo recebe erro genérico. |

### Custo de uma apresentação (confere com a regra do produto)

`créditos = slides × 10 + profundidade (curto 10 · médio 20 · longo 30) + falas dos apresentadores (50, opcional)`

- A faixa de slides é de 5 a 20, a mesma na tela e no servidor.
- O código tem também **"longo = 30"**. Confirme se continua valendo, porque na sua mensagem só apareceram curto (10) e médio (20).
- As três cópias da regra (tela, `generate-presentation` e o teste de paridade) batem.

| Slides | Profundidade | Falas | Créditos |
|---|---|---|---|
| 5 | curto | não | 60 |
| 8 | médio | não | 100 |
| 10 | médio | não | 120 |
| 10 | médio | sim | 170 |
| 15 | longo | não | 180 |
| 20 | médio | sim | 270 |
| 20 | longo | sim | 280 |

---

## Eventos, um a um

Legenda: ✅ correto · 🔧 corrigido neste PR · ⚖️ decisão de negócio (sem mudança; recomendação abaixo)

| # | Evento | Como estava | Situação |
|---|---|---|---|
| 1 | **Compra avulsa, sem plano** | +500 no bônus, plano `single`. | ✅ |
| 2 | **Compra avulsa com assinatura ativa** (adição de créditos) | +500 no bônus; plano e cota mensal intactos. Como o consumo usa a cota primeiro, o avulso fica guardado. | ✅ |
| 3 | **Compra avulsa com assinatura vencida** (a renovação passou sem pagamento) | O plano antigo continuava e o acesso bloqueava por `subscription_expired`: **o cliente pagava R$ 14,90 e não conseguia usar os 500 créditos.** | 🔧 Assinatura vencida não conta mais como ativa (`isActiveSubscriber`), e o plano vira `single`. |
| 4 | **Compra avulsa com assinatura cancelada** | O plano virava `single`, mas **a sobra da cota mensal antiga voltava a valer** junto com o avulso (até 3.200 ou 16.000 créditos). | 🔧 A sobra mensal é zerada quando não há assinatura ativa. |
| 5 | **Assinatura criada** (a Cakto manda `purchase_approved` **e** `subscription_created`) | Os dois eventos redefinem a cota (idempotente) e o bônus de ativação sai uma vez só por conta. | ✅ |
| 6 | **Renovação** | A cota renovava no **dia 1º** de cada mês **e** era redefinida no **dia do pagamento**: um plano mensal recarregava **duas vezes por mês**. | 🔧 A cota segue o ciclo da assinatura: renova 1 mês depois da ativação ou renovação, e o pagamento reancora o ciclo. Âncoras antigas (dia 1º) continuam valendo. Os planos trimestral e anual continuam recebendo a cota todo mês. |
| 7 | **Renovação recusada / compra recusada / pix-boleto gerado / checkout abandonado** | Classificados por palavras. Como a Cakto manda o pedido inteiro, um evento de recusa com `status: "paid"` (é o que aparece nos testes dela) **virava pagamento**: estendia a assinatura e recarregava créditos. | 🔧 Esses eventos são sempre ignorados, antes de qualquer regra de pagamento. |
| 8 | **Troca de plano** (PRO ↔ MAX) | A cota é redefinida para a do plano novo e o ciclo reancora. O bônus de ativação é **um por conta** (não vale de novo ao trocar). | ✅ ⚖️ (ver B4) |
| 9 | **Cancelamento** | Bloqueia a geração **na hora**, mesmo com o período já pago. | ⚖️ (ver B2) |
| 10 | **Expiração** (renovação não paga) | Bloqueia quando `subscription_renews_at` passa. | ✅ |
| 11 | **Reembolso / chargeback** | Eram **descartados como duplicata** (mesmo id do pedido da compra). Quando passavam, zeravam **todo** o saldo e cancelavam a assinatura, mesmo sendo o reembolso de um avulso. | 🔧 (PR anterior) Idempotência por evento + pedido. O estorno se limita ao que o pedido deu, e caso ambíguo vai para revisão manual. |
| 12 | **Reentrega do mesmo evento** | Barrada pelo índice único. | ✅ |
| 13 | **Geração que falha** (erro tratado) | Estorno automático e idempotente, com a causa registrada. | ✅ |
| 14 | **Geração que trava** (tempo esgotado ou queda da função) | O débito aconteceu, mas nenhum estorno roda: o crédito some. | ⚖️ (ver B5) |
| 15 | **Desenvolvedor** | Sem cobrança. Limite de 5 por dia e 5 por hora. | ✅ |
| 16 | **Regenerar falas** (Editor) | **Quebrado em produção:** a consulta lia colunas inexistentes (`topic`, `tone`) e sempre respondia "Apresentação não encontrada". E não conferia se as falas tinham sido pagas: consertada sem isso, viraria **falas grátis**, contornando os 50 créditos. | 🔧 A consulta foi corrigida, e a regeneração só vale para decks que pagaram as falas (5 por apresentação, como antes). |
| 17 | **Chat de edição** (10 mensagens / 3 edições complexas por apresentação) | A contagem **vinha do navegador**: enviar 0 dava edições por IA ilimitadas. | 🔧 A contagem fica no banco (`ai_edit_messages`/`ai_edit_complex`), só o servidor altera, e vale o maior valor entre banco e cliente. |
| 18 | **Notas do orador** | O PR anterior completava notas vazias **para todos**, o que concorreria com a opção paga "Gerar falas dos apresentadores" (+50). | 🔧 Só completa quando o usuário escolheu e pagou as falas. |
| 19 | **Imagens (fotos e IA)** | Não custam crédito. | ⚖️ (ver B1) |
| 20 | **Consulta de saldo de outro usuário** | Qualquer pessoa logada via plano, saldo e vencimento de outra. | 🔧 (PR anterior) |

---

## Margem por apresentação

Premissas:
- US$ 1 = R$ 5,40;
- sem taxas da Cakto e impostos;
- receita por crédito = preço do plano ÷ créditos do período, supondo que o cliente **usa todos os créditos** (pior caso para a margem);
- custo de texto: estimativa do registro de modelos. O único deck v2 medido em produção (6 slides) custou **US$ 0,016** de texto, cerca de metade da estimativa, então a tabela é conservadora;
- imagem de IA: gpt-image-2.5-flare em qualidade média, US$ 0,035 (preço estimado), no **teto** de imagens de IA que o plano visual permite. Na prática o planner usa menos: o deck medido reservou 1.

**Receita por crédito:**

| Plano | Preço | Créditos no período | R$/crédito |
|---|---|---|---|
| Avulso | R$ 14,90 | 500 | 0,0298 |
| PRO mensal | R$ 49,90 | 3.200 | 0,0156 |
| PRO trimestral | R$ 127,90 | 9.600 | 0,0133 |
| PRO anual | R$ 397,90 | 38.400 | 0,0104 |
| MAX mensal | R$ 147,90 | 16.000 | 0,0092 |
| MAX trimestral | R$ 377,90 | 48.000 | 0,0079 |
| MAX anual | R$ 1.175,00 | 192.000 | 0,0061 |

**Custo × receita por deck (R$):**

| Deck | Créditos | Custo IA (texto + imagens no teto) | Avulso | PRO mensal | PRO anual | MAX anual |
|---|---|---|---|---|---|---|
| 5 slides, curto | 60 | 0,54 | 1,79 | 0,94 | 0,62 | **0,37** |
| 8 slides, médio | 100 | 0,60 | 2,98 | 1,56 | 1,04 | 0,61 |
| 10 slides, médio | 120 | 0,83 | 3,58 | 1,87 | 1,24 | **0,73** |
| 10 slides, médio + falas | 170 | 0,94 | 5,07 | 2,65 | 1,76 | 1,04 |
| 15 slides, longo | 180 | 1,32 | 5,36 | 2,81 | 1,87 | **1,10** |
| 20 slides, médio + falas | 270 | 1,84 | 8,05 | 4,21 | 2,80 | **1,65** |

Em negrito, os casos em que a receita não cobre o custo no pior caso.

Leitura:
- **O texto é barato.** Por slide, fica em US$ 0,003–0,006. A opção de falas (+50 créditos) custa cerca de US$ 0,02 a mais em IA e tem folga grande em todos os planos.
- **Quem pesa é a imagem de IA.** Até 6 imagens por deck somam US$ 0,21 (R$ 1,13), e **o usuário não paga nada por elas**.
- **Avulso e PRO têm margem** mesmo no pior caso.
- **MAX anual e MAX trimestral ficam negativos** quando o deck usa o teto de imagens de IA e o cliente gasta toda a cota. O MAX mensal fica no limite.
- Com o uso real (menos imagens de IA e créditos que sobram), a margem é positiva. Mas um cliente MAX intenso, gerando decks curtos com muitas imagens, pode dar prejuízo.

---

## Decisões de negócio (recomendações, sem mudança no código)

- **B1 — Imagens de IA sem custo em créditos.** É a principal alavanca de margem. As opções, da mais simples à mais justa:
  - (a) usar o `gpt-image-1-mini` em qualidade média (US$ 0,015, menos da metade) como modelo principal **para todos os planos**. Basta criar o secret `IMAGE_MODEL_PRIMARY=gpt-image-1-mini`, sem deploy de código, ao custo de um pouco de fidelidade nas vistas técnicas;
  - (b) limitar as imagens de IA por deck conforme o plano;
  - (c) cobrar créditos por imagem de IA (por exemplo, +10), mostrando o valor no formulário, como já é feito com as falas.
- **B2 — Cancelamento bloqueia na hora.** O cliente que cancela a renovação já pagou o mês. O comum é manter o acesso até `subscription_renews_at`. Recomendo manter até o fim do período; é uma mudança em `can_user_generate` e no `useEntitlement`.
- **B3 — Bônus permanente depois de cancelar ou expirar.** Créditos avulsos comprados durante a assinatura (permanentes, pagos à parte) ficam inacessíveis quando a assinatura cancela ou expira. Recomendo liberar o uso **só do bônus** nesse caso.
- **B4 — Bônus de ativação é um por conta.** Quem sai do PRO mensal para o anual não ganha o bônus do anual. Faz sentido contra abuso (cancelar e assinar de novo), mas vale deixar claro na página de planos.
- **B5 — Geração que trava não estorna.** É raro (tempo limite ou queda da função), mas o crédito some. Recomendo uma rotina diária que estorne débitos sem registro de sucesso nem de falha depois de 15 minutos. O estorno já é idempotente por tentativa, então é seguro.
- **B6 — Reembolso de créditos já gastos.** O estorno retira no máximo o saldo disponível: créditos já usados não voltam como dívida. É o comportamento esperado, mas vale constar nos termos.
