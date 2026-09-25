# Motor criativo v2 — o que mudou e por quê

Complementa `01-auditoria-e-impacto.md` (diagnóstico e impacto por arquivo) e
`02-prompt-lovable.md` (o que aplicar fora do repositório).

## Em uma frase

Cada slide passou a ser uma **cena de 4 camadas**: fundo → decoração → bloco
visual → texto. Quem decide o visual é um planejador determinístico, não a
IA de texto, e o motor novo roda atrás de `engine_version: 2`. O motor
atual continua intacto para comparação, e os decks antigos renderizam como
antes.

## Pipeline

| Etapa | Onde | IA? |
|---|---|---|
| Direção (brief + roteiro, em paralelo) | `creativeDirector.ts`, `storyEngine.ts` | 2 chamadas de texto, as mesmas de antes. O roteiro agora também traz `visual_intent` e `key_objects` |
| Plano Visual | `visualPlanner.ts` | não, determinístico |
| Conteúdo | `generate-presentation/contentV2.ts` | 1 chamada (ver abaixo) |
| Resolução | `sceneResolver.ts` | não |
| Persistência | `generate-presentation/persist.ts` | não |
| Ativos | Editor (`useProgressiveAssets`) → `fetch-image` | imagem só onde aparece |
| Quality Gate | `qualityGate.ts` (servidor), `SceneSlide`/`VisualBlock` (cliente) | não |

A contagem de chamadas de texto é a mesma. A exceção é deliberada: um deck
com **mais de 14 slides e falas** divide o conteúdo em **2 chamadas
paralelas**. Os tokens totais não mudam, a latência cai e o risco de
resposta truncada também. O retry deixou de refazer o deck inteiro: pede só
os slides que faltaram, e o que ainda faltar é preenchido a partir do
roteiro.

## Os 9 pontos do diagnóstico

| # | Problema | O que foi feito |
|---|---|---|
| 1 | Imagem buscada em todo slide, exibida em poucos | Uma única regra, `slideDisplaysMedia` (`_shared/sceneMedia.ts`), decide se há slot de mídia. O resolvedor só cria ativo onde a regra diz que aparece, e o renderer usa a mesma regra. O v1 também só cria ativo pendente em layouts que mostram imagem. Invariante **pedidas = exibidas**, com teste. |
| 2 | Fallback Pexels→IA sem login | `fetch-image` só cai para a IA com usuário logado, `allow_ai_fallback` ligado e cota (por apresentação ou o limite genérico). Anônimo nunca gera por IA. |
| 3 | Campos do schema sobrescritos ou nunca lidos | O schema v2 não tem `slide_title`, `animation`, `ai_image_prompt` nem `narrative_act`, e tem `index` obrigatório. O v1 continua igual. O seletor de animação do Editor grava `motion`, que agora tem efeito também em slides v1. |
| 4 | ~5 mil tokens fixos | O prompt v2 leva o brief compacto, uma linha de plano por slide e só o contrato dos comandos que aparecem no plano. Layouts, acentos e animações são decididos em código. |
| 5 | Retry refaz o deck inteiro | O retry pede só os índices faltantes. |
| 6 | `creative_brief` salvo nulo | A persistência vai para o servidor e usa o brief da própria geração. O caminho legado no cliente (`legacyPersist.ts`) lê o brief da resposta, não do estado React. |
| 7 | Deck gravado só depois das imagens | O servidor grava o deck antes de responder e o cliente vai direto para o Editor, que resolve as imagens de forma progressiva e retomável. Fechar a aba não perde o deck pago. |
| 8 | `no-background` com fundo branco | Recortes pedem `background: transparent` em webp. O legado `no-background` também passou a ser transparente. |
| 9 | `COSTS.aiImage` errado e duplicado | Registro único de modelos e preços (`_shared/modelRegistry.ts`), usado pelo edge e pelo Dev Mode. O custo real vem do `usage` da API quando existe. |

Os achados extras da auditoria também foram tratados:

