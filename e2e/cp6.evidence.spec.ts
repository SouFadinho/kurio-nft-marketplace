/**
 * Evidências visuais do CP6 (rodar com EVIDENCE=1; grava em planning/evidence/cp6/).
 * Pedido pendente, recibo confirmado, pedido recusado, reserva expirada, histórico e
 * explorador simulado em 390/768/1440. Sem frame no Figma: derivados do design system.
 */
import { expect, test, type Page } from '@playwright/test'
import { mock, placeOrder } from './support'

const OUT = 'planning/evidence/cp6'
test.use({ reducedMotion: 'reduce' })

const CART = [
  { nftId: 'nft-001', editionId: 'ed-10', quantity: 2 },
  { nftId: 'nft-005', editionId: 'ed-50', quantity: 1 },
]

async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await expect.poll(() => page.evaluate(() => [...document.images].filter((i) => i.offsetParent !== null).every((i) => i.complete))).toBe(true)
}

for (const width of [390, 768, 1440]) {
  test(`pedidos @${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 })
    const full = width < 1024

    const rejected = await placeOrder(page, { items: CART })
    await settle(page)
    await page.screenshot({ path: `${OUT}/pedido-pendente-${width}.png`, fullPage: full })
    await mock(page).settleOrder(rejected, 'rejected')
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'rejected')
    await page.screenshot({ path: `${OUT}/pedido-recusado-${width}.png`, fullPage: full })

    const expired = await placeOrder(page, { items: [], open: false }) // recusa/vencimento mantêm o carrinho (PAY-07)
    await mock(page).advanceClock(10 * 60_000)
    await expect(page.getByRole('heading', { level: 1, name: 'Reserva expirada' })).toBeVisible()
    await page.screenshot({ path: `${OUT}/pedido-reserva-expirada-${width}.png`, fullPage: full })
    void expired

    const confirmed = await placeOrder(page, { items: [], open: false }) // recusa/vencimento mantêm o carrinho (PAY-07)
    await mock(page).settleOrder(confirmed, 'confirmed')
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed')
    await settle(page)
    await page.screenshot({ path: `${OUT}/recibo-confirmado-${width}.png`, fullPage: true })

    await page.getByRole('link', { name: 'Ver no explorador simulado' }).click()
    await expect(page.getByRole('note')).toBeVisible()
    await page.screenshot({ path: `${OUT}/explorador-simulado-${width}.png`, fullPage: full })

    await page.goto('/pedidos')
    await expect(page.getByTestId('order-row')).toHaveCount(3)
    await settle(page)
    await page.screenshot({ path: `${OUT}/historico-${width}.png`, fullPage: true })
  })
}
