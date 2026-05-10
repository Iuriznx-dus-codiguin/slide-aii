
# Plano — Mobile QA, Sync de Falas e Enriquecimento Visual

## 1. Auditoria & correções de mobile

Verificação visual via browser tool em viewports 375×812 (iPhone) e 768×1024 (tablet) nas 4 telas críticas: `/generate`, `/editor/:slug`, `/slides/:slug` (viewer normal e fullscreen).

Problemas já identificados na leitura do código (a confirmar visualmente e corrigir):

- **Editor (`src/pages/Editor.tsx`)**
  - Layout principal usa `flex` lado-a-lado fixo: `aside thumbnails (w-44/52)` + `main canvas` + `chat (w-72/80)` + `notes panel (w-80/96)` + `inspector (w-72/80)`. Em telas <1024px estoura horizontalmente.
  - Toolbar (`flex-wrap` mas com botões grandes) quebra em 3+ linhas no mobile.
  - Inline edit overlay tem inputs com `text-2xl` que quebram em telas estreitas.
  - Solução: em `<lg` colapsar thumbnails para faixa horizontal no topo, e transformar inspector/chat/notes em **drawers** (Sheet) acionados por botões na toolbar; canvas ocupa toda a largura.

- **Generate (`src/pages/Generate.tsx`)**
  - Form (`max-w-3xl` + `p-5 md:p-8`) já razoável, mas grid de temas `grid-cols-3` em telas muito pequenas resulta em cards minúsculos — manter `grid-cols-3` mas garantir `min-h-[64px]`.
  - Preview phase: `lg:flex-row` aplica chat lateral em ≥lg; em mobile, chat ocupa `max-h-[40vh]` no topo — verificar se a área do slide remanescente não fica esmagada (provavelmente <300px de altura). Reduzir chat para `max-h-[35vh]` ou colapsável.
  - Header da preview: 3 botões (PDF, Editar, Salvar) em `gap-2` sem flex-wrap — confirmar que cabem em 360px.

- **SlideViewer (`src/pages/SlideViewer.tsx`)**
  - Header com 4–5 botões de ação à direita + título centralizado + "Voltar" — já usa `hidden sm:inline` mas a soma de ícones pode estourar em <360px. Reduzir `gap` em mobile e empilhar título abaixo se necessário.
  - Botões de navegação prev/next sobrepõem o conteúdo do slide em telas <400px (estão a `left-2`/`right-2`). Aceitável, mas podem cobrir texto — adicionar leve fundo gradient atrás.
  - Popover de Falas: `w-[380px]` quebra no mobile (>= viewport). Trocar para `w-[calc(100vw-2rem)] sm:w-[380px]`.

- **SlideRenderer**
  - Várias áreas usam `text-[3.2vw]` / `text-[5vw]` — em mobile o slide fica letterboxed (tela 16:9 estreita), resultando em fontes ainda menores. Verificar legibilidade nos thumbnails do Generate (escala 0.058) e no preview real.

## 2. Sincronização das falas no modo Apresentar

Estado atual em `SlideViewer.tsx::PresenterNotesPopover`:
```
const activeSpeakerId = useMemo(() => {
  const speaking = presenters.find((p) => (p.exact_speech || "").trim().length > 0);
  return speaking?.id ?? presenters[0]?.id ?? "0";
}, [presenters]);
useEffect(() => { setTab(activeSpeakerId); }, [activeSpeakerId]);
```

Problemas sutis:
- O `useMemo` depende de `presenters`, que é recalculado a cada render (novo array via `presentersNames.map`). Isso muda referência mesmo quando o slide não mudou, mas o `activeSpeakerId` em si será o mesmo string → `useEffect` não dispara duplo. OK.
- Quando o popover fica fechado e o usuário troca slides, ao reabrir a aba já reflete o falante atual. OK.
- **Falha real**: os IDs gerados quando não existe `presenters_data` (caso `presentersNames.length > 0` mas o slide veio sem dados) usam o índice do array (`${i}`). Mas em outro slide, o índice pode coincidir com IDs reais de `presenters_data` (uuid) — então o `setTab(activeSpeakerId)` pode tentar selecionar um id inexistente nos `TabsTrigger` de outro slide, deixando a aba "vazia".