- A fase de preview morta saiu do Generate.
- `NarrativeAct`, temas, slug, fonte automática e `densityScore` vêm do `_shared`.
- O PPTX lê o tema de `presentations.dynamic_theme`.
- `DataPattern` e `WaveForm` ganharam desenho próprio nas cenas v2 (o `AccentLayer` do v1 não mudou).
- O `cubicBezier` do framer-motion substituiu o `bezierY` aproximado.
- `background_image_url` passou a ser preenchido quando a imagem da capa chega.

## Renderização

- O **SlideStage/SlideRenderer continua sendo o ponto único** de Editor,
  Generate e Viewer:
  - slide v2 com bloco visual → `SceneSlide`;
  - slide v2 só de texto → layout clássico sobre o fundo de cena;
  - qualquer slide sem `engine_version: 2` → caminho clássico, sem mudança.
- **Visuais nativos** usam uma geometria pura (`src/lib/scene/diagramLayout.ts`),
  que também desenha os shapes do PPTX: fluxo e pipeline, ciclo, linha do
  tempo, comparações, funil, pirâmide, camadas, dados, sistema e mapa
  conceitual.
- **Mídia gerada** vem de receitas do Image Director, sempre sem texto. Nos
  híbridos, os rótulos ficam numa legenda numerada nativa e editável.
- Um ativo que falha cai no gêmeo nativo do comando (ou num cartão
  editorial). O slot nunca fica vazio.
- **Movimento** é JSON declarativo (`{ preset, params }`) convertido num
  cenário da Timeline Engine que já existia, com uma camada ambiente
  separada da entrada. As **âncoras do magic move só existem no modo
  dinâmico**. No clássico, nada muda.
- **Exports:**
  - o PDF rasteriza offscreen com fallbacks estáticos dos efeitos que o
    html2canvas não desenha;
  - o PPTX usa shapes e gráficos nativos, rasteriza só o slot dos visuais
    complexos e mantém o texto como caixa editável.

## Regras preservadas

| Regra | Como foi garantida |
|---|---|
| Créditos, cobrança e estorno intocados | Nenhuma linha dessa lógica mudou; no diff de `generate-presentation`, só reindentação do caminho v1. A migração não toca em créditos. |
| SlideStage como ponto único | O desvio para o `SceneSlide` acontece dentro do `SlideRenderer`. |
| Modo dinâmico × clássico | `anchor_key` só é gravado com o modo dinâmico ligado (teste). O fluxo de transições do clássico não foi alterado. |
| Tipo, persona, profundidade, tema, tipografia, capas, falas, templates | O prompt e o pós-processamento do v1 são os mesmos. O v2 reusa `personaGuide`, `depthGuide`, `autoFontForContext`, as capas e as falas (`speeches.ts`, extraído do handler sem mudar a lógica). A profundidade de texto escala a capacidade das caixas. |
| Decks antigos iguais | O renderer decide pelo `engine_version` gravado em cada slide. A conversão do v1 não ganha campos do v2 (teste). |

Uma regra nova, só no v2: **sem imagens, uma capa desenhada para foto**
(`split-hero`/`full-bleed-image`) vai para a variante tipográfica
equivalente (`asymmetric-grid`/`gradient-mesh`), em vez de ficar com o slot
vazio. O v1 não muda.

## Testes (vitest, `src/test/`)

| Suíte | Cobre |
|---|---|
| `visualPlanner.test.ts` | Determinismo, plano em JSON puro, invariantes por opção: sem imagens, economia, teto de fotos e IA, sem repetição consecutiva, ritmo |
| `sceneResolver.test.ts` | Cadeia de fallback, registro sem ciclos, deck que não quebra com visual inválido ou faltante, **pedidas = exibidas** em 6 variações, âncoras só no dinâmico, v1 sem campos do v2 |
| `catalogParity.test.ts` | Schemas das ferramentas de IA (Deno) × renderer, Editor, HUD, capas, fundos, timeline (Vite); ícones, fontes, temas |
| `sceneMotion.test.ts` | Validação e round-trip do JSON de movimento; os 17 presets geram cenário determinístico, finito e serializável |
| `imageDirector.test.ts` | Nenhum pedido de texto chega ao prompt, restrições fixas, marcadores só em híbridos, recorte transparente |
| `qualityGate.test.ts` | Contraste AA, excedente nas notas (bullets preservados), ritmo, geometria dos diagramas dentro do slot |

