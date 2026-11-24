import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const BASE_URL = `http://localhost:${PORT}`

/**
 * Os testes rodam contra o BUILD DE PRODUÇÃO (vite build + vite preview) com os mocks
 * ativos — o mesmo artefato do deploy (MOCK-09 / DEL-03).
 * Cada teste usa um contexto novo de navegador (localStorage/sessionStorage vazios)
 * e o mock nasce do seed: estado isolado (TEST-03).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'unit', testMatch: /unit\/.*\.spec\.ts/ },
    {
      name: 'desktop-chromium',
      testIgnore: /unit\//,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-chromium',
      testIgnore: /unit\//,
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: BASE_URL,
    // Sempre um build novo: a evidência dos testes corresponde ao código atual.
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
