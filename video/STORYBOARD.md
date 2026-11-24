# SlideAI · comercial 40s · 16:9 (YouTube) e 9:16 (Shorts/Reels) · v4

Remotion, 30 fps, 1200 frames, trilha a 112,5 BPM (1 tempo = 16 frames,
1 compasso = 64 frames). As cenas se sobrepõem nas transições e todo início
de cena cai num tempo da música. Render final em 4K (3840×2160 e 2160×3840).

## Direção

- **Mais ágil, mais limpo**: uma ideia por tela, entradas de 0,5 s com
  desfoque, nada de partículas, ondas de choque ou formas decorativas
  sobrando. Movimento só onde ele explica algo (digitação, clique, slides
  chegando, chamadas, lista virando gráfico).
- **Transições**: crossfade com zoom (hook → marca), íris branca a partir do
  logo (marca → claro), crossfade com desfoque (prompt → slides), empurrão
  lateral (slides → públicos), empurrão vertical (públicos → recursos),
  crossfade (recursos → assinatura), íris branca (assinatura → cartela).
- **Três mundos**: claro (fundo branco, brilho violeta, grade de pontos),
  grade (preto com grade roxa uniforme) e brilho roxo (orbes da landing).

## Roteiro e narração

Voz masculina (jovem adulto, tom grave, português do Brasil) gerada com o
VoiceStudio (motor k2-fsa/OmniVoice): a voz é desenhada uma vez e clonada em
todas as falas. Cada fala tem um espaço máximo na cena e é ajustada para
caber.

| Tempo | Mundo | Tela | Narração |
| --- | --- | --- | --- |
| 0–4,3s | Grade | "Apresentação pra amanhã?" → "Resolva em menos de 1 minuto." (cronômetro para em 00:48) | "Apresentação pra amanhã? Resolva em menos de um minuto." |
| 4,3–7,5s | Brilho roxo | Estrela do logo se desenha, "SlideAI", "Apresentações prontas com IA." | "Conheça o SlideAI." |
| 7,5–13,3s | Claro | "Descreva o tema." → digita "Energia solar para o 9º ano" → Gerar → "A IA cria tudo." | "Você descreve o tema. E a IA escreve, desenha e ilustra." |
| 13,3–19,2s | Claro | "8 slides prontos. Em menos de 1 minuto." → chamadas Roteiro / Design / Gráficos / Imagens | "Pronto: oito slides em menos de um minuto. Roteiro, design, imagens e gráficos." |
| 19,2–25,6s | Claro + roxo | "Para sua aula / TCC / reunião / pitch" | "Pra sua aula, seu TCC, sua reunião ou seu pitch." |
| 25,6–32s | Grade | Ajuste conversando · Falas prontas · Exporte ou apresente | "Ajuste tudo conversando. Tenha as falas prontas. E exporte em PowerPoint, PDF ou link." |
| 32–34,7s | Brilho roxo | "Sua próxima apresentação está a um prompt de distância." | a mesma frase |
| 34,7–40s | Claro | "Crie apresentações incríveis com IA" (título da landing), botão, slideai.com.br, "A partir de R$ 14,90", "PRO com até 64% OFF", linha de confiança | "Crie apresentações incríveis com IA. slideai.com.br" |

Os textos exatos que a voz lê (com grafia fonética para SlideAI, TCC, PDF e a
URL) e o espaço de cada fala ficam em `VOICE_LINES`, em `src/timeline.ts`.

## Estratégia

- **ABCD do YouTube**: hook de dor + promessa em 4,3 s, marca aos 4,3 s
  (antes do Pular), o produto em uso, públicos, cartela com oferta.
- **PAS** nos primeiros 7 s; depois prova e oferta.
- **Ogilvy**: uma promessa (pronta em menos de 1 minuto), demonstração,
  mnemônico visual (a estrela do logo) e sonoro (sino no logo e na cartela).
- **Com ou sem som**: a narração reforça; todo o texto continua na tela.
- **Honestidade**: "Simulação de uso · tempo acelerado" durante a demo.

## Versão 9:16

Mesma timeline, narração, trilha e copy; cada cena recompõe a tela (texto no
topo e visual embaixo, botões de largura total) e respeita a zona segura do
Shorts/Reels/TikTok (220 px do topo, 420 px de baixo, coluna de ícones à
direita).

## Oferta

- Preço de entrada: `PLAN_PRICES.single` de `src/lib/cakto.ts` (R$ 14,90).
- Desconto do PRO: "até 64%", valor informado pela equipe para a campanha;
  fica como prop `discount` em `src/Root.tsx`, editável no Studio.

## Trilha

`scripts/make-music.mjs` sintetiza a trilha a partir de `src/timeline.ts`,
mais enxuta para dar espaço à voz: pulso no hook, drop com assinatura sonora
no logo, groove leve com arpejo a partir do clique em Gerar, whooshes nas
transições, respiro na assinatura e a mesma assinatura na cartela. A música
abaixa automaticamente sob cada fala da narração.
