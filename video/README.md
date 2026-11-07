# Comercial do SlideAI para YouTube (Remotion)

Comercial de 40 s (30 fps, trilha a 112,5 BPM, narração masculina) em dois
formatos, renderizados em 4K:

- **16:9**, composição `SlideAIComercial` (3840×2160 no render final), para anúncio in-stream no YouTube;
- **9:16**, composição `SlideAIComercialVertical` (2160×3840 no render final), para Shorts, Reels e TikTok.

Os dois usam o mesmo componente, a mesma timeline, narração, trilha e efeitos; cada cena
lê o tamanho da composição e se recompõe para a orientação. Projeto isolado do
app: tem `package.json` próprio e não entra no build do Vite.

Roteiro, estratégia (ABCD do YouTube, PAS, Ogilvy) e mapa de cenas:
[STORYBOARD.md](STORYBOARD.md).

## Comandos

Requer Node 22.18+ (o gerador de trilha importa `src/timeline.ts` direto).

```sh
cd video
npm install
npm run dev        # Remotion Studio para editar e pré-visualizar
npm run render            # 4K 16:9 → out/slideai-comercial-40s-16x9-4k.mp4
npm run render:vertical   # 4K 9:16 → out/slideai-comercial-40s-9x16-4k.mp4
npm run render:preview    # prévia rápida em 1080p
npm run still -- --frame=180   # um frame para conferir layout
npm run music      # regenera public/audio/music.mp3 a partir da timeline
npm run typecheck
```

Qualidade do render final: escala 2× (4K), frames em PNG (sem perdas), H.264
com CRF 14 e preset `slow`, espaço de cor BT.709 e áudio AAC a 320 kbps.

## Narração

Voz masculina gerada com o [VoiceStudio](https://github.com/debpalash/VoiceStudio)
usando o motor padrão dele, k2-fsa/OmniVoice: a voz é desenhada uma vez
("male, young adult, low pitch", português) e clonada em todas as falas, para
manter o mesmo timbre do início ao fim.

- As falas, o momento de cada uma e o espaço máximo ficam em `VOICE_LINES`
  (`src/timeline.ts`).
- `scripts/make-voice.py` gera os arquivos em `public/voice/`, ajusta cada fala
  ao espaço dela, trata o áudio como locução de estúdio (passa-altas,
  compressão, presença, -16 LUFS, 48 kHz) e registra as durações em
  `src/voice.json`.
- O vídeo só toca as falas listadas em `src/voice.json` e abaixa a música sob
  cada uma (ducking).

```sh
node scripts/export-voice-lines.mjs > /tmp/lines.json
python scripts/make-voice.py --lines /tmp/lines.json   # num ambiente com omnivoice + torch
npm run render && npm run render:vertical
```

## Oferta e preço

Os dois textos da oferta ficam em `src/Root.tsx` e podem ser sobrescritos
como props no Studio:

- `price`: vem de `PLAN_PRICES.single` em `src/lib/cakto.ts` → "A partir de R$ 14,90".
  Se o preço mudar no app, o próximo render já sai certo.
- `discount`: "PRO com até 64% OFF", valor informado pela equipe para a
  campanha. A tabela de preços do repositório sozinha não chega a esse número,
  então atualize a prop quando a oferta mudar.

## Versão 9:16 (mobile)

- Zona segura do Shorts/Reels/TikTok respeitada: nada importante nos 220 px do
  topo, nos 420 px de baixo (legenda, nome do perfil, botão do anúncio) nem na
  coluna de ícones à direita.
- Texto maior em relação à largura (títulos de 96 a 150 px em 1080 de largura)
  e quebras de linha próprias para tela estreita.
- Cenas empilhadas: texto no topo e visual embaixo; botão da cartela em largura
  total; painel roxo dos públicos no topo com o deck embaixo; plano isométrico
  em 2 × 4 slides.
- A etiqueta "Simulação de uso · tempo acelerado" sobe para o topo esquerdo.

## Estrutura

| Caminho | O que é |
| --- | --- |
| `src/timeline.ts` | Duração das cenas, transições, momentos-chave e falas da narração. Vídeo, voz, efeitos e trilha leem daqui; todo início de cena cai num tempo da música. |
| `src/transitions.tsx` | Transições entre cenas: crossfade com zoom ou desfoque, empurrão lateral e vertical. |
| `src/theme.ts` | Tokens da marca copiados de `src/index.css` do site (claro e escuro). |
| `src/bg/` | Os três mundos: `LightBg` (branco + roxo), `GridBg` (preto com grade roxa uniforme) e `Orbs`/`GlowBg` (o brilho e os orbes roxos da landing, reconstruídos a partir de `index.css` e `AmbientBackdrop`). |
| `src/mg/` | Motion graphics: tipografia cinética, marca-texto, palavra em caça-níquel, estrela que se desenha, chamadas com linha e íris. |
| `src/scenes/` | As 8 cenas do comercial. |
| `src/decks/Decks.tsx` | Decks de exemplo (aula, TCC, reunião, pitch), todos fictícios. |
| `src/SoundTrack.tsx` | Trilha, narração (com ducking) e efeitos de UI posicionados pela timeline. |
| `src/voice.json` | Manifesto da narração: motor, voz e duração de cada fala gerada. |
| `scripts/make-voice.py` | Gera a narração com o VoiceStudio / OmniVoice. |
| `scripts/make-music.mjs` | Sintetizador determinístico da trilha (sem samples), com assinatura sonora no logo. |
| `public/fonts/` | Plus Jakarta Sans, JetBrains Mono e Fraunces (SIL OFL), embutidas para render offline. |
| `public/sfx/` | Efeitos Kenney (CC0). |

## Observações

- A demo traz a etiqueta "Simulação de uso · tempo acelerado": o vídeo
  comprime a geração em poucos segundos.
- Slogan do vídeo: "Sua apresentação pronta em menos de 1 minuto"; na cartela
  final, o título da landing, "Crie apresentações incríveis com IA".
- Se mudar a duração de uma cena ou uma fala em `src/timeline.ts`, rode
  `npm run music` e gere a narração de novo.
