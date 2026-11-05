# Motor principal (v1) — 11/2026: o melhor do v2, menos tokens, chat que edita de verdade

O **v1 continua sendo o motor principal**: todo cliente gera com ele. O v2
(motor de cenas) segue em teste no Dev Mode. Esta rodada trouxe para o v1 o
que o v2 tem de sólido e deixou de fora o que ainda é instável nele.

## O que mudou na geração

| Antes (v1) | Agora |
| --- | --- |
| A capa recebia um título inventado pela IA ("Espanha: séculos de glória") e o título salvo era o texto cru, com erros. | Capa e título salvo = **o título pedido, só com correção de ortografia, acentos e maiúsculas** ("historia da espanha" → "História da Espanha"). A correção da IA é validada (`_shared/deckTitle.ts`): reescrita, sinônimo, tradução ou palavra a mais são recusados; um subtítulo acrescentado é cortado. Sem correção válida, entra a correção determinística. |
| Imagem da capa às vezes genérica; capa tipográfica mesmo com imagens ligadas. | Com imagens, a capa **sempre** mostra o símbolo mais literal do tema (busca em inglês pedida no prompt; fallback com receita do Image Director). Sem imagens, variante tipográfica (nunca slot vazio). |
| Prompt de ~15 mil caracteres + schema com campos que o código sobrescrevia (layout, acentos, animação, ato narrativo, `slide_title`, `ai_image_prompt` "SEMPRE preencha"…). | Prompt de ~6 mil caracteres e schema enxuto (`generate-presentation/contentV1.ts`). Entrada total por geração de 10 slides: **~21 mil → ~10,6 mil caracteres** (≈ −50%), e menos tokens de saída por slide. |
| Retry refazia o deck inteiro no Gemini Pro quando faltavam slides. | Retry **só dos slides que faltaram**, decks grandes com falas em 2 chamadas paralelas (mecânica do v2, `contentCall.ts`). |
| Layout sorteado sem olhar o conteúdo: "citação" sem citação, "seção" escondendo bullets, foto buscada para slide que não a exibia. | **Composição pelo conteúdo** (`_shared/deckComposer.ts`): a IA escolhe UM protagonista por slide (texto, diagrama, gráfico, número, citação ou foto) e o código decide layout, acentos, animação e fundo. Imagem só onde aparece (pedidas = exibidas). |
| Gráfico aparecia mesmo com "Gráficos & dados" desligado; paleta da IA gravada mesmo com tema fixo. | O formulário manda: sem gráficos não há `chart`; sem imagens não há busca; tema fixo não recebe paleta da IA; slide dinâmico liga/desliga o magic move em todos os slides; a profundidade escala o texto e o teto de saída. |

### Recursos do v2 que entraram no v1

- **Diagramas nativos** (custo zero de imagem, texto editável e animado): linha
  do tempo, fluxo de processo, passo a passo, ciclo, lado a lado, antes/depois,
  funil, pirâmide e mapa conceitual. Validados pela cadeia de fallback do v2
  (ex.: fluxo com 2 etapas → sequência; sem dado → bullets) e desenhados pelo
  `SceneSlide`.
- **Gráficos**: novo tipo `horizontal-bar` (ranking/rótulos longos), unidade,
  **fonte do dado visível** e o **número em destaque** do DataScene (último
  ponto + variação numa série temporal; maior valor num ranking; maior fatia
  numa pizza), descrição acessível do gráfico e exportação nativa no PPTX
  (inclusive rosca e barras horizontais).

### O que ficou de fora do v1 (instável no v2)

- Plano visual forçado slide a slide e "resgate de ritmo" que convertia bullets em diagrama automaticamente.
- Visuais técnicos gerados por IA (vista explodida, corte, raio-x) — dependem de imagem com marcadores numerados.
- Grafos de sistema (arestas inconsistentes vindas da IA).

### Correções em recursos do v2 (valem para os dois motores)

- **Linha do tempo**: cartões ~1,8× mais largos (eventos vizinhos ficam em lados opostos do eixo), datas em destaque e pinos sempre redondos.
- **Diagramas**: a geometria usa a proporção **medida** do espaço do slide (antes era estimada e o SVG esticava conectores e pinos).
- **Tipografia dos itens** de 0,9 para ~1,02 do slide (legível em projetor, na faixa em que o Quality Gate mede a capacidade).
- **Comparação**: cartões com a altura do conteúdo (antes esticavam vazios até o fim do slot).
- **Números**: "1,46 tri" não vira mais "1.46 tri" na animação.

