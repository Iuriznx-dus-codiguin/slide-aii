# Motor criativo v2 — auditoria e impacto por arquivo

Auditoria do fluxo real de ponta a ponta, feita **antes** de qualquer alteração:
`generate-presentation` e os módulos de `_shared`, `fetch-image`, `Generate.tsx`,
`SlideStage`, `SlideRenderer` e tudo que ele renderiza, `timeline`, transições,
exports, `chat-editor` e `editDirector`.

## 1. Pontos do diagnóstico — confirmados no código

| # | Diagnóstico | Evidência | Status |
|---|---|---|---|
| 1 | Imagem buscada em todo slide, exibida em poucas variantes | `SYSTEM_PROMPT` PASSO F exige `image_query` em todo slide de conteúdo. `SlideRenderer` só exibe `image_url` em `full-image`, `image-left/right` e nas capas `split-hero`/`full-bleed-image` (`CoverLayouts.tsx:54,106`). `DefaultSlide` usa `hasImage` só para escolher acentos. `exportPptx.ts` segue a mesma regra. Toda imagem de `title-content`, `two-columns`, `quote`, `stat`, `data-chart` e `centered` é paga e nunca aparece, e as chamadas `ai` contam no limite de 15/h. | Confirmado |
| 2 | Fallback Pexels→IA sem login | `fetch-image/index.ts:300-318`: na estratégia `pexels` sem resultado, gera por IA sem exigir `userId`, sob o limite público de 60/h por IP. | Confirmado |
| 3 | Schema obriga campos sobrescritos ou nunca lidos | `narrative_act` é trocado pelo do Story Engine (`index.ts:897`); `animation` sempre perde para `animation_intent` (`SlideRenderer.tsx:613`, `presetFromIntent` primeiro); `slide_title` duplica `headline` e não é lido; `ai_image_prompt` é "SEMPRE preencha" mesmo em slide Pexels. | Confirmado |
| 4 | ~5 mil tokens fixos por geração | Prompt de sistema com catálogos de layout (PASSO E), acentos, estilos de imagem (PASSO F) e distribuição (E.1) que `assignLayouts`/`accentsFor` já impõem em código, mais o schema com 14 acentos, 10 animações e 11 layouts. | Confirmado |
| 5 | Retry refaz o deck inteiro | `index.ts:822-852`: abaixo de 70% dos slides, nova chamada completa no Gemini em vez de pedir só os faltantes. | Confirmado |
| 6 | `creative_brief` salvo nulo | `Generate.tsx:375` chama `setCreativeBrief` e, na mesma execução, `persistAndOpenWith` (`:456`) lê o estado antigo (`null`) da closure. Editor, Viewer e PDF rodam Motion Director e espaçamento sem brief. | Confirmado |
| 7 | Deck gravado só depois de todas as imagens | `Generate.tsx:358-381`: `resolveImages` (até 20 chamadas) antes do `insert`. Fechar a aba nesse intervalo perde um deck já cobrado (o débito acontece no servidor no início). | Confirmado |
| 8 | `no-background` = fundo branco | `STYLE_SUFFIX["no-background"]` pede "pure white background"; não há `background: transparent` na chamada OpenAI. Vira retângulo branco em tema escuro. | Confirmado |
| 9 | `COSTS.aiImage` errado e duplicado | `0.039` (preço do Gemini Flash Image) em `generate-presentation/index.ts:64` e `src/lib/devSettings.ts:29`, mas o primário é `gpt-image-1-mini` quality `low`. Painel de custos incorreto. | Confirmado |

Achados extras da leitura:

