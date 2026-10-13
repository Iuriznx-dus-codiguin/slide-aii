# Testar o motor v2 pelo Dev Mode

O **v1 é o motor principal**: todo usuário gera com ele. O **v2 (motor de cenas)** fica em teste e só roda para contas com papel `admin` ou `developer`, quando escolhido no Dev Mode.

## Como escolher o motor

1. Abra o Dev Mode pelo botão redondo no canto inferior direito, por `Ctrl+Shift+D` ou pelo indicador "Motor desta geração" na tela de geração.
2. Em **Motor de geração**, escolha:
   - **v1 · Principal (produção):** o mesmo motor que os clientes recebem. Use para reproduzir o que o cliente vê.
   - **v2 · Motor de cenas (teste):** slides em camadas, mídia decidida no servidor e Quality Gate.
3. Gere normalmente. A escolha fica salva no navegador e vale só para as suas gerações.

Depois de gerar, uma notificação mostra o motor que o servidor usou e o motivo. Se ele divergir do escolhido, o aviso aparece em amarelo. No Editor, o selo ao lado do título (`v1` ou `v2 · teste`) mostra com qual motor o deck foi gerado. Só desenvolvedores veem o selo.

## Regra do servidor

Fica em `supabase/functions/_shared/engineSelection.ts` e é coberta por `src/test/engineSelection.test.ts`.

| Situação | Motor | Motivo gravado |
| --- | --- | --- |
| Cliente antigo, sem `persist: "server"` | v1 | `legacy_client` |
| Desenvolvedor com motor escolhido no Dev Mode | o escolhido | `dev_choice` |
| `ENGINE_V2_ROLLOUT_PERCENT` > 0 | v2 para a fração sorteada (estável por usuário), v1 para os demais | `rollout` |
| Nenhum dos casos acima (situação atual) | v1 | `default` |

Quando quem pede não é desenvolvedor, o pedido de motor é ignorado: a escolha nunca vem do navegador de um cliente. `ENGINE_V2_ROLLOUT_PERCENT` não existe hoje, o que equivale a 0%.

## Onde comparar

Em **Dashboard dev (`/__dev`) → Métricas Dev**, a tabela "Comparação por motor" mostra, para v1 e v2:
- número de gerações;
- custo médio, tempo médio e tokens de saída por slide;
- parcela de slides só com texto;
- imagens pedidas e exibidas;
- fallbacks do resolvedor;
- falhas.

Na lista de gerações, passar o mouse sobre `v1`/`v2` mostra o motivo da escolha.

Em `generation_logs.metadata`, cada geração grava `engine_version`, `engine_requested` e `engine_reason`, inclusive as que falham.

## O que testar no v2

- [ ] Gerar o mesmo tema nos dois motores (por exemplo, 10 slides com imagens) e comparar no painel.
- [ ] Abrir o deck v2 no Editor: as imagens pendentes carregam, e trocar o visual e editar por chat funcionam.
- [ ] Abrir pelo link público (`/slides/<slug>`) e no modo apresentação.
- [ ] Exportar em PDF e PPTX.
- [ ] Gerar com falas dos apresentadores e regenerar uma fala.

## Para valer em produção

A escolha do motor já funciona com a função publicada hoje, que respeita o pedido de desenvolvedores. Já o motivo na notificação e as falhas por motor no painel dependem do deploy da nova `generate-presentation`. Antes dele, a notificação diz "motivo não informado".