## Edição por chat

| Problema | Correção |
| --- | --- |
| Pedido sem número de slide virava edição do **deck inteiro** (caro, contava como edição complexa e mexia em slides que ninguém pediu). | O **slide aberto no editor** é o alvo padrão. Número, ordinal ("terceiro slide"), "capa", "próximo slide" e "todos os slides" continuam valendo. A chamada de classificação por IA só acontece quando a referência é ambígua ("no slide sobre Roma"). |
| "Remover um elemento" não funcionava: o servidor descartava campos vazios. | Remoção **explícita** (`remove: ["image", "subtitle", "bullets", "stat", "quote", "chart", "visual"…]`) e exclusão do slide inteiro (`remove_slide`). |
| "Trocar a imagem" não trocava: a URL antiga voltava na mesclagem do editor e nenhuma busca nova era feita nos slides do v1. | `null` explícito apaga no merge; a troca cria um **ativo pendente** que o editor resolve em segundo plano (Pexels primeiro, IA de reserva). Link https colado pelo usuário é usado direto. Slide de texto que ganha imagem muda para um layout que a exibe. |
| Layout podia ficar pedindo um elemento removido. | Layout e tipo reconciliados com o conteúdo depois de cada edição. |
| Mudança ficava só na tela até o autosave (30 s). | Salva na hora; "Desfazer edição da IA" continua disponível. |
| Prompt enviava o slide inteiro (URLs, ativos, DNA de animação). | Só os campos editáveis vão para a IA; teto de saída proporcional ao escopo. |

## Página de apresentação

Medido com CPU 4× mais lenta (celular intermediário), mesma apresentação, 9 trocas:

| Métrica | Antes | Depois |
| --- | --- | --- |
| Tempo médio por quadro | 70–76 ms | 41–44 ms |
| Quadro p95 | 250–267 ms | 117 ms |
| Slide parado (só animação ambiente) | 264 ms (~4 fps) | 29–31 ms (~33 fps) |
| CPU da thread principal | 17,5 s | 14,2–14,6 s |

O que mudou:

- Orbes e campos de cor sem `filter: blur()` nem `mix-blend-mode` (o degradê radial já é o desfoque) e animados por CSS no compositor; partículas por CSS em vez de 22 animações JavaScript por slide.
- Vídeo de fundo só em aparelhos que aguentam (sem economia de dados, sem rede lenta, fora de celular/tablet) e pausado com a aba em segundo plano; sem `backdrop-filter` sobre o vídeo.
- Camada de transição montada só durante a troca (o mosaico deixava 40 camadas na tela); `will-change` e 3D só onde a transição precisa.
- Imagem do próximo e do anterior pré-carregada (a troca não espera download).
- "Reduzir movimento" do sistema: o slide entra no quadro final, sem loops.
- Acessibilidade: botões com rótulo, anúncio do slide atual para leitores de tela, barra de progresso semântica, navegação dos pontos com `aria-current`, teclas ignoradas quando o foco está em campo/menu, gesto de arrastar só sobre o slide, controles revelados também pelo teclado em tela cheia. Os quadradinhos pretos sobre os pontos de navegação sumiram.

## Dados reais usados (banco, só leitura)

Antes do merge, `generation_logs` foi consultado (somente leitura, números agregados — sem títulos nem conteúdo de usuários) para calibrar o teto de tokens de saída do v1 novo: o v1 antigo chegou a p90 de 587 tokens/slide no "equilibrado" e máx. de 774 no "longo", encostado no teto antigo (800). O teto novo ficou em 650/800/1050 por profundidade (+380 com falas) — nunca abaixo do antigo, porque resposta cortada é geração perdida e o teto não custa nada (paga-se o que a IA escreve). O mesmo levantamento mostrou que, nos últimos 90 dias, as gerações foram de contas de desenvolvedor (15 no v1, 2 no v2) e as únicas falhas foram 2 `ai_rate_limited`.

## GitHub × Lovable

A Lovable tinha desfeito em 03/11 a mudança "Destacou descontos de até 54%" (versão restaurada), mas essa reversão nunca chegou ao GitHub. Para o merge não trazer o selo de volta, este PR inclui a mesma reversão (`git revert -m 1 bcfed66`): os 6 arquivos ficaram idênticos aos da Lovable.

## Testes

