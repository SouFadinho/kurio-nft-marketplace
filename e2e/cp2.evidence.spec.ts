/**
 * Evidências visuais do CP2 (rodar com EVIDENCE=1; grava em planning/evidence/cp2/).
 * Captura a estrutura global e os componentes em 390, 768 e 1440 px, com dados estáveis
 * (seed do mock), fontes carregadas, imagens lazy carregadas e movimento reduzido
 * (sem shimmer/animações no instante da captura).
 */
import { expect, test } from '@playwright/test'
import { openApp } from './support'

const OUT = 'planning/evidence/cp2'
const WIDTHS = [390, 768, 1440]
const PAGES = [
  { name: 'inicio-estrutura', path: '/' },
  { name: 'componentes', path: '/demo/componentes' },
  { name: 'layout-conta', path: '/demo/conta' },
  { name: 'layout-checkout', path: '/demo/checkout' },
  { name: 'fora-do-escopo', path: '/criadores' },
  { name: '404', path: '/rota-inexistente' },
]

test.use({ reducedMotion: 'reduce' })

for (const width of WIDTHS) {
  for (const p of PAGES) {
    test(`${p.name} @${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 })
      await openApp(page, p.path)
      await page.waitForLoadState('networkidle')
      await page.evaluate(() => document.fonts.ready)
      // Imagens lazy: rola a página inteira e espera todas carregarem.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 400) {
          window.scrollTo(0, y)
          await new Promise((r) => setTimeout(r, 30))
        }
        window.scrollTo(0, 0)
      })
      await expect.poll(() => page.evaluate(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0))).toBe(true)
      await page.screenshot({ path: `${OUT}/${p.name}-${width}-viewport.png` })
      await page.screenshot({ path: `${OUT}/${p.name}-${width}-pagina.png`, fullPage: true })
    })
  }
}

/** Recortes por elemento, usados nas comparações lado a lado com o Figma (scripts/evidence/compare-cp2.mjs). */
const ELEMENTS = [
  { name: 'el-header-desktop', path: '/', width: 1440, locator: 'header' },
  { name: 'el-footer-desktop', path: '/', width: 1440, locator: '[data-testid="site-footer"]' },
  { name: 'el-conta-desktop', path: '/demo/conta', width: 1440, locator: 'main' },
  { name: 'el-bottom-nav-mobile', path: '/', width: 390, locator: '[data-testid="bottom-nav"]' },
  { name: 'el-cards-mobile', path: '/demo/componentes', width: 390, locator: '[data-testid="nft-grid"]' },
  { name: 'el-carrinho-mobile', path: '/demo/checkout', width: 390, locator: 'main' },
]

for (const el of ELEMENTS) {
  test(`elemento ${el.name}`, async ({ page }) => {
    await page.setViewportSize({ width: el.width, height: el.width < 768 ? 844 : 900 })
    await openApp(page, el.path)
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    const target = page.locator(el.locator).first()
    await target.scrollIntoViewIfNeeded()
    await expect.poll(() => page.evaluate(() => [...document.images].filter((i) => i.loading !== 'lazy' || i.getBoundingClientRect().top < innerHeight).every((i) => i.complete))).toBe(true)
    await target.screenshot({ path: `${OUT}/${el.name}.png` })
  })
}
