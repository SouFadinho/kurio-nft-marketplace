/**
 * CP2: responsividade da estrutura global (CHALLENGE §8: 390, 768, 1440 e larguras intermediárias).
 */
import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { openApp } from './support'

const WIDTHS = [360, 390, 600, 768, 900, 1024, 1280, 1440]
const ROUTES = ['/', '/mercado', '/mercado?category=musica&network=solana', '/nft/nft-001', '/nft/nao-existe', '/criadores', '/demo/componentes', '/demo/conta', '/demo/checkout', '/rota-inexistente']

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    // Culpados só são calculados quando HÁ overflow real (diagnóstico; caro em páginas grandes).
    if (doc.scrollWidth <= doc.clientWidth) return { scroll: doc.scrollWidth, client: doc.clientWidth, offenders: [] as string[] }
    const offenders = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && (r.right > doc.clientWidth + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed'
      })
      // Ignora elementos recortados por um ancestral (overflow hidden/clip/auto/scroll):
      // eles não causam rolagem horizontal; o scrollWidth acima é a medida principal.
      .filter((el) => {
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).overflowX !== 'visible') return false
        return true
      })
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`)
    return { scroll: doc.scrollWidth, client: doc.clientWidth, offenders }
  })
}

for (const width of WIDTHS) {
  test(`sem overflow horizontal em ${width}px`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width, height: 900 })
    await openApp(page, '/')
    for (const route of ROUTES) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      const result = await horizontalOverflow(page)
      expect.soft(result.scroll, `${route} @${width}px: scrollWidth ${result.scroll} > ${result.client} (${result.offenders.join(', ')})`).toBeLessThanOrEqual(result.client)
      expect.soft(result.offenders, `${route} @${width}px`).toEqual([])
    }
  })
}

test.describe('troca de navegação por breakpoint', () => {
  // Páginas pesadas com reset do seed a cada teste: sob pressão de memória (checkout limpo do CP3,
  // 2 GB livres) estes testes levaram até 37 s contra 4–6 s normais. Mesmo limite do overflow.
  test.describe.configure({ timeout: 90_000 })
  for (const width of [390, 768]) {
    test(`${width}px: navegação inferior visível, header desktop oculto`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await openApp(page, '/')
      await expect(page.getByTestId('bottom-nav')).toBeVisible()
      await expect(page.getByRole('navigation', { name: 'Principal', exact: true })).toBeHidden()
      // Telas com barra de ação própria no Figma mobile não têm bottom nav.
      await page.goto('/carrinho')
      await expect(page.getByTestId('bottom-nav')).toHaveCount(0)
    })
  }
  for (const width of [1024, 1440]) {
    test(`${width}px: header desktop visível, navegação inferior oculta`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await openApp(page, '/')
      await expect(page.getByRole('navigation', { name: 'Principal', exact: true })).toBeVisible()
      await expect(page.getByTestId('bottom-nav')).toBeHidden()
    })
  }
})
