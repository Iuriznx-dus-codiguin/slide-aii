import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Os *.e2e.test.ts usam o backend real (rede e dados de produção): ficam
    // fora do `npm test` e rodam com `npm run test:e2e` (vitest.e2e.config.ts).
    exclude: [...configDefaults.exclude, "src/**/*.e2e.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
