# Anúncio do SlideAI para YouTube (Remotion)

Vídeo de 30 s em 16:9 (1920×1080, 30 fps) para anúncio in-stream no YouTube.
Projeto isolado do app: tem `package.json` próprio e não entra no build do Vite.

Roteiro, estratégia e ritmo: [STORYBOARD.md](STORYBOARD.md).

## Comandos

Requer Node 22.18+ (o gerador de trilha importa `src/timeline.ts` direto).

```sh
cd video
npm install
npm run dev        # Remotion Studio para editar e pré-visualizar
npm run render     # gera out/slideai-anuncio-youtube-16x9.mp4 (H.264, CRF 18)
npm run still -- --frame=150   # um frame para conferir layout
npm run music      # regenera public/audio/music.mp3 a partir da timeline
npm run typecheck
```

Preço, URL e áudio são props editáveis no Studio (schema Zod em
`src/SlideAIAd.tsx`). O preço padrão vem do plano "Geração única" em
`src/lib/cakto.ts`; se ele mudar, atualize `defaultProps` em `src/Root.tsx`.

## Estrutura

| Caminho | O que é |
| --- | --- |
| `src/timeline.ts` | Duração das cenas, transições e momentos-chave. Vídeo, efeitos e trilha leem daqui. |
| `src/theme.ts` | Tokens da marca copiados de `src/index.css` do site (violeta `#6C47FF`, gradiente hero, fundo escuro). |
| `src/scenes/` | As 7 cenas: Hook, Marca, Prompt, Slides prontos, Ajuste por chat, Exportação, CTA. |
| `src/components/DeckSlide.tsx` | Deck de exemplo "Café Raiz" (empresa fictícia) usado na demonstração. |
| `src/transitions.tsx` | Zoom com blur, whip e íris. |
| `src/SoundTrack.tsx` | Trilha + efeitos posicionados pela timeline. |
| `scripts/make-music.mjs` | Sintetizador determinístico da trilha (120 BPM, sem samples). |
| `public/fonts/` | Plus Jakarta Sans, JetBrains Mono e Fraunces (SIL OFL), embutidas para render offline. |
| `public/sfx/` | Efeitos Kenney (CC0). |

## Observações

- A demo traz a etiqueta "Simulação de uso · tempo acelerado": a geração real
  leva cerca de um minuto, como diz o site.
- Se mudar a duração de uma cena em `src/timeline.ts`, rode `npm run music`
  para realinhar a trilha.
