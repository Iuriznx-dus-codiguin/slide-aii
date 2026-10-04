# Plano de avisos por e-mail (Resend)

**Objetivo:** cada e-mail parte da **situação atual da pessoa**, não só do evento que o disparou. Exemplos de situação:
- acabou de entrar e ainda não comprou nada;
- tem plano que renova sozinho no cartão;
- tem Pix pendente;
- teve a renovação recusada.

Com isso, cada mensagem mantém o bom relacionamento, facilita o uso e leva ao próximo pagamento (primeira compra, renovação ou recuperação), com o link certo e os dados certos.

**Status (04/10/2026):** fases 1 e 2 implementadas, com as decisões da seção 11. Código: `supabase/functions/_shared/lifecycle*.ts`, `email-dispatcher`, `email-unsubscribe` e a migração `0008_lifecycle_emails`. Operação: [../operacao/emails.md](../operacao/emails.md).

---

## 1. Princípios

1. **Situação antes de evento.** Antes de enviar, o sistema reavalia o estado da conta. Se a pessoa comprou entre o agendamento e o envio, o lembrete de compra não sai.
2. **Um próximo passo por e-mail.** Um botão principal, no máximo um secundário. O link já leva ao checkout certo ou à tela certa.
3. **Dados reais, nunca inventados:**
   - nome;
   - perfil (estudante, professor…);
   - plano;
   - data de renovação;
   - forma de pagamento ("Visa final 4323");
   - saldo de créditos.

   Sem o dado, a frase muda; não se inventa.
4. **Tom SlideAI.** Criativo, próximo e leve, sem perder clareza. Em assunto de dinheiro (recusa, reembolso, contestação) o tom fica mais sóbrio, nunca culpando a pessoa.
5. **Respeito à caixa de entrada.** Há horários, limites de frequência, descadastro em um clique para o que não é essencial, e supressão de endereços que retornam erro ou marcam spam.
6. **Sem duplicar a Cakto.** A Cakto já envia o recibo. Nossos e-mails falam do que acontece **no SlideAI** (créditos liberados, o que fazer agora) e não repetem o comprovante.

---

## 2. Categorias de mensagem (e o que a lei e os Termos exigem)

| Categoria | Exemplos | Quem recebe | Descadastro |
| --- | --- | --- | --- |
| **Transacional** | Compra aprovada, assinatura criada, renovação feita, reembolso, contestação, chamado respondido | Todos, sempre | Não se aplica (é a prestação do serviço) |
| **Aviso de conta** | Lembrete de renovação (5/3/1 dias), renovação recusada, assinatura atrasada, plano vencendo, saldo baixo, mudança nos Termos | Todos com conta ativa | Não, mas a pessoa pode reduzir lembretes nas preferências |
| **Relacionamento e marketing** | Sequência para quem ainda não comprou (dias 1, 3, 5, 10, 15 e 30), carrinho abandonado, reconquista após cancelamento, dicas | **Só com consentimento** | Obrigatório, em um clique |

**Ponto de atenção legal:** os Termos (cláusula 20.2) dizem "Não enviamos comunicações de marketing sem o seu consentimento". Por isso a sequência de nutrição e os e-mails de reconquista dependem de:
- uma **caixa de consentimento no cadastro**, desmarcada por padrão: *"Quero receber dicas, ideias de apresentação e ofertas do SlideAI por e-mail"*;
- uma **página de preferências**;
- **link de descadastro** em todos esses e-mails, com cabeçalho `List-Unsubscribe` de um clique (exigência de Gmail e Yahoo para remetentes em volume);
- uma linha na Política de Privacidade sobre a finalidade "comunicações de relacionamento", com nova versão e novo aceite.

Para quem já tem conta (sem consentimento registrado), um aviso único no app pede a escolha.

---

## 3. O que sabemos de cada pessoa

