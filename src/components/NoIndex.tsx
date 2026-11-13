// Tira a página do índice dos buscadores sem mexer no título (que a própria
// página define). Usado nas rotas privadas, de login e de transação: sem ele,
// elas herdavam a descrição, o canonical e os dados estruturados da home que
// vêm no index.html.
import { Helmet } from "react-helmet-async";

export const NoIndex = () => (
  <Helmet>
    <meta name="robots" content="noindex, nofollow" />
  </Helmet>
);
