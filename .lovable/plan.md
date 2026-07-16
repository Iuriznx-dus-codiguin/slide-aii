# Sistema de Suporte Inteligente + Catálogo de Erros

Escopo grande. Proponho executar em 4 etapas incrementais, cada uma entregável e testável. Confirme antes de eu começar.

## Visão geral da arquitetura

```text
┌─ Frontend ──────────────────────────────┐    ┌─ Backend (Edge Functions) ──┐
│ ErrorBoundary global                    │    │ support-chat (OpenAI)       │
│ captureError() helper                   │───▶│ log-error (persistência)    │
│ Widget de Suporte (chat flutuante)      │    │                             │
│ /admin/suporte (painel)                 │    │                             │
└─────────────────────────────────────────┘    └──────────────┬──────────────┘
                                                              │
                                          ┌───────────────────▼──────────────┐
                                          │ Tabelas:                          │
                                          │  error_catalog                    │
                                          │  error_occurrences                │
                                          │  support_conversations            │
                                          │  support_messages                 │
                                          └───────────────────────────────────┘
```

## Etapa 1 — Fundação (banco + catálogo inicial)

Auditoria dos módulos existentes (autenticação, generate-presentation, cakto-webhook, chat-editor, fetch-image, entitlements, roles, exports) para popular o catálogo real.

**Migração cria:**
- `error_catalog` — code (PK, ex: `AUTH-001`), title, tech_description, user_description, severity (critical/high/medium/low/info), module, flow, probable_causes[], resolution_steps[], ai_can_resolve, related_codes[], version
- `error_occurrences` — occurrence_id, user_id, session_id, request_id, error_code, route, context (jsonb sem PII), stack_summary, status (open/investigating/resolved/reopened), created_at
- `support_conversations` — conversation_id, ticket_id (nullable), user_id, state (open/diagnosing/awaiting_user/resolved/escalated/closed), related_occurrence_id, rating (1-5), created_at
- `support_messages` — conversation_id, role (user/assistant/system), content, code_ref, created_at

RLS estrito: usuário só vê os próprios dados; admin/developer via `has_role()` vê tudo.
GRANTs para authenticated/service_role. Rate limit reaproveitando `check_rate_limit`.

Seed do catálogo com ~30 códigos reais extraídos da auditoria (AUTH-*, PAY-*, GEN-*, DB-*, WHK-*, INT-*, UI-*, SEC-*).

## Etapa 2 — Captura e correlação

- `src/lib/errorCapture.ts` — `captureError(err, {code?, context?})` que insere em `error_occurrences` e retorna `occurrence_id`.
- `src/components/ErrorBoundary.tsx` — captura falhas de render, mostra fallback com o código para o usuário citar.
- Wrapper em `supabase` client + `fetch` para padronizar erros de rede/RLS.
- Helper `edgeError()` reusado por todas as edge functions (cakto-webhook, generate-presentation, chat-editor, fetch-image) com try/catch e log via service role. Sem PII em `context`.

## Etapa 3 — Chatbot de suporte (OpenAI)

- Edge function `support-chat`:
  - Recebe `{conversation_id, message, user_id}`
  - Carrega histórico + últimas ocorrências do usuário + catálogo compacto (title+code+user_description)
  - System prompt: dois papéis (guia de uso + diagnóstico), regra de "1 pergunta se ambíguo", nunca inventar, se não achar → criar occurrence "uncatalogued" e escalar
  - Modelo: `openai/gpt-5.5` via Lovable AI Gateway (usa `LOVABLE_API_KEY` já configurada — a OpenAI API key existente fica como fallback opcional)
  - Persiste mensagens, atualiza state da conversa, faz escalation quando `severity=critical` ou `ai_can_resolve=false`
  - Rate limit via `check_rate_limit`
- Widget `<SupportWidget/>` flutuante em todas as páginas autenticadas: chat, exibe código do erro quando relevante, botão "avaliar atendimento" no fim.

## Etapa 4 — Painel admin + KPIs

- Rota `/admin/suporte` (guard: admin/developer) com abas:
  - **Ocorrências** — filtro por código/severidade/status, detalhe individual, marcar resolved/reopened/investigating
  - **Catálogo** — CRUD inline (edita título, user_description, steps sem redeploy)
  - **Não catalogados** — fila de ocorrências sem `error_code`, ação "promover ao catálogo"
  - **Conversas** — histórico, escalations abertas
  - **KPIs** — % resolvido pela IA vs humano, tempo médio resolução, top-10 códigos, satisfação média

## Segurança/governança
- RLS em todas as tabelas novas + GRANTs corretos
- Contexto de erro sanitizado (sem tokens/emails/payloads brutos)
- Escalation automática para: severity=critical, security incidents, pagamentos, falha em `ai_can_resolve=false`
- Rate limit 30 msg/hora/usuário no support-chat

## Ordem de execução sugerida
Vou executar Etapa 1 primeiro (migração + seed do catálogo). Após aprovar a migração e eu regenerar os types, sigo Etapa 2 → 3 → 4 em respostas sequenciais.

**Confirma que posso começar pela Etapa 1?**
