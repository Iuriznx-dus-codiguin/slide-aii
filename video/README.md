# Comercial do SlideAI para YouTube (Remotion)

Comercial de 30 s em 16:9 (1920×1080, 30 fps, trilha a 120 BPM) para anúncio
in-stream no YouTube. Projeto isolado do app: tem `package.json` próprio e não
entra no build do Vite.

Roteiro, estratégia (ABCD do YouTube, PAS, Ogilvy) e mapa de cenas:
[STORYBOARD.md](STORYBOARD.md).

## Comandos

Requer Node 22.18+ (o gerador de trilha importa `src/timeline.ts` direto).

```sh
cd video
npm install
npm run dev        # Remotion Studio para editar e pré-visualizar
npm run render     # gera out/slideai-comercial-30s-16x9.mp4 (H.264, CRF 17)
npm run still -- --frame=180   # um frame para conferir layout
npm run music      # regenera public/audio/music.mp3 a partir da timeline
npm run textures   # regenera as texturas de nebulosa (public/textures)
npm run typecheck
```

## Oferta e preço

O preço de entrada e o selo de desconto vêm do próprio app, no
`src/Root.tsx`:

- `PLAN_PRICES.single` de `src/lib/cakto.ts` → "A partir de R$ 14,90"
- `maximumProDiscountPct()` de `src/lib/planDiscounts.ts` → "PRO com até 54% OFF"
  (o mesmo cálculo do selo "Descontos de até X%" da landing)

Se os preços mudarem no app, o próximo render já sai certo. Os textos também
podem ser sobrescritos como props no Studio.

## Estrutura

| Caminho | O que é |
| --- | --- |
| `src/timeline.ts` | Duração das cenas e momentos-chave. Vídeo, efeitos e trilha leem daqui; todo corte cai num tempo da música. |
| `src/theme.ts` | Tokens da marca copiados de `src/index.css` do site (claro e escuro). |
| `src/bg/` | Os três mundos: `LightBg` (branco + roxo), `GridBg` (preto com grade roxa), `NebulaBg` (preto com nuvens roxas). |
| `src/mg/` | Motion graphics: tipografia cinética, marca-texto, palavra em caça-níquel, estrela que se desenha, onda de choque, partículas, chamadas com linha, cortinas de blocos e íris. |
| `src/scenes/` | As 8 cenas do comercial. |
| `src/decks/Decks.tsx` | Decks de exemplo (aula, TCC, reunião, pitch), todos fictícios. |
| `src/SoundTrack.tsx` | Trilha + efeitos de UI posicionados pela timeline. |
| `scripts/make-music.mjs` | Sintetizador determinístico da trilha (sem samples), com assinatura sonora no logo. |
| `public/fonts/` | Plus Jakarta Sans, JetBrains Mono e Fraunces (SIL OFL), embutidas para render offline. |
| `public/sfx/` | Efeitos Kenney (CC0). |

## Observações

- A demo traz a etiqueta "Simulação de uso · tempo acelerado": a geração real
  leva cerca de um minuto, como diz o site.
- Se mudar a duração de uma cena em `src/timeline.ts`, rode `npm run music`.
