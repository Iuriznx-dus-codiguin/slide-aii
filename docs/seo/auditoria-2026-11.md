# Auditoria de SEO e plano para o topo do Google (novembro de 2026)

Auditoria feita com a metodologia do [claude-seo](https://github.com/AgriciDaniel/claude-seo) (v2.6): SEO técnico, conteúdo e E-E-A-T, on-page, dados estruturados, Core Web Vitals, busca por IA (GEO) e imagens. O site em produção não estava acessível do ambiente da auditoria; o diagnóstico foi feito pelo código e por builds locais, e as medições são do Lighthouse rodando localmente.

Nenhuma alteração de código garante a primeira posição: o ranking depende também de autoridade do domínio, concorrência e tempo. O que está abaixo remove os bloqueios técnicos, cria páginas para as buscas que o produto atende e lista o que falta fazer fora do código.

## Diagnóstico

| # | Severidade | Problema | Correção |
| --- | --- | --- | --- |
| 1 | Crítica | SPA sem HTML por rota: toda URL devolvia o mesmo `index.html` com `<div id="root"></div>` vazio e título "SlideAI". Buscadores de IA (ChatGPT, Perplexity, Claude) e prévias de redes sociais não viam conteúdo; o Google dependia da fila de renderização de JavaScript. | Pré-renderização no build: 103 páginas públicas com HTML e `<head>` próprios (`scripts/prerender.ts`). |
| 2 | Crítica | Título da home "SlideAI", sem palavra-chave. Meta tags duplicadas em todas as páginas (as do `index.html` e as do Helmet), e páginas sem `<Seo>` (como `/auth`) herdavam descrição e FAQ da home. | Título "SlideAI: Gerador de Apresentações e Slides com IA"; tags marcadas com `data-rh` para o Helmet assumir; `noindex` em login e área logada. |
| 3 | Alta | Templates eram botões que abriam um modal: nenhum link rastreável e nenhuma página para buscas como "modelo de apresentação de TCC" ou "estrutura de pitch deck". | 12 guias em `/templates/<id>` com estrutura slide a slide, dicas, erros comuns e FAQ (`src/lib/templateGuides.ts`). |
| 4 | Alta | `robots.txt` liberava as áreas logadas e tinha grupos nomeados (Googlebot, Bingbot) que fariam esses robôs ignorar regras gerais. | Um grupo `*`, áreas privadas bloqueadas, páginas públicas e conteúdo publicado liberados. |
| 5 | Alta | 17 famílias de fonte por `@import` encadeado no CSS, em todas as páginas (bloqueio de renderização). | Fontes da interface no `<head>`; fontes dos temas só com o renderizador de slides (`src/lib/slideFonts.ts`). |
| 6 | Alta | Título e subtítulo do topo da home começavam com `opacity: 0` e só apareciam depois do JavaScript (885 KB): LCP alto. | Topo sem animação de entrada; mockup anima só com movimento. |
| 7 | Média | Menu com âncoras `#how` quebradas fora da home. | Âncoras `/#how` e links para Templates e Ajuda. |
| 8 | Média | Respostas do FAQ fora do HTML (acordeão desmontado quando fechado). | Respostas no HTML, fechadas com `hidden`. |
| 9 | Média | Dados estruturados incompletos e um JSON-LD de FAQ mantido à mão no `index.html`. | Organization, WebSite, SoftwareApplication com preços reais, BreadcrumbList, Article, CollectionPage, ProfilePage, gerados do código (`src/lib/seo.ts`). |
| 10 | Média | Página Sobre com ~200 palavras e sem sinais de confiança. | Seções "O que o SlideAI faz", "Como usamos a IA" e "Nossos compromissos". |
| 11 | Média | Visualizador público (`/slides/…`) e portfólio (`/u/…`) sem canonical nem descrição própria. | `<Seo>` com título, descrição e canonical; `noindex` quando a apresentação está privada ou fora do ar. |
| 12 | Baixa | `favicon.png` de 578 KB, sem `apple-touch-icon` e sem cache longo para `/assets`. | Favicon 192×192 (26 KB), ícone Apple e cache de 1 ano para arquivos com hash. |

## Como a pré-renderização funciona

- No build, o plugin `scripts/prerender.ts` compila `src/entry-server.tsx` para Node e renderiza cada rota pública com React. Grava `dist/index.html` para `/` e `dist/<rota>.html` para as demais (`dist/sobre.html`, `dist/ajuda/<slug>.html`), o formato que hosts estáticos servem em URLs sem extensão.
- No navegador o React monta por cima (`src/lib/prerender.ts`): enquanto o código da página carrega, o fallback mostra o mesmo HTML em vez do spinner, e a Central de Ajuda começa com os dados embutidos e busca a versão publicada no banco em seguida.
- O `index.html` da home também é o fallback da SPA em rotas não pré-renderizadas (`/slides/…`, `/u/…`, área logada). Por isso ele não leva canonical, e um script no `<head>` esconde o conteúdo da home nessas rotas até o React montar a rota certa.
- Na hospedagem da Lovable, só a home é servida a partir desse HTML; as demais páginas chegam aos robôs verificados pela renderização da própria Lovable (veja a seção seguinte).
- Se a pré-renderização falhar, o build continua como SPA e avisa no log (`SLIDEAI_PRERENDER_STRICT=1` faz o build falhar). `src/test/prerender.test.tsx` renderiza todas as rotas nos testes.

## Resultados medidos (Lighthouse local, celular, com gzip)

| Página | Antes | Depois |
| --- | --- | --- |
| Home: performance | 62 a 67 | 71 a 84 |
| Home: LCP | 6,8 s | 3,7 a 4,6 s |
| Home: elemento do LCP | imagem do mockup, depois do JavaScript | subtítulo, já no HTML |
| Home: peso total | 1.693 KiB | 1.240 KiB |
| SEO (Lighthouse) | 100 | 100 |
| Palavras visíveis sem JavaScript na home | 0 | ~1.300 |
| Páginas com HTML próprio gerado no build | 0 | 103 (na Lovable, só a home é servida assim; veja a seção seguinte) |

O Lighthouse executa JavaScript, por isso já dava 100 em SEO antes: o ganho principal aparece para quem não executa (buscadores de IA, redes sociais) e na velocidade com que o Google processa as páginas.

## Como a hospedagem da Lovable serve as páginas (verificado no ar em 22/11/2026)

- **Pessoas e robôs não verificados:** toda URL sem extensão recebe o `index.html`. Só a home (`/`) chega com o HTML pré-renderizado do build; em `/sobre`, `/templates/…` e `/ajuda/…` o conteúdo da home vem escondido (script de fallback) e o React monta a página certa. Os arquivos `<rota>.html` do build ficam acessíveis só pelo endereço com `.html` (cada um com canonical para a URL limpa) e serviriam numa hospedagem que resolva URLs limpas.
- **Robôs verificados** (Google, Bing, ChatGPT, Perplexity, Claude, Gemini e prévias de redes sociais): a Lovable renderiza cada página na hora e entrega o HTML resultante (documentação de SEO da Lovable). O que carrega depois desse momento pode ficar de fora. Foi assim que se descobriu o problema dos artigos da Central: o artigo só aparecia depois de três consultas ao banco, e a cópia saía com o título certo e o corpo vazio. Corrigido: o artigo aparece logo após a primeira consulta.
- **Banco pausado:** sem o banco, os artigos viravam "não encontrado" com `noindex`, e o renderizador da Lovable guarda essas cópias por um tempo. Agora uma falha de conexão mostra um aviso com "Tentar novamente", sem `noindex`. Depois de uma pausa do banco, peça nova indexação dos artigos no Search Console.
- **`public/_headers` não é aplicado pela Lovable:** o arquivo é servido como arquivo comum. Os arquivos de `/assets` já recebem cache longo da própria Lovable, mas os cabeçalhos de segurança listados ali (CSP, X-Frame-Options, Permissions-Policy) não estão ativos no site.

### Como conferir o que os robôs recebem

A Lovable entrega a versão em Markdown da página renderizada a quem pede, o mesmo conteúdo que um robô verificado lê:

```sh
curl -s -H "Accept: text/markdown" https://slideai.com.br/ajuda/reembolso | head -40
```

O título deve ser o do artigo e o texto do artigo deve aparecer abaixo do cabeçalho. Também vale usar a Inspeção de URL do Search Console ("Testar URL publicado") e o [Teste de pesquisa aprimorada](https://search.google.com/test/rich-results).

## O que falta fazer fora do código

Em ordem de impacto:

1. **Google Search Console:** reenviar o `sitemap.xml`, pedir indexação da home e dos 12 guias de template, e acompanhar os relatórios Páginas e Core Web Vitals. Repetir no **Bing Webmaster Tools** (importa a configuração do Search Console).
2. **Dados da empresa:** preencher razão social, CNPJ e endereço em `src/lib/legal.ts`. São exigidos pelo Decreto 7.962/2013 e entram automaticamente no JSON-LD da organização, um sinal de confiança (E-E-A-T).
3. **Perfis oficiais:** criar ou listar Instagram, LinkedIn e YouTube da marca e acrescentá-los em `sameAs` no `organizationJsonLd` (`src/lib/seo.ts`).
4. **Menções da marca:** segundo o claude-seo (estudo da Ahrefs com 75 mil marcas), menções em YouTube, Reddit e sites de referência se correlacionam cerca de 3 vezes mais com citações em buscadores de IA do que backlinks. Tutoriais em vídeo, parcerias com professores e universidades e diretórios brasileiros de ferramentas de IA são o caminho natural.
5. **Conteúdo novo a partir de dados reais:** usar as consultas do Search Console (e o Planejador de Palavras-chave) para escolher os próximos guias, como "quantos slides em uma apresentação" ou "como fazer slides para seminário". Seguir o padrão dos guias de template: conteúdo próprio, útil e revisado, nunca páginas em massa com troca de palavras.
6. **Avaliações reais:** quando houver avaliações de clientes visíveis no site, dá para marcá-las com `AggregateRating`. Nunca inventar notas.
7. **Peso do JavaScript inicial:** o pacote da home tem 885 KB (269 KB com gzip), principalmente Supabase/autenticação e animações. Adiar o login para quem não está logado melhora o INP e o LCP no celular.
8. **Selo "Powered By GPT-6 Astra" no topo da home:** a Política de Privacidade cita OpenAI e Google (Gemini) como provedores. Confirme que o selo corresponde ao modelo realmente usado; uma afirmação que o visitante não consegue verificar enfraquece a confiança.

## Manutenção

- Página pública nova: incluir em `src/entry-server.tsx`, em `scripts/prerender-routes.ts` e no sitemap (`scripts/help-center.ts`), com um `<Seo>`.
- Artigo novo na Central de Ajuda: o fluxo de sempre (`docs/central-de-ajuda/README.md`); o sitemap e a pré-renderização pegam o artigo sozinhos.
- Página privada nova: dentro de `ProtectedRoute` (já leva `noindex`) e no `public/robots.txt`.
