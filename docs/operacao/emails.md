# E-mails da plataforma

O SlideAI envia e-mails por dois caminhos, ambos com o domínio `slideai.com.br`:

| Caminho | E-mails | Onde está o modelo |
| --- | --- | --- |
| **Login da Lovable Cloud** (domínio de envio próprio) | Confirmação de cadastro, redefinição de senha, link mágico, convite, troca de e-mail, código de reautenticação | Modelos de autenticação da Lovable Cloud (Cloud → Emails), com a identidade descrita abaixo |
| **Resend** (conector da Lovable) | Boas-vindas, suporte (chamado aberto, encaminhado, respondido, resolvido), portfólio (pedido e decisão de acesso) e alertas internos | `supabase/functions/_shared/emailTemplates.ts` (modelos) e `email.ts` (envio) |

Os e-mails de pagamento (compra, renovação, reembolso) são enviados pela **Cakto** e não passam pelo SlideAI.

## Envio pela Resend

- Remetente `SlideAI <contato@slideai.com.br>`; respostas vão para `suporte@slideai.com.br` (o atendimento dos Termos, `src/lib/legal.ts`). **A caixa `suporte@` precisa existir e ser lida.**
- Secrets: `RESEND_API_KEY` e `LOVABLE_API_KEY` (o conector da Lovable cria os dois).
- Todo envio passa por `email_log` com `dedupe_key` única: o mesmo evento nunca gera dois e-mails.
- O destinatário é sempre resolvido no servidor (`send-email`, `support-chat`, alertas). O navegador só informa o evento e o id do registro.
- Cada e-mail sai em HTML e em texto puro.

| Evento | Quem dispara | Destinatário |
| --- | --- | --- |
| `welcome` | `useAuth`, no primeiro login com e-mail confirmado | A própria pessoa |
| `ticket_opened`, `ticket_escalated` | `support-chat` | Quem abriu o chamado |
| `support_reply` | `AdminSupport` → `send-email` (só admin/dev) | Dono do chamado |
| `access_requested`, `access_decided` | `PublicProfile` / `Profile` → `send-email` | Dono do portfólio / quem pediu |
| `ops_alert` | `_shared/opsAlerts.ts` | Contas `admin` e `OPS_ALERT_EMAILS` |
| Avisos de ciclo de vida (compra, assinatura, renovação, cobrança, reembolso, nutrição, reconquista…) | `cakto-webhook` (na hora) e `email-dispatcher` (agendados) | A própria pessoa |

## Avisos de ciclo de vida

Plano completo, catálogo e tom: [../produto/plano-de-avisos-por-email.md](../produto/plano-de-avisos-por-email.md).

| Peça | Papel |
| --- | --- |
| `_shared/lifecycleTemplates.ts` | Modelos por situação, saudação pelo perfil, remetentes, cupons, formas de pagamento que renovam sozinhas |
| `_shared/lifecycleRules.ts` | Reavaliação no envio (`shouldSend`), horário (9 h–20 h) e frequência (1/dia, 3/semana) do relacionamento |
| `_shared/lifecycle.ts` | Monta a situação da conta, envia (`sendLifecycle`) e agenda (`scheduleLifecycle`) |
| `cakto-webhook` | Grava forma de pagamento e próxima cobrança (`billing_profiles`), Pix/boleto pendentes (`pending_charges`), envia os avisos do evento e agenda Pix/boleto pendente e carrinho abandonado |
| `plan_lifecycle_emails()` | Planejador SQL: nutrição (dias 1, 3, 5, 10, 15 e 30), lembretes de renovação (5/3/1), atraso (D+3), reconquista (D+7, D+30), primeira apresentação, saldo baixo, estorno de geração |
| `email-dispatcher` | Chamado pelo pg_cron a cada 10 min (job `slideai-email-dispatch`, via pg_net, com o segredo `email_dispatch_secret` do Vault): roda o planejador e envia o que venceu |
| `email-unsubscribe` + `/emails/preferencias` | Descadastro em um clique (`List-Unsubscribe-Post`) e página de preferências pelo token do link |
| Perfil → Conta → E-mails | Preferência da própria conta (`get_my_email_preferences`/`set_my_email_preferences`) |

Só os e-mails de **relacionamento** (`nurture`, `checkout_abandoned`, `winback`) respeitam o descadastro e saem em nome da Rebeca. Contas `admin`/`developer` não recebem relacionamento.

### Implantação

Prompt pronto para a Lovable: [deploy-avisos-por-email.md](deploy-avisos-por-email.md).

1. Migrações `0008_lifecycle_emails.sql` e `0009_help_center_emails.sql` (cópias em `supabase/migrations/20261004000300_*` e `20261004000400_*`).
2. Funções: `email-dispatcher` e `email-unsubscribe` (novas, `verify_jwt = false` em `supabase/config.toml`), `cakto-webhook`, `send-email`, `support-chat`, `generate-presentation`.
3. Criar na Cakto os cupons `COMECE10` (10%) e `VOLTA20` (20%).
4. Conferir: `select jobname, schedule from cron.job;` (deve ter `slideai-email-dispatch`), `select * from email_schedule order by created_at desc limit 20;` e `select net._http_response` (respostas do pg_net) se nada sair.

