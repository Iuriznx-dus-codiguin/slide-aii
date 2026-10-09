# Dados da auditoria de segurança do SlideAI (fonte do relatório em PDF).
#
# Tudo aqui foi verificado no código do commit auditado, no histórico git
# completo e, em modo somente leitura, no banco de produção. Valores de
# segredos NUNCA entram neste arquivo: segredos aparecem só como "[oculto]" ou
# pela impressão (SHA-256 truncado em 12 caracteres), que é o mesmo formato que
# o próprio servidor registra em security_events.
#
# Regerar o PDF: python gerar_relatorio.py  (ver README.md nesta pasta).

PROJETO = "SlideAI"
DATA = "09/10/2026"
COMMIT = "4890504 (main)"
REPOSITORIO = "github.com/Iuriznx-dus-codiguin/slide-aii (público)"

SEVERIDADES = ["crítica", "alta", "média", "baixa", "informativa"]
CORES = {
    "crítica": "#B91C1C",
    "alta": "#EA580C",
    "média": "#D97706",
    "baixa": "#2563EB",
    "informativa": "#6B7280",
    "ponto forte": "#059669",
}

CATEGORIAS = {
    1: "Banco sem tranca",
    2: "Permissão no navegador",
    3: "IDOR",
    4: "Chaves expostas",
    5: "XSS / inputs sem tratamento",
}

STACK = [
    ("Linguagens", "TypeScript (front e edge functions), SQL (PostgreSQL / PL/pgSQL)"),
    ("Frontend", "React 18 + Vite, Tailwind/shadcn-ui, React Router, TanStack Query, Supabase JS"),
    ("Backend", "11 Supabase Edge Functions (Deno) + RPCs PostgreSQL (SECURITY DEFINER)"),
    ("Banco / ORM", "PostgreSQL (Supabase via Lovable Cloud); migrações SQL em supabase/migrations "
                    "(42) e drizzle/migrations (10, drizzle-kit); acesso via PostgREST e supabase-js — sem ORM em runtime"),
    ("Autenticação", "Supabase Auth (JWT); papéis em user_roles (admin, developer, user) via has_role(); "
                     "OAuth para agentes MCP"),
    ("Isolamento", "Row Level Security (RLS) por auth.uid(); service role nas edge functions com "
                   "filtro manual por user_id; triggers que travam colunas de faturamento"),
    ("Integrações", "Cakto (webhook de pagamento), Resend (e-mail), OpenAI e gateway de IA da Lovable, Pexels"),
    ("Deploy", "Lovable Cloud (sincronização com o GitHub). Não há Docker, docker-compose, CI, "
               "Helm nem Terraform no repositório"),
]

METODOLOGIA = [
    (1, "Banco sem tranca",
     "O mecanismo de isolamento é RLS + triggers. Listei no banco de produção as 29 tabelas do schema public "
     "(RLS e grants por papel), as 37 políticas, os 2 buckets e 4 políticas do Storage, as 22 funções "
     "executáveis por anon/authenticated e os triggers. Nas 11 edge functions que usam service role "
     "(que ignora RLS), conferi se toda consulta filtra pelo usuário autenticado."),
    (2, "Permissão no navegador",
     "Localizei todos os gates de papel do front (useDeveloperRole, isDeveloper, isAdmin, useEntitlement) "
     "e cruzei cada escrita das telas protegidas (AdminSupport, DevDashboard, DevModePanel, Generate) com a "
     "política RLS ou a checagem de papel da edge function correspondente. Incluí privilégios pagos "
     "decididos pelo cliente."),
    (3, "IDOR",
     "Percorri todos os handlers das 11 edge functions (inclusive cada evento de send-email, cada fluxo de "
     "support-chat e as 5 ferramentas do MCP) e as RPCs que recebem IDs, verificando se o objeto pertence "
     "ao chamador antes de ler, alterar ou apagar."),
    (4, "Chaves expostas",
     "git grep com 12 padrões de segredo na árvore, varredura do histórico completo (708 commits), "
     "decodificação dos JWTs do .env e do bundle (dist/), busca por defaults do tipo env ?? \"literal\", "
     "docs, scripts e migrações. Impressões de valores suspeitos comparadas com as registradas pelo servidor."),
    (5, "XSS / inputs sem tratamento",
     "Front: dangerouslySetInnerHTML, innerHTML, document.write, eval/new Function, iframes, href/src "
     "dinâmicos, window.location e os 2 renderizadores de markdown (configuração de sanitização conferida no "
     "pacote). Back: HTML de e-mails (emailTemplates.ts) e da página de preview (og-preview)."),
]