| Dado | Fonte | Uso no e-mail |
| --- | --- | --- |
| Primeiro nome | `profiles.full_name` (primeira palavra); senão `username` | Saudação |
| Perfil | `profiles.role`: `estudante`, `professor`, `profissional`, `criador` (hoje há "Professor" com maiúscula; normalizar) | Tom, exemplos, sugestões de tema |
| Plano, status e renovação | `profiles.plan`, `subscription_status`, `subscription_renews_at` | Lembretes, textos de acesso |
| Forma de pagamento | Webhook da Cakto: `data.paymentMethod`, `data.subscription.paymentMethod`, `card.brand` e `card.lastDigits` | Renovação automática ou manual, e "Visa final 4323" |
| Próxima cobrança e tentativas | `data.subscription.next_payment_date`, `max_retries`, `retry_interval` | Datas dos lembretes e da recusa |
| Pix ou boleto pendente | `data.pix.qrCode` e `expirationDate`; `data.boleto.boletoUrl` e `expirationDate`; `data.checkoutUrl` | Link direto para pagar |
| Saldo | `credits_bonus` + cota do mês (`decideEntitlement`) | Saldo baixo, créditos renovados |
| Uso | `generations_count`, última apresentação (`presentations`) | "Sua última apresentação, *Ciclo da água*…" |
| Consentimento | nova tabela `email_preferences` | Pode ou não receber marketing |

**Hoje não guardamos a forma de pagamento nem a próxima cobrança no perfil**, só no histórico de eventos. A fase 1 cria esses campos (seção 9).

### Renovação automática ou manual

| Última forma de pagamento | Renovação | Lembrete D-5/3/1 diz… | Link do botão |
| --- | --- | --- | --- |
| Cartão de crédito (`credit_card`) | **Automática** | "Vamos renovar no dia 12/11 no Visa final 4323. Não precisa fazer nada." | Ver plano no app; atualizar cartão (portal da Cakto, se ela oferecer) |
| Pix Automático (valor exato do payload a confirmar; ver seção 11) | **Automática** | "A renovação sai pelo Pix Automático no dia 12/11." | Ver plano no app |
| Pix, boleto, PicPay e outros | **Manual** | "Seu plano vence em 5 dias. Para continuar, é só renovar pelo link." | Cobrança pendente (Pix ou boleto da Cakto) ou checkout do mesmo plano |
| Assinatura cancelada, ainda no período pago | Não renova | "Seu acesso vai até 12/11. Quer continuar? Reative em um clique." | Checkout do mesmo plano |

---

## 4. Voz e tom adaptativos

### Saudação

| Perfil | Saudação | Exemplo |
| --- | --- | --- |
| Professor | "Olá, prof. {nome}! Tudo certo?" | "Olá, prof. Fernando! Tudo certo? Passando para lembrar que faltam 5 dias…" |
| Estudante | "Oi, {nome}! Tudo bem por aí?" | "Oi, Ana! Tudo bem por aí? Seu seminário merece slides à altura…" |
| Profissional | "Olá, {nome}, tudo bem?" | "Olá, Carla, tudo bem? Sua próxima reunião pode começar com um deck pronto…" |
| Criador de conteúdo | "E aí, {nome}!" | "E aí, Lucas! Bora transformar aquele roteiro em slides?" |
| Sem perfil | "Olá, {nome}!" | — |
| Sem nome | "Olá!" | — |

Regras:
- "prof." só aparece para quem escolheu **Professor** no onboarding.
- Nunca use gênero ("professora", "querido"): o perfil não informa.
- Use só o primeiro nome. Se o nome parecer um e-mail ou tiver números, use a saudação sem nome.

### Tom por situação

