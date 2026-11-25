/**
 * CP6 (PEND-03): consistência entre abas da mesma origem.
 * Duas páginas no mesmo contexto = duas abas (mesmo localStorage, sessionStorage separado).
 * A primeira é o líder do cluster de mocks; a segunda encaminha REST e controle a ele. Eventos
 * de domínio chegam a cada aba pelo PRÓPRIO socket.io-client (o barramento é interno ao mock).
 */
import type { BrowserContext, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { USERS, cartQuantity, mock, openApp, placeOrder, readOrder, seedCart, signIn } from './support'

async function secondTab(context: BrowserContext, path = '/') {
  const tab = await context.newPage()
  await tab.goto(path)
  await tab.waitForFunction(() => window.__kurioMock !== undefined)
  await tab.locator('main#conteudo').waitFor()
  return tab
}
const price = (page: Page, id: string) => page.locator(`[data-testid="nft-card"][data-nft-id="${id}"] [data-value]`).first()

test.describe('consistência entre abas', () => {
  test('um único servidor lógico: catálogo e estoque sincronizados pelos sockets de cada aba', async ({ page, context }) => {
    await openApp(page, '/')
    const other = await secondTab(context)
    expect([await mock(page).role(), await mock(other).role()]).toEqual(['leader', 'follower'])
    await expect(price(other, 'nft-002')).toHaveText('1.69 ETH')

    await mock(page).updateNft('nft-002', { price: '2.22' }) // no líder
    await expect(price(other, 'nft-002')).toHaveText('2.22 ETH')
    await mock(other).updateNft('nft-002', { price: '2.33' }) // pela seguidora (RPC ao líder)
    await expect(price(page, 'nft-002')).toHaveText('2.33 ETH')
    await expect(price(other, 'nft-002')).toHaveText('2.33 ETH')
    expect(await mock(other).available('nft-002', 'ed-10')).toBe(6)
  })

  test('carrinho do mesmo usuário: escritas concorrentes das duas abas sem perda; a outra aba atualiza ao voltar', async ({ page, context }) => {
    await openApp(page, '/')
    await signIn(page, USERS.ana)
    const other = await secondTab(context)
    await signIn(other, USERS.ana)
    await other.goto('/carrinho')
    await expect(other.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()

    // Mesmo instante, nas duas abas: linhas diferentes e a MESMA linha.
    await Promise.all([
      seedCart(page, [{ nftId: 'nft-001', editionId: 'ed-10', quantity: 1 }, { nftId: 'nft-005', editionId: 'ed-50', quantity: 1 }]),
      seedCart(other, [{ nftId: 'nft-002', editionId: 'ed-10', quantity: 1 }, { nftId: 'nft-005', editionId: 'ed-50', quantity: 1 }]),
    ])
    expect(await cartQuantity(page)).toBe(4)
    expect(await cartQuantity(other)).toBe(4)
    // A aba que estava aberta reconcilia ao voltar a ficar visível.
    await other.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await expect(other.getByTestId('cart-line')).toHaveCount(3)
    await expect(other.locator('[data-line-id="nft-005:ed-50"] output')).toHaveText('2')
  })

  test('idempotência entre abas: a mesma tentativa enviada pelas duas abas cria UM pedido', async ({ page, context }) => {
    await openApp(page, '/', 'manual-settlement')
    await signIn(page, USERS.ana)
    const other = await secondTab(context)
    await signIn(other, USERS.ana)
    const body = await page.evaluate(async () => {
      const token = (JSON.parse(sessionStorage.getItem('kurio:session')!) as { token: string }).token
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      await fetch('/api/cart/items', { method: 'POST', headers, body: JSON.stringify({ nftId: 'nft-002', editionId: 'ed-10', quantity: 1 }) })
      const quote = (await (await fetch('/api/cart/quote', { method: 'POST', headers, body: JSON.stringify({ network: 'ethereum' }) })).json()) as { id: string }
      const conn = (await (await fetch('/api/wallet-connections', { method: 'POST', headers, body: JSON.stringify({ provider: 'metamask', network: 'ethereum', address: '0xA91F7c2D3e4F5a6B7c8D9e0F1a2B3c4D5e6FE82C' }) })).json()) as { id: string }
      return { quoteId: quote.id, network: 'ethereum', buyer: { displayName: 'Ana', email: 'ana@kurio.test' }, wallet: { kind: 'saved', walletId: 'wal_ana_1' }, connectionId: conn.id }
    })
    const post = (tab: Page) =>
      tab.evaluate(async (b) => {
        const token = (JSON.parse(sessionStorage.getItem('kurio:session')!) as { token: string }).token
        const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': 'tentativa-entre-abas' }, body: JSON.stringify(b) })
        return [res.status, ((await res.json()) as { id: string }).id] as const
      }, body)
    const [a, b] = await Promise.all([post(page), post(other)])
    expect(a[1]).toBe(b[1])
    expect([a[0], b[0]].sort()).toEqual([200, 201])
    expect((await mock(other).orders()).length).toBe(1)
  })

  test('isolamento entre usuários em abas diferentes: pedido e eventos de Ana não chegam à aba de Bruno', async ({ page, context }) => {
    const orderId = await placeOrder(page) // Ana, aba líder
    const other = await secondTab(context)
    await signIn(other, USERS.bruno, '/pedidos')
    await expect(other.getByRole('heading', { name: 'Você ainda não fez pedidos' })).toBeVisible()
    await mock(page).settleOrder(orderId, 'confirmed')
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed')
    expect((await readOrder(other, orderId)).status).toBe(404)
    await other.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await expect(other.getByRole('heading', { name: 'Você ainda não fez pedidos' })).toBeVisible()
  })

  test('failover: a aba líder fecha, a outra assume o servidor e continua a liquidação', async ({ page, context }) => {
    const orderId = await placeOrder(page) // liquidação manual
    const other = await secondTab(context)
    await signIn(other, USERS.ana, `/pedidos/${orderId}`)
    await expect(other.getByTestId('order-status')).toHaveAttribute('data-status', 'pending')
    await page.close()
    await expect.poll(() => mock(other).role()).toBe('leader')
    await mock(other).settleOrder(orderId, 'confirmed')
    await expect(other.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed')
    expect((await mock(other).orders()).length).toBe(1)
  })

  test('aba desconectada perde eventos e reconcilia pelo REST ao reconectar', async ({ page, context }) => {
    await openApp(page, '/')
    const other = await secondTab(context)
    await mock(other).setOnline(false) // só o transporte da outra aba
    await mock(page).updateNft('nft-002', { price: '3.10' })
    await expect(price(page, 'nft-002')).toHaveText('3.10 ETH')
    await expect(price(other, 'nft-002')).toHaveText('1.69 ETH')
    await mock(other).setOnline(true)
    await expect(price(other, 'nft-002')).toHaveText('3.10 ETH')
  })
})
