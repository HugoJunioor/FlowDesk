import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: false,
    // jsdom pra testes de componentes (DOM simulado).
    // Util tests puros (.test.ts em lib/) tambem rodam aqui — overhead minimo.
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/lib/**"],
      exclude: ["**/*.test.ts", "**/*.test.tsx", "src/lib/i18n.ts", "src/lib/clipboard.ts"],
      // Regression-only mode: CI quebra se cobertura piorar
      thresholds: {
        lines: 9,
        functions: 8,
        branches: 7,
        statements: 9,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
