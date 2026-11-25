/**
 * CP6: ciclo de vida do pedido, recibo definitivo, reserva de estoque e histórico
 * (PAY-05, PAY-06, PAY-07, PAY-08, E2E-06, R-40). Desktop e mobile.
 * O estado do pedido vem sempre da API simulada (mock.settleOrder / relógio da simulação).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './fixtures'
import { USERS, cartQuantity, mock, openApp, placeOrder, readOrder, seedCart, signIn, signOut, openAccount } from './support'

const MIN = 60_000

test.describe('compra completa até o recibo definitivo', () => {
  test('pendente → confirmado pela rede: recibo com snapshot, hash, explorador simulado e histórico', async ({ page }) => {
    const orderId = await placeOrder(page)
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'pending')
    await expect(page.getByTestId('reservation')).toContainText('Itens reservados até')
    await expect(page.getByText('Compra confirmada')).toHaveCount(0)

    await mock(page).settleOrder(orderId, 'confirmed')
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed')
    await expect(page.getByRole('heading', { level: 1, name: 'Compra confirmada' })).toBeVisible()
    const receipt = page.getByTestId('receipt')
    await expect(receipt.getByTestId('receipt-status')).toHaveText('Confirmado')
    await expect(receipt.getByTestId('order-tx')).toHaveText(/^0x[0-9a-f]{40}$/)
    await expect(receipt).toContainText('Confirmado em')
    const line = receipt.getByTestId('receipt-line')
    await expect(line).toContainText('Emerald Ape #042')
    await expect(line).toContainText('Edição 1/10')
    await expect(line.getByTestId('receipt-unit')).toHaveText('1 × 1.19 ETH')
    await expect(receipt.getByTestId('receipt-subtotal')).toHaveText('1.19 ETH')
    await expect(receipt.getByTestId('receipt-discount')).toHaveText('(-) 0.00 ETH')
    await expect(receipt.getByTestId('receipt-fee')).toHaveText('0.016 ETH')
    await expect(receipt.getByTestId('order-total')).toHaveText('1.206 ETH')
    await expect(receipt.getByTestId('receipt-network')).toHaveText('Ethereum')
    await expect(receipt.getByTestId('receipt-wallet')).toHaveText('Principal · 0xA91F…E82C · via MetaMask')
    // Itens comprados saem do carrinho só agora (PAY-07).
    await expect.poll(() => cartQuantity(page)).toBe(0)

    const hash = await receipt.getByTestId('order-tx').textContent()
    await receipt.getByRole('link', { name: 'Ver no explorador simulado' }).click()
    await expect(page.getByRole('note')).toContainText('Explorador simulado: ambiente de demonstração')
    await expect(page.getByText(hash!)).toBeVisible()
    await expect(page.getByText('1.206 ETH')).toBeVisible()

    await page.goto('/pedidos')
    const row = page.locator(`[data-order-id="${orderId}"]`)
    await expect(row.getByTestId('order-row-status')).toHaveText('Confirmado')
    await row.getByRole('link', { name: `Ver pedido ${orderId}` }).click()
    await expect(page).toHaveURL(new RegExp(`/pedidos/${orderId}$`))
  })

  test('recibo imutável: preço, estoque, carteira e perfil mudam depois e o recibo não', async ({ page }) => {
    const orderId = await placeOrder(page)
    await mock(page).settleOrder(orderId, 'confirmed')
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed')
    await mock(page).updateNft('nft-001', { price: '9.99', editions: [{ id: 'ed-10', available: 0 }] })
    const changed = await page.evaluate(async () => {
      const token = (JSON.parse(sessionStorage.getItem('kurio:session')!) as { token: string }).token
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      const wallet = await fetch('/api/me/wallets/wal_ana_1', { method: 'PUT', headers, body: JSON.stringify({ nickname: 'Renomeada', network: 'polygon', type: 'coinbase', address: '0x1111111111111111111111111111111111111111' }) })
      const profile = await fetch('/api/me/profile', { method: 'PUT', headers, body: JSON.stringify({ displayName: 'Outro Nome', username: 'ana.coleciona', email: 'ana@kurio.test', walletNickname: 'Outro apelido' }) })
      return [wallet.status, profile.status]
    })
    expect(changed).toEqual([200, 200])
    await page.reload()
    const receipt = page.getByTestId('receipt')
    await expect(receipt.getByTestId('receipt-unit')).toHaveText('1 × 1.19 ETH')
    await expect(receipt.getByTestId('order-total')).toHaveText('1.206 ETH')
    await expect(receipt.getByTestId('receipt-wallet')).toHaveText('Principal · 0xA91F…E82C · via MetaMask')
    await expect(receipt.getByTestId('receipt-network')).toHaveText('Ethereum')
    // Estado terminal não muda no servidor.
    expect(await mock(page).settleOrder(orderId, 'rejected')).toBeNull()
    expect((await readOrder(page, orderId)).body.status).toBe('confirmed')
  })

  test('acessibilidade do recibo: axe sem violações', async ({ page }) => {
    const orderId = await placeOrder(page)
    await mock(page).settleOrder(orderId, 'confirmed')
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed')
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(results.passes.length).toBeGreaterThan(10)
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([])
  })
})

test.describe('recusa e reserva de estoque (R-40)', () => {
  test('recusa: sem confirmação, carrinho preservado, reserva liberada UMA vez', async ({ page }) => {
    await openApp(page, '/', 'slow-order')
    expect(await mock(page).available('nft-001', 'ed-10')).toBe(4)
    const orderId = await placeOrder(page, { open: false })
    expect(await mock(page).available('nft-001', 'ed-10')).toBe(3) // reservado na criação
    await mock(page).settleOrder(orderId, 'rejected')
    await expect(page.getByRole('heading', { level: 1, name: 'Pagamento recusado' })).toBeVisible()
    await expect(page.getByText('Nenhum valor foi cobrado')).toBeVisible()
    await expect(page.getByTestId('order-tx')).toHaveCount(0)
    expect(await cartQuantity(page)).toBe(1)
    expect(await mock(page).available('nft-001', 'ed-10')).toBe(4)
    // Liquidação repetida e vencimento posterior não devolvem o estoque de novo.
    expect(await mock(page).settleOrder(orderId, 'rejected')).toBeNull()
    await mock(page).advanceClock(11 * MIN)
    expect(await mock(page).available('nft-001', 'ed-10')).toBe(4)
  })

  test('reserva vence: pedido recusado por prazo, estoque devolvido, confirmação atrasada não confirma', async ({ page }) => {
    await openApp(page, '/', 'slow-order')
    const orderId = await placeOrder(page, { open: false })
    expect(await mock(page).available('nft-001', 'ed-10')).toBe(3)
    expect(await mock(page).advanceClock(9 * MIN)).toBe(0) // ainda dentro do prazo
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'pending')
    expect(await mock(page).advanceClock(1 * MIN)).toBe(1) // 10 min: vence
    await expect(page.getByRole('heading', { level: 1, name: 'Reserva expirada' })).toBeVisible()
    expect(await mock(page).available('nft-001', 'ed-10')).toBe(4)
    expect((await mock(page).orders())[0]!.failureReason).toBe('reservation_expired')
    // A "rede" confirma tarde demais: nada muda.
    expect(await mock(page).settleOrder(orderId, 'confirmed')).toBeNull()
    expect((await readOrder(page, orderId)).body.status).toBe('rejected')
    expect(await cartQuantity(page)).toBe(1)
    await mock(page).advanceClock(30 * MIN)
    expect(await mock(page).available('nft-001', 'ed-10')).toBe(4)
  })

  test('confirmação que chega depois do prazo vira recusa mesmo antes de qualquer varredura', async ({ page }) => {
    await openApp(page, '/', 'slow-order')
    const orderId = await placeOrder(page, { open: false })
    await mock(page).advanceClock(11 * MIN, false) // prazo vencido, sem varredura
    await mock(page).settleOrder(orderId, 'confirmed') // a "rede" confirma tarde
    const order = (await readOrder(page, orderId)).body
    expect([order.status, order.failureReason, order.txHash]).toEqual(['rejected', 'reservation_expired', null])
    await expect(page.getByRole('heading', { level: 1, name: 'Reserva expirada' })).toBeVisible()
    expect(await mock(page).available('nft-001', 'ed-10')).toBe(4)
  })

  test('itens adicionados depois do pedido permanecem após a confirmação', async ({ page }) => {
    const orderId = await placeOrder(page)
    await seedCart(page, [{ nftId: 'nft-002', editionId: 'ed-10', quantity: 1 }])
    await mock(page).settleOrder(orderId, 'confirmed')
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed')
    await page.goto('/carrinho')
    await expect(page.getByTestId('cart-line')).toHaveCount(1)
    await expect(page.getByTestId('cart-line')).toContainText('Sage Nomad #009')
  })
})

test.describe('histórico e acesso', () => {
  test('histórico: mais recentes primeiro, status da API; vazio para quem não comprou', async ({ page }) => {
    const first = await placeOrder(page)
    await mock(page).settleOrder(first, 'rejected')
    const second = await placeOrder(page, { open: false })
    await page.goto('/pedidos')
    const rows = page.getByTestId('order-row')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toHaveAttribute('data-order-id', second)
    await expect(rows.nth(0).getByTestId('order-row-status')).toHaveText('Pendente')
    await expect(rows.nth(1).getByTestId('order-row-status')).toHaveText('Recusado')
    // Atualiza em tempo real.
    await mock(page).settleOrder(second, 'confirmed')
    await expect(rows.nth(0).getByTestId('order-row-status')).toHaveText('Confirmado')

    await page.goto('/')
    await openAccount(page)
    await signOut(page)
    await signIn(page, USERS.bruno, '/pedidos')
    await expect(page.getByRole('heading', { name: 'Você ainda não fez pedidos' })).toBeVisible()
  })

  test('pedido de outro usuário: tela e API respondem "não encontrado"', async ({ page }) => {
    const orderId = await placeOrder(page)
    await page.goto('/')
    await openAccount(page)
    await signOut(page)
    await signIn(page, USERS.bruno, `/pedidos/${orderId}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Pedido não encontrado' })).toBeVisible()
    expect((await readOrder(page, orderId)).status).toBe(404)
    await expect(page.getByText('Emerald Ape #042')).toHaveCount(0)
  })

  test('carregamento, erro e recuperação da tela do pedido', async ({ page }) => {
    const orderId = await placeOrder(page)
    await page.goto(`/pedidos/${orderId}?scenario=hold-order-read`)
    await expect(page.getByLabel('Carregando pedido')).toBeVisible()
    await mock(page).release('orders.read')
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'pending')

    await page.goto(`/pedidos/${orderId}?scenario=order-read-error`)
    // Erro só depois da tentativa + 2 retries automáticos (backoff de 1 s e 2 s).
    await expect(page.getByRole('heading', { name: 'Não foi possível carregar o pedido' })).toBeVisible({ timeout: 10_000 })
    await mock(page).recover('orders.read')
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'pending')
  })
})