# ---------------------------------------------------------------------------
# Achados. "evidencias": lista de (arquivo:linha, trecho). "issue": número da
# issue do GitHub que cobre o achado (None = informativo sem issue própria).
# ---------------------------------------------------------------------------
ACHADOS = [
    {
        "id": "A1", "categoria": 1, "severidade": "alta", "issue": 1,
        "titulo": "E-mail do perfil é editável pelo usuário e decide quem recebe o pagamento da Cakto",
        "resumo": "profiles.email pode ser alterado pelo próprio usuário; o webhook da Cakto credita a compra "
                  "ao primeiro perfil com aquele e-mail.",
        "evidencias": [
            ("supabase/migrations/20260419011055_21b30c1d-4d93-4844-bbdf-d4be80e96700.sql:16",
             'CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);'),
            ("supabase/migrations/20260827000346_68e8e98f-500b-4310-8345-f07ef89f505f.sql:206-224",
             "protect_billing_columns() trava plan, subscription_*, credits_*, cakto_* — a coluna email não está na lista"),
            ("supabase/functions/cakto-webhook/index.ts:134-137",
             'const { data: profile } = await admin\n  .from("profiles").select("id").ilike("email", escapeLike(email)).maybeSingle();\nif (profile?.id) { userId = profile.id; }'),
            ("Banco (pg_indexes)", "profiles_email_lower_idx ON profiles (lower(email)) — índice NÃO único"),
            ("supabase/functions/_shared/lifecycle.ts:32 · supabase/functions/send-email/index.ts:62, 74, 86",
             "let email = (p.email ?? \"\").trim();   // e-mails da plataforma vão para profiles.email"),
        ],
        "exploravel": "Com a chave anon (pública) e a própria sessão, supabase.from('profiles').update({ email: "
                      "'vitima@empresa.com' }).eq('id', meuId) passa pela RLS e pelo trigger. Quando a vítima "
                      "compra com esse e-mail, o webhook encontra o perfil do atacante e libera nele o plano ou os créditos.",
        "condicoes": "O e-mail da compra não pode estar em outro perfil: com dois perfis iguais o maybeSingle falha e o "
                     "webhook cai em auth.users, que resolve a vítima. Vale para quem compra antes de criar a conta ou "
                     "com outro e-mail. É um ataque direcionado: o atacante precisa saber o e-mail com antecedência.",
        "impacto": "Desvio de compras e assinaturas (prejuízo direto ao cliente e chargeback para o SlideAI). "
                   "Os e-mails da conta do atacante (boas-vindas, nutrição, suporte, portfólio) passam a ser enviados "
                   "para um endereço escolhido por ele, usando o domínio slideai.com.br.",
        "correcao": "Incluir email no trigger de colunas protegidas (ou sincronizar profiles.email a partir de "
                    "auth.users por trigger). No webhook, resolver primeiro por auth.users (find_user_id_by_email) e "
                    "só depois pelo perfil. Criar índice único em lower(email).",
    },
    {
        "id": "A2", "categoria": 4, "severidade": "média", "issue": 2,
        "titulo": "Segredo de produção do webhook da Cakto ficou no histórico git de um repositório público",
        "resumo": "Commit de 01/08/2026 trouxe o segredo real em um teste; foi trocado no dia seguinte, mas continua no "
                  "histórico. O segredo só foi rotacionado em 28/09.",
        "evidencias": [
            ("commit 1cdc8b0 (01/08/2026) · supabase/functions/cakto-webhook/index.test.ts:13",
             'const SECRET = "…[valor oculto]";   // removido em eec60fc (02/08/2026), segue no histórico'),
            ("Impressão SHA-256[:12] do valor", "46925c8066f7 — igual à impressão esperada registrada pelo servidor "
             "(security_events) até 28/09/2026. A esperada hoje é 2bf40c2c9acd."),
            ("GitHub API (repos/Iuriznx-dus-codiguin/slide-aii)", '"private": false, "visibility": "public"'),
        ],
        "exploravel": "Entre 01/08 e 28/09/2026, qualquer pessoa com o histórico podia enviar eventos falsos "
                      "(purchase_approved, subscription_created…) com o segredo válido e liberar planos ou créditos "
                      "para qualquer e-mail.",
        "condicoes": "Hoje o valor não é mais aceito: o segredo foi rotacionado e a lista esperada só tem 2bf40c2c9acd. "
                     "Forense: os 7 eventos de pagamento entre 01/08 e 29/09 não foram creditados a nenhuma conta (user_id nulo).",
        "impacto": "Risco residual baixo enquanto o segredo antigo não voltar a ser usado. A severidade era crítica "
                   "durante a janela de exposição.",
        "correcao": "Manter o segredo antigo fora de qualquer lista aceita, confirmar no painel da Cakto, usar só "
                    "valores fictícios em testes e adicionar varredura de segredos (gitleaks) no fluxo de PR. "
                    "Reescrever o histórico é opcional, porque o valor já foi rotacionado.",
    },
    {
        "id": "A3", "categoria": 4, "severidade": "média", "issue": 2,
        "titulo": "Segredo atual do webhook da Cakto foi colado em texto puro no chat do projeto na Lovable",
        "resumo": "Achado fora do repositório, verificado pela API da Lovable. O valor enviado no chat em 29/09/2026 "
                  "tem a impressão do segredo em uso.",
        "evidencias": [
            ("Histórico de mensagens do projeto na Lovable (29/09/2026 00:43 UTC)",
             'configure o webhook cakto … segredo: …[valor oculto]'),
            ("Impressão SHA-256[:12]", "2bf40c2c9acd — igual à impressão esperada atual do cakto-webhook"),
        ],
        "exploravel": "Quem tem acesso ao histórico do projeto (membros do workspace; visibilidade workspace_edit) "
                      "ou ao armazenamento do fornecedor pode forjar eventos de pagamento válidos.",
        "condicoes": "É preciso ter acesso ao projeto na Lovable. O segredo continua válido.",
        "impacto": "Liberação indevida de planos e créditos e eventos de reembolso falsos.",
        "correcao": "Rotacionar o segredo na Cakto e no secret CAKTO_WEBHOOK_SECRET. Cadastrar o novo valor só pela "
                    "tela de Secrets, nunca no chat.",
    },
    {
        "id": "A4", "categoria": 1, "severidade": "média", "issue": 3,
        "titulo": "Apresentações publicadas são listáveis por qualquer pessoa e furam o portfólio privado",
        "resumo": "A RLS de leitura pública devolve todas as colunas de todas as apresentações publicadas, e toda "
                  "apresentação gerada nasce publicada.",
        "evidencias": [
            ("supabase/migrations/20260419011055_21b30c1d-4d93-4844-bbdf-d4be80e96700.sql:44",
             'CREATE POLICY "presentations_public_read" ON public.presentations FOR SELECT\n  USING (is_published = true AND deleted_at IS NULL);'),
            ("supabase/migrations/20260419011055_21b30c1d-4d93-4844-bbdf-d4be80e96700.sql:66",
             'CREATE POLICY "slides_public_read" ON public.slides FOR SELECT …'),
            ("src/lib/legacyPersist.ts:88 · supabase/functions/generate-presentation/persist.ts:82",
             "is_paid: true, is_published: true,"),
            ("supabase/migrations/20260814235606_fe2269e2-9079-4ffe-8ae8-2adfe259f9fa.sql:61-65",
             "get_profile_for_viewer(_username) RETURNS TABLE (id uuid, …) — devolve o id mesmo sem acesso"),
            ("supabase/functions/mcp/index.ts:81 · src/lib/mcp/tools/list-presentations.ts:22-23",
             'supabase.from("presentations").select("id, title, slug, …")  // sem filtro por user_id'),
        ],
        "exploravel": "Com a chave anon: GET /rest/v1/presentations?select=*&is_published=eq.true&user_id=eq.<id> "
                      "lista todas as apresentações de um portfólio privado, incluindo creative_brief, brand_identity "
                      "e presenters_names. A verificação can_view_portfolio só existe na RPC get_portfolio_presentations. "
                      "A ferramenta list_presentations do MCP também mistura as apresentações publicadas de todos os usuários.",
        "condicoes": "Basta a chave anon pública. Em produção, 50 de 52 apresentações estão publicadas, hoje todas de uma única conta.",
        "impacto": "Exposição de conteúdo e de metadados de marca de todos os usuários e quebra da promessa de "
                   "portfólio privado com pedido de acesso.",
        "correcao": "Criar apresentações como não publicadas por padrão. Servir a leitura pública por slug via RPC ou "
                    "view com colunas mínimas, sem listagem aberta. Fazer a listagem por dono respeitar "
                    "can_view_portfolio e filtrar por user_id no MCP.",
    },
    {
        "id": "A5", "categoria": 2, "severidade": "média", "issue": 4,
        "titulo": "Recurso pago (falas) e cotas de IA por apresentação dependem de dados que o próprio cliente grava",
        "resumo": "O servidor confia em include_speeches, gravado pelo navegador, e as cotas são contadas por "
                  "apresentação, que o cliente pode criar à vontade.",
        "evidencias": [
            ("src/lib/legacyPersist.ts:86-90",
             'supabase.from("presentations").insert({ …, is_paid: true, is_published: true,\n  presenters_names: form.presentersNames, include_speeches: form.includeSpeeches, … })'),
            ("supabase/migrations/20260419011055_21b30c1d-4d93-4844-bbdf-d4be80e96700.sql:43",
             'presentations_owner_all … FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)'),
            ("supabase/migrations/20260927000100_platform_review_fixes.sql:233-251",
             "protect_ai_edit_usage() protege só ai_edit_messages, ai_edit_complex e speech_regen_count"),
            ("supabase/functions/regenerate-speeches/index.ts:16, 67, 88",
             'export const MAX_SPEECH_REGENS = 5;\nif (!(pres as any).include_speeches) { … 402 }\nconst targets = scope === "all" ? slideRows : …   // sem teto de slides'),
            ("supabase/functions/chat-editor/index.ts:198-211",
             "Cota de edição por apresentação (10 mensagens ou 3 edições complexas)"),
        ],
        "exploravel": "Um usuário com plano ativo (ou bônus) cria pela API apresentações com include_speeches=true "
                      "(sem pagar os +50 créditos) e com quantos slides quiser, depois chama regenerate-speeches até 5 "
                      "vezes em cada uma. Cada apresentação nova também zera a cota do chat-editor, cujo limite real é "
                      "o rate limit de 40/h.",
        "condicoes": "Exige conta autenticada com direito de uso (can_user_generate com custo 0).",
        "impacto": "Custo de IA sem cobrança e contorno do preço das falas.",
        "correcao": "Travar include_speeches, is_paid e presenters_* por trigger (só service role grava), ou fazer a "
                    "edge function de geração criar o registro. Contar as cotas por usuário e período, e limitar o número "
                    "de slides em regenerate-speeches.",
    },
    {
        "id": "A6", "categoria": 1, "severidade": "baixa", "issue": 5,
        "titulo": "Usuário pode inserir mensagens com papel de \"equipe\" no próprio chamado",
        "resumo": "msg_own_insert não restringe role nem metadata, e a resposta humana usa o mesmo formato.",
        "evidencias": [
            ("supabase/migrations/20260716013934_90aa6f03-b7f6-4313-b724-57a99fea27f7.sql:135-137",
             'CREATE POLICY "msg_own_insert" ON public.support_messages FOR INSERT TO authenticated\n  WITH CHECK (EXISTS (… c.user_id = auth.uid()));'),
            ("src/pages/AdminSupport.tsx:154-158",
             'insert({ conversation_id, role: "assistant", content, metadata: { source: "human_agent" } })'),
            ("supabase/functions/support-chat/index.ts:243-245",
             '.filter((m) => m.role === "user" || m.role === "assistant")   // assistant forjado vai ao modelo'),
        ],
        "exploravel": "Via PostgREST, o dono do chamado insere role=\"assistant\" e metadata.source=\"human_agent\" "
                      "(por exemplo, \"reembolso aprovado\"). A mensagem aparece como resposta da equipe e entra no "
                      "contexto do modelo.",
        "condicoes": "Afeta só o próprio chamado.",
        "impacto": "Engenharia social contra a equipe de suporte e indução do assistente de IA.",
        "correcao": "Forçar role='user' e metadata vazia no INSERT feito pelo dono (WITH CHECK ou trigger), deixando "
                    "role assistant/system só para staff e service role.",
    },
    {
        "id": "A7", "categoria": 1, "severidade": "baixa", "issue": 5,
        "titulo": "Dono do chamado altera qualquer coluna da conversa (estado, escalonamento, métricas)",
        "resumo": "conv_own_update não tem WITH CHECK específico nem restrição de colunas.",
        "evidencias": [
            ("supabase/migrations/20260716013934_90aa6f03-b7f6-4313-b724-57a99fea27f7.sql:109-110",
             'CREATE POLICY "conv_own_update" ON public.support_conversations FOR UPDATE TO authenticated\n  USING (user_id = auth.uid() OR has_role(…admin) OR has_role(…developer));'),
        ],
        "exploravel": "O usuário grava state='escalated', escalated_at, resolved_by_human, reopen_count ou rating "
                      "direto pela API.",
        "condicoes": "Afeta só as conversas do próprio usuário.",
        "impacto": "Furar a fila de atendimento humano e distorcer as métricas de suporte.",
        "correcao": "Remover o UPDATE do dono, porque as mudanças de estado já passam pela edge function support-chat, "
                    "ou travar por trigger as colunas de staff.",
    },
    {
        "id": "A8", "categoria": 1, "severidade": "baixa", "issue": 6,
        "titulo": "Bucket de avatares sem limite de tamanho nem de tipo no servidor",
        "resumo": "A validação de formato e tamanho existe só no navegador.",
        "evidencias": [
            ("Banco (storage.buckets)", "avatars: file_size_limit = NULL, allowed_mime_types = NULL"),
            ("src/lib/avatarUpload.ts:3-4, 14-15, 22",
             'const ALLOWED = ["image/png", …]; const MAX_BYTES = 4 * 1024 * 1024;\n.upload(path, file, { upsert: true, contentType: file.type, … })'),
            ("supabase/migrations/20260814235606_fe2269e2-9079-4ffe-8ae8-2adfe259f9fa.sql:130-140",
             "avatars_read_auth (anon, authenticated: todo o bucket); avatars_insert_own / update_own (pasta do usuário)"),
        ],
        "exploravel": "Chamando a API do Storage direto, o usuário sobe arquivos de qualquer tipo e tamanho (HTML, SVG, "
                      "binários grandes) na própria pasta. Eles ficam acessíveis por URL assinada de 10 anos e podem "
                      "ser lidos por anônimos.",
        "condicoes": "Basta uma conta autenticada.",
        "impacto": "Hospedagem de conteúdo arbitrário no domínio de storage do projeto e custo de armazenamento.",
        "correcao": "Definir file_size_limit (4 MB) e allowed_mime_types (png, jpeg, webp, gif) no bucket.",
    },
    {
        "id": "A9", "categoria": 3, "severidade": "baixa", "issue": 7,
        "titulo": "RPCs liberadas para anônimos revelam papéis e relações de acesso de terceiros",
        "resumo": "has_role, can_view_portfolio e get_profile_for_viewer aceitam IDs arbitrários sem checar o chamador.",
        "evidencias": [
            ("supabase/migrations/20260806000729_867c7dc3-03da-4aea-aa55-d62f0694eb74.sql:38",
             "GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated, service_role;"),
            ("supabase/migrations/20260814235606_fe2269e2-9079-4ffe-8ae8-2adfe259f9fa.sql:41, 120",
             "can_view_portfolio(_owner uuid, _viewer uuid) … GRANT EXECUTE … TO anon, authenticated;"),
            ("supabase/migrations/20260814235606_fe2269e2-9079-4ffe-8ae8-2adfe259f9fa.sql:61-65, 121",
             "get_profile_for_viewer(_username) devolve id, created_at, is_public de qualquer username"),
        ],
        "exploravel": "Com IDs obtidos em presentations.user_id (público) ou em get_profile_for_viewer, um anônimo "
                      "descobre quais contas são admin ou developer (has_role) e quem tem acesso aprovado a um "
                      "portfólio privado (can_view_portfolio com _viewer arbitrário).",
        "condicoes": "Basta a chave anon.",
        "impacto": "Enumeração de alvos privilegiados e vazamento de relações entre usuários.",
        "correcao": "Revogar EXECUTE de anon e authenticated em has_role (as políticas o chamam como definer) e em "
                    "can_view_portfolio, ou fazer can_view_portfolio usar só auth.uid().",
    },
    {
        "id": "A10", "categoria": 5, "severidade": "baixa", "issue": 8,
        "titulo": "Roteiro de falas é escrito com document.write sem escapar HTML",
        "resumo": "Título, headlines, nomes e falas entram crus numa janela do mesmo domínio.",
        "evidencias": [
            ("src/components/PresenterNotesPanel.tsx:86-114",
             'const w = window.open("", "_blank", …);\n<h1>${title}</h1> … <h3>${p.name || "Apresentador"}</h3> … ${p.exact_speech.replace(/\\n/g, "<br>")}\nw.document.write(html);'),
        ],
        "exploravel": "Uma fala ou título com <img src=x onerror=…> executa script na origem slideai.com.br quando o "
                      "usuário clica em imprimir o roteiro.",
        "condicoes": "O painel só aparece no Editor do dono, então hoje é self-XSS. Passa a afetar outros usuários se o "
                     "conteúdo vier de terceiros (duplicar ou importar apresentações, templates) ou de uma IA manipulada.",
        "impacto": "Execução de script com acesso à sessão do usuário.",
        "correcao": "Escapar todos os campos (função escapeHtml) ou montar o documento com textContent.",
    },
    {
        "id": "A11", "categoria": 5, "severidade": "baixa", "issue": 8,
        "titulo": "og-preview insere título e descrição num bloco <script> JSON-LD sem escapar \"<\"",
        "resumo": "JSON.stringify não neutraliza </script>; as meta tags estão escapadas, mas o JSON-LD não.",
        "evidencias": [
            ("supabase/functions/og-preview/index.ts:63-70",
             '<script type="application/ld+json">${JSON.stringify({ …, name: title, description, url, … })}</script>'),
        ],
        "exploravel": "Um título publicado com </script><script>…</script> fecha o bloco e injeta script na página.",
        "condicoes": "A função hoje não está publicada (404 na verificação de 04/10) e o site não a referencia. Vira "
                     "explorável se for publicada e servida como HTML.",
        "impacto": "XSS armazenado na página de preview.",
        "correcao": "Serializar com JSON.stringify(...).replace(/</g, \"\\\\u003c\") ou remover o bloco JSON-LD.",
    },
    {
        "id": "A12", "categoria": 4, "severidade": "informativa", "issue": 9,
        "titulo": ".env versionado com a chave pública (anon) do Supabase",
        "resumo": "A chave é pública por design (role=anon), mas o .env real está no git e fora do .gitignore.",
        "evidencias": [
            (".env:1-3", "VITE_SUPABASE_PROJECT_ID / VITE_SUPABASE_PUBLISHABLE_KEY (JWT role=anon) / VITE_SUPABASE_URL"),
            (".env.example:1-6", "\"o repositório não deveria versionar um .env com valores reais preenchidos\""),
        ],
        "exploravel": "Não é um segredo, porque a segurança vem da RLS. O risco é alguém acrescentar uma chave real "
                      "(service role, OpenAI) a esse arquivo já rastreado.",
        "condicoes": "—",
        "impacto": "Higiene de configuração.",
        "correcao": "Adicionar .env ao .gitignore e manter só o .env.example. Lembrar que a Lovable injeta as "
                    "variáveis no build.",
    },
    {
        "id": "A13", "categoria": 4, "severidade": "informativa", "issue": 9,
        "titulo": "Migração concede admin e developer a um UUID fixo",
        "resumo": "Credencial de privilégio embutida no código de um repositório público.",
        "evidencias": [
            ("supabase/migrations/20260517133059_9502e9f2-1012-4cec-8021-84c751280b72.sql:38-41",
             "INSERT … VALUES ('54783c81-…', 'developer'), ('54783c81-…', 'admin') ON CONFLICT DO NOTHING;"),
        ],
        "exploravel": "Expõe o ID da conta administradora, facilitando ataques direcionados junto com A9. Todo "
                      "ambiente criado a partir do repositório herda esse admin.",
        "condicoes": "—",
        "impacto": "Higiene e alvo conhecido.",
        "correcao": "Conceder papéis por procedimento operacional (SQL manual documentado), não por migração.",
    },
    {
        "id": "A14", "categoria": 1, "severidade": "informativa", "issue": 7,
        "titulo": "Contador de visualizações pode ser inflado por anônimos",
        "resumo": "views_published_insert permite que qualquer pessoa insira visualizações de apresentações publicadas.",
        "evidencias": [
            ("supabase/migrations/20260806000646_a3684224-f5cb-4467-ab32-3685b698016a.sql:23",
             "CREATE POLICY views_published_insert ON public.slide_views … (p.is_published = true OR p.user_id = auth.uid())"),
        ],
        "exploravel": "Um script com a chave anon insere linhas em massa, e o trigger bump_presentation_view_count "
                      "infla view_count.",
        "condicoes": "Basta a chave anon.",
        "impacto": "Métricas falsas e crescimento da tabela.",
        "correcao": "Registrar visualizações por RPC com deduplicação (sessão ou IP com hash, por janela de tempo).",
    },
    {
        "id": "A15", "categoria": 5, "severidade": "informativa", "issue": 6,
        "titulo": "avatar_url aceita qualquer URL externa e é carregada por quem visita o perfil",
        "resumo": "O usuário grava a URL que quiser em profiles.avatar_url.",
        "evidencias": [
            ("src/pages/PublicProfile.tsx:170",
             "<AvatarImage src={profile.avatar_url ?? undefined} alt={…} />"),
        ],
        "exploravel": "Não executa script (img não roda javascript:), mas permite rastrear o IP e o navegador de quem "
                      "visita o portfólio.",
        "condicoes": "Basta uma conta.",
        "impacto": "Privacidade dos visitantes.",
        "correcao": "Aceitar só URLs do próprio Storage, validadas por CHECK ou trigger.",
    },
]