Suítes novas: `deckTitle`, `deckComposer`, `contentV1`; ampliadas: `editDirector`, `aiEditMerge`. `npm test`: **509 passando, nenhuma falha** (a falha antiga de `landingSeo.test.tsx` era causada pela mudança de descontos que a Lovable já tinha desfeito).

## O que aplicar na Lovable

Não há migração de banco nem segredo novo. Depois do merge na `main`, a Lovable puxa o código do GitHub (confira se o último commit do projeto é o do merge; se a conexão com o GitHub mostrar erro, reconecte em Settings → GitHub). Falta o deploy de **duas** edge functions e, por fim, publicar o site (Publish → Update), para o front novo e as funções novas entrarem juntos. O bloco abaixo pode ser colado inteiro no chat da Lovable:

```text
Contexto: o repositório recebeu a atualização do motor principal (v1) do
SlideAI — geração com título fiel ao pedido, diagramas nativos, gráficos
novos, prompt enxuto — e a correção da edição por chat. O código já está
pronto, revisado e testado. NÃO reescreva, refatore nem "corrija" arquivos
de código. A tarefa é só publicar o que não entra por commit, validar e me
reportar. Se alguma etapa falhar, pare e me mostre o erro exato.

NÃO há migração de banco nesta atualização. Não altere tabelas, funções de
crédito/cobrança/estorno, políticas, config.toml nem verify_jwt.

ETAPA 1 — Deploy das edge functions
Faça o deploy destas duas funções (os módulos novos de
supabase/functions/_shared e da própria pasta vão juntos no bundle):
  - generate-presentation  (inclui contentV1.ts, contentCall.ts, contentV2.ts,
    persist.ts e speeches.ts; usa _shared/deckComposer.ts, deckTitle.ts e
    chartSpec.ts)
  - chat-editor            (usa _shared/editDirector.ts e chartSpec.ts)
Nenhuma outra função mudou. Não crie nem altere secrets.

ETAPA 2 — Build e testes
  1. npm install (ou bun install, conforme o lockfile)
  2. npm run build → deve terminar sem erro
  3. npm test → espero 509 testes passando e nenhuma falha. Me mostre o
     resumo.

ETAPA 3 — Verificação funcional (conta de teste, motor v1 = padrão)
  a) Gere "historia da espanha", 10 slides, "Gráficos & dados" e "Imagens
     reais" ligados, tema "De acordo com o tema". Esperado: a capa e o título
     da apresentação são exatamente "História da Espanha", com uma foto
     ligada ao tema; há ao menos uma linha do tempo e um gráfico com a fonte
     do dado.
  b) Gere outra com "Gráficos & dados" e "Imagens reais" DESLIGADOS. Esperado:
     nenhum gráfico, nenhuma foto e capa tipográfica.
  c) No editor da primeira, abra o slide 2 e peça no chat, um de cada vez:
     "troque a imagem por uma foto de um castelo", "remova o subtítulo",
     "mude o título para Reconquista", "exclua o slide 5". Esperado: cada
     mudança aparece na hora no slide aberto (a foto nova carrega em segundo
     plano), fica salva ao recarregar e "Desfazer edição da IA" volta atrás.
  d) Abra /slides/<slug> e navegue com as setas: as trocas devem ser fluidas.
  e) Rode e me mostre:
     SELECT created_at, status, metadata->>'engine_version' AS engine,
            metadata->>'deck_title' AS titulo, metadata->>'deck_title_source' AS origem_titulo,
            metadata->'elements' AS elementos, metadata->'dropped' AS descartados,
            metadata->'tokens' AS tokens, actual_cost_usd, duration_ms
       FROM public.generation_logs
      ORDER BY created_at DESC LIMIT 3;

ETAPA 4 — Publicação
Se as etapas 1 a 3 passaram, publique a versão atual do site (Publish →
Update), para o front novo entrar junto com as funções novas.

Não mude código para "melhorar" nada que eu não pedi. Se algo divergir do
esperado, descreva o que viu e pare.
```

## Depois

- A Central de Ajuda (artigo "Editar slides conversando com a IA") ainda diz para sempre citar o número do slide — continua correto, mas agora o slide aberto também vale. Atualizar o texto exige uma migração nova da Central (os artigos publicados vêm de `docs/central-de-ajuda`), o que ficou fora desta mudança.
- `slideComposition.assignLayouts` não é mais usado na geração (fica para decks antigos/testes).