- **Fase `preview` morta** em `Generate.tsx`: nada chama `setPhase("preview")`, então ~180 linhas de chat e preview nunca rodam.
- **Seletor de animação sem efeito** no Editor: grava `animation`, que sempre perde para `animation_intent`.
- **`NarrativeAct` sincronizado à mão** entre `storyEngine.ts` e `CinematicHUD.tsx` (o comentário no código admite isso).
- **Capa `asymmetric-grid`** é sugerida pelo prompt "quando o símbolo for forte visualmente", mas o componente não exibe imagem.
- **Export PPTX** lê `dynamic_theme` de `slides[0].content`, que as gerações novas não gravam (o tema fica em `presentations.dynamic_theme`), então o PPTX sai com o tema padrão.
- **`data-pattern` e `wave-form`** são apelidos de `DotGrid` e `DiagonalLines`.
- **`bezierY` do Timeline Engine** assume t≈x, o que distorce `snap` (overshoot) e `inertia`.
- **`background_image_url`** (capa do portfólio público) nunca é preenchido pela geração.

## 2. Decisões estruturais (com justificativa)

1. **Motor v2 atrás de `engine_version`.** O caminho v1 (prompt, schema e pós-processamento) fica intacto para comparação. O v2 é escolhido por `engineVersion: 2` no pedido (Dev Mode) ou por rollout percentual no servidor (`ENGINE_V2_ROLLOUT_PERCENT`, padrão 0). Nenhum corte vira definitivo sem os dados de `generation_logs.metadata`.
2. **A persistência vai para o servidor nos dois motores.** A perda de deck pago e o brief nulo são bugs do fluxo atual, não do motor. O cliente anuncia `persist: "server"`. Um cliente antigo, sem a flag, continua recebendo `slides` e não duplica o deck. Um servidor antigo, sem `slug` na resposta, faz o cliente cair no caminho legado já com o brief corrigido.
3. **Catálogos puros em `supabase/functions/_shared`**, no padrão de `transitionNames.ts`, importados pelos dois runtimes (fim da sincronia manual Deno/Vite).
4. **Uma função decide "slot de mídia"** (`sceneMedia.ts`) e é usada pelo resolvedor (que pede o ativo) e pelo renderer (que o exibe). A invariante imagens solicitadas = imagens exibidas vale por construção e é testada.
5. **Matemática de layout dos diagramas em módulo puro**, usada pelo SVG/HTML da tela e pelos shapes do PPTX: uma geometria só, testável.
6. **Motion em JSON (`{ preset, params }`)** gerado sobre o `TimelineScenario` que já existe, sem dependência nova.
7. **Cota de ativos por apresentação** em tabela própria (migração), com fallback para o limite genérico enquanto a migração não for aplicada.

## 3. Impacto por arquivo

### Novos (puros, sem dependência, importados por Deno e Vite)

| Arquivo | Papel |
|---|---|
| `_shared/sceneCatalog.ts` | Intenções visuais, domínios, atos narrativos, `domainFromContext` |
| `_shared/visualCommands.ts` | Registro de comandos: render_mode, componente, layouts, min/max, movimento, receita, export, fallback |
| `_shared/sceneIcons.ts` | Lista curada de ícones lucide permitidos |
| `_shared/motionPresets.ts` | Presets de movimento e o mapeamento por comando/intenção |
| `_shared/modelRegistry.ts` | Modelos de texto e imagem por etapa, capacidades, preços e `COSTS` |
| `_shared/textMetrics.ts` | Densidade e capacidade de texto (extraído do `compositionEngine`) |
| `_shared/typography.ts`, `_shared/slug.ts` | `autoFontForContext`, ids de pares tipográficos, `generateSlug` (servidor e cliente) |
| `_shared/sceneMedia.ts` | "Este slide exibe mídia?" — fonte única do renderer e do resolvedor |
| `_shared/visualPlanner.ts` | Plano Visual determinístico (absorve e estende `assignLayouts`/`accentsFor`) |
| `_shared/sceneResolver.ts` | Validação, cadeia de fallback, derivações, ativos e Quality Gate do servidor |
| `_shared/qualityGate.ts` | Capacidade de texto, contraste AA, equilíbrio, ritmo |
| `_shared/imageDirector.ts` | Prompt de imagem por receita, sem LLM |
| `_shared/slideContent.ts` | Slide da IA → `slides.content` (núcleo do `aiSlideToContent`) |
| `src/lib/scene/diagramLayout.ts` | Geometria dos diagramas nativos |
| `src/lib/scene/sceneMotion.ts` | `motion` → `TimelineScenario` (determinístico e serializável) |
| `src/components/scene/*` | `SceneSlide` (compositor de camadas), `SceneBackground`, `VisualBlock` e os visuais nativos |
| `src/hooks/useProgressiveAssets.ts` | Resolução progressiva e retomável dos ativos no Editor |
| `supabase/migrations/*_scene_engine_v2.sql` | `engine_version` e cota de ativos por apresentação |