# ---------------------------------------------------------------------------
# Pontos fortes verificados (evidência = onde foi conferido).
# ---------------------------------------------------------------------------
PONTOS_FORTES = [
    (1, "RLS ligada em 29 de 29 tabelas do schema public",
     "Banco (pg_class.relrowsecurity). Tabelas sensíveis sem nenhuma política para clientes (só service role): "
     "billing_profiles, pending_charges, email_preferences, email_schedule, email_log, generation_attempts, "
     "edge_rate_limits, access_logs, maintenance_runs."),
    (1, "Colunas de faturamento e contadores de IA travados por trigger",
     "protect_billing_columns (…20260827000346…sql:206-224) e protect_ai_edit_usage "
     "(…20260927000100_platform_review_fixes.sql:233-251). handle_new_user sempre cria o perfil, o que fecha a "
     "brecha do INSERT."),
    (1, "Consultas com service role filtram pelo usuário",
     "assetIntelligence.ts:68 (.eq(\"user_id\")), consume_presentation_asset e add_ai_edit_usage (WHERE user_id = _uid), "
     "generate-presentation/persist.ts (user_id do token), support-chat:171 (ocorrências do próprio usuário)."),
    (3, "Toda edge function que recebe um ID confere a posse",
     "chat-editor/index.ts:187, regenerate-speeches/index.ts:64, support-chat/index.ts:82 e 157, "
     "send-email/index.ts:71 e 82, fetch-image (cota via RPC com _uid)."),
    (2, "Toda ação de staff tem a checagem equivalente no servidor",
     "send-email support_reply checa papel (index.ts:52-56). As escritas do AdminSupport têm RLS has_role "
     "(catalog_admin_write, occ_admin_update, msg_staff_insert, conv_own_update, \"Admin/dev gerencia artigos\"). "
     "user_roles só pode ser alterada por admin."),
    (2, "Poderes de desenvolvedor são decididos no servidor",
     "generate-presentation/index.ts:461 e 670-674 (engineVersion e max_budget_usd só se can_user_generate = dev). "
     "fetch-image rebaixa premium para não-dev. can_user_generate força auth.uid() para clientes."),
    (3, "Webhooks e jobs sem JWT exigem segredo ou token",
     "cakto-webhook compara sem curto-circuito (lib.ts:85) e alerta segredo divergente; email-dispatcher confere "
     "o segredo do Vault (≥ 32 caracteres); no email-unsubscribe o token UUID é a credencial e o GET não "
     "descadastra; send-email deriva o destinatário no servidor."),
    (4, "Código atual e bundle sem segredos",
     "Nenhum padrão de segredo na árvore. O bundle (dist/) só tem o JWT role=anon. O front só lê "
     "VITE_SUPABASE_URL/PUBLISHABLE_KEY/PROJECT_ID, e não há defaults env ?? \"literal\" para segredos."),
    (5, "HTML de e-mail sempre escapado",
     "emailTemplates.ts:43 (escapeHtml) e :71 (inline escapa antes de aplicar **negrito**); URLs de CTA montadas no "
     "servidor. O nome no cumprimento é limitado a uma palavra só com letras (lifecycleTemplates.ts:54-61)."),
    (5, "Markdown renderizado com sanitização",
     "Suporte (Streamdown 2.6) com rehype-sanitize + rehype-harden, que bloqueia javascript:. Central de Ajuda "
     "(react-markdown) sem HTML cru e com urlTransform padrão."),
    (5, "URLs controladas pelo usuário filtradas",
     "PublicProfile.tsx:28-31 (só http/https) e socialUrl; pós-login aceita só caminho relativo (Auth.tsx:41); "
     "meta tags do og-preview escapadas (esc + safeUrl)."),
    (5, "Painel da equipe renderiza mensagens de usuários como texto",
     "AdminSupport e SupportWidget não usam HTML cru; chart.tsx (dangerouslySetInnerHTML) não é usado em lugar nenhum."),
    (3, "Proteção contra prompt injection no histórico do suporte",
     "support-chat/index.ts:243-245 descarta mensagens gravadas com papel system antes de chamar o modelo."),
]

