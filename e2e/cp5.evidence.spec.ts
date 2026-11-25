/**
 * Evidências visuais do CP5 (rodar com EVIDENCE=1; grava em planning/evidence/cp5/).
 * Carrinho e pagamento em 390/768/1440, com os 3 itens do Figma, mais estados.
 */
import { expect, test, type Page } from '@playwright/test'
import { USERS, mock, openApp, seedCart, signIn, summaryValue } from './support'

const OUT = 'planning/evidence/cp5'
test.use({ reducedMotion: 'reduce' })

const FIGMA_CART = [
  { nftId: 'nft-001', editionId: 'ed-10', quantity: 2 },
  { nftId: 'nft-005', editionId: 'ed-50', quantity: 6 },
  { nftId: 'nft-006', editionId: 'ed-50', quantity: 9 },
]

async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await expect.poll(() => page.evaluate(() => [...document.images].filter((i) => i.offsetParent !== null).every((i) => i.complete))).toBe(true)
}

const size = (width: number) => ({ width, height: width < 768 ? 844 : 900 })

for (const width of [390, 768, 1440]) {
  test(`carrinho e pagamento @${width}`, async ({ page }) => {
    await page.setViewportSize(size(width))
    await openApp(page, '/')
    await signIn(page, USERS.ana)
    await seedCart(page, FIGMA_CART)
    await page.goto('/carrinho')
    await expect(summaryValue(page, 'quote-total')).toHaveAttribute('data-value', '26.846')
    await settle(page)
    await page.screenshot({ path: `${OUT}/carrinho-${width}.png`, fullPage: width < 1024 })

    await page.goto('/pagamento')
    await expect(summaryValue(page, 'quote-total')).toBeVisible()
    await settle(page)
    await page.screenshot({ path: `${OUT}/pagamento-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Conectar MetaMask' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Conectada via MetaMask' })).toBeVisible()
    await page.screenshot({ path: `${OUT}/pagamento-conectado-${width}.png`, fullPage: width < 1024 })
  })
}

test('estados do carrinho e do pagamento @1440 e @390', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize(size(width))
    await openApp(page, '/')
    await page.goto('/carrinho')
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
    await page.screenshot({ path: `${OUT}/estado-carrinho-vazio-${width}.png` })

    await signIn(page, USERS.ana)
    await seedCart(page, [{ nftId: 'nft-004', editionId: 'ed-10', quantity: 2 }, { nftId: 'nft-001', editionId: 'ed-10', quantity: 1 }])
    await page.goto('/carrinho')
    await expect(summaryValue(page, 'quote-total')).toBeVisible()
    await page.getByLabel('Código promocional').fill('natal2024')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('Este cupom expirou em 31/12/2024.')).toBeVisible()
    await mock(page).updateNft('nft-004', { editions: [{ id: 'ed-10', available: 1 }] })
    await mock(page).updateNft('nft-001', { price: '1.25' })
    await expect(page.getByText('Só resta 1 unidade')).toBeVisible()
    await expect(page.getByText('Preço atualizado')).toBeVisible()
    await page.screenshot({ path: `${OUT}/estado-carrinho-estoque-preco-cupom-${width}.png`, fullPage: width < 1024 })
    await page.getByRole('button', { name: 'Ajustar para 1' }).click()
    await expect(page.getByText('Só resta 1 unidade')).toHaveCount(0)

    await page.goto('/pagamento')
    await expect(summaryValue(page, 'quote-total')).toBeVisible()
    await page.getByRole('button', { name: 'Conectar MetaMask' }).click()
    await mock(page).updateNft('nft-001', { price: '1.40' })
    await expect(page.getByTestId('quote-changed')).toBeVisible()
    await page.getByTestId('quote-changed').scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${OUT}/estado-pagamento-valores-mudaram-${width}.png` })
    await page.evaluate(() => {
      sessionStorage.clear()
      localStorage.removeItem('kurio:guest-cart')
    })
  }
})

test('pedido criado aguardando a rede @1440', async ({ page }) => {
  await page.setViewportSize(size(1440))
  await openApp(page, '/', 'slow-order')
  await signIn(page, USERS.ana)
  await seedCart(page, FIGMA_CART)
  await page.goto('/pagamento')
  await expect(summaryValue(page, 'quote-total')).toBeVisible()
  await page.getByRole('button', { name: 'Conectar MetaMask' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Conectada via MetaMask' })).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar compra' }).filter({ visible: true }).click()
  await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'pending')
  await page.screenshot({ path: `${OUT}/pedido-pendente-1440.png` })
})
