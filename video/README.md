# Comercial do SlideAI para YouTube (Remotion)

Comercial de 45 s em 16:9 (1920×1080, 30 fps, trilha a 100 BPM) para anúncio
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
npm run render     # gera out/slideai-comercial-45s-16x9.mp4 (H.264, CRF 17)
npm run still -- --frame=180   # um frame para conferir layout
npm run music      # regenera public/audio/music.mp3 a partir da timeline
npm run typecheck
```

## Oferta e preço

Os dois textos da oferta ficam em `src/Root.tsx` e podem ser sobrescritos
como props no Studio:

- `price`: vem de `PLAN_PRICES.single` em `src/lib/cakto.ts` → "A partir de R$ 14,90".
  Se o preço mudar no app, o próximo render já sai certo.
- `discount`: "PRO com até 64% OFF", valor informado pela equipe para a
  campanha. A tabela de preços do repositório sozinha não chega a esse número,
  então atualize a prop quando a oferta mudar.

## Estrutura

| Caminho | O que é |
| --- | --- |
| `src/timeline.ts` | Duração das cenas e momentos-chave. Vídeo, efeitos e trilha leem daqui; todo corte cai num tempo da música. |
| `src/theme.ts` | Tokens da marca copiados de `src/index.css` do site (claro e escuro). |
| `src/bg/` | Os três mundos: `LightBg` (branco + roxo), `GridBg` (preto com grade roxa uniforme) e `Orbs`/`GlowBg` (o brilho e os orbes roxos da landing, reconstruídos a partir de `index.css` e `AmbientBackdrop`). |
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