PONTOS_FRACOS = [
    "Colunas de controle editáveis pelo dono: a RLS de UPDATE das tabelas centrais (profiles, presentations, "
    "support_*) não restringe colunas, e os triggers cobrem só parte delas (e-mail, flags pagas, papel da mensagem).",
    "Segredo do webhook de pagamento tratado fora do cofre: esteve em um repositório público e o valor atual foi "
    "colado no chat do projeto.",
    "\"Publicado\" significa \"listável por qualquer pessoa\": toda apresentação nasce publicada e a leitura pública "
    "não respeita o portfólio privado.",
    "Cotas de IA contadas por apresentação, uma unidade que o próprio cliente cria.",
]

RECOMENDACOES = [
    ("P1", "Imediato", [
        "Travar profiles.email (trigger) e resolver o pagamento por auth.users no cakto-webhook; índice único em lower(email). (A1)",
        "Rotacionar CAKTO_WEBHOOK_SECRET na Cakto e na Lovable, cadastrando o valor só pela tela de Secrets; confirmar que "
        "nenhum valor antigo é aceito. (A2, A3)",
    ]),
    ("P2", "Antes de abrir para mais usuários", [
        "Criar apresentações como não publicadas por padrão; leitura pública só por slug via RPC/view com colunas mínimas; "
        "listagem por dono respeitando can_view_portfolio; MCP filtrando por user_id. (A4)",
        "Proteger include_speeches, is_paid e presenters_* por trigger; cotas de IA por usuário e período; teto de slides "
        "em regenerate-speeches. (A5)",
    ]),
    ("P3", "Próximo ciclo", [
        "Suporte: forçar role='user' no INSERT do dono e restringir o UPDATE de conversas. (A6, A7)",
        "Storage: file_size_limit e allowed_mime_types no bucket avatars; avatar_url só do próprio Storage. (A8, A15)",
        "Revogar anon/authenticated de has_role e can_view_portfolio; reduzir o que get_profile_for_viewer devolve. (A9)",
        "Escapar HTML em PresenterNotesPanel e no JSON-LD do og-preview. (A10, A11)",
    ]),
    ("P4", "Higiene contínua", [
        ".env no .gitignore; papéis administrativos fora das migrações. (A12, A13)",
        "Visualizações por RPC com deduplicação. (A14)",
        "Adicionar gitleaks e um teste de RLS (pgTAP ou script) ao fluxo de PR.",
    ]),
]

