# SlideAI · anúncio YouTube 30s (16:9)

Remotion, 1920×1080, 30 fps, 900 frames. Identidade visual tirada do código do
próprio site (`src/index.css`, `tailwind.config.ts`, `public/og-image.png`):
violeta `#6C47FF` (hsl 252 100% 64%), acento hsl 280 95% 65%, gradiente hero
252→270→290, fundo escuro hsl 245 35% 7%, Plus Jakarta Sans + JetBrains Mono,
raio 14px, easing `cubic-bezier(0.19, 1, 0.22, 1)`.

## Estratégia (Ogilvy)

| Pergunta | Resposta |
| --- | --- |
| Posicionamento | Para estudantes, professores e profissionais que precisam de slides para amanhã e não têm a noite toda. |
| Promessa única | Descreva o tema e receba a apresentação pronta em cerca de um minuto. |
| Big idea | "A um prompt de distância": o prompt vira o deck na frente do espectador. |
| Prova | Demonstração do produto: prompt → geração → 8 slides → ajuste por chat → exportação. |
| Mnemônico | A estrela de 4 pontas do logo aparece em todo momento de "IA agindo" e fecha o vídeo. |
| Marca nos 5s | Logo + nome entram aos 3s, antes do botão "Pular" do YouTube. |
| Honestidade | Tag "Simulação de uso · tempo acelerado" durante a demo (skill product-proof-saas: nada de velocidade falsa sem aviso). |

## Ritmo (beat-direction do HyperFrames)

`hook-SLAM-build-BUILD-PEAK-fast-fast-hold`

| # | Cena | Frames (abs.) | Verbo / energia | Transição de saída |
| --- | --- | --- | --- | --- |
| 1 | Hook: "Apresentação amanhã, 8h." / "Slides prontos: 0" + relógio 23:47 | 0–90 | texto ESTAMPA, relógio TICA, câmera empurra | corte seco (disrupção) |
| 2 | Marca: logo SLAMS, "SlideAI", "Descreva o tema. A IA cria os slides." | 90–180 | explosão violeta, logo com overshoot | zoom através (blur) |
| 3 | 01 Descreva o tema → 02 A IA escreve, monta e ilustra (UI digitando, clique, etapas) | 168–354 | digita, CLICA, checks em CASCATA | zoom através |
| 4 | PICO: 8 slides voam para a grade, "8 slides prontos em cerca de 1 minuto" | 340–530 | cards CASCATA e assentam | whip lateral |
| 5 | 03 Ajuste conversando: chat pede gráfico, slide vira gráfico de barras | 518–668 | mensagem SOBE, barras CRESCEM | whip lateral |
| 6 | Exporte: PowerPoint, PDF, PNG, Link | 658–758 | blocos BATEM no tempo | íris com gradiente |
| 7 | CTA: "Sua próxima apresentação está a um prompt de distância." + slideai.com.br | 744–900 | segura, brilho no botão | fim |

## Copy final (stop-slop: sem travessão, sem advérbio, voz ativa)

1. Apresentação amanhã, 8h. / Slides prontos: 0
2. SlideAI · Descreva o tema. A IA cria os slides.
3. 01 Descreva o tema. Em poucas palavras. / 02 A IA escreve, monta e ilustra.
4. 8 slides prontos em cerca de 1 minuto. Roteiro · Layout · Imagens · Gráficos
5. 03 Peça ajustes em português.
6. Exporte e apresente onde quiser.
7. Sua próxima apresentação está a um prompt de distância. · A partir de R$ 14,90 · slideai.com.br

## Áudio

- Trilha sintetizada por `scripts/make-music.mjs` (determinística, 120 BPM, compassos alinhados ao slam no frame 90). Volume baixo: Ogilvy lembra que música reduz recall, então o texto carrega a mensagem.
- Efeitos: Kenney Interface Sounds + Casino Audio (CC0), em `public/sfx/`.
