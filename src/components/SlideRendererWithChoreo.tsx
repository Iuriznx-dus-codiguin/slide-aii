// Wrapper que provê ChoreographyProvider derivado do slide ao SlideRenderer.
// Usado no Editor e no Generate (preview) para que useChoreo() dos
// subcomponentes do SlideRenderer não retorne a choreography default.
import { ChoreographyProvider, useSlideChoreography, type ChoreographyName } from "@/lib/slideChoreography";
import { SlideRenderer, type SlideData } from "@/components/SlideRenderer";
import type { ThemeColors } from "@/lib/slugify";
import type { ComponentProps } from "react";

type BaseProps = ComponentProps<typeof SlideRenderer>;
interface Props extends BaseProps {
  index?: number;
}

export const SlideRendererWithChoreo = (props: Props) => {
  const idx = props.index ?? 0;
  const animationIntent = (props.slide?.content as any)?.animation_intent;
  // Bug corrigido: lia content.transition (campo consumido por
  // slideTransitions.tsx, com valores como "iris"/"shatter"/"mosaic") em vez
  // de content.choreography (campo correto, com valores como
  // "liftoff"/"scatter"/"cascade"). Como "iris" nunca é um ChoreographyName
  // válido, useSlideChoreography sempre rejeitava o hint e caía no fallback
  // determinístico por índice — ou seja, a coreografia explícita definida
  // pela IA na geração NUNCA era respeitada aqui (só no SlideViewer, que já
  // lia o campo certo). Editor e Generate mostravam uma coreografia
  // diferente da que a apresentação final usa.
  const hint = (props.slide?.content as any)?.choreography as ChoreographyName | undefined;
  const choreo = useSlideChoreography(idx, props.slide?.slide_type, hint, animationIntent);
  return (
    <ChoreographyProvider value={choreo}>
      <SlideRenderer {...props} />
    </ChoreographyProvider>
  );
};