| Situação | Tom | Emoji |
| --- | --- | --- |
| Boas-vindas, primeira apresentação, compra aprovada | Animado e criativo | Até 1 no assunto |
| Lembretes de renovação | Tranquilo, útil e objetivo | Não |
| Recusa, atraso, plano vencendo | Acolhedor e prático ("acontece, resolve em 1 minuto") | Não |
| Reembolso, contestação (chargeback) | Neutro e formal | Não |
| Nutrição (dias 1 a 30) | Inspirador, com ideias do perfil da pessoa | Até 1 |

### Assinatura

- Transacionais e avisos: **"Equipe SlideAI"**.
- Relacionamento: **"Time criativo do SlideAI"** ou o nome de uma pessoa, se o dono quiser (ver seção 11).

### Ideias por perfil (usadas nos e-mails de nutrição)

- **Professor:** aula de revisão para a prova; sequência didática da semana; apresentação para reunião de pais.
- **Estudante:** seminário em grupo; defesa de TCC; trabalho de história com linha do tempo.
- **Profissional:** resultados do trimestre; kickoff de projeto; proposta comercial.
- **Criador:** módulo de curso; roteiro de vídeo em slides; apresentação de mídia kit.

---

## 5. Jornadas

```
CADASTRO ─► boas-vindas + escolha um plano (D0)
   │
   ├─ não comprou ─► nutrição D1 · D3 · D5 · D10 · D15 · D30 (marketing) ─► para ao comprar
   │      └─ abriu checkout e não pagou ─► Pix/boleto pendente · carrinho abandonado
   │
   ├─ compra avulsa ─► créditos liberados ─► saldo baixo ─► recompra ou assinatura
   │
   └─ assinatura criada ─► boas-vindas ao plano
          ├─ D-5 · D-3 · D-1 ─► automática: aviso │ manual: link para renovar
          ├─ renovou ─► renovação confirmada + créditos do mês
          ├─ recusada ─► D0 · D+1 · D+3 (recuperação) ─► atrasada ─► recuperada / encerrada
          ├─ upgrade ─► novo plano ativo
          ├─ cancelou ─► confirmação + acesso até X ─► D-3 do fim ─► reconquista D+7 · D+30
          └─ reembolso / contestação ─► confirmação e efeito nos créditos
```

---

## 6. Catálogo completo

Legenda:
- **Cat.:** T = transacional · A = aviso de conta · M = marketing (exige consentimento).
- **Prior.:** 1 = fase 1 · 2 = fase 2 · 3 = fase 3.

### 6.1 Entrada e conta

| ID | E-mail | Gatilho | Cat. | Condição para enviar | Botão principal | Prior. |
| --- | --- | --- | --- | --- | --- | --- |
| `welcome` | Boas-vindas + escolha seu caminho | Primeiro login com e-mail confirmado (já existe; vai ser reescrito) | T | Sempre, uma vez | Sem compra: "Escolher meu plano" (página de planos). Com compra: "Criar apresentação" | 1 |
| `onboarding_incomplete` | "Conta pronta, falta só você contar quem é" | 24 h sem perfil escolhido | A | `role` vazio | Completar perfil | 3 |
| `first_deck` | Primeira apresentação criada | Primeira geração com sucesso | T | `generations_count` = 1 | Apresentar ou compartilhar | 2 |
| `terms_updated` | Termos ou Privacidade atualizados | Nova versão em `legal.ts` | A | Todos com conta | Ler o resumo das mudanças | 2 |
| `account_deleted` | Conta excluída | Exclusão concluída | T | Sempre | — | 3 |

### 6.2 Sem compra (nutrição)

Para quando qualquer compra for reconhecida. Só com consentimento.

