/**
 * CP6: recuperação de pedido no fluxo REAL do checkout (não só a PoC). Desktop e mobile.
 * Em todos os casos o servidor deve terminar com UM pedido (nenhuma recuperação cria outro).
 */
import { expect, test } from './fixtures'
import { USERS, mock, openApp, placeOrder, seedCart, signIn, submitLogin, summaryValue, EMERALD_LINE } from './support'
import type { Page } from '@playwright/test'

const ordersCount = async (page: Page) => (await mock(page).orders()).length
const status = (page: Page) => page.getByTestId('order-status')

test.describe('refresh, nova aba e acesso direto', () => {
  test('refresh durante o pedido pendente: continua pendente e recebe a confirmação depois', async ({ page }) => {
    const orderId = await placeOrder(page)
    await page.reload()
    await expect(status(page)).toHaveAttribute('data-status', 'pending')
    await mock(page).settleOrder(orderId, 'confirmed')
    await expect(status(page)).toHaveAttribute('data-status', 'confirmed')
    expect(await ordersCount(page)).toBe(1)
  })

  test('fechar a aba e reabrir pela URL: login (sessão é por aba) e o estado vem do REST', async ({ page, context }) => {
    const orderId = await placeOrder(page)
    const url = `/pedidos/${orderId}`
    await page.close()
    // A liquidação acontece com a aba fechada; a nova aba vira o líder do cluster de mocks.
    const reopened = await context.newPage()
    await reopened.goto(url)
    await expect(reopened).toHaveURL(new RegExp(`/login\\?redirect=${encodeURIComponent(url)}`))
    await mock(reopened).settleOrder(orderId, 'confirmed')
    await submitLogin(reopened, USERS.ana.email, USERS.ana.password)
    await expect(reopened).toHaveURL(new RegExp(`${url}$`))
    await expect(status(reopened)).toHaveAttribute('data-status', 'confirmed')
    await expect(reopened.getByTestId('order-tx')).toBeVisible()
    expect(await ordersCount(reopened)).toBe(1)
  })
})

test.describe('desconexão e reconciliação', () => {
  for (const outcome of ['confirmed', 'rejected'] as const) {
    test(`pedido ${outcome === 'confirmed' ? 'confirmado' : 'recusado'} enquanto o cliente está offline: reconcilia ao reconectar`, async ({ page }) => {
      const orderId = await placeOrder(page)
      await mock(page).setOnline(false)
      await mock(page).settleOrder(orderId, outcome)
      // Sem socket, nenhum evento chega: a tela não presume nada.
      await page.waitForTimeout(300)
      await expect(status(page)).toHaveAttribute('data-status', 'pending')
      await mock(page).setOnline(true)
      await expect(status(page)).toHaveAttribute('data-status', outcome)
      await expect(page.getByRole('heading', { level: 1, name: outcome === 'confirmed' ? 'Compra confirmada' : 'Pagamento recusado' })).toBeVisible()
      expect(await ordersCount(page)).toBe(1)
    })
  }
})

test.describe('falhas na criação até o recibo', () => {
  for (const scenario of ['order-timeout', 'order-lost-response'] as const) {
    test(`${scenario === 'order-timeout' ? 'timeout' : 'resposta perdida'} após a criação: retry recupera o mesmo pedido até o recibo`, async ({ page }) => {
      await openApp(page, '/', scenario)
      await signIn(page, USERS.ana)
      await seedCart(page, [EMERALD_LINE])
      await page.goto('/pagamento')
      await expect(summaryValue(page, 'quote-total')).toBeVisible()
      await page.getByRole('button', { name: 'Conectar MetaMask' }).click()
      await expect(page.getByRole('status').filter({ hasText: 'Conectada via MetaMask' })).toBeVisible()
      await page.getByRole('button', { name: 'Confirmar compra' }).filter({ visible: true }).click()
      const alert = page.getByRole('alert').filter({ hasText: 'Não recebemos a resposta do servidor' })
      // timeout: o cliente desiste após 5 s (ORDER_CREATE_TIMEOUT_MS)
      await expect(alert).toBeVisible({ timeout: 8_000 })
      const [created] = await mock(page).orders()
      await alert.getByRole('button', { name: 'Tentar novamente' }).click()
      await expect(page).toHaveURL(new RegExp(`/pedidos/${created!.id}$`))
      await mock(page).settleOrder(created!.id, 'confirmed')
      await expect(status(page)).toHaveAttribute('data-status', 'confirmed')
      await expect(page.getByTestId('order-total')).toHaveText('1.206 ETH')
      expect(await ordersCount(page)).toBe(1)
    })
  }
})

test.describe('sessão', () => {
  test('sessão expira com o pedido pendente: login com aviso, volta ao pedido e acompanha a liquidação', async ({ page }) => {
    const orderId = await placeOrder(page)
    await mock(page).expireSessions()
    await page.getByRole('button', { name: 'Atualizar status' }).click()
    await expect(page).toHaveURL(new RegExp(`/login\\?redirect=%2Fpedidos%2F${orderId}&motivo=expirada`))
    await expect(page.getByRole('alert')).toContainText('Sua sessão expirou')
    await submitLogin(page, USERS.ana.email, USERS.ana.password)
    await expect(page).toHaveURL(new RegExp(`/pedidos/${orderId}$`))
    await expect(status(page)).toHaveAttribute('data-status', 'pending')
    await mock(page).settleOrder(orderId, 'confirmed')
    await expect(status(page)).toHaveAttribute('data-status', 'confirmed')
    expect(await ordersCount(page)).toBe(1)
  })
})
