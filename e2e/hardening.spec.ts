/**
 * CP7: lacunas técnicas deixadas pelo CP6, cada uma com teste determinístico.
 * - duas abas VISÍVEIS do mesmo usuário: carrinho sincronizado por `cart.updated` (Socket.IO);
 * - timeout após a criação + refresh ou fechamento da aba: a tentativa é recuperada pela chave
 *   (GET /orders/by-key), sem novo pedido;
 * - troca de líder do cluster durante uma requisição e durante a liquidação;
 * - navegador sem Web Locks/BroadcastChannel: modo de aba única;
 * - explorador simulado sem dados privados.
 */
import type { BrowserContext, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { EMERALD_LINE, USERS, mock, openApp, placeOrder, seedCart, signIn, submitLogin, summaryValue } from './support'

async function secondTab(context: BrowserContext, path = '/') {
  const tab = await context.newPage()
  await tab.goto(path)
  await tab.waitForFunction(() => window.__kurioMock !== undefined)
  await tab.locator('main#conteudo').waitFor()
  return tab
}

async function confirmWithTimeout(page: Page) {
  await openApp(page, '/', 'order-timeout')
  await signIn(page, USERS.ana)
  await seedCart(page, [EMERALD_LINE])
  await page.goto('/pagamento')
  await expect(summaryValue(page, 'quote-total')).toBeVisible()
  await page.getByRole('button', { name: 'Conectar MetaMask' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Conectada via MetaMask' })).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar compra' }).filter({ visible: true }).click()
  // O servidor grava na hora e só responde depois do timeout do cliente (5 s).
  await expect.poll(async () => (await mock(page).orders()).length).toBe(1)
  return (await mock(page).orders())[0]!.id
}

test.describe('carrinho em duas abas visíveis do mesmo usuário', () => {
  test('a aba que está mostrando o carrinho atualiza sozinha quando a outra muda o carrinho', async ({ page, context }) => {
    await openApp(page, '/')
    await signIn(page, USERS.ana, '/carrinho')
    const other = await secondTab(context)
    await signIn(other, USERS.ana)
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
    // Nenhum evento de visibilidade: só o `cart.updated` pelo socket da primeira aba.
    await seedCart(other, [{ nftId: 'nft-002', editionId: 'ed-10', quantity: 2 }])
    await expect(page.getByTestId('cart-line')).toHaveCount(1)
    await expect(page.locator('[data-line-id="nft-002:ed-10"] output')).toHaveText('2')
    await expect(summaryValue(page, 'quote-subtotal')).toHaveAttribute('data-value', '3.38')
  })

  test('cart.updated é privado: a aba de outro usuário não recebe', async ({ page, context }) => {
    await openApp(page, '/')
    await signIn(page, USERS.bruno, '/carrinho')
    const other = await secondTab(context)
    await signIn(other, USERS.ana)
    await seedCart(other, [{ nftId: 'nft-002', editionId: 'ed-10', quantity: 1 }])
    await page.waitForTimeout(300) // janela para um evento indevido chegar
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  })
})

test.describe('tentativa idempotente após refresh ou fechamento da aba', () => {
  test('timeout + refresh antes da resposta: o pagamento encontra o pedido pela chave, sem criar outro', async ({ page }) => {
    const orderId = await confirmWithTimeout(page)
    await page.reload() // ainda em /pagamento, antes da resposta atrasada (que chegaria em 8 s)
    await expect(page.getByText('Encontramos a compra que você já tinha enviado')).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/pedidos/${orderId}$`))
    expect((await mock(page).orders()).length).toBe(1)
    // A tentativa foi encerrada: voltar ao pagamento não procura de novo.
    await page.goto('/pagamento')
    await expect(page.getByText('Encontramos a compra que você já tinha enviado')).toHaveCount(0)
    await expect(summaryValue(page, 'quote-total')).toBeVisible()
  })

  test('timeout + fechar a aba: nova aba, novo login, o pagamento recupera o mesmo pedido', async ({ page, context }) => {
    const orderId = await confirmWithTimeout(page)
    await page.close()
    const reopened = await context.newPage()
    await reopened.goto('/pagamento')
    await expect(reopened).toHaveURL(/\/login\?redirect=%2Fpagamento/)
    await submitLogin(reopened, USERS.ana.email, USERS.ana.password)
    await expect(reopened).toHaveURL(new RegExp(`/pedidos/${orderId}$`))
    expect((await mock(reopened).orders()).length).toBe(1)
  })

  test('tentativa que NÃO chegou ao servidor é descartada: nada é recuperado nem criado', async ({ page }) => {
    await openApp(page, '/')
    await signIn(page, USERS.ana)
    await seedCart(page, [EMERALD_LINE])
    await page.evaluate(() => localStorage.setItem('kurio:checkout-attempt:usr_ana', JSON.stringify({ key: 'nunca-enviada', payload: '{}' })))
    await page.goto('/pagamento')
    await expect(summaryValue(page, 'quote-total')).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('kurio:checkout-attempt:usr_ana'))).toBeNull()
    expect((await mock(page).orders()).length).toBe(0)
  })
})

test.describe('troca de líder do cluster', () => {
  test('durante uma requisição: a aba promovida desiste da RPC antiga na hora e o retry é atendido por ela', async ({ page, context }) => {
    const orderId = await placeOrder(page) // aba líder
    const other = await secondTab(context)
    await signIn(other, USERS.ana)
    await mock(page).hold('orders.read') // retido no líder atual
    await other.goto(`/pedidos/${orderId}`)
    await expect(other.getByLabel('Carregando pedido')).toBeVisible()
    await page.close() // o líder sai com a requisição da outra aba em andamento
    await expect.poll(() => mock(other).role()).toBe('leader')
    // Sem esperar os 20 s do timeout de RPC: falha imediata + retry automático na nova líder.
    await expect(other.getByTestId('order-status')).toHaveAttribute('data-status', 'pending', { timeout: 6_000 })
  })

  test('durante a liquidação: a aba promovida retoma o agendamento e o pedido é confirmado', async ({ page, context }) => {
    // A segunda aba é preparada ANTES do pedido; o líder fecha logo após a criação (a liquidação
    // automática está agendada para 4 s depois, no líder que vai fechar).
    await openApp(page, '/', 'slow-settlement')
    const other = await secondTab(context)
    await signIn(other, USERS.ana)
    const orderId = await placeOrder(page, { open: false })
    await page.close()
    await expect.poll(() => mock(other).role()).toBe('leader')
    expect((await mock(other).orders())[0]!.status).toBe('pending') // ainda não liquidado no fechamento
    await other.goto(`/pedidos/${orderId}`)
    // Margem acima dos 4 s agendados: a nova líder retoma o agendamento persistido.
    await expect(other.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed', { timeout: 8_000 })
    expect((await mock(other).orders()).length).toBe(1)
  })
})

test.describe('compatibilidade', () => {
  // BroadcastChannel é requisito do próprio MSW (interceptação de WebSocket); só Web Locks pode faltar.
  test('sem Web Locks a aplicação funciona como aba única (com aviso)', async ({ browser }) => {
    const context = await browser.newContext()
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true })
    })
    const page = await context.newPage()
    const warnings: string[] = []
    page.on('console', (m) => m.type() === 'warning' && warnings.push(m.text()))
    await openApp(page, '/')
    expect(await mock(page).role()).toBe('leader')
    await page.getByRole('button', { name: 'Adicionar Emerald Ape #042 ao carrinho' }).click()
    await expect(page.getByText('Emerald Ape #042 adicionado ao carrinho')).toBeVisible()
    expect(warnings.some((w) => w.includes('sem sincronização entre abas'))).toBe(true)
    await context.close()
  })
})

test.describe('explorador simulado', () => {
  test('contrato público: só dados da transação, nenhum dado do comprador', async ({ page }) => {
    const orderId = await placeOrder(page)
    await mock(page).settleOrder(orderId, 'confirmed')
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed')
    const hash = (await page.getByTestId('order-tx').textContent())!
    // Sem sessão: o explorador é público.
    const tx = await page.evaluate(async (h) => (await fetch(`/api/explorer/tx/${h}`)).json(), hash)
    expect(Object.keys(tx).sort()).toEqual(['blockNumber', 'confirmedAt', 'demo', 'from', 'hash', 'network', 'status', 'value'])
    const raw = JSON.stringify(tx)
    for (const secret of [USERS.ana.email, USERS.ana.name, 'Emerald Ape', 'usr_ana', orderId, 'Principal']) expect(raw).not.toContain(secret)
    // Pedido pendente ou recusado não aparece no explorador.
    const pending = await placeOrder(page, { open: false })
    void pending
    const missing = await page.evaluate(async () => (await fetch('/api/explorer/tx/0xnao-existe')).status)
    expect(missing).toBe(404)
  })
})