São 167 casos novos. Eles encontraram 4 defeitos, já corrigidos:

- bullets cortados eram perdidos nas notas;
- a capa com foto ficava sem foto quando as imagens estavam desligadas;
- a capa pedia `image_query` sem imagens;
- uma tipagem estava errada no `editDirector`.

## O que foi verificado neste ambiente (e o que não foi)

A instalação das dependências foi bloqueada neste ambiente (o registro de
pacotes do lockfile respondeu 403). Por isso, **`npm run build` e `vitest`
não rodaram aqui**. Rodaram, sobre a instalação parcial que existia:

- **TypeScript** (`tsc`) no app inteiro: nenhum erro além de "pacote não
  instalado". As edge functions foram checadas em `strict` com um stub do
  Deno; o único erro vem do próprio stub. O baseline (`HEAD` anterior) tem
  os mesmos erros pré-existentes.
- **esbuild** empacotou o app e as quatro edge functions sem erro. As
  dependências externas do app são exatamente as mesmas de antes (nenhum
  pacote novo).
- **ESLint:** nenhum achado novo além de `no-explicit-any` no estilo do
  código ao redor e avisos de fast-refresh.
- As **6 suítes novas e as suítes puras existentes** (`creativeEngines`,
  `slideComposition`, `compositionEngine`) rodaram com um shim do vitest
  sobre Node. `morphing`, `slideTransitions` e `transitionNames.sync`
  dependem de pacotes não instalados e não rodaram aqui.
- Testes de integração com mocks de `generate-presentation`:
  - v2 gravado no servidor;
  - v1 gravado no servidor;
  - cliente legado;
  - divisão com retry parcial;
  - banco sem a coluna nova.
- Testes de integração com mocks de `fetch-image`, 7 cenários:
  - receita;
  - modelo indisponível → próximo da cadeia;
  - anônimo sem IA;
  - economia sem IA;
  - fallback logado com cota;
  - legado transparente;
  - 401.

A etapa 5 do `02-prompt-lovable.md` roda o build e o vitest de verdade.

## Ressalvas e próximos passos

- **Preço do `gpt-image-2.5-flare` é estimado** (`estimated: true` no
  registro). O custo real passa a vir do `usage` da API quando ela devolver.
  Se o modelo não estiver disponível na conta, a cadeia cai para
  `gpt-image-1-mini`.
- **As economias de tokens do v2 são estimativas de calibração** até existir
  tráfego real: 470 × 780 tokens de saída por slide e prompt fixo menor.
  O painel "Métricas Dev" compara `output_per_slide`, custo, tempo, fração
  de slides só de texto e imagens pedidas × exibidas por motor. Use-o antes
  de subir `ENGINE_V2_ROLLOUT_PERCENT`.
- **Export PNG** (menu de export) continua capturando o DOM ao vivo do
  Viewer, sem os fallbacks estáticos. Em slides v2 com efeitos (aurora,
  grain), o PNG pode sair diferente da tela. O PDF e o PPTX já usam a
  rasterização offscreen.
- **Rasterizador:** um baseado em `foreignObject` (html-to-image) desenharia
  filter e blend nativamente. Fica como avaliação futura; o fallback
  estático garante a paridade tela × arquivo sem dependência nova.
- `MAP_VIEW` e `ROUTE_MAP` estão no registro com `mvp: false`: o planner e a
  IA não os oferecem até existir um desenho de mapa.
- Os testes de paridade leem os componentes React como texto (nomes de
  `case` e chaves de mapas), porque montá-los exigiria DOM. Se alguém
  renomear o switch do `VisualBlock`, por exemplo, o teste acusa.
