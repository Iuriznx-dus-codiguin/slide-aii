// Despachante do bloco visual: escolhe o componente pelo registro de
// comandos e aplica a regra final do Quality Gate no cliente — ativo que
// falhou (ou mídia ausente fora do estado pendente) cai no fallback nativo do
// comando (camadas → LayerStack; vistas técnicas → ConceptMap) ou, se o
// comando não tem desenho nativo, num cartão editorial. Nunca slot vazio.
import { buildVisualModel } from "@/lib/scene/visualModel";
import { FlowDiagram, CycleDiagram, TimelineDiagram } from "./visuals/FlowVisuals";
import { ComparisonDiagram } from "./visuals/CompareVisuals";
import { FunnelDiagram, LayerStack, PyramidDiagram } from "./visuals/HierarchyVisuals";
import { DataScene } from "./visuals/DataScene";
import { ConceptMap, SystemDiagram } from "./visuals/SystemVisuals";
import { EditorialCard, MediaVisual } from "./visuals/MediaVisual";
import type { VisualProps } from "./visuals/shared";

export const VisualBlock = (props: VisualProps & { listToFlow?: boolean; bleed?: boolean }) => {
  let p = props;
  const mediaMissing = p.model.media && (p.assetStatus === "failed" || (!p.imageUrl && p.assetStatus !== "pending"));
  if (mediaMissing) {
    const native = buildVisualModel(p.visual, true);
    if (native && native.component !== "MediaVisual") p = { ...p, model: native };
    else return <EditorialCard {...p} />;
  }
  switch (p.model.component) {
    case "FlowDiagram": return <FlowDiagram {...p} />;
    case "CycleDiagram": return <CycleDiagram {...p} />;
    case "TimelineDiagram": return <TimelineDiagram {...p} />;
    case "ComparisonDiagram": return <ComparisonDiagram {...p} />;
    case "FunnelDiagram": return <FunnelDiagram {...p} />;
    case "PyramidDiagram": return <PyramidDiagram {...p} />;
    case "LayerStack": return <LayerStack {...p} />;
    case "DataScene": return <DataScene {...p} />;
    case "SystemDiagram": return <SystemDiagram {...p} />;
    case "ConceptMap": return <ConceptMap {...p} />;
    case "MediaVisual": return <MediaVisual {...p} />;
    default: return null;
  }
};
