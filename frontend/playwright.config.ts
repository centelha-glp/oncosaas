import { defineConfig, devices } from '@playwright/test';

/**
 * Configuração do Playwright para testes E2E do OncoNav.
 *
 * Pré-requisitos:
 *   npx playwright install chromium   # instalar browsers
 *
 * Execução:
 *   npx playwright test               # todos os testes E2E
 *   npx playwright test --ui          # modo interativo
 *   npx playwright test e2e/auth.spec.ts  # arquivo específico
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // evitar conflito de sessão no mesmo banco de teste
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
});
