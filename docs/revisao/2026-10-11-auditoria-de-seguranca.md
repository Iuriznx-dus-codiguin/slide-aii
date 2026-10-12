# Auditoria de segurança (11 e 12/10/2026)

Auditoria ofensiva e defensiva da plataforma inteira (banco, Edge Functions, front-end, pagamentos e infraestrutura declarada no repositório), com as correções aplicadas na migração `0010_security_hardening` e no código.

**Base usada:**
- código em `claude/blissful-hamilton-v61rom` a partir de `d1353bc`;
- histórico completo de migrações (`supabase/migrations` até 11/09/2026 e `drizzle/migrations` 0000–0009, as que a Lovable Cloud aplica), reconstruído e executado num PostgreSQL 16 local com um stub do Supabase ([supabase/tests/security](../../supabase/tests/security/README.md));
- `npm audit` sobre as dependências resolvidas pelo registro público (o `bun.lock` aponta para um espelho privado inacessível daqui);
- `deno check` das Edge Functions alteradas e revisão adversarial independente do diff (seção 6).

**Não houve teste contra a produção.** Nada aqui foi executado no projeto real da Lovable Cloud nem na Cakto. Os exploits foram reproduzidos no banco local, com as mesmas migrações, papéis e políticas.

**Severidade:** escala Crítico → Alto → Médio → Baixo, com CVSS 3.1 aproximado quando o achado é uma vulnerabilidade explorável. Defeitos de integridade financeira ou de conformidade sem atacante recebem severidade pelo impacto, sem CVSS.

---

## 1. Resumo

