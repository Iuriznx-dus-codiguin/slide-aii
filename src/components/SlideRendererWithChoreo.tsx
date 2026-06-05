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
  const hint = (props.slide?.content as any)?.transition as ChoreographyName | undefined;
  const choreo = useSlideChoreography(idx, props.slide?.slide_type, hint, animationIntent);
  return (
    <ChoreographyProvider value={choreo}>
      <SlideRenderer {...props} />
    </ChoreographyProvider>
  );
};
