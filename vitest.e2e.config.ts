// Testes contra o backend real (VITE_SUPABASE_URL/KEY do .env e, para os
// autenticados, E2E_USER_A_* / E2E_USER_B_*). Uso: npm run test:e2e
import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.e2e.test.ts"],
    exclude: configDefaults.exclude,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