| ID | Dia | Tema | Assunto (exemplo, perfil Professor) | Botão |
| --- | --- | --- | --- | --- |
| `nurture_d1` | 1 | Primeira apresentação em 1 minuto | "Prof. Fernando, sua próxima aula pode estar pronta em 1 minuto" | Avulso R$ 14,90 |
| `nurture_d3` | 3 | Quanto rende cada opção | "Quantas apresentações cabem no seu bolso?" | Comparar planos |
| `nurture_d5` | 5 | História de uso do perfil | "Como montar uma aula de revisão com IA" | Ver modelos (`/templates`) |
| `nurture_d10` | 10 | Recurso destaque: falas do apresentador e PowerPoint | "Slides + roteiro do que falar: tudo pronto" | Avulso |
| `nurture_d15` | 15 | Objeções: pagamento seguro, 7 dias para desistir, cancele quando quiser | "Sem pegadinha: como funciona o pagamento" | PRO mensal |
| `nurture_d30` | 30 | Último contato + pedido de opinião | "Ainda faz sentido pra você?" (pede resposta por e-mail) | Escolher plano |

Base para "quanto rende cada opção" (`creditos-e-pagamentos.md`):
- uma apresentação de 10 slides custa 120 créditos;
- o avulso tem 500 créditos, ou seja, cerca de 4 apresentações;
- o PRO mensal tem 3.200 créditos por mês mais 800 de bônus na ativação, cerca de 26 apresentações por mês.

### 6.3 Checkout e pagamento pendente

| ID | E-mail | Gatilho (Cakto) | Cat. | Quando | Botão | Prior. |
| --- | --- | --- | --- | --- | --- | --- |
| `pix_pending` | "Seu Pix está te esperando" | `pix_gerado` | A | 10 min depois, se ainda não pago e o Pix não venceu | Pagar com Pix (QR e copia e cola) | 2 |
| `boleto_pending` | "Seu boleto vence amanhã" | `boleto_gerado` | A | D-1 do vencimento, se não pago | Abrir boleto | 2 |
| `checkout_abandoned` | "Ficou alguma dúvida?" | `checkout_abandonment` | M | 1 h e 24 h depois, se não pagou; só para e-mails com conta | Voltar ao checkout (`checkoutUrl`) | 2 |
| `purchase_refused` | "O pagamento não passou, mas dá para tentar de novo" | `purchase_refused` | A | Imediato | Tentar com outra forma de pagamento | 1 |

### 6.4 Compras e assinatura

| ID | E-mail | Gatilho (Cakto) | Cat. | Conteúdo-chave | Botão | Prior. |
| --- | --- | --- | --- | --- | --- | --- |
| `purchase_single` | "500 créditos liberados" | `purchase_approved` (avulso) | T | Saldo atual; quantas apresentações cabem; dica de tema do perfil | Criar apresentação | 1 |
| `subscription_created` | "Boas-vindas ao PRO" (ou MAX) | `subscription_created` / primeira `purchase_approved` | T | Plano, créditos do mês, bônus de ativação, data da próxima renovação, forma de pagamento, se renova sozinho | Criar apresentação | 1 |
| `subscription_upgraded` | "Agora você é MAX" | Troca para um plano superior | T | O que mudou (16.000 créditos por mês, uso justo); bônus não se repete | Criar apresentação | 1 |
| `subscription_downgraded` | "Seu plano foi alterado" | Troca para um plano inferior | T | Nova cota a partir de quando | Ver plano | 3 |
| `renewal_reminder_d5` / `_d3` / `_d1` | Lembrete de renovação | `next_payment_date` (ou `subscription_renews_at`) − 5, 3 e 1 dias | A | **Automática:** data, valor, cartão final; "não precisa fazer nada". **Manual:** data, valor, link de pagamento. **Cancelada:** "seu acesso termina em X" | Automática: Ver plano. Manual: Renovar agora. Cancelada: Reativar | 1 |
| `renewal_success` | "Renovado! Seus créditos do mês chegaram" | `subscription_renewed` / `subscription_late_recovered` | T | Créditos renovados, próxima data, resumo do mês anterior (apresentações criadas) | Criar apresentação | 1 |
| `renewal_refused` | "Não conseguimos renovar seu plano" | `subscription_renewal_refused` | A | Motivo genérico; o acesso continua até o fim do período; quando a Cakto tenta de novo (`retry_interval`, `max_retries`) | Atualizar pagamento ou pagar agora | 1 |
| `subscription_late` | "Seu plano está em atraso" | `subscription_late` | A | O que deixa de funcionar (a cota do mês) e o que continua (bônus, apresentações) | Regularizar | 1 |
| `subscription_late_d3` | "Ainda dá tempo de manter seu plano" | 3 dias depois de `subscription_late`, se não recuperada | A | Lembrete curto | Regularizar | 2 |
| `subscription_reactivated` | "Que bom ter você de volta" | `subscription_resumed` / `late_recovered` após atraso | T | Plano ativo de novo, créditos disponíveis | Criar apresentação | 1 |
| `subscription_paused` | "Assinatura pausada" | `subscription_paused` | T | O que muda enquanto estiver pausada | Retomar | 2 |
| `subscription_canceled` | "Cancelamento confirmado" | `subscription_canceled` | T | Acesso até X; bônus e apresentações ficam; como reativar | Reativar plano | 1 |
| `access_ending_d3` | "Seu acesso termina em 3 dias" | Cancelada, 3 dias antes de `subscription_renews_at` | A | O que muda depois | Reativar | 2 |
| `winback_d7` / `winback_d30` | "Sentimos sua falta" | 7 e 30 dias após o fim do acesso | M | Novidades; resposta com feedback | Voltar para o PRO | 3 |

