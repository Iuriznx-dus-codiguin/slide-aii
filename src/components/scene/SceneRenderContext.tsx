// Contexto de renderização do motor de cenas.
//
// `staticEffects` liga os FALLBACKS ESTÁTICOS de cada efeito: o export de
// PDF/PNG usa html2canvas, que ignora backdrop-filter, filter, mix-blend-mode
// e máscaras. Todo efeito novo do motor v2 declara aqui o seu equivalente
// estático (vidro → preenchimento translúcido, blobs desfocados → gradientes
// radiais pré-desenhados, duotone → foto com scrim sólido), para que o
// arquivo exportado bata com a tela.
import { createContext, useContext } from "react";

export interface SceneRenderOptions {
  staticEffects: boolean;
  /**
   * Export PPTX: "visual" desenha SÓ o bloco visual (fundo transparente e
   * texto invisível, mantendo o layout), para recortá-lo como imagem — o
   * texto vai como caixa nativa editável no PowerPoint.
   */
  only?: "visual";
}

const SceneRenderCtx = createContext<SceneRenderOptions>({ staticEffects: false });

export const SceneRenderProvider = SceneRenderCtx.Provider;

export const useSceneRender = (): SceneRenderOptions => useContext(SceneRenderCtx);