| # | Achado | Severidade | Situação |
| --- | --- | --- | --- |
| C1 | Toda apresentação nascia pública e a API listava as de todos os usuários (título, prompt, slides, notas e falas) | Crítico (CVSS 7.5) | Corrigido |
| A1 | `profiles.email` gravável pelo usuário: e-mails da plataforma, com texto do atacante, para qualquer endereço | Alto (6.4) | Corrigido |
| A2 | Regenerar falas sem pagar e sem limite (campo `include_speeches` gravável, contador em corrida, sem rate limit) | Alto (7.1) | Corrigido |
| A3 | Estorno automático de gerações travadas e registro de acesso (Marco Civil) abortavam no gatilho de cobrança | Alto (integridade e conformidade) | Corrigido |
| M1 | `type`/`language` sem limite fora do bloco de dados do prompt: amplificação de custo de IA | Médio (4.3) | Corrigido |
| M2 | Contadores de IA da apresentação negativos via INSERT; cota do chat em corrida; deck do cliente sem teto | Médio (4.3) | Corrigido |
| M3 | Rate limit por IP contornável trocando `X-Forwarded-For` (cota da Pexels do projeto) | Médio (5.3) | Corrigido |
| M4 | Visualizações infladas sem limite por anônimos | Médio (5.3) | Corrigido |
| M5 | Usuário grava mensagens "system"/"assistant" e muda o estado do próprio atendimento | Médio (4.3) | Corrigido |
| M6 | `og-preview`: JSON-LD sem escape fecha o `<script>` (XSS armazenado se servido como HTML) | Médio (6.1, condicional) | Corrigido |
| M7 | Webhook: crédito avulso idempotente por (evento, pedido), não por pedido; corpo sem teto; inundação de `security_events` | Médio (5.3) | Corrigido |
| B1 | XSS no roteiro impresso do Editor (`document.write` sem escape) | Baixo (3.5) | Corrigido |
| B2 | Bucket de avatares listável por anônimos (UUID de todo usuário com foto) | Baixo (5.3) | Corrigido |
| B3 | MCP lia decks publicados de terceiros; filtro `.or()` montado com texto do cliente | Baixo (4.3) | Corrigido |
| B4 | Mensagens de exceção devolvidas ao cliente; `support-chat` aceitava ocorrência de outro usuário | Baixo (3.1) | Corrigido |
| B5 | Senha mínima de 6 na troca e na redefinição (8 no cadastro) | Baixo | Corrigido |
| B6 | `can_view_portfolio` chamável por qualquer um (consulta quem tem acesso a qual portfólio) | Baixo (3.1) | Corrigido |
| R1–R12 | Recomendações que dependem de decisão, de configuração fora do repositório ou de teste em produção | — | [Seção 4](#4-recomendações-não-aplicadas) |

---

## 2. Achados corrigidos

### C1 — Apresentações públicas por padrão e listáveis pela API

**Onde:** `supabase/functions/generate-presentation/persist.ts` (`is_published: true`), `src/lib/legacyPersist.ts`, `presentations.is_published DEFAULT true` (migração inicial), políticas `presentations_public_read` e `slides_public_read`; `supabase/functions/mcp/index.ts` (`list_presentations`, `get_presentation`).

**Falha:** os Termos (seção 12) e a Central de Ajuda dizem que "toda apresentação nasce privada", mas o servidor gravava `is_published = true`. As políticas de leitura pública não exigiam o slug: valiam para qualquer consulta.

**Exploração:** com a chave `anon` (pública, vai no bundle), sem conta:

```
GET /rest/v1/presentations?select=title,description,slug,creative_brief
GET /rest/v1/slides?select=presentation_id,content,speaker_notes,presenters_data
```

Devolvia todas as apresentações de todos os usuários: título, descrição (o prompt digitado), conteúdo, notas e falas. Reproduzido no banco local (`exploits_before_fix.sql`, PoC 1). As ferramentas MCP também listavam decks de terceiros.

**Correção (migração 0010 + código):**
- `is_published` passa a `DEFAULT false`; `persist.ts` e `legacyPersist.ts` gravam `false`.
- As políticas de leitura pública foram removidas. O link compartilhado passa pelo RPC `get_shared_presentation(_slug)` (SECURITY DEFINER): devolve um deck **pelo slug exato** se estiver publicado e fora da lixeira, ou se for do próprio usuário; não expõe o `user_id` do autor (só `is_owner`).
- `SlideViewer` e `ExportMenu` leem pelo RPC (`src/lib/sharedPresentation.ts`), com recurso ao caminho antigo se o RPC ainda não existir (front publicado antes do banco).
- O visualizador avisa o dono quando o link ainda é privado.
- MCP: `list_presentations`, `get_presentation` e `update_presentation` filtram por `user_id`.

**Por que não quebra:** o portfólio público já usava RPCs (`get_portfolio_presentations`, `get_profile_for_viewer`); o og-preview usa `service_role`; o Editor e o painel leem só os decks do dono. O e2e `public-portfolio` foi atualizado para a nova regra.

**Teste:** `supabase/tests/security/run.sh` (exploits 1 e regressão "anônimo abre deck publicado pelo slug", "deck na lixeira some", "outra conta não lê slides alheios"); `src/test/securityHardening.test.ts`.

**Atenção — dados existentes e incidente:** a migração **não** torna privadas as apresentações já publicadas (não há como saber quais foram publicadas de propósito; mudar quebraria links compartilhados). Ver [R1](#r1--apresentações-já-publicadas-por-engano) e [R2](#r2--avaliar-incidente-lgpd-art-48).

### A1 — E-mail do perfil gravável: a plataforma como retransmissor de phishing

**Onde:** gatilho `protect_billing_columns` (não cobria `email`); `send-email` (`access_requested`, `access_decided`, `support_reply`) e `_shared/lifecycle.ts` usavam `profiles.email` como destinatário; `cakto-webhook` resolve o pagador primeiro por `profiles.email`.

**Exploração:** o atacante faz `PATCH /rest/v1/profiles?id=eq.<seu id>` com `{"email":"vitima@empresa.com"}` (PoC 2). A partir daí, os e-mails de nutrição (dias 1 a 30), boas-vindas e portfólio saem do domínio do SlideAI, com SPF/DKIM válidos, para a vítima. Com uma segunda conta, o pedido de acesso ao portfólio leva nome e mensagem escolhidos pelo atacante no assunto e no corpo. Também envenenava a busca do pagador no webhook (compra com e-mail sem conta podia cair na conta do atacante).

**Correção:**
- `protect_billing_columns` protege `email`, `generations_count`, `total_views` e `id`; `profiles_insert_own` removida e `INSERT` revogado (só `handle_new_user` cria perfis).
- Gatilho `on_auth_user_email_changed` mantém `profiles.email` igual ao de `auth.users`; a migração ressincroniza os já alterados.
- `accountEmail()` (`_shared/email.ts`): `send-email` e `lifecycle` pegam o destinatário em `auth.users`; nome e mensagem do pedido de acesso com teto (80 e 500 caracteres).

**Por que não quebra:** nenhuma tela edita o e-mail do perfil (Profile/Settings gravam nome, papel, username, bio, site, local, avatar, visibilidade, redes). O runbook não pede edição manual de `profiles.email`.

**Teste:** exploit 2 e regressão "dono atualiza campos editáveis", "profiles.email acompanha auth.users".

### A2 — Falas regeneradas de graça e sem limite

**Onde:** `supabase/functions/regenerate-speeches/index.ts`; coluna `presentations.include_speeches`; gatilho `protect_ai_edit_usage` (só `UPDATE`).

**Exploração:** qualquer conta com saldo (inclusive só o avulso de R$ 14,90):
1. cria decks direto pela API (`INSERT` em `presentations`, de graça) com `include_speeches = true` e `speech_regen_count = -1000` (PoC 3), ou liga `include_speeches` num deck existente (PoC 4);
2. chama `regenerate-speeches` com `scope: "all"` sem parar.

Não havia rate limit, e o teto de 5 era lido antes da chamada de IA e gravado depois: requisições em paralelo passavam todas. Resultado: chamadas de IA ilimitadas pagas pela plataforma.

**Correção:**
- Gatilho `protect_presentation_server_fields` (`BEFORE INSERT OR UPDATE`): no `INSERT` do cliente, contadores e visualizações começam em 0 e `include_speeches = false` (falas só vêm da geração paga); no `UPDATE`, o cliente não altera `include_speeches`, contadores, `view_count`, `is_paid`, `engine_version`, `creative_brief` nem `user_id`. `CHECK` de contadores não negativos.
- `reserve_speech_regen`/`release_speech_regen`: a vaga é reservada atomicamente **antes** da IA (com `include_speeches` e dono na mesma condição) e devolvida se a chamada falhar.
- Rate limit de 20/h por conta e teto de 40 slides no prompt.

**Teste:** exploits 3, 4 e 10; regressão "reserva de falas para em 5", "liberação devolve a vaga", "reserva exige ser o dono".

### A3 — Estorno automático e registro de acesso quebrados pelo gatilho de cobrança

**Onde:** `protect_billing_columns` decidia por `auth.role()`.

**Falha (sem atacante):** `auth.role()` é nulo no pg_cron e vale `authenticated` dentro de `record_access`. Em ambos, `refund_generation_credits` altera `credits_bonus`/`credits_monthly` e o gatilho aborta a transação. Consequências, reproduzidas no banco local (PoCs 7 e 8):
- o job `slideai-stale-generations` falha a cada 5 minutos; gerações interrompidas **nunca** são estornadas automaticamente (o runbook promete até 15 minutos);
- enquanto houver uma tentativa presa, **todo** `record_access` falha para **todos** os usuários: o registro de acesso exigido pelo Marco Civil (art. 15) deixa de ser gravado, e a retenção diária (`run_data_retention_if_due`) não roda. O cliente ignora o erro, então ninguém percebe.

O próprio runbook mostrava o sintoma: para mexer em créditos no SQL editor era preciso forjar o JWT de `service_role`.

**Correção:** os gatilhos de proteção passam a ser `SECURITY INVOKER` e decidem por `current_user IN ('anon', 'authenticated')`. Escrita direta da API roda com esses papéis; funções `SECURITY DEFINER` do banco, o pg_cron e o SQL editor rodam como o dono. Nenhuma função chamável pelo cliente grava colunas protegidas com valor vindo dele (todas foram revisadas).

**Depois do deploy:** rode a consulta do [runbook](../operacao/runbooks.md#créditos-de-geração-que-travou) para estornar tentativas presas de antes da correção e confira `access_logs` (lacuna de registros desde a primeira geração travada — avaliar com o jurídico).

### M1 — Amplificação de custo pelo prompt da geração

**Onde:** `generate-presentation/index.ts` (prompts do v1 e do v2, Creative Director e Story Engine).

**Falha:** só `title` e `description` eram limpos. `type` e `language` entravam crus, sem limite e **fora** do bloco marcado como dado do usuário. Um `type` de megabytes multiplicava o custo de cada chamada de texto de uma geração cobrada por preço fixo, e permitia injetar instruções.

**Correção:** `generate-presentation/input.ts` normaliza o corpo antes de qualquer uso (inclusive do cálculo de custo): teto de 64 KB no corpo (413), `type` limpo e com 80 caracteres, `language`/`persona`/`textDepth` em listas fechadas, `theme` só entre os temas existentes, `slidesCount` inteiro. `computeCreditsCost` só aceita chaves próprias (`__proto__`/`constructor` viravam texto no custo).

### M2 — Contadores e cota do chat de edição

**Onde:** `chat-editor/index.ts`, `presentations.ai_edit_*`.

**Falha:** contadores negativos via `INSERT` davam edições ilimitadas por deck; a cota era checada antes da IA e gravada depois (corrida); o deck vem do cliente sem teto de tamanho.

**Correção:** gatilho do item A2; `reserve_ai_edit_usage`/`release_ai_edit_usage` (reserva atômica depois da classificação, devolvida em qualquer falha); corpo limitado a 400 mil caracteres; erro genérico ao cliente.

### M3 — Rate limit por IP contornável

**Onde:** `fetch-image/index.ts` e `_shared/observability.ts` usavam o **primeiro** item de `X-Forwarded-For`, que o cliente escolhe.

**Exploração:** um script anônimo troca o cabeçalho a cada pedido e esgota a cota da Pexels do projeto (imagens somem para todos).

**Correção:** `_shared/clientIp.ts` prefere `cf-connecting-ip` (preenchido pela Cloudflare, mesma ordem de `request_client_info()` no banco). A chave de limite usa HMAC do IP (a Política de Privacidade diz que o IP de espectadores não é guardado; antes ia em claro para `edge_rate_limits`). Corpo de `fetch-image` limitado a 128 KB.

### M4 — Visualizações infladas

**Onde:** política `views_published_insert`.

**Correção:** inserção só pelo RPC `record_presentation_view`: mesma regra de antes (publicada ou do dono, fora da lixeira), com teto de 30 por hora por visitante e deck e 300 por hora por visitante, chaveado por hash do IP com segredo do Vault (`rate_limit_pepper`). O navegador é lido do cabeçalho, não do corpo.

### M5 — Atendimento adulterado pelo próprio usuário

**Onde:** políticas `msg_own_insert` e `conv_own_update`.

**Exploração:** o usuário grava "Reembolso aprovado pela equipe" como mensagem `system` e marca o próprio atendimento como resolvido por humano (PoC 5) — engenharia social contra a equipe e injeção no histórico que vai para a IA.

**Correção:** `msg_own_insert` só aceita `role = 'user'`; gatilho `protect_support_conversation_fields` deixa o dono alterar só a avaliação (`rating`, gravada pelo `SupportWidget`). A equipe segue respondendo e mudando o estado.

### M6 — XSS no `og-preview`

**Onde:** `og-preview/index.ts`, bloco `application/ld+json` com `JSON.stringify` cru.

**Exploração:** título `</script><script>…</script>` numa apresentação publicada fecha o bloco. Hoje a função roda no domínio `*.supabase.co` (que costuma servir HTML de funções como texto); vira XSS armazenado no momento em que um domínio próprio ou proxy servir esse HTML.

**Correção:** `jsonForScript` (`_shared/html.ts`) escapa `<`, `>`, `&`, U+2028/2029; slug restrito a `[a-z0-9-]`.

### M7 — Webhook da Cakto

**Correção:**
- Compra avulsa creditada por `grant_order_bonus_credits`: **uma vez por pedido**, qualquer que seja o evento (antes, um segundo evento "pago" do mesmo pedido — por exemplo, um tipo novo classificado pela heurística — creditava de novo). Sem id de pedido, nada é creditado e sobe o alerta `payment_without_order_id`.
- Corpo limitado a 256 KB.
- Segredo inválido: acima de 30 por hora do mesmo IP, só responde 401 (antes cada POST anônimo gravava em `security_events`).

### B1 — XSS no roteiro impresso

**Onde:** `PresenterNotesPanel.printScript`. A janela `about:blank` herda a origem do app; título, nomes e falas iam crus para `document.write` — com acesso à sessão do Supabase no `localStorage`. Conteúdo é do dono ou da IA (auto-XSS, ou injeção indireta via prompt). **Correção:** `escapeHtml` (`src/lib/html.ts`) em todo texto.

### B2 — Avatares listáveis

A política `avatars_read_auth` liberava `SELECT` em todo o bucket para anônimos: a listagem entregava o UUID de cada usuário com foto. **Correção:** leitura só da própria pasta (a foto exibida usa URL assinada, que não depende dessa política). Limites de 4 MB/imagens no bucket `avatars` e 12 MB/imagens no `slide-images`.

### B3 — MCP

Além do filtro por dono (C1), a busca de artigos montava `or=(title.ilike.%…%,…)` com o texto do cliente; vírgulas e parênteses alteravam o filtro. **Correção:** o termo é limpo antes. O bundle `supabase/functions/mcp/index.ts` foi atualizado junto com as fontes (o build regenera o mesmo código).

### B4, B5, B6

- `chat-editor`, `fetch-image` e `support-chat` não devolvem mais `e.message`; `support-chat` só vincula ocorrências do próprio usuário e códigos existentes no catálogo (código fora do catálogo quebrava a gravação com 500).
- Senha mínima de 8 também em Configurações e na redefinição.
- `can_view_portfolio` revogada de `anon`/`authenticated` (é usada só dentro das funções do portfólio).

---

## 3. O que foi verificado e está correto

- **SQL injection:** o cliente nunca monta SQL; todas as funções recebem parâmetros tipados; nenhuma função usa SQL dinâmico (`EXECUTE`/`format` com entrada). O único filtro montado com texto livre era o do MCP (B3).
- **Escalonamento de papel:** `user_roles` sem escrita do cliente; `has_role` é `SECURITY DEFINER` com `search_path` fixo. A coluna `profiles.role` é só a persona do onboarding (não dá acesso a nada).
- **Funções de cobrança:** todas `SECURITY DEFINER` com `search_path` fixo e executáveis só por `service_role`, exceto as de cliente previstas (`can_user_generate` força `_uid = auth.uid()`).
- **Débito antes da IA:** `generate-presentation` valida acesso, aplica rate limit (12/h; dev 5/h e 5/dia) e debita com `charge_generation` (débito + tentativa na mesma transação, com `FOR UPDATE` no perfil) antes de qualquer chamada cara. Duas gerações simultâneas não gastam o mesmo saldo.
- **Webhook:** fail-closed sem segredo, comparação em tempo constante, segredo fora da query string, idempotência por (evento, pedido), bônus de ativação uma vez por conta (`grant_bonus_credits_once`), estorno restrito ao pedido (`revoke_order_credits`).
- **SSRF:** nenhuma função busca URL fornecida pelo usuário (a extração de identidade de marca foi removida). `fetch-image` só chama Pexels e provedores de IA fixos; a URL de imagem do provedor só é lida, não buscada.
- **Segredos:** o histórico do git só tem a chave `anon` (pública por design, expira em 2036). Nenhuma `service_role`, chave de IA, Pexels, Resend ou Cakto versionada. `service_role` só nas Edge Functions.
- **Redirecionamento aberto:** `?next=` aceita só caminhos relativos; `emailRedirectTo` e o retorno do Google são prefixados pela origem; o consentimento OAuth só segue URLs devolvidas pelo servidor de autorização.
- **Markdown:** `react-markdown` (Central de Ajuda) e `streamdown` (suporte) não renderizam HTML cru; links `javascript:` são neutralizados. Links do portfólio público passam por `safeExternalUrl` (só http/https).
- **Cabeçalhos:** `public/_headers` define HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy` e CSP (com ressalvas em R6).
- **CORS `*`** nas funções autenticadas não abre CSRF: a autenticação é por `Authorization: Bearer`, não por cookie.

---

## 4. Recomendações não aplicadas

### R1 — Apresentações já publicadas por engano

Todas as apresentações criadas até a 0010 estão publicadas, embora os usuários tenham sido informados do contrário. A 0010 já impede a listagem (só quem tem o slug abre), mas cada link continua público. Decisão do dono, com duas opções:

1. **Avisar e deixar o usuário decidir** (recomendado): e-mail explicando que os decks ficaram públicos por engano, com link para o painel.
2. **Tornar privadas as que nunca tiveram visita de terceiros** (quebra links que só o dono abriu):
   ```sql
   update presentations p set is_published = false
    where is_published and created_at < '<data do deploy da 0010>'
      and not exists (select 1 from slide_views v where v.presentation_id = p.id);
   ```

### R2 — Avaliar incidente (LGPD, art. 48)

C1 permitia a qualquer pessoa ler conteúdo de todos os usuários. Siga [lgpd/resposta-a-incidentes.md](../lgpd/resposta-a-incidentes.md): procure nos logs da API (Lovable Cloud → Logs, PostgREST) requisições anônimas a `/rest/v1/presentations` ou `/rest/v1/slides` **sem** filtro de `slug`/`id`, em volume ou de IPs desconhecidos. Sem evidência de acesso indevido, registre a avaliação; com evidência, o plano exige comunicação à ANPD e aos titulares.

### R3 — Configurações do Supabase Auth (fora do repositório)

- **Troca de senha segura** ("Secure password change"): hoje basta uma sessão válida para trocar a senha sem a atual (Configurações e `/reset-password`). Um token roubado vira tomada de conta.
- **Proteção contra senhas vazadas** e **mínimo de 8 caracteres** também no servidor (o front já exige).
- **MFA** obrigatório para contas `admin`/`developer`.
- Lista de **URLs de redirecionamento** restrita aos domínios do produto; expiração curta de links de e-mail.
- **Registro dinâmico de clientes OAuth** (MCP): se estiver aberto, qualquer um registra um app com nome enganoso ("SlideAI Oficial") e usa a tela de consentimento para phishing. Restrinja ou mostre o domínio de retorno na tela (`OAuthConsent.tsx`).

### R4 — Dependências

`npm audit` (dependências de produção, versões resolvidas hoje): 33 avisos (23 altos, sem críticos). Os relevantes em produção:

| Pacote | Aviso | Ação |
| --- | --- | --- |
| `react-router-dom` ≤ 6.30.2 | Redirecionamento aberto/XSS em redirects de data routers | O app usa `BrowserRouter` declarativo (pouco exposto). Atualize para ≥ 6.30.3 |
| `@lovable.dev/mcp-js` (via `@modelcontextprotocol/sdk`) | Cliente OAuth pode enviar credenciais a servidor escolhido pelo MCP | Afeta o lado cliente do SDK; atualize quando a Lovable publicar a correção |
| `pptxgenjs` (via `image-size`) | DoS com imagens JXL/HEIF/ICNS | Exportação roda no navegador do próprio usuário; atualize |

Os demais (vite, rollup, postcss, esbuild, tinypool, glob) são de build e de servidor de desenvolvimento. O `bun.lock` aponta para um espelho privado da Lovable: regenere-o lá depois das atualizações.

### R5 — `.env` versionado

Só contém URL e chave `anon` (públicas por design), mas o `.env.example` já pede para não versionar. Remova do git (`git rm --cached .env`) se a Lovable não depender dele no deploy.

### R6 — CSP

`script-src` tem `'unsafe-inline'` e `'unsafe-eval'`, o que anula a CSP como defesa contra XSS. O build do Vite não gera script inline. Publique primeiro como `Content-Security-Policy-Report-Only` sem os dois, confira o console (Mermaid, KaTeX, jsPDF e o host da Lovable podem precisar de ajuste) e só então aplique. Confirme também se o host respeita `public/_headers` (não dá para verificar daqui).

### R7 — Reembolso depois do consumo

`revoke_order_credits` retira só o saldo que ainda existe: quem compra, gasta tudo e pede reembolso fica com o que gerou. É uma regra de negócio (CDC, art. 49): defina política (reter créditos consumidos, negar reembolso integral após uso, revisão manual) e registre nos Termos.

### R8 — Heurística de eventos da Cakto

Evento de tipo desconhecido com `status: paid` ainda é tratado como pagamento. Para avulso, a 0010 impede crédito duplo; para assinatura, um evento novo redefine a cota mensal do ciclo. Recomendado: tipo desconhecido → ignorar e alertar (`ops_alerts`), depois de confirmar com a Cakto a lista completa de eventos.

### R9 — Conteúdo público como vetor de phishing

Decks publicados ficam em `slideai.com.br/slides/…` e herdam a credibilidade do domínio (texto, imagens, QR codes). Não há links clicáveis nos slides, mas há como orientar a vítima. Recomendado: botão "Denunciar" no visualizador, `noindex` para contas novas e revisão de decks com muitas visitas recém-criados.

### R10 — SPF, DKIM e DMARC

Os e-mails saem pela Resend com o domínio do produto. Confira no DNS: SPF incluindo a Resend, DKIM ativo e DMARC com `p=quarantine` ou `p=reject` (`dig TXT _dmarc.slideai.com.br`). Não verificável daqui.

### R11 — `error_occurrences` sem limite

Usuário autenticado pode inserir ocorrências à vontade (contexto JSON sem teto). Baixo risco; um `CHECK (pg_column_size(context) < 16384)` e um limite por hora resolvem.

### R12 — Monitoração de abuso

`security_events` já registra limites e acessos negados. Crie alertas (`ops_alerts`) para picos de `rate_limited`/`forbidden` por conta e para `record_presentation_view` recusado em volume.

---

## 5. Como implantar e verificar

1. **Ordem: front e Edge Functions primeiro, migração depois.** O código novo funciona com o banco antigo (os RPCs novos caem no caminho anterior se ainda não existirem). O contrário não: com a 0010 aplicada, o visualizador antigo lê as tabelas direto e deixa de abrir decks publicados para visitantes até o front novo entrar no ar.
2. **Migração:** `drizzle/migrations/0010_security_hardening.sql` (cópia idêntica em `supabase/migrations/20261011000100_security_hardening.sql`). Idempotente.
3. **Pós-deploy:**
   - Abrir um deck publicado numa janela anônima (abre) e um privado (não abre); exportar PDF como visitante.
   - Gerar uma apresentação: deve aparecer como **Privada** no painel.
   - Regenerar falas e usar o chat de edição até o limite.
   - Rodar a consulta de tentativas presas do runbook e `select count(*) from access_logs where created_at > now() - interval '1 hour';`.
   - Confirmar com `curl` anônimo que `/rest/v1/presentations?select=id` devolve `[]`.
4. **Testes locais:** `npm test` (inclui `securityHardening.test.ts`) e `supabase/tests/security/run.sh`.

---

## 6. Revisão adversarial do diff

Seção preenchida com o resultado da revisão independente (cinco revisores por dimensão e um verificador por achado tentando refutá-lo).

---

## 7. O que não foi possível auditar

| Área | Por quê | O que fecha a lacuna |
| --- | --- | --- |
| Estado real do banco de produção | Sem acesso; políticas criadas pelo painel da Lovable fora das migrações não aparecem aqui | Rodar `select * from pg_policies where schemaname in ('public','storage')` e comparar com as migrações |
| Configuração dos buckets | Não está no repositório; a 0010 aplica limites se os buckets existirem | Conferir no painel de Storage (público/privado, tamanho, tipos) |
| Supabase Auth | Configuração fora do repositório (R3) | Revisar no painel |
| Cabeçalhos realmente servidos | Não há como saber se o host aplica `public/_headers` | `curl -I https://slideai.com.br` |
| DNS e e-mail (SPF/DKIM/DMARC) | Sem acesso ao DNS (R10) | `dig` nos registros |
| Cakto | Painel, eventos enviados e formato real do payload | Comparar `payment_events.payload` reais com `lib.ts` |
| Gateway de IA da Lovable e provedores | Fora do código | Tetos de gasto na OpenAI e no gateway |
| Execução real das Edge Functions | Sem deploy; `deno check` só nas alteradas (os imports de `esm.sh`/`deno.land` são bloqueados aqui e foram mapeados para `npm:`) | Testar em staging após o deploy |
| Versões exatas instaladas | `bun.lock` aponta para registro privado (403) | `npm audit` no pipeline da Lovable |
| Teste de intrusão em produção | Não autorizado e sem rede para o projeto | Pentest com escopo e autorização formal |