### 6.5 Reembolso e contestação

| ID | E-mail | Gatilho (Cakto) | Cat. | Conteúdo-chave | Prior. |
| --- | --- | --- | --- | --- | --- |
| `refund_requested` | "Recebemos seu pedido de reembolso" | `refund_requested` | T | Confirmação imediata (Termos, 8.2); prazo; o que acontece com os créditos | 1 |
| `refund_done` | "Reembolso processado" | `refund` | T | Valor; créditos retirados; o estorno no cartão leva até duas faturas; a conta continua existindo | 1 |
| `chargeback` | "Contestação de pagamento registrada" | `chargeback` | T | Formal: plano encerrado e créditos do pedido retirados; canal para resolver; sem acusações | 1 |

### 6.6 Créditos e uso

| ID | E-mail | Gatilho | Cat. | Conteúdo-chave | Prior. |
| --- | --- | --- | --- | --- | --- |
| `credits_low` | "Seus créditos estão acabando" | Depois de uma geração, saldo abaixo de 120 (uma apresentação de 10 slides) | A | Saldo; quanto falta. Avulso: comprar mais ou assinar. Assinante: data da renovação ou upgrade | 2 |
| `credits_monthly_renewed` | "Seus 3.200 créditos do mês chegaram" | Novo ciclo da cota (`ensure_monthly_credits`) | A | Ideias de tema do perfil | 2 |
| `bonus_granted` | "+800 créditos de bônus" | Bônus de ativação ou concedido pelo suporte | T | Permanentes; saldo total | 2 |
| `generation_refunded` | "Tivemos um problema e seus créditos voltaram" | Estorno automático (`stale_timeout` ou falha) | T | Quanto voltou; tentar de novo | 2 |
| `fair_use_80` | "Você já usou 80% do uso justo deste mês" | MAX com 80% da cota | A | Data da renovação | 3 |

### 6.7 Já existentes

Ganham o novo padrão visual e a saudação adaptada:
- Suporte: chamado aberto, encaminhado, respondido e resolvido.
- Portfólio: pedido de acesso e decisão.
- Alertas internos.

---

## 7. Links de pagamento

