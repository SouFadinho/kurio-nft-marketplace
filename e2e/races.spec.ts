/**
 * CP6: corridas resolvidas com testes DETERMINÍSTICOS (sem depender de repetição da suíte).
 *
 * R-42: uma leitura REST do pedido (versão N) sai antes do evento e chega depois dele.
 *   O mock FOTOGRAFA o pedido no início da leitura retida (`hold('orders.read')`), entrega o
 *   `order.updated` (N+1) pelo socket e só então libera a resposta antiga.
 * R-44: a primeira adição do visitante cria o id, habilita a leitura do carrinho e dispara o
 *   POST junto. A leitura é retida com o carrinho VAZIO fotografado; o POST grava; a leitura
 *   antiga é liberada depois.
 * Controles negativos (sem as proteções) em planning/evidence/cp6-tests/*-SEM-PROTECAO*.log.
 */
import { expect, test } from './fixtures'
import { mock, openApp, placeOrder, readOrder } from './support'
import type { Page } from '@playwright/test'

/** Espera a resposta de uma rota da API chegar à página (servida pelo Service Worker do MSW). */
const nextResponse = (page: Page, path: RegExp) => page.waitForResponse((r) => path.test(new URL(r.url()).pathname))

test.describe('R-42: leitura REST antiga depois de evento novo (pedido)', () => {
  test('versão N retida, evento N+1 aplicado, resposta N liberada: o estado continua em N+1', async ({ page }) => {
    const orderId = await placeOrder(page)
    const status = page.getByTestId('order-status')
    await expect(status).toHaveAttribute('data-status', 'pending')
    expect((await readOrder(page, orderId)).body.version).toBe(1)

    // 1–2. Uma leitura REST da versão 1 sai e fica retida no "servidor".
    await mock(page).hold('orders.read')
    await page.getByRole('button', { name: 'Atualizar status' }).click()
    await expect(page.getByRole('button', { name: 'Atualizando…' })).toBeDisabled()
    // 3–4. O evento da versão 2 chega pelo Socket.IO e é aplicado.
    await mock(page).settleOrder(orderId, 'confirmed')
    await expect(status).toHaveAttribute('data-status', 'confirmed')
    // 5. A resposta antiga (versão 1, "pendente") é liberada e chega ao cliente.
    const stale = nextResponse(page, new RegExp(`/api/orders/${orderId}$`))
    await mock(page).release('orders.read')
    const body = (await (await stale).json()) as { status: string; version: number }
    expect([body.status, body.version]).toEqual(['pending', 1])
    // 6. O estado permanece na versão mais nova.
    await expect(status).toHaveAttribute('data-status', 'confirmed')
    await page.waitForTimeout(300) // margem para qualquer re-render tardio
    await expect(status).toHaveAttribute('data-status', 'confirmed')
    await expect(page.getByRole('heading', { level: 1, name: 'Compra confirmada' })).toBeVisible()
  })
})

test.describe('eventos de pedido repetidos, antigos e terminais', () => {
  test('duplicado, versão antiga e tentativa de regredir estado terminal são ignorados', async ({ page }) => {
    const orderId = await placeOrder(page)
    await mock(page).settleOrder(orderId, 'confirmed')
    const status = page.getByTestId('order-status')
    await expect(status).toHaveAttribute('data-status', 'confirmed')

    await mock(page).replayLast() // mesmo eventId
    await mock(page).emitOrderEvent(orderId, 'pending', 1) // versão antiga
    await mock(page).emitOrderEvent(orderId, 'rejected', 9) // versão maior, mas o pedido já é terminal
    await page.waitForTimeout(300)
    await expect(status).toHaveAttribute('data-status', 'confirmed')
    await expect(page.getByRole('heading', { level: 1, name: 'Compra confirmada' })).toBeVisible()
    // Após refresh, o REST (autoridade) confirma o mesmo estado.
    await page.reload()
    await expect(status).toHaveAttribute('data-status', 'confirmed')
  })

  test('evento antigo antes do terminal não regride um pendente; o terminal vence', async ({ page }) => {
    const orderId = await placeOrder(page)
    const status = page.getByTestId('order-status')
    await mock(page).emitOrderEvent(orderId, 'pending', 1) // mesma versão já em cache: descartado
    await mock(page).settleOrder(orderId, 'rejected') // v2
    await expect(status).toHaveAttribute('data-status', 'rejected')
    await mock(page).emitOrderEvent(orderId, 'confirmed', 2) // fora de ordem / mesma versão
    await page.waitForTimeout(300)
    await expect(status).toHaveAttribute('data-status', 'rejected')
  })
})

test.describe('R-44: primeira adição do visitante', () => {
  test('leitura do carrinho vazio retida, POST grava, leitura antiga liberada: o carrinho continua com o item', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'o badge do header só existe no desktop; o mobile é coberto pela leitura da API')
    await openApp(page, '/')
    // Destino da leitura antiga: abortada (cancelamento ao gravar) ou entregue e ignorada (versão).
    const fate: string[] = []
    const isCartRead = (url: string) => /\/api\/cart$/.test(new URL(url).pathname)
    page.on('requestfailed', (r) => isCartRead(r.url()) && fate.push('abortada'))
    page.on('response', (r) => isCartRead(r.url()) && r.request().method() === 'GET' && fate.push('entregue'))
    await mock(page).hold('cart.read')
    await page.getByRole('button', { name: 'Adicionar Emerald Ape #042 ao carrinho' }).click()
    await expect(page.getByText('Emerald Ape #042 adicionado ao carrinho')).toBeVisible()
    const badge = page.getByRole('banner').getByRole('link', { name: /^Carrinho/ })
    await expect(badge).toHaveAccessibleName('Carrinho, 1 itens')
    await mock(page).release('cart.read')
    await expect.poll(() => fate.length).toBeGreaterThan(0)
    await page.waitForTimeout(300)
    await expect(badge).toHaveAccessibleName('Carrinho, 1 itens')
    test.info().annotations.push({ type: 'leitura antiga', description: fate.join(', ') })
  })
})
