# Arquitetura

## Visão geral

```
Navegador (React + Vite)
 ├─ Páginas públicas: início, preços, /ajuda, /termos, /privacidade, /slides/:slug, /u/:username
 ├─ Área logada: /gerar, /dashboard, /editor/:slug, /perfil, /suporte
 │    └─ LegalConsentGate: aceite da versão vigente dos documentos + registro de acesso
 │
 ├──► Supabase (Lovable Cloud)
 │     ├─ Auth (e-mail/senha e Google)
 │     ├─ PostgreSQL com RLS (dados, créditos, conteúdo)
 │     ├─ Storage (avatares e ativos)
 │     └─ Realtime (saldo e plano atualizados sem recarregar)
 │
 └──► Edge Functions (Deno)
       ├─ generate-presentation ──► OpenAI / Gemini, Pexels
       ├─ fetch-image, chat-editor, regenerate-speeches, support-chat
       ├─ cakto-webhook ◄── Cakto (pagamentos)
       ├─ og-preview (prévia de links)
       └─ mcp (aplicativos conectados via OAuth)
```

## Fluxos principais

### Geração de apresentação

1. O formulário (`src/pages/Generate.tsx`) calcula o custo com `estimateCreditsCost` e consulta o acesso com `useEntitlement` (espelho de `can_user_generate`).
2. `generate-presentation` valida a entrada, chama `can_user_generate(_uid, custo)`, aplica o limite de frequência (12/h) e **debita** com `charge_generation` antes de chamar a IA. O débito e a tentativa (`generation_attempts`) são gravados na mesma transação.
3. O motor v2 planeja a narrativa e as cenas, gera o conteúdo, grava a apresentação e os slides no servidor e devolve o `slug`.
4. Qualquer falha depois do débito passa por `failGeneration`, que estorna com `refund_generation_credits` (idempotente por tentativa) e registra em `generation_logs`. Se a função cair sem responder, `refund_stale_generations` estorna a tentativa depois de 10 minutos.
5. As imagens são resolvidas aos poucos no editor (`useProgressiveAssets` + `fetch-image`).

### Pagamento

1. O `PaymentGate` mostra os planos e o **resumo do contrato** (`ContractSummary`) e abre o checkout da Cakto.
2. A Cakto chama `cakto-webhook` com o segredo compartilhado. O evento é registrado em `payment_events`, com idempotência por evento + pedido.
3. Compra aprovada: plano/assinatura ativados, cota mensal definida, bônus creditado. Reembolso: estorno só do que o pedido concedeu (`revoke_order_credits`). Cancelamento: `subscription_status = canceled`, com o acesso mantido até `subscription_renews_at`.
4. O front recebe a mudança via Realtime e libera a geração.

Regras completas: [creditos-e-pagamentos.md](creditos-e-pagamentos.md).

### Conformidade

- **Aceite:** o cadastro por e-mail exige marcar o aceite (a versão vai nos metadados da conta). No primeiro acesso autenticado, `accept_legal_terms` registra versão, data/hora, IP e navegador **do lado do servidor**. Login pelo Google e contas antigas veem o diálogo de aceite.
- **Registros de acesso (Marco Civil, art. 15):** `record_access()` a cada sessão, com deduplicação de 30 minutos por IP. A tabela `access_logs` não tem política de RLS: só o servidor lê.
- **Retenção:** `purge_expired_data()` roda no máximo uma vez por dia, disparada por `record_access` (`run_data_retention_if_due`). Os prazos seguem a Política de Privacidade.

## Banco de dados

### Tabelas principais