| Situação | Link |
| --- | --- |
| Primeira compra | Checkout do plano sugerido (`CHECKOUT_URLS` em `src/lib/cakto.ts`), ou a página de planos do app para escolher |
| Renovação manual | 1º: cobrança pendente da Cakto (Pix ou boleto do evento mais recente da mesma assinatura). 2º: `checkoutUrl` da assinatura. 3º: checkout do mesmo plano |
| Recusa e atraso | Portal da Cakto para atualizar o cartão (se houver) ou `checkoutUrl` da assinatura |
| Upgrade | Checkout do MAX no mesmo ciclo (`max_mensal`, `max_trimestral`, `max_anual`) |
| Reativação após cancelamento | Checkout do mesmo plano e ciclo |
| Carrinho abandonado | `checkoutUrl` do próprio evento |

Todos os links levam:
- **UTM** (`utm_source=email&utm_medium=lifecycle&utm_campaign=<id>`), para medir conversão por e-mail;
- se a Cakto aceitar (ver seção 11), **e-mail preenchido no checkout** (`?email=`), para o pagamento cair na conta certa. Hoje esse é o motivo nº 1 de "pagamento sem conta".

---

## 8. Padrão visual dos modelos

Parte da base já publicada (`supabase/functions/_shared/emailTemplates.ts`): cartão branco, faixa em gradiente roxo, logo e rodapé. O que entra de novo:

| Componente | Uso |
| --- | --- |
| **Saudação** | Linha antes do título, adaptada ao perfil (seção 4) |
| **Destaque numérico** | Número grande com rótulo: "5 dias", "500 créditos", "R$ 49,90" |
| **Cartão do plano** | Plano, valor, próxima data, forma de pagamento ("Visa final 4323" ou "Pix") e se renova sozinho |
| **Medidor de créditos** | Barra com saldo e "dá para ~4 apresentações" |
| **Ideias para você** | 2 ou 3 temas do perfil da pessoa, cada um com link para `/gerar?tema=…` (parâmetro novo, que preenche o tema no formulário) |
| **Comparador** | Mini-tabela avulso × PRO × MAX (nutrição D3) |
| **Faixa de garantia** | "Pagamento seguro · Cancele quando quiser · 7 dias para desistir" |
| **Cor de destaque por situação** | Roxo (padrão), verde `#16A34A` (sucesso), âmbar `#D97706` (atenção), vermelho `#DC2626` (recusa ou atraso), sempre com texto, nunca só cor |
| **Rodapé de marketing** | "Você recebe estes e-mails porque aceitou receber dicas do SlideAI. Gerenciar preferências · Descadastrar" |

Todos continuam com versão em texto puro, pré-visualização (`npm run email:preview`) e testes.

### Exemplos de texto

**Boas-vindas, sem compra, Professor**

> Assunto: Boas-vindas ao SlideAI, prof. Fernando ✨
>
> Olá, prof. Fernando! Tudo certo?
>
> Que bom ter você aqui. A partir de um tema, o SlideAI monta o roteiro, escreve os slides, escolhe imagens e ainda prepara as falas. Sua próxima aula pode ficar pronta em cerca de um minuto.
>
> **Para começar, escolha como quer usar:**
> - **Avulso, R$ 14,90:** 500 créditos, cerca de 4 apresentações, sem assinatura.
> - **PRO, R$ 49,90/mês:** 3.200 créditos por mês + 800 de bônus na ativação.
>
> [Escolher meu plano]
>
> Ideias para a sua turma: aula de revisão para a prova · sequência didática da semana · reunião de pais.

**Renovação manual em 5 dias, Estudante, Pix**

> Assunto: Seu PRO vence em 5 dias
>
> Oi, Ana! Tudo bem por aí?
>
> Passando para lembrar que seu **PRO Mensal vence em 5 dias (12/11)**. Como o último pagamento foi por Pix, a renovação não é automática.
>
> **[ 5 dias ]** · PRO Mensal · R$ 49,90 · Pix
>
> Renovando até 12/11, os 3.200 créditos do próximo mês chegam na hora, e seu bônus continua guardado.
>
> [Renovar com Pix]

**Renovação automática em 3 dias, Profissional, cartão**

