/**
 * Evidências do CP8 (rodar com EVIDENCE=1; grava em planning/evidence/cp8/).
 * As 9 telas obrigatórias + Mercado, Favoritos e Meus pedidos em 390/768/1440, no estado
 * principal (dados do seed). "Antes" = evidências dos CPs anteriores (cp3..cp6).
 */
import { expect, test, type Page } from '@playwright/test'
import { USERS, mock, openApp, placeOrder, seedCart, signIn, summaryValue } from './support'

const OUT = 'planning/evidence/cp8'
test.use({ reducedMotion: 'reduce' })
test.setTimeout(120_000)

async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await expect.poll(() => page.evaluate(() => [...document.images].filter((i) => i.offsetParent !== null).every((i) => i.complete))).toBe(true)
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 8_000 })
}
const shot = (page: Page, name: string, width: number, fullPage = true) => page.screenshot({ path: `${OUT}/${name}-${width}.png`, fullPage })

const CART = [
  { nftId: 'nft-001', editionId: 'ed-10', quantity: 2 },
  { nftId: 'nft-005', editionId: 'ed-50', quantity: 6 },
  { nftId: 'nft-006', editionId: 'ed-50', quantity: 9 },
]

for (const width of [390, 768, 1440]) {
  test(`telas públicas @${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 })
    for (const [name, path] of [
      ['inicio', '/'],
      ['mercado', '/mercado'],
      ['detalhe', '/nft/nft-001'],
      ['login', '/login'],
      ['cadastro', '/cadastro'],
    ] as const) {
      await openApp(page, path)
      await settle(page)
      await shot(page, name, width, !['login', 'cadastro'].includes(name) || width < 1024)
    }
  })

  test(`telas privadas @${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 })
    await openApp(page, '/')
    await signIn(page, USERS.ana, '/perfil')
    await expect(page.getByLabel('Nome de exibição')).toHaveValue(USERS.ana.name)
    await settle(page)
    await shot(page, 'perfil', width)
    await page.goto('/perfil/carteiras')
    await expect(page.getByRole('region', { name: 'Carteira principal' })).toBeVisible()
    await settle(page)
    await shot(page, 'carteiras', width)

    await page.evaluate(async () => {
      const token = (JSON.parse(sessionStorage.getItem('kurio:session')!) as { token: string }).token
      for (const id of ['nft-002', 'nft-005']) await fetch(`/api/favorites/${id}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } })
    })
    await page.goto('/favoritos')
    await settle(page)
    await shot(page, 'favoritos', width)

    await seedCart(page, CART)
    await page.goto('/carrinho')
    await expect(summaryValue(page, 'quote-total')).toHaveAttribute('data-value', '26.846')
    await settle(page)
    await shot(page, 'carrinho', width, width >= 1024)
    if (width < 1024) await shot(page, 'carrinho-pagina', width)

    await page.goto('/pagamento')
    await expect(summaryValue(page, 'quote-total')).toBeVisible()
    await settle(page)
    await shot(page, 'pagamento', width, width >= 1024)
    if (width < 1024) await shot(page, 'pagamento-pagina', width)
  })

  test(`pedidos e confirmação @${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 })
    const pending = await placeOrder(page, { items: CART })
    await settle(page)
    await shot(page, 'pedido-pendente', width, false)
    await mock(page).settleOrder(pending, 'confirmed')
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed')
    await settle(page)
    await shot(page, 'confirmacao', width)
    const rejected = await placeOrder(page, { items: [{ nftId: 'nft-002', editionId: 'ed-10', quantity: 1 }], open: false })
    await mock(page).settleOrder(rejected, 'rejected')
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'rejected')
    await settle(page)
    await shot(page, 'pedido-recusado', width, false)
    await page.goto('/pedidos')
    await expect(page.getByTestId('order-row')).toHaveCount(2)
    await settle(page)
    await shot(page, 'meus-pedidos', width)
  })
}
