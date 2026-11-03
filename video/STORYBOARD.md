# SlideAI · comercial YouTube 30s (16:9) · v2

Remotion, 1920×1080, 30 fps, 900 frames, trilha a 120 BPM (1 tempo = 15
frames, 1 compasso = 60 frames). Todo corte cai num tempo da música.

## Três mundos visuais (da identidade do site)

| Mundo | Visual | Uso |
| --- | --- | --- |
| **Claro** (tema principal do site) | Fundo branco, brilho violeta no topo, grade de pontos, formas roxas flutuando, UI clara | Promessa, demonstração, públicos, cartela final |
| **Grade** | Preto com piso de grade roxa em perspectiva, parede de grade, feixe de varredura que pulsa no tempo | Dor (hook) e recursos em sequência |
| **Nebulosa** | Preto com nuvens roxas e magenta, estrelas, raios de luz | Revelação da marca e frase-assinatura |

Tokens: violeta `#6C47FF` (hsl 252 100% 64%), acento hsl 280 95% 65%,
gradiente hero 252→270→290, texto hsl 240 20% 12%, Plus Jakarta Sans 800,
JetBrains Mono para rótulos.

## Estratégia

**ABCD do YouTube**

- **Attract**: 4 golpes de texto em 4 s, um por tempo forte, em preto com grade. Pergunta que o público reconhece e termina numa curiosidade ("E se levasse 1 minuto?").
- **Brand**: logo e nome aos 4 s (antes do botão Pular), de novo no meio (UI com a marca) e na cartela final.
- **Connect**: o produto em uso; o espectador se vê na lista "Para sua aula / TCC / reunião / pitch".
- **Direct**: cartela de 4 s com botão, URL, preço de entrada e oferta.

**PAS (problema, agitação, solução)** nos primeiros 7 s; depois prova (demo) e oferta.

**Ogilvy**: uma promessa ("descreva o tema, receba a apresentação pronta em cerca de 1 minuto"), marca cedo, demonstração em vez de adjetivos, fatos do produto, mnemônico visual (a estrela do logo aparece sempre que a IA age).

**Sem som**: a mensagem inteira está no texto da tela; a trilha reforça o ritmo.

**Honestidade**: "Simulação de uso · tempo acelerado" durante a demo. Preço e desconto vêm de `src/lib/cakto.ts` e `src/lib/planDiscounts.ts` (o mesmo cálculo do selo "Descontos de até X%" do site).

## Roteiro

| # | Frames | Mundo | Tela | Motion |
| --- | --- | --- | --- | --- |
| 1 | 0–120 | Grade | "Apresentação pra amanhã?" → "Página em branco." → "Horas formatando." → "E se levasse 1 minuto?" | 4 cortes secos no tempo, split RGB nos cortes, relógio 23:47, cursor piscando, contador de horas, cronômetro enchendo |
| 2 | 120–210 | Nebulosa | Logo + "SlideAI" + "Apresentações prontas com IA." | Flash branco + onda de choque no drop, estrela do logo se desenha, letras em cascata, raios girando, íris branca para o próximo mundo |
| 3 | 210–330 | Claro | Passo 1 "Descreva o tema." → barra de prompt digita "Energia solar para o 9º ano" → clique em Gerar → "A IA cria." com etapas | Formas roxas entram no tempo, digitação, onda no clique, borda vira barra de progresso, palavras rolando |
| 4 | 330–450 | Claro | "8 slides prontos. Em cerca de 1 minuto." → slide com chamadas "Roteiro, Design, Imagens, Gráficos" | Slides voam para um plano isométrico com câmera em movimento; depois linhas de chamada se desenham |
| 5 | 450–570 | Claro + painel roxo | "Para sua aula. / TCC. / reunião. / pitch." | Painel roxo entra em cortina, palavra em caça-níquel a cada 2 tempos, capa vira em 3D para o deck certo |
| 6 | 570–720 | Grade | 01 "Ajuste conversando." · 02 "Falas prontas para apresentar." · 03 "Exporte em PowerPoint, PDF ou link." | Chat transforma lista em gráfico, ondas de áudio no tempo, formatos explodem do slide |
| 7 | 720–780 | Nebulosa | "Sua próxima apresentação está a um prompt de distância." | Respiro: a música abre, palavras sobem, sublinhado se desenha |
| 8 | 780–900 | Claro | Logo, "Crie a sua agora.", botão "Criar minha apresentação", slideai.com.br, "A partir de R$ 14,90", selo "PRO com até 54% OFF" | Cartela segura 4 s, brilho no botão, cursor clica, cards do produto flutuando |

Transições: corte seco com split RGB (hook), flash e onda de choque (drop),
íris branca (nebulosa → claro), cortina de blocos roxos (demo → públicos e
públicos → grade), whip (entre recursos), íris a partir do cursor (nebulosa →
cartela).

## Trilha

`scripts/make-music.mjs` sintetiza a trilha a partir de `src/timeline.ts`:
pulso tenso no hook com golpes nos cortes, riser e drop com assinatura sonora
no logo, groove de 4 no chão com arpejo na demo, whooshes em cada transição,
pausa na frase-assinatura e acorde final na cartela. Efeitos de UI: Kenney
(CC0).