> Assunto: Sua assinatura renova em 3 dias
>
> Olá, Carla, tudo bem?
>
> Seu **PRO Anual** renova sozinho em **15/11**, no **Visa final 4323**, no valor de R$ 397,90. Não precisa fazer nada.
>
> Mudou de cartão? Atualize antes da data para não perder o ritmo.
>
> [Ver meu plano] · [Atualizar cartão]

**Renovação recusada, Criador**

> Assunto: Não conseguimos renovar seu plano
>
> Oi, Lucas. A renovação do seu **MAX Mensal** não passou no cartão final 1188. Acontece: limite, cartão vencido ou bloqueio do banco.
>
> Seu acesso continua até **20/11**, e a Cakto tenta de novo em 1 dia. Se preferir resolver agora, leva um minuto:
>
> [Atualizar pagamento]

**Nutrição D3, Estudante**

> Assunto: Quantas apresentações cabem no seu bolso?
>
> Oi, Ana! Fizemos as contas: uma apresentação de 10 slides usa 120 créditos.
>
> | Opção | Preço | Rende |
> | --- | --- | --- |
> | Avulso | R$ 14,90 | ~4 apresentações |
> | PRO Mensal | R$ 49,90/mês | ~26 por mês + bônus |
>
> Seminário, TCC ou trabalho em grupo: tem opção para cada fase do semestre.
>
> [Começar com o avulso]

---

## 9. Como funciona por trás

### Dados novos

| Tabela ou campo | Conteúdo |
| --- | --- |
| `profiles.payment_method`, `payment_auto_renew`, `card_brand`, `card_last4`, `next_payment_date` | Gravados pelo webhook a cada evento de pagamento. Só os 4 últimos dígitos, nunca o cartão inteiro |
| `pending_charges` | Pix ou boleto pendente: link, QR, vencimento e assinatura. Removido ao pagar ou vencer |
| `email_preferences` | `marketing_opt_in`, data, origem do consentimento, `reminders` (on/off), `unsubscribed_at` |
| `email_schedule` | Envios agendados: `user_id`, `template`, `send_at`, `dedupe_key`, `status`, `cancel_if` (ex.: `purchased`) |
| `email_events` | Retorno da Resend: entregue, aberto, clicado, devolvido, spam |

### Fluxo

1. **Eventos imediatos** (compra, recusa, reembolso…): o `cakto-webhook` envia na hora pelo `sendPlatformEmail`, que já existe e tem deduplicação.
2. **Eventos agendados** (lembretes D-5/3/1, nutrição, Pix pendente, carrinho):
   - o evento grava em `email_schedule`;
   - o **pg_cron** (já ativo) roda a cada 15 minutos uma função `email-dispatcher`, chamada via `pg_net` com segredo;
   - o dispatcher **reavalia a situação** (comprou? renovou? descadastrou?) e só então envia.
3. **Lembretes de renovação:** uma varredura diária às 9 h (Brasília) agenda D-5, D-3 e D-1 a partir de `next_payment_date`. Assim, uma mudança de data (atraso, renovação antecipada) é respeitada.
4. **Deduplicação:** a chave inclui o período, por exemplo `renewal_reminder:<assinatura>:<data>:d5`. O mesmo lembrete nunca sai duas vezes.

### Regras de envio

- **Horário:** avisos e marketing saem entre **9 h e 20 h** (Brasília). Transacionais saem na hora.
- **Frequência (marketing):** no máximo **1 por dia e 3 por semana**. Se coincidir com um aviso, o marketing fica para o dia seguinte.
- **Prioridade:** recusa ou atraso cancela a nutrição e a reconquista enquanto durar.
- **Supressão:** endereço com erro definitivo ou marcação de spam (via webhook da Resend) não recebe mais nada além de transacional crítico.
- **Contas internas** (admin/dev) não entram na nutrição.

### Medição

