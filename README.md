# SlideAI

Plataforma brasileira que cria apresentações profissionais com inteligência artificial. O usuário descreve o tema; o SlideAI escreve o roteiro, monta os slides com layout, imagens, gráficos e animações, e entrega um editor completo, modo apresentação, exportação (PowerPoint, PDF, PNG) e publicação por link.

Produção: <https://slideai.com.br> · Central de Ajuda: [/ajuda](https://slideai.com.br/ajuda) · [Termos de Uso](https://slideai.com.br/termos) · [Política de Privacidade](https://slideai.com.br/privacidade)

## Sumário

- [Arquitetura](#arquitetura)
- [Rodando localmente](#rodando-localmente)
- [Testes e verificações](#testes-e-verificações)
- [Banco de dados e migrações](#banco-de-dados-e-migrações)
- [Edge functions e segredos](#edge-functions-e-segredos)
- [Publicação (deploy)](#publicação-deploy)
- [Documentação](#documentação)

## Arquitetura

| Camada | Tecnologia | Onde |
| --- | --- | --- |
| Front-end | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Framer Motion | `src/` |
| Back-end | Lovable Cloud (Supabase): PostgreSQL com RLS, Auth, Storage, Realtime | `supabase/`, `drizzle/` |
| Funções de servidor | Deno (Supabase Edge Functions) | `supabase/functions/` |
| IA | OpenAI e Google Gemini (direto ou pelo gateway de IA da Lovable) | `supabase/functions/_shared/modelRegistry.ts` |
| Imagens | Pexels + geração por IA | `supabase/functions/fetch-image/` |
| Pagamentos | Cakto (checkout + webhook) | `src/lib/cakto.ts`, `supabase/functions/cakto-webhook/` |

Visão detalhada, fluxos e decisões: [docs/arquitetura.md](docs/arquitetura.md).

## Rodando localmente

Requisitos: Node 20+ (ou Bun).

```sh
npm install        # ou: bun install
npm run dev        # http://localhost:8080
```

O front usa o projeto Lovable Cloud configurado em `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`). As edge functions rodam na nuvem; para testá-las localmente é preciso o Supabase CLI com os segredos da seção [Edge functions e segredos](#edge-functions-e-segredos).

## Testes e verificações

```sh
npm test           # vitest (unitários e paridade de catálogos)
npm run lint       # eslint
npm run build      # build de produção
```

Suítes que protegem regras de negócio e conformidade:

| Suíte | O que garante |
| --- | --- |
| `src/test/entitlement.test.ts` | Regra de acesso igual à do banco (`can_user_generate`): cancelamento vale até o fim do período, bônus permanente, uso justo do MAX |
| `src/test/caktoWebhook.test.ts` | Webhook de pagamento: idempotência, escopo do reembolso, eventos ignorados |
| `src/test/helpCenterContent.test.ts` | Central de Ajuda publicada = arquivos `.md`; nenhum link quebrado; valores de preço e custo corretos |
| `src/test/catalogParity.test.ts` | Paridade de catálogos entre o motor (Deno) e o renderizador (Vite) |

Os dois `*.e2e.test.ts` dependem de variáveis de ambiente de um projeto real.

## Banco de dados e migrações

- As migrações aplicadas pela Lovable Cloud ficam em `drizzle/migrations/` (com `meta/_journal.json`). O histórico anterior está em `supabase/migrations/` (uma cópia de cada migração nova é mantida lá).
- Toda migração deve ser **idempotente** (`CREATE … IF NOT EXISTS`, `CREATE OR REPLACE`, `ON CONFLICT`).
- A tabela de conteúdo `help_articles` é gerada a partir de `docs/central-de-ajuda/artigos` — veja [docs/central-de-ajuda/README.md](docs/central-de-ajuda/README.md).

Modelo de dados, RLS e funções: [docs/arquitetura.md](docs/arquitetura.md#banco-de-dados).

## Edge functions e segredos

| Função | Papel |
| --- | --- |
| `generate-presentation` | Gera a apresentação (motor v2), cobra e estorna créditos, persiste o deck |
| `fetch-image` | Busca fotos (Pexels) e gera imagens por IA sob cota |
| `chat-editor` | Assistente de edição (limite por apresentação) |
| `regenerate-speeches` | Regera as falas dos apresentadores (só com falas pagas) |
| `cakto-webhook` | Recebe eventos da Cakto: compra, renovação, cancelamento, reembolso |
| `support-chat` | Assistente de suporte com escalonamento para a equipe |
| `og-preview` | Prévia de links publicados para redes sociais |
| `mcp` | Servidor MCP para aplicativos conectados via OAuth (gerado) |

Segredos (configurados em Lovable Cloud → Secrets; **nunca** no repositório): `LOVABLE_API_KEY`, `OPENAI_API_KEY`, `PEXELS_API_KEY`, `CAKTO_WEBHOOK_SECRET`, `IMAGE_MODEL_PRIMARY` e `IMAGE_MODEL_ECONOMY` (opcionais), `SUPPORT_ALERT_WEBHOOK_URL` (opcional). As variáveis `SUPABASE_*` são injetadas pela plataforma.

## Publicação (deploy)

1. PR revisado e mesclado na `main`.
2. A Lovable sincroniza o código do front automaticamente.
3. Migrações novas e deploy das edge functions alteradas são aplicados pela Lovable (ou manualmente, rodando o SQL do arquivo, sem editar).
4. Conferência pós-deploy: [docs/operacao/runbooks.md](docs/operacao/runbooks.md#checklist-pós-deploy).

## Documentação

Índice completo em [docs/README.md](docs/README.md): arquitetura, créditos e pagamentos, conformidade legal (LGPD, termos e runbooks do titular e de incidentes), operação e Central de Ajuda.
