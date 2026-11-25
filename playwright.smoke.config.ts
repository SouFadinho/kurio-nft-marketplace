/**
 * CP9.1: smoke test da aplicação PUBLICADA (sem servidor local).
 *
 *   SMOKE_URL=https://<deploy> npx playwright test -c playwright.smoke.config.ts
 *
 * Roda `e2e/public.smoke.ts` contra a URL pública, em desktop e mobile, sem retries. Cada teste usa um
 * contexto novo (localStorage e Service Worker próprios) e reseta a simulação pela URL (`?reset=1`).
 * O arquivo não casa com o padrão `*.spec.ts`, então a suíte normal não o executa.
 */
import { defineConfig, devices } from '@playwright/test'

const SMOKE_URL = process.env.SMOKE_URL
if (!SMOKE_URL) throw new Error('Defina SMOKE_URL com a URL pública (https://...)')

export default defineConfig({
  testDir: './e2e',
  testMatch: /\.smoke\.ts$/,
  fullyParallel: true,
  retries: 0,
  workers: Number(process.env.PW_WORKERS) || 2,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-smoke' }]],
  use: { baseURL: SMOKE_URL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
})