| Tabela | Conteúdo | Acesso (RLS) |
| --- | --- | --- |
| `profiles` | Perfil, plano, assinatura, créditos | Dono; campos de cobrança protegidos por gatilho (`protect_billing_columns`) |
| `presentations`, `slides` | Apresentações e slides | Dono; leitura pública se publicada e fora da lixeira |
| `credit_transactions` | Extrato de créditos | Dono (leitura); escrita só por funções |
| `payment_events` | Eventos da Cakto | Somente servidor |
| `generation_logs` | Telemetria de geração | Somente servidor e equipe |
| `slide_views` | Visitas a apresentações publicadas (data e navegador) | Inserção pública em apresentação publicada; leitura do dono |
| `support_conversations`, `support_messages` | Atendimentos | Dono e equipe |
| `help_articles`, `error_catalog` | Central de Ajuda e catálogo de erros | Leitura pública; escrita da equipe |
| `legal_acceptances` | Aceites dos Termos/Política | Dono lê os próprios; escrita só por `accept_legal_terms` |
| `access_logs` | Registros de acesso (IP, data, hora) | Somente servidor |
| `security_events`, `error_occurrences`, `edge_rate_limits` | Segurança, erros e limites | Servidor e equipe |
| `generation_attempts` | Tentativas de geração cobradas e seu desfecho | Somente servidor |
| `ops_alerts` | Alertas operacionais enviados à equipe | Servidor; leitura da equipe |
| `email_log` | E-mails enviados (um por evento, pela chave única) | Somente servidor |

### Funções SQL de negócio

| Função | Papel |
| --- | --- |
| `can_user_generate(_uid, _credits_cost)` | Decide o acesso (dev, assinatura vigente, avulso, bônus, uso justo). Clientes só consultam a própria conta |
| `subscription_is_current(plan, status, renews_at)` | Assinatura ativa ou cancelada dentro do período pago |
| `consume_credits`, `ensure_monthly_credits` | Débito (cota mensal primeiro) e renovação da cota por ciclo |
| `charge_generation` | Débito de uma geração + registro da tentativa, na mesma transação |
| `refund_generation_credits` | Estorno idempotente por tentativa de geração (usa o débito da própria tentativa) |
| `refund_stale_generations(_if_due)` | Estorno das tentativas sem desfecho há mais de 10 minutos (pg_cron e `record_access`) |
| `set_monthly_credits`, `grant_bonus_credits(_once)`, `revoke_order_credits` | Operações do webhook de pagamento |
| `add_ai_edit_usage` | Contador do assistente de edição (servidor) |
| `accept_legal_terms`, `record_access`, `purge_expired_data` | Conformidade legal |

Funções de cobrança são `SECURITY DEFINER` e executáveis apenas pelo `service_role`, exceto as marcadas como de cliente (`can_user_generate`, `accept_legal_terms`, `record_access`).

## Segurança

- RLS em todas as tabelas; campos de cobrança e contadores de IA protegidos por gatilhos.
- Webhook autenticado por segredo, com idempotência por evento + pedido e revisão manual em reembolsos ambíguos.
- Limites de frequência por conta e por IP nas funções caras.
- Captura de erros no front com allowlist de chaves e remoção de e-mails, tokens e senhas (`src/lib/errorCapture.ts`).
- Cabeçalhos de segurança em `public/_headers`.

## Observabilidade

- `generation_logs`: latência, modelo, custo estimado/real, créditos cobrados e estornos.
- `security_events`: limites atingidos, acessos negados, segredo inválido do webhook, reembolsos para revisão.
- `error_occurrences` + `error_catalog`: erros com código, ligados aos artigos de ajuda e ao assistente de suporte.
- `ops_alerts`: alertas por e-mail aos administradores (pagamento, falhas de geração, estornos). Tipos e respostas em [operacao/runbooks.md](operacao/runbooks.md#alertas).
- Painéis: `/__dev` (equipe) e `/admin/suporte`.

## E-mails

E-mails de cadastro, confirmação e senha saem pelo sistema de login da Lovable Cloud; os demais (boas-vindas, suporte, portfólio e alertas) pela Resend, a partir de `supabase/functions/_shared/email.ts`. Detalhes em [operacao/emails.md](operacao/emails.md).
