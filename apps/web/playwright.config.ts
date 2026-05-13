/**
 * Playwright config — E2E tests do FlowDesk web.
 *
 * Sobe vite preview automaticamente antes dos testes. Roda em Chromium
 * por padrao (suficiente pro padrao Just; expandir pra firefox/webkit
 * quando precisar verificar cross-browser).
 *
 * Comandos:
 *   npm run test:e2e          # headless
 *   npm run test:e2e:ui       # modo interativo
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Sobe o preview do build automaticamente
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_DEMO_MODE: 'true',
      VITE_DISABLE_HTTPS: '1',
    },
  },
});