Os eventos da Resend (`email_events`) entram no painel `/__dev`, junto com a conversão: compra até 7 dias depois do clique, ligada pela UTM e por `payment_events`.

| Indicador | Meta inicial |
| --- | --- |
| Entrega | ≥ 98% |
| Clique em lembretes de renovação manual | ≥ 15% |
| Recuperação de recusa e atraso | ≥ 40% |
| Conversão da nutrição (30 dias) | ≥ 5% dos cadastros |
| Descadastro por envio de marketing | < 0,5% |
| Marcação de spam | < 0,1% |

---

## 10. Fases

| Fase | Escopo | Resultado |
| --- | --- | --- |
| **1. Receita e confiança** | Campos de pagamento no perfil; `email_schedule` + `email-dispatcher` + cron; novos componentes visuais; `welcome` com escolha de plano; compra avulsa; assinatura criada; upgrade; lembretes D-5/3/1 (automática, manual e cancelada); renovação feita; recusa; atraso; reativação; cancelamento; pedido de reembolso; reembolso; contestação; recusa na primeira compra | Toda mudança de dinheiro tem e-mail, e toda renovação manual tem link |
| **2. Conversão** | Consentimento no cadastro + preferências + descadastro (`List-Unsubscribe`) + Política atualizada; nutrição D1–D30; Pix e boleto pendentes; carrinho abandonado; saldo baixo; créditos do mês; bônus; primeira apresentação; estorno de geração; fim de acesso D-3; webhook da Resend e painel | Quem cadastrou e não comprou é acompanhado com respeito |
| **3. Retenção** | Reconquista D+7/D+30; onboarding incompleto; uso justo 80%; downgrade; pausa; Termos atualizados; testes A/B de assunto | Menos cancelamento, base reativada |

Cada fase vira um PR, com pré-visualização de todos os modelos e testes de: escolha do texto por situação, datas, deduplicação e respeito às preferências.

---

## 11. Decisões do dono (04/10/2026)

| # | Tema | Decisão | Como ficou |
| --- | --- | --- | --- |
| 1 | Pix Automático | Valor `pix_automatico` | `AUTO_RENEW_METHODS` aceita `credit_card` e `pix_automatico` (e os apelidos `pix_auto` e `automatic_pix`, até confirmar com um pagamento real) |
| 2 | E-mail no checkout | A Cakto identifica a compra pelo e-mail digitado no checkout | Todo e-mail com link de pagamento lembra: "use o e-mail da sua conta" |
| 3 | Lembretes da Cakto | Manter os dois | O artigo de ajuda `emails-e-preferencias` explica: o da Cakto é o recibo; o do SlideAI conta o que muda na conta |
| 4 | Consentimento | **Uma única caixa no cadastro** (o aceite dos Termos) | Pela LGPD, consentimento de marketing não pode vir embutido no aceite. Por isso, o relacionamento usa **legítimo interesse** (art. 7º, IX), com descadastro em um clique em todo e-mail, Termos 20.2–20.3 e Política (seção 3, seção 8) atualizados, versão 2026-10-04 e aviso de transparência abaixo da caixa |
| 5 | Remetente do relacionamento | Pessoa do time (Robson, Fernando ou Rebeca) | **Rebeca, do SlideAI** (`SENDERS.relationship`). Avisos e compras saem de "SlideAI". Para trocar o nome, mude `SENDERS` e `RELATIONSHIP_SIGNOFF` em `lifecycleTemplates.ts` |
| 6 | Cupons | Só nos últimos casos, 10% e 20% | **`COMECE10` (10%)** no último e-mail para quem nunca comprou (dia 30) e **`VOLTA20` (20%)** no último e-mail de reconquista (30 dias após o fim da assinatura). **Os dois precisam ser criados no painel da Cakto** |
| 7 | Deploy | Após o reinício dos créditos da Lovable | Ver [../operacao/emails.md](../operacao/emails.md#implantação) |
