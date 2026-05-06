import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // text: log no terminal/CI; html: relatorio navegavel local; json-summary: pra badges/automacao
      reporter: ["text", "html", "json-summary"],
      // Cobre apenas src/lib (utils puros). UI/pages nao tem teste ainda.
      include: ["src/lib/**"],
      exclude: ["**/*.test.ts", "src/lib/i18n.ts", "src/lib/clipboard.ts"],
      // Thresholds baixos pra refletir realidade atual. Aumentar conforme
      // adicionamos testes — CI falha se regredir.
      // Thresholds em "regression-only mode": setados ligeiramente abaixo
      // do nivel atual. CI quebra se cobertura piorar; nao bloqueia se
      // melhorar. Aumente conforme adicionamos mais testes.
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
