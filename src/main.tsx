import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAnalytics } from "./lib/analytics";
import { capturePrerenderedRoot } from "./lib/prerender";

initAnalytics();

const root = document.getElementById("root")!;
// Páginas públicas chegam com o HTML pré-renderizado (scripts/prerender.ts):
// guarda-o para o fallback do Suspense antes de o React substituí-lo.
capturePrerenderedRoot(root, window.location.pathname);
createRoot(root).render(<App />);
