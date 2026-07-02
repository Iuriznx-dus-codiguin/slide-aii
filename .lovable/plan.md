# Auditoria Funcional do MVP + Roadmap de Aperfeiçoamentos

## Objetivo
Rodar uma verificação ponta-a-ponta da plataforma (auth → geração → pagamento → visualização → dev mode) para validar prontidão do MVP e, em seguida, entregar um relatório com correções críticas e um roadmap priorizado de melhorias.

---

## Fase 1 — Verificação Funcional (read-only, sem alterar código)

### 1.1 Saúde da infraestrutura
- Checar status do backend (Cloud) e latência.
- Rodar linter do banco (RLS, políticas ausentes, grants).
- Conferir tabelas: `profiles`, `user_roles`, `presentations`, `slides`, `generation_logs`, `payment_events`, `slide_views` — colunas, policies e grants.
- Validar funções: `has_role`, `can_user_generate`, `consume_single_credit`, `handle_new_user`.

### 1.2 Edge Functions
- `generate-presentation`: validação de auth, gate de `can_user_generate`, consumo de crédito, log em `generation_logs`, tratamento do `image_budget_mode`.
- `cakto-webhook`: verificação de secret, idempotência via `payment_events`, atualização correta de `plan`/`single_credits` para os 3 SKUs.
- `chat-editor` e `fetch-image`: schema atualizado, timeouts, tratamento de erro.
- Ler logs recentes de cada função em busca de 4xx/5xx.

### 1.3 Fluxo do usuário (Playwright headless em `localhost:8080`)
- **Landing**: CTAs abrem `/gerar`, SEO/meta tags, JSON-LD válido, sem erros no console.
- **Auth**: signup/login (Google + email), criação de `profiles`, redirect pós-login.
- **Geração**: wizard → configuração → **PaymentGate** trava sem plano → após simular plano, geração roda → salvamento correto de `dynamic_theme`, `presenters_data`, `transition`, `choreography`, `animation_intent`.
- **Viewer** (`/s/:slug`): abre sem tela branca, transições cinematográficas, coreografia per-element, HUD narrativo, fullscreen, atalhos, notas do apresentador, export (PDF/PPTX), print.
- **Editor**: upsert de slides, chat-editor, preview com choreography provider.
- **Dashboard**: `AccountPanel` mostra plano correto, botão gerenciar assinatura.
- **Dev Mode**: rota `/__dev`, atalho `Ctrl+Shift+D`, painel de métricas em tempo real, slider único de teto USD, persistência via `useDevSettings`.

### 1.4 Regras de negócio críticas
- Bloqueio de geração gratuita para não-devs.
- Limite oculto de 20/mês para `mensal`/`anual` retornando `system_error` genérico.
- Consumo correto de `single_credits` após geração no plano avulso.
- Renovação mensal alinhada ao ciclo do plano anual.
- Webhook exige secret; idempotência não duplica créditos em retries.

### 1.5 SEO/Performance
- Validar `sitemap.xml`, `robots.txt`, `llms.txt`.
- JSON-LD (`@graph` WebSite/Organization/FAQPage) sem warnings.
- Lighthouse rápido (LCP, CLS, TBT) na landing e no viewer público.

---

## Fase 2 — Entregável: Relatório de Auditoria

Um documento estruturado no chat com:

1. **Matriz de status** por área (✅ ok / ⚠ ajuste / ❌ bloqueador) com evidência (screenshot, log, query).
2. **Bloqueadores de MVP** — o que impede lançar hoje.
3. **Bugs não-bloqueadores** — resolver na sequência.
4. **Riscos de segurança/dados** — RLS faltando, grants abertos, secrets expostos, race conditions no webhook.

## Fase 3 — Roadmap de Aperfeiçoamentos (priorizado)

Sugestões organizadas em 3 ondas, cada item com escopo, impacto e esforço:

- **Onda 1 — Estabilidade & Confiança (pré-lançamento)**
  Ex.: retry/backoff no webhook, dead-letter para `payment_events` falhos, feature flag server-side para dev mode (hoje é client-side), rate limit por IP na Edge Function de geração, sentry/error tracking, testes vitest para `can_user_generate` e cálculo de custo.

- **Onda 2 — Conversão & Experiência (0–30 dias pós-MVP)**
  Ex.: onboarding com template gratuito para novos usuários (sem consumir crédito), preview animado da geração em progresso, recuperação de apresentação em caso de falha, histórico de versões no editor, share público com senha, analytics de engajamento por slide (`slide_views` → funil).

- **Onda 3 — Diferenciação & Escala (30–90 dias)**
  Ex.: colaboração em tempo real (Realtime channels), branding customizado (logo/cores no plano anual), export de vídeo (.mp4 do deck cinematográfico), API pública para integrações, biblioteca de decks públicos, i18n (EN/ES), cache de imagens Pexels no storage para reduzir chamadas.

---

## Regras de execução
- Somente leitura na Fase 1 (queries SELECT, logs, Playwright headless). Nenhuma migration, deploy ou edição de arquivo.
- Cada finding vem com evidência reproduzível.
- Nenhuma correção é aplicada nesta rodada — o output é o relatório + roadmap. Correções entram em planos separados aprovados individualmente.

## Detalhes técnicos
- Ferramentas: `supabase--read_query`, `supabase--linter`, `supabase--edge_function_logs`, `code--view`, Playwright via shell, `websearch` p/ validar JSON-LD/Rich Results se necessário.
- Credenciais de teste: sessão do usuário dev (`iuri.ads.money.gm@gmail.com`) já injetada via `LOVABLE_BROWSER_SUPABASE_*` quando aplicável.
- Sem tocar em `src/integrations/supabase/client.ts`, `types.ts`, `.env`, `supabase/config.toml`.