### Mudar ou criar um modelo

1. Edite `buildEmail` em `supabase/functions/_shared/emailTemplates.ts` (suporte, portfólio, alertas) ou o modelo em `lifecycleTemplates.ts` (ciclo de vida). Os blocos aceitam `p`, `quote`, `list`, `steps`, `rows`, `note`, `stat`, `card`, `meter`, `ideas`, `compare`, `coupon` e `guarantee`; texto é sempre escapado, e `**negrito**` é a única marcação.
2. Inclua um exemplo em `scripts/email-preview.ts`.
3. Rode `npm run email:preview` e abra `.email-previews/*.html` no navegador (largura de celular também).
4. `npm test` cobre renderização, escape e links.
5. Implante as funções que usam o módulo: `send-email`, `support-chat`, `cakto-webhook`, `generate-presentation` e `email-dispatcher`.

## Identidade visual (vale para os dois caminhos)

| Elemento | Valor |
| --- | --- |
| Fundo da página | `#F5F3FF` |
| Cartão | branco, borda `#E9E6FB`, cantos de 16 px, faixa de 4 px no topo em gradiente `#6C47FF` → `#C251FB` |
| Logo | `https://slideai.com.br/email-logo.png` (96 px, exibido a 32 px) + "SlideAI" em negrito |
| Título | 22 px, `#17172B`, peso 700 |
| Texto | 15 px / 24 px, `#3F3F5C`; notas em 13 px `#7A7A96` |
| Botão | fundo `#6C47FF` com gradiente para `#C251FB`, texto branco 15 px, cantos de 10 px, com o endereço do link escrito embaixo |
| Fonte | pilha do sistema (`-apple-system, Segoe UI, Roboto, Helvetica, Arial`) |
| Rodapé | motivo do e-mail, "Dúvidas? Responda este e-mail ou acesse a Central de Ajuda", links para Termos e Privacidade |
| Idioma | português do Brasil, segunda pessoa ("você"), frases curtas |

## Modelos de autenticação (Lovable Cloud)

Textos aprovados. As variáveis entre chaves são as do sistema de login.

**Confirmação de cadastro**
- Assunto: `Confirme seu e-mail no SlideAI`
- Prévia: `Falta um passo para criar suas apresentações.`
- Título: `Confirme seu e-mail`
- Texto: `Recebemos o cadastro de {email} no SlideAI. Confirme que o endereço é seu para ativar a conta.`
- Botão: `Confirmar e-mail` → `{confirmation_url}`
- Nota: `Se você não criou esta conta, ignore este e-mail: nada será ativado.`

**Redefinição de senha**
- Assunto: `Redefina sua senha do SlideAI`
- Prévia: `Use o link para criar uma nova senha.`
- Título: `Redefinir senha`
- Texto: `Recebemos um pedido para redefinir a senha da conta {email}.`
- Botão: `Criar nova senha` → `{confirmation_url}`
- Nota: `O link expira em pouco tempo e só pode ser usado uma vez. Se você não pediu, ignore este e-mail: sua senha continua a mesma.`

**Link mágico (entrar sem senha)**
- Assunto: `Seu link de acesso ao SlideAI`
- Prévia: `Entre na sua conta com um clique.`
- Título: `Entrar no SlideAI`
- Texto: `Use o botão abaixo para entrar na conta {email}.`
- Botão: `Entrar` → `{confirmation_url}`
- Nota: `O link expira em pouco tempo e só pode ser usado uma vez. Se você não pediu, ignore este e-mail.`

**Convite**
- Assunto: `Você foi convidado para o SlideAI`
- Prévia: `Aceite o convite e crie sua senha.`
- Título: `Você recebeu um convite`
- Texto: `Você foi convidado a criar uma conta no SlideAI com o e-mail {email}.`
- Botão: `Aceitar convite` → `{confirmation_url}`
- Nota: `Se não esperava este convite, ignore este e-mail.`

**Troca de e-mail**
- Assunto: `Confirme seu novo e-mail no SlideAI`
- Prévia: `Confirme a alteração do e-mail da sua conta.`
- Título: `Confirme o novo e-mail`
- Texto: `Recebemos um pedido para trocar o e-mail da sua conta de {email} para {new_email}.`
- Botão: `Confirmar troca` → `{confirmation_url}`
- Nota: `Se não foi você, não clique no link e altere sua senha. Fale com o suporte se precisar de ajuda.`

**Código de reautenticação**
- Assunto: `Seu código de verificação do SlideAI`
- Prévia: `Use o código para confirmar a operação.`
- Título: `Código de verificação`
- Texto: `Use o código abaixo para confirmar a operação na sua conta.`
- Código em destaque: `{token}` (28 px, espaçado, fundo `#F3F0FF`)
- Nota: `O código expira em poucos minutos. Se você não pediu, altere sua senha.`

Todos com o mesmo rodapé: `Você recebeu este e-mail por causa de uma ação na sua conta SlideAI.` + Central de Ajuda, Termos e Privacidade.
