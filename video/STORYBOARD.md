# SlideAI · comercial YouTube 45s (16:9) · v3

Remotion, 1920×1080, 30 fps, 1350 frames, trilha a 100 BPM (1 tempo = 18
frames, 1 compasso = 72 frames). Todo corte cai num tempo da música.

**Ritmo**: cada frase fica na tela, já parada, por pelo menos 1 segundo antes
de ser trocada. Entradas de 0,5 a 0,7 s, uma ideia por tela.

## Três mundos visuais (da identidade do site)

| Mundo | Visual | Uso |
| --- | --- | --- |
| **Claro** (tema principal) | Fundo branco, brilho violeta no topo, grade de pontos, formas roxas flutuando, UI clara | Promessa, demonstração, públicos, cartela final |
| **Grade** | Preto coberto de ponta a ponta por uma grade roxa uniforme (com pontos nas interseções), que pulsa de leve no tempo | Hook e recursos |
| **Brilho roxo** | Fundo escuro do tema dark com os efeitos roxos da landing: `.bg-gradient-glow` no topo e os orbes do `AmbientBackdrop` (degradê radial 0,4 → 0,16 → transparente, cores primária e acento, trajetórias `slideai-orb-a/b`), mais grão de 6% | Revelação da marca e frase-assinatura |

Tokens: violeta `#6C47FF` (hsl 252 100% 64%), acento hsl 280 95% 65%,
gradiente hero 252→270→290, texto hsl 240 20% 12%, Plus Jakarta Sans 800,
JetBrains Mono para rótulos.

## Estratégia

- **ABCD do YouTube**. Attract: duas frases de dor/curiosidade em 4,8 s. Brand: logo e nome aos 4,8 s (antes do botão Pular), de novo na UI e na cartela. Connect: o produto em uso e "Para sua aula / TCC / reunião / pitch". Direct: cartela de 4,8 s com botão, URL, preço de entrada e oferta.
- **PAS** nos primeiros 9 s; depois prova (demo) e oferta.
- **Ogilvy**: uma promessa (descreva o tema, receba a apresentação pronta em cerca de 1 minuto), demonstração em vez de adjetivos, mnemônico visual (a estrela do logo) e sonoro (assinatura em sino no logo e na cartela).
- **Sem som**: a mensagem inteira está no texto da tela.
- **Honestidade**: "Simulação de uso · tempo acelerado" durante a demo.

## Roteiro

| # | Tempo | Mundo | Tela |
| --- | --- | --- | --- |
| 1 | 0–4,8s | Grade | "Apresentação pra amanhã?" (slide em branco + 23:47) → "E se ficasse pronta em 1 minuto?" (cronômetro enche até 01:00) |
| 2 | 4,8–9s | Brilho roxo | Estrela do logo se desenha e pousa no ícone, "SlideAI", "Apresentações prontas com IA."; íris branca abre o mundo claro |
| 3 | 9–15,6s | Claro | Passo 1 "Descreva o tema." → digita "Energia solar para o 9º ano" no campo "Título / Tema" → Gerar → "A IA cria tudo." com as etapas reais (Direção de arte, Roteiro, Ilustração) |
| 4 | 15,6–22,8s | Claro | "8 slides prontos. Em cerca de 1 minuto." em plano isométrico → slide com chamadas Roteiro, Design, Gráficos, Imagens |
| 5 | 22,8–30s | Claro + painel roxo | "Para sua aula. / TCC. / reunião. / pitch." (1,8 s cada) com a capa virando em 3D |
| 6 | 30–37,2s | Grade | 01 "Ajuste conversando." · 02 "Falas prontas." · 03 "Exporte ou apresente." (2,4 s cada) |
| 7 | 37,2–40,2s | Brilho roxo | "Sua próxima apresentação está a um prompt de distância." |
| 8 | 40,2–45s | Claro | Logo, "Sua apresentação pronta em cerca de 1 minuto.", botão "Criar minha apresentação", slideai.com.br, "A partir de R$ 14,90", selo "PRO com até 64% OFF", "Pagamento seguro · Cancele quando quiser · 7 dias para desistir" |

Transições: corte com leve split RGB (hook), flash suave e onda de choque
(marca), íris branca (brilho → claro), cortina de blocos roxos (demo →
públicos e públicos → grade), deslize com blur (entre recursos), íris branca
(assinatura → cartela).

## Oferta

- Preço de entrada: `PLAN_PRICES.single` de `src/lib/cakto.ts` (R$ 14,90).
- Desconto do PRO: "até 64%", valor informado pela equipe para a campanha
  (a tabela de preços do repositório sozinha não chega a esse número). Fica
  como prop `discount` em `src/Root.tsx`, editável no Studio.

## Trilha

`scripts/make-music.mjs` sintetiza a trilha a partir de `src/timeline.ts`:
pulso contido no hook com golpe em cada frase, riser e drop com assinatura
sonora no logo, groove a 100 BPM com arpejo a partir do clique em Gerar,
whooshes nas transições, respiro na frase-assinatura e a mesma assinatura na
cartela. Efeitos de UI: Kenney (CC0).
