import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const BASE_URL = `http://localhost:${PORT}`
const EVIDENCE = process.env.EVIDENCE === '1'

/**
 * Os testes rodam contra o BUILD DE PRODUÇÃO (vite build + vite preview) com os mocks
 * ativos, o mesmo artefato do deploy (MOCK-09 / DEL-03).
 * Cada teste usa um contexto novo de navegador (localStorage/sessionStorage vazios)
 * e o mock nasce do seed: estado isolado (TEST-03).
 *
 * Projetos:
 *  - unit:      funções puras (eth, EventGuard, cn, tokens de contraste…).
 *  - desktop-chromium / mobile-chromium: fluxos e componentes nos dois viewports do enunciado.
 *  - responsive: larguras explícitas (360–1440), overflow e troca de navegação.
 *  - evidence:  capturas do checkpoint (só com EVIDENCE=1; grava em planning/evidence).
 */
const SPECIAL = /(unit\/|\.responsive\.spec\.ts$|\.evidence\.spec\.ts$)/

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // CP4: o padrão (50% dos 12 núcleos = 6) abria 6 Chromium ao mesmo tempo com ~4 GB de RAM livre;
  // os 6 primeiros testes de navegador estouravam o tempo no arranque a frio (R-36). Limitar o
  // paralelismo trata a causa (recursos) sem aumentar timeouts. `PW_WORKERS` sobrescreve.
  workers: Number(process.env.PW_WORKERS) || (process.env.CI ? 2 : 4),
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
      testIgnore: SPECIAL,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-chromium',
      testIgnore: SPECIAL,
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'responsive',
      testMatch: /\.responsive\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
    ...(EVIDENCE
      ? [{ name: 'evidence', testMatch: /\.evidence\.spec\.ts$/, use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1 } }]
      : []),
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: BASE_URL,
    // Sempre um build novo: a evidência dos testes corresponde ao código atual.
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
