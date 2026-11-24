/**
 * Evidências visuais do CP3 (rodar com EVIDENCE=1; grava em planning/evidence/cp3/).
 * Páginas completas de Início, Mercado e Detalhe em 390/768/1440 e estados de interface.
 */
import { expect, test, type Page } from '@playwright/test'
import { mock, openApp } from './support'

const OUT = 'planning/evidence/cp3'
test.use({ reducedMotion: 'reduce' })

async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 30))
    }
    window.scrollTo(0, 0)
  })
  await expect.poll(() => page.evaluate(() => [...document.images].filter((i) => i.offsetParent !== null).every((i) => i.complete))).toBe(true)
}

const PAGES = [
  { name: 'inicio', path: '/' },
  { name: 'detalhe', path: '/nft/nft-001' },
  { name: 'mercado-filtrado', path: '/mercado?category=musica' },
]

for (const width of [390, 768, 1440]) {
  for (const p of PAGES) {
    test(`${p.name} @${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 })
      await openApp(page, p.path)
      await settle(page)
      await page.screenshot({ path: `${OUT}/${p.name}-${width}-viewport.png` })
      await page.screenshot({ path: `${OUT}/${p.name}-${width}-pagina.png`, fullPage: true })
    })
  }
}

const STATES = [
  { name: 'estado-busca-vazia', path: '/?q=zzzz', scenario: 'default' },
  { name: 'estado-404', path: '/nft/nao-existe', scenario: 'default' },
  { name: 'estado-erro', path: '/', scenario: 'catalog-error' },
  { name: 'estado-skeleton', path: '/', scenario: 'hold-catalog' },
  { name: 'estado-imagem-quebrada', path: '/', scenario: 'broken-images' },
]

for (const width of [390, 1440]) {
  for (const s of STATES) {
    test(`${s.name} @${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 })
      await openApp(page, s.path, s.scenario)
      if (s.name === 'estado-erro') await expect(page.getByText('Tentar novamente').first()).toBeVisible({ timeout: 15_000 })
      if (s.name === 'estado-skeleton') await expect(page.getByTestId('nft-card-skeleton').first()).toBeVisible()
      else await page.waitForLoadState('networkidle')
      const target = page.locator('#catalogo')
      if (s.name !== 'estado-404' && (await target.count())) await target.scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${OUT}/${s.name}-${width}.png` })
      if (s.name === 'estado-skeleton') await mock(page).release('nfts.list')
    })
  }
}
