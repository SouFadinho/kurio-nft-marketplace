/**
 * CP3 — Detalhes do NFT (E2E-02 e parte de E2E-09/E2E-12).
 * Integração real: Router (loader + notFound) → Query → Axios → MSW; tempo real via
 * socket.io-client. Roda nos projetos desktop (1440) e mobile (390).
 */
import { expect, test, type Page } from '@playwright/test'
import { mock, openApp } from './support'

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 1024
const price = (page: Page) =>
  isMobile(page) ? page.getByTestId('mobile-buy-bar').locator('[data-value]') : page.locator('main [data-slot="price"] [data-value]').filter({ visible: true }).first()
const qtyGroup = (page: Page) => page.getByRole('group', { name: 'Quantidade de Emerald Ape #042' }).filter({ visible: true })

test.describe('detalhe do NFT', () => {
  test('acesso direto e refresh mostram o NFT com os dados do Figma', async ({ page }) => {
    await openApp(page, '/nft/nft-001')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await expect(price(page)).toHaveText('1.19 ETH')
    await expect(page.getByRole('img', { name: /Avaliação 4,8 de 5, 19 avaliações/ }).filter({ visible: true })).toBeVisible()
    await expect(page.getByRole('radio', { name: /Edição 1\/50/ })).toHaveAttribute('aria-checked', 'true')
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
  })

  test('NFT inexistente mostra 404 com caminho de volta', async ({ page }) => {
    await openApp(page, '/nft/nao-existe')
    await expect(page.getByRole('heading', { level: 1, name: 'NFT não encontrado' })).toBeVisible()
    await page.getByRole('link', { name: 'Voltar ao mercado' }).click()
    await expect(page).toHaveURL(/\/mercado$/)
  })

  test('seleção de edição vai para a URL; edição esgotada fica indisponível', async ({ page }) => {
    await openApp(page, '/nft/nft-001')
    await expect(page.getByRole('radio', { name: 'Edição 1/1, esgotada' })).toBeDisabled()
    await page.getByRole('radio', { name: /Edição 1\/10/ }).click()
    await expect(page).toHaveURL(/edicao=ed-10/)
    await expect(page.getByTestId('edition-stock')).toContainText('4 unidades disponíveis')
    await page.reload()
    await expect(page.getByRole('radio', { name: /Edição 1\/10/ })).toHaveAttribute('aria-checked', 'true')
  })

  test('quantidade é inteira e limitada ao estoque da edição', async ({ page }) => {
    await openApp(page, '/nft/nft-001?edicao=ed-10')
    const group = qtyGroup(page)
    const plus = group.getByRole('button', { name: /Aumentar/ })
    for (let i = 0; i < 6; i++) if (await plus.isEnabled()) await plus.click()
    await expect(group.locator('output')).toHaveText('4')
    await expect(plus).toBeDisabled()
  })

  test('nft.updated via Socket.IO: preço e estoque mudam na tela e são anunciados', async ({ page }) => {
    await openApp(page, '/nft/nft-001?edicao=ed-10')
    const group = qtyGroup(page)
    for (let i = 0; i < 3; i++) await group.getByRole('button', { name: /Aumentar/ }).click()
    await expect(group.locator('output')).toHaveText('4')

    await mock(page).updateNft('nft-001', { price: '1.50' })
    await expect(price(page)).toHaveText('1.50 ETH')
    await expect(page.getByTestId('live-notice')).toHaveText('Preço atualizado para 1.50 ETH.')

    // Estoque cai para 2: a quantidade escolhida (4) passa a valer 2.
    await mock(page).updateNft('nft-001', { editions: [{ id: 'ed-10', available: 2 }] })
    await expect(group.locator('output')).toHaveText('2')
    await expect(page.getByTestId('edition-stock')).toContainText('2 unidades disponíveis')

    // Esgota: compra desabilitada, sem sucesso simulado.
    await mock(page).updateNft('nft-001', { editions: [{ id: 'ed-10', available: 0 }] })
    await expect(page.getByText('Edição 1/10 indisponível no momento.')).toBeVisible()
    await expect(page.getByTestId('live-notice')).toHaveText('Esta edição esgotou.')
  })

  test('comprar e adicionar ao carrinho NÃO simulam sucesso (carrinho é do CP5)', async ({ page }) => {
    await openApp(page, '/nft/nft-001')
    const buy = isMobile(page) ? page.getByRole('button', { name: 'Comprar NFT', exact: true }) : page.getByRole('button', { name: 'Comprar', exact: true })
    await buy.click()
    await expect(page.getByText('Compra ainda não disponível')).toBeVisible()
    await page.getByRole('button', { name: 'Adicionar Emerald Ape #042 ao carrinho' }).filter({ visible: true }).click()
    await expect(page.getByText('Compra ainda não disponível').first()).toBeVisible()
  })

  test('falha ao carregar o detalhe: erro e "Tentar novamente" recupera', async ({ page }) => {
    await openApp(page, '/mercado', 'detail-error')
    await page.goto('/nft/nft-002')
    const alert = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar este NFT' })
    await expect(alert).toBeVisible({ timeout: 15_000 })
    await alert.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Sage Nomad #009' })).toBeVisible()
  })

  test('do catálogo filtrado ao detalhe e de volta: filtros preservados', async ({ page }) => {
    await openApp(page, '/?category=musica')
    await page.getByRole('link', { name: 'Golden Beat #207' }).click()
    await expect(page).toHaveURL(/\/nft\/nft-007/)
    await expect(page.getByRole('heading', { level: 1, name: 'Golden Beat #207' })).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(/category=musica/)
    await expect(page.getByTestId('nft-card')).toHaveCount(7)
  })

  test('mobile: barra de compra fixa e sem navegação inferior; desktop: ações em linha', async ({ page }) => {
    await openApp(page, '/nft/nft-001')
    if (isMobile(page)) {
      await expect(page.getByTestId('mobile-buy-bar')).toBeVisible()
      await expect(page.getByTestId('bottom-nav')).toHaveCount(0)
    } else {
      await expect(page.getByTestId('mobile-buy-bar')).toBeHidden()
      await expect(page.getByRole('button', { name: 'Comprar', exact: true })).toBeVisible()
      await expect(page.getByRole('navigation', { name: 'Trilha de navegação' })).toContainText('Início/Mercado/Emerald Ape #042')
    }
  })

  test('edições operáveis por teclado (setas)', async ({ page }) => {
    await openApp(page, '/nft/nft-001')
    const current = page.getByRole('radio', { name: /Edição 1\/50/ })
    await current.focus()
    await page.keyboard.down('ArrowRight')
    await page.waitForTimeout(80)
    await page.keyboard.up('ArrowRight')
    await expect(page.getByRole('radio', { name: /Edição Aberta/ })).toHaveAttribute('aria-checked', 'true')
    await expect(page).toHaveURL(/edicao=ed-open/)
  })
})