Correções:
- Padronizar a chave de aba como **índice do apresentador** (sempre 0..N−1), não o id, para garantir consistência entre slides.
- Adicionar dependência explícita do índice do slide (`slide?.id`) no `useEffect` para garantir reset mesmo se a referência de `activeSpeakerId` permanecer estável.
- Ao mudar de slide, animar o tab indicator (já vem grátis do Radix, mas garantir que o conteúdo da fala atualiza com `motion.div key={slide.id+activeSpeakerId}` para fade rápido em vez de "pop").

## 3. Enriquecimento visual com formas animadas

Hoje só `DefaultSlide` (sem imagem) tem decoração extra (linhas SVG + marcador de canto). Os demais layouts usam apenas `AmbientBackdrop` (orbs + glass + grain).

Criar um componente reutilizável `src/components/SlideDecorations.tsx` com 5 famílias de formas, cada uma animada via Framer Motion, adaptadas ao `theme.accent`:

1. **OrbitalRings** — 2–3 anéis concêntricos SVG com `pathLength` animado + leve `rotate` infinito (slides de section_divider, conclusion).
2. **DotGrid** — grade pontilhada que aparece em wave (delay por linha/coluna), boa para slides de dados/conteúdo.
3. **FloatingShapes** — círculos vazados + quadrados rotacionados + triângulos, posicionados nos cantos com `y: [-10, 10]` infinito.
4. **DiagonalLines** — linhas diagonais com `pathLength` reveal (já existe versão horizontal).
5. **CornerBracket** — colchetes editoriais nos 4 cantos, animados com `clipPath`.

Aplicar nos layouts:
- `QuoteSlide` → OrbitalRings (centro) + CornerBracket
- `StatSlide` → DotGrid de fundo + FloatingShapes
- `Centered/SectionDivider` → OrbitalRings + DiagonalLines
- `DefaultSlide (sem imagem)` → manter linhas atuais + adicionar FloatingShapes
- `ChartSlide` → DotGrid sutil
- `ImageSplitSlide` → CornerBracket no painel de texto + 1 anel pequeno
- `FullImageSlide` → CornerBracket apenas (não competir com a foto)

Todas as formas usam `theme.accent` com baixa opacidade (0.10–0.25), `mix-blend-mode: screen`, e respeitam `useReducedMotion` (estáticas se reduzido).

## 4. Auditoria do uso da timeline engine

Verificado: `useTimeline` + `applyIntent` é usado em `QuoteSlide`, `StatSlide`, `ChartSlide`, `DefaultSlide`. Mas `ImageSplitSlide`, `FullImageSlide` e o bloco `Centered` ainda usam `variants` + `motionMode` legado (presets puros).

- Migrar esses 3 para a engine de timeline com cenários adequados (`buildEditorialScenario` com `applyIntent("narrative-build")` ou criar `buildHeroScenario` para FullImage).
- Garantir que toda track tem keyframe inicial em `t > 0` quando precisa de hold (já tratado no engine).
- Confirmar que `noAnimate` (thumbnails / print) está sendo passado corretamente em todos os subcomponentes — auditar e corrigir se faltar.

## 5. Validação final

- Build pelo harness automático.
- Browser tool: navegar /generate (mobile 375), /editor/:slug (mobile + tablet), /slides/:slug (mobile + fullscreen). Screenshot de cada e verificação de overflow / textos cortados.
- Presentar uma apresentação multi-presenter de teste e trocar slides confirmando que aba+conteúdo mudam instantaneamente.

---

### Arquivos afetados

- `src/pages/Editor.tsx` — refator responsivo (drawers em mobile)
- `src/pages/SlideViewer.tsx` — header responsivo, popover full-width mobile, sync de falas robusto (key por índice + dependência do slide)
- `src/pages/Generate.tsx` — ajustes finos no preview/loading e header
- `src/components/SlideRenderer.tsx` — aplicar decorações + migrar 3 layouts para timeline
- `src/components/SlideDecorations.tsx` *(novo)* — 5 formas animadas reutilizáveis
- `src/components/PresenterNotesPanel.tsx` — chave de aba por índice (paridade com viewer)

Sem mudanças de backend / edge functions / banco.