# ---------------------------------------------------------------------------
# Issues para o GitHub (agrupando achados do mesmo tema).
# ---------------------------------------------------------------------------
ISSUES = [
    {
        "n": 1, "achados": ["A1"], "severidade": "alta",
        "titulo": "[Segurança] E-mail do perfil editável desvia pagamentos da Cakto",
        "descricao": "A coluna `profiles.email` pode ser alterada pelo próprio usuário: a política "
                     "`profiles_update_own` não restringe colunas e o trigger `protect_billing_columns` não inclui `email`. "
                     "O `cakto-webhook` resolve o dono da compra procurando primeiro esse e-mail em `profiles`. Um usuário "
                     "que grave no próprio perfil o e-mail de outra pessoa recebe o plano ou os créditos quando ela compra "
                     "sem ter perfil com aquele e-mail (compra antes do cadastro ou com outro e-mail).",
        "evidencia": [
            "`supabase/migrations/20260419011055_21b30c1d-4d93-4844-bbdf-d4be80e96700.sql:16` — `CREATE POLICY \"profiles_update_own\" ON public.profiles FOR UPDATE USING (auth.uid() = id);`",
            "`supabase/migrations/20260827000346_68e8e98f-500b-4310-8345-f07ef89f505f.sql:206-224` — `protect_billing_columns()` não verifica `email`.",
            "`supabase/functions/cakto-webhook/index.ts:134-137` — `.from(\"profiles\").select(\"id\").ilike(\"email\", escapeLike(email)).maybeSingle()` define o `userId`.",
            "Índice `profiles_email_lower_idx` não é único.",
            "`supabase/functions/_shared/lifecycle.ts:32` e `supabase/functions/send-email/index.ts:62,74,86` enviam e-mails para `profiles.email`.",
        ],
        "impacto": "Desvio de compras e assinaturas de terceiros, e e-mails da plataforma enviados para endereços escolhidos pelo atacante.",
        "correcao": [
            "Adicionar `email` à lista de colunas travadas (ou sincronizar `profiles.email` a partir de `auth.users` por trigger).",
            "No `cakto-webhook`, resolver primeiro por `auth.users` (`find_user_id_by_email`) e só depois pelo perfil.",
            "Criar índice único em `lower(email)` e tratar duplicados existentes.",
        ],
        "criterios": [
            "`update profiles set email = ...` feito pelo cliente retorna erro 42501.",
            "Teste do webhook com dois perfis com o mesmo e-mail credita a conta de `auth.users`.",
            "Índice único em `lower(email)` criado em produção.",
            "Lifecycle e send-email usam o e-mail de `auth.users`.",
        ],
    },
    {
        "n": 2, "achados": ["A2", "A3"], "severidade": "média",
        "titulo": "[Segurança] Rotacionar o segredo do webhook da Cakto e eliminar as exposições",
        "descricao": "O segredo do webhook da Cakto foi exposto duas vezes:\n\n"
                     "1. O valor real em produção foi commitado em `supabase/functions/cakto-webhook/index.test.ts:13` "
                     "(commit `1cdc8b0`, 01/08/2026). O repositório é público, e o valor foi aceito até a rotação em "
                     "28/09/2026 (impressão `46925c8066f7`).\n"
                     "2. O valor atual (impressão `2bf40c2c9acd`) foi colado em texto puro no chat do projeto na Lovable em 29/09/2026.\n\n"
                     "Com o segredo, qualquer pessoa pode forjar eventos de pagamento.",
        "evidencia": [
            "`git show 1cdc8b0:supabase/functions/cakto-webhook/index.test.ts` — linha 13 (`const SECRET = \"[oculto]\"`).",
            "`security_events` (cakto-webhook): impressão esperada `46925c8066f7` até 28/09/2026 e `2bf40c2c9acd` depois.",
            "Forense: nenhum dos 7 eventos de pagamento entre 01/08 e 29/09/2026 foi creditado a uma conta.",
        ],
        "impacto": "Liberação indevida de planos e créditos e reembolsos falsos.",
        "correcao": [
            "Gerar um novo segredo na Cakto e atualizar `CAKTO_WEBHOOK_SECRET` só pela tela de Secrets da Lovable.",
            "Conferir que a lista aceita contém apenas o novo valor.",
            "Usar só valores fictícios em testes e adicionar gitleaks ao fluxo de PR.",
            "(Opcional) Reescrever o histórico para remover o valor antigo.",
        ],
        "criterios": [
            "A impressão esperada em `security_events` muda para o novo valor.",
            "Um evento de teste da Cakto com o novo segredo é aceito; com os dois antigos, recebe 401.",
            "Workflow de varredura de segredos ativo no repositório.",
        ],
    },
    {
        "n": 3, "achados": ["A4"], "severidade": "média",
        "titulo": "[Segurança] Apresentações publicadas são listáveis por qualquer pessoa e furam o portfólio privado",
        "descricao": "A política `presentations_public_read` permite que anônimos leiam todas as colunas de todas as "
                     "apresentações publicadas, e toda apresentação gerada nasce com `is_published: true`. Com a chave anon "
                     "é possível listar todas as apresentações de um perfil privado (o `user_id` vem de "
                     "`get_profile_for_viewer`), incluindo `creative_brief` e `brand_identity`, ignorando `can_view_portfolio`. "
                     "A ferramenta `list_presentations` do MCP também devolve as apresentações publicadas de todos os usuários.",
        "evidencia": [
            "`supabase/migrations/20260419011055_21b30c1d-4d93-4844-bbdf-d4be80e96700.sql:44` e `:66` (presentations_public_read, slides_public_read).",
            "`src/lib/legacyPersist.ts:88` e `supabase/functions/generate-presentation/persist.ts:82` — `is_published: true`.",
            "`supabase/functions/mcp/index.ts:81` / `src/lib/mcp/tools/list-presentations.ts:22-23` — consulta sem filtro por `user_id`.",
        ],
        "impacto": "Exposição do conteúdo e dos metadados de marca de todos os usuários e quebra do portfólio privado.",
        "correcao": [
            "Criar apresentações como não publicadas por padrão (o usuário publica explicitamente).",
            "Trocar a leitura pública direta por RPC ou view por slug, com colunas mínimas e sem listagem aberta.",
            "Fazer a listagem por dono respeitar `can_view_portfolio`.",
            "Filtrar por `user_id = ctx.getUserId()` no MCP.",
        ],
        "criterios": [
            "`GET /rest/v1/presentations?is_published=eq.true` com a chave anon não lista apresentações.",
            "O visualizador público por slug continua funcionando.",
            "Portfólio privado sem acesso aprovado não expõe apresentações por nenhuma rota.",
            "`list_presentations` devolve só as apresentações do usuário autenticado.",
        ],
    },
    {
        "n": 4, "achados": ["A5"], "severidade": "média",
        "titulo": "[Segurança] Flags pagas e cotas de IA controladas pelo cliente",
        "descricao": "`include_speeches` (recurso de +50 créditos) e `presenters_*` são gravados pelo navegador "
                     "(`legacyPersist.ts`), e a RLS permite alterá-los. O `regenerate-speeches` confia em `include_speeches` "
                     "e não limita o número de slides. As cotas do `chat-editor` e do `regenerate-speeches` são contadas por "
                     "apresentação, uma unidade que o cliente cria livremente pela API.",
        "evidencia": [
            "`src/lib/legacyPersist.ts:86-90` — insert com `include_speeches: form.includeSpeeches`.",
            "`supabase/migrations/20260927000100_platform_review_fixes.sql:233-251` — o trigger protege só os contadores.",
            "`supabase/functions/regenerate-speeches/index.ts:16,67,88` — 5 regenerações por apresentação, confia no flag, escopo `all` sem teto.",
            "`supabase/functions/chat-editor/index.ts:198-211` — cota por apresentação.",
        ],
        "impacto": "Custo de IA sem cobrança e contorno do preço das falas.",
        "correcao": [
            "Travar `include_speeches`, `is_paid` e `presenters_*` por trigger (só service role grava).",
            "Contar as cotas de edição e de regeneração por usuário e período.",
            "Limitar o número de slides enviados ao modelo em `regenerate-speeches`.",
        ],
        "criterios": [
            "O cliente não consegue mudar `include_speeches` (erro 42501).",
            "Criar apresentações novas não renova a cota de IA.",
            "`regenerate-speeches` recusa decks acima do limite de slides.",
        ],
    },
    {
        "n": 5, "achados": ["A6", "A7"], "severidade": "baixa",
        "titulo": "[Segurança] Usuário forja mensagens da equipe e altera o estado dos próprios chamados",
        "descricao": "`msg_own_insert` não restringe `role` nem `metadata`: o dono do chamado insere mensagens "
                     "`role=assistant` com `metadata.source=human_agent`, o mesmo formato da resposta humana. "
                     "`conv_own_update` permite alterar `state`, `escalated_at`, `resolved_by_human`, `reopen_count` e `rating`.",
        "evidencia": [
            "`supabase/migrations/20260716013934_90aa6f03-b7f6-4313-b724-57a99fea27f7.sql:135-137` (msg_own_insert) e `:109-110` (conv_own_update).",
            "`src/pages/AdminSupport.tsx:154-158` — formato da resposta humana.",
            "`supabase/functions/support-chat/index.ts:243-245` — mensagens assistant do histórico vão ao modelo.",
        ],
        "impacto": "Engenharia social contra o suporte, indução do assistente e fura-fila ou métricas falsas.",
        "correcao": [
            "Exigir `role = 'user'` e `metadata` vazia no INSERT do dono (WITH CHECK).",
            "Remover o UPDATE do dono em `support_conversations` (as transições passam pela edge function) ou travar as colunas de staff por trigger.",
        ],
        "criterios": [
            "INSERT do dono com `role = 'assistant'` falha.",
            "UPDATE do dono em `state` falha; o fluxo do support-chat continua funcionando.",
        ],
    },
    {
        "n": 6, "achados": ["A8", "A15"], "severidade": "baixa",
        "titulo": "[Segurança] Avatares: sem limite de tipo/tamanho no bucket e URL externa livre",
        "descricao": "O bucket `avatars` não define `file_size_limit` nem `allowed_mime_types`. A validação existe só "
                     "no navegador (`avatarUpload.ts`). `profiles.avatar_url` aceita qualquer URL externa, que é "
                     "carregada por quem visita o portfólio.",
        "evidencia": [
            "`storage.buckets`: avatars com `file_size_limit = NULL` e `allowed_mime_types = NULL`.",
            "`src/lib/avatarUpload.ts:3-4,14-15,22` — validação só no cliente; `contentType: file.type`.",
            "`src/pages/PublicProfile.tsx:170` — `<AvatarImage src={profile.avatar_url} />`.",
        ],
        "impacto": "Hospedagem de conteúdo arbitrário no storage do projeto e rastreamento de visitantes.",
        "correcao": [
            "Configurar `file_size_limit = 4 MB` e `allowed_mime_types = png, jpeg, webp, gif` no bucket.",
            "Aceitar em `avatar_url` só URLs do próprio Storage (CHECK ou trigger).",
        ],
        "criterios": [
            "Upload de 10 MB ou de `text/html` pela API é recusado.",
            "Gravar `avatar_url` externa falha.",
        ],
    },
    {
        "n": 7, "achados": ["A9", "A14"], "severidade": "baixa",
        "titulo": "[Segurança] Superfícies anônimas: enumeração de papéis/acessos e visualizações infláveis",
        "descricao": "`has_role(uuid, app_role)` e `can_view_portfolio(_owner, _viewer)` podem ser executadas por "
                     "anônimos com IDs arbitrários (revelam contas admin e acessos aprovados), e `get_profile_for_viewer` "
                     "devolve o `id` de qualquer username. `views_published_insert` permite inserir visualizações em "
                     "massa, inflando `view_count`.",
        "evidencia": [
            "`supabase/migrations/20260806000729_867c7dc3-03da-4aea-aa55-d62f0694eb74.sql:38` — GRANT de has_role a anon.",
            "`supabase/migrations/20260814235606_fe2269e2-9079-4ffe-8ae8-2adfe259f9fa.sql:41,61-65,120-121`.",
            "`supabase/migrations/20260806000646_a3684224-f5cb-4467-ab32-3685b698016a.sql:23` — views_published_insert.",
        ],
        "impacto": "Enumeração de alvos privilegiados, vazamento de relações e métricas falsas.",
        "correcao": [
            "Revogar EXECUTE de anon e authenticated em `has_role` e `can_view_portfolio` (as políticas continuam funcionando como definer).",
            "Fazer `can_view_portfolio` usar só `auth.uid()`; `get_profile_for_viewer` sem `id` quando não houver acesso.",
            "Registrar visualizações por RPC com deduplicação.",
        ],
        "criterios": [
            "`rpc('has_role', …)` com a chave anon retorna erro de permissão.",
            "Inserir 100 visualizações seguidas da mesma origem conta uma.",
        ],
    },
    {
        "n": 8, "achados": ["A10", "A11"], "severidade": "baixa",
        "titulo": "[Segurança] HTML montado sem escape no roteiro de falas e no JSON-LD do og-preview",
        "descricao": "`PresenterNotesPanel.printScript` interpola título, headlines, nomes e falas direto em HTML "
                     "escrito com `document.write` numa janela do mesmo domínio. O `og-preview` insere "
                     "`JSON.stringify(...)` dentro de `<script>` sem neutralizar `</script>`.",
        "evidencia": [
            "`src/components/PresenterNotesPanel.tsx:86-114`.",
            "`supabase/functions/og-preview/index.ts:63-70`.",
        ],
        "impacto": "Execução de script na origem do app (hoje self-XSS) e XSS armazenado no preview, caso a função seja publicada.",
        "correcao": [
            "Escapar todos os campos com `escapeHtml` (ou usar `textContent`) no roteiro.",
            "No JSON-LD, `JSON.stringify(obj).replace(/</g, \"\\\\u003c\")`.",
        ],
        "criterios": [
            "Fala contendo `<img src=x onerror=alert(1)>` aparece como texto no roteiro impresso.",
            "Título com `</script>` não quebra o HTML do og-preview (teste unitário).",
        ],
    },
    {
        "n": 9, "achados": ["A12", "A13"], "severidade": "informativa",
        "titulo": "[Segurança] Higiene: .env versionado e papel admin concedido por migração",
        "descricao": "O `.env` com a chave anon (pública por design) está versionado e fora do `.gitignore`. Uma "
                     "migração concede `admin` e `developer` a um UUID fixo, expondo o ID da conta administradora num "
                     "repositório público.",
        "evidencia": [
            "`.env:1-3` e `.env.example:1-6`.",
            "`supabase/migrations/20260517133059_9502e9f2-1012-4cec-8021-84c751280b72.sql:38-41`.",
        ],
        "impacto": "Risco de uma chave real ir parar num arquivo já rastreado e alvo administrativo conhecido.",
        "correcao": [
            "Adicionar `.env` ao `.gitignore` (git rm --cached .env) e manter `.env.example`.",
            "Documentar a concessão de papéis como procedimento manual, fora das migrações.",
        ],
        "criterios": [
            "`git ls-files .env` vazio.",
            "Nenhuma migração nova concede papel a UUID fixo.",
        ],
    },
]