### Alterados

| Arquivo | Impacto |
|---|---|
| `generate-presentation/index.ts` | O ramo v2 usa prompt enxuto, schema com `visual` e sem campos mortos, conteúdo em duas chamadas paralelas acima de 14 slides com falas, retry só dos faltantes, resolução, persistência no servidor, cota de ativos e métricas por etapa. O v1 mantém prompt e schema e ganha só a persistência no servidor. Créditos, cobrança e estorno não mudam (a falha de persistência usa o `failGeneration` existente). |
| `_shared/creativeDirector.ts` | `domain` no brief (IA + fallback derivado do tipo e do título) |
| `_shared/storyEngine.ts` | `visual_intent` + `key_objects` por beat (só no v2), atos vindos do catálogo compartilhado |
| `_shared/slideComposition.ts` | Layouts `visual-hero` e `diagram-full` no repertório. O v1 continua com o conjunto legado. |
| `_shared/editDirector.ts`, `chat-editor/index.ts` | Patches em `visual`/`background`/`motion`, com merge e revalidação pelo resolvedor |
| `fetch-image/index.ts` | Receitas do Image Director, recorte transparente em webp, cadeia de modelos, cota por apresentação, login + cota no fallback Pexels→IA, custo real |
| `src/pages/Generate.tsx` | Navega direto ao Editor pelo `slug`. Remove a fase `preview` morta e a resolução de imagens no cliente (mantidas só como fallback legado). |
| `src/pages/Editor.tsx` | Ativos progressivos, painel Visual, seletor de animação escrevendo em `motion`, layouts novos |
| `src/components/SlideRenderer.tsx` | Slides v2 vão para o `SceneSlide`. Slides sem `engine_version: 2` seguem o caminho atual, byte a byte. |
| `src/components/CinematicHUD.tsx` | `NarrativeAct` derivado do catálogo compartilhado |
| `src/lib/timeline.ts` | `cubicBezier` real do framer-motion, `pathLength`, reveals por clip, spring, trilhas ambiente e amostragem de valores |
| `src/lib/morphing.ts` | `semanticAnchorId` (magic move por `anchor_key`, só no modo dinâmico) |
| `src/lib/aiSlide.ts` | Delega ao núcleo compartilhado e preserva os campos v2 no merge |
| `src/lib/exportPptx.ts`, `src/components/ExportMenu.tsx` | Tema vindo da apresentação, visuais nativos como shapes, complexos como imagem |
| `src/lib/exportPdf.ts` | Modo de efeitos estáticos (fallbacks para html2canvas) |
| `src/lib/devSettings.ts`, `DevModePanel.tsx` | `COSTS` vindo do registro de modelos, toggle do motor v2 |
| `src/components/DevMetricsPanel.tsx` | Latência e tokens por etapa, comandos, fallbacks, imagens solicitadas × exibidas, comparação por motor |
| `src/lib/compositionEngine.ts`, `src/lib/slugify.ts` | Passam a importar do `_shared` (mesma API pública) |

### Não tocados (por regra)

Tabela de créditos, `consume_credits`, `refund_generation_credits`, `can_user_generate`,
`computeCreditsCost` e as mensagens de estorno. A separação entre modo dinâmico e
clássico continua em `pickTransition`. Tipo, persona, profundidade, tema, tipografia,
variantes de capa, falas e templates continuam com a lógica atual e passam a ser
**sinais** do motor novo.
