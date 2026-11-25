/**
 * CP5: pagamento (PAY-01..04, PEND-01, PEND-02). Desktop e mobile.
 * Pedidos são conferidos no "servidor" (mock.orders()): nenhuma confirmação vem da interface.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './fixtures'
import { USERS, cartQuantity, mock, openApp, seedCart, signIn, submitLogin, summaryValue } from './support'
import type { Page } from '@playwright/test'

const EMERALD = { nftId: 'nft-001', editionId: 'ed-10', quantity: 1 }

async function goCheckout(page: Page, scenario = 'default', items = [EMERALD]) {
  await openApp(page, '/', scenario)
  await signIn(page, USERS.ana)
  await seedCart(page, items)
  await page.goto('/pagamento')
  await expect(summaryValue(page, 'quote-total')).toBeVisible()
}

const confirmButton = (page: Page) => page.getByRole('button', { name: /^(Confirmar compra|Enviando pedido…)$/ }).filter({ visible: true })

async function connect(page: Page, provider = 'MetaMask') {
  await page.getByRole('button', { name: `Conectar ${provider}` }).click()
  await expect(page.getByRole('status').filter({ hasText: `Conectada via ${provider}` })).toBeVisible()
}

async function ordersCount(page: Page) {
  return (await mock(page).orders()).length
}

test.describe('fluxo principal', () => {
  test('visitante: carrinho → login (merge) → pagamento → pedido pendente → confirmado pela rede simulada', async ({ page }) => {
    await openApp(page, '/', 'slow-order')
    await seedCart(page, [EMERALD])
    await page.goto('/carrinho')
    await page.getByRole('button', { name: 'Conectar e finalizar' }).filter({ visible: true }).click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fpagamento/)
    await submitLogin(page, USERS.ana.email, USERS.ana.password)
    await expect(page).toHaveURL(/\/pagamento$/)

    // Dados do perfil e carteiras cadastradas (principal primeiro).
    await expect(page.getByLabel('Nome de exibição')).toHaveValue(USERS.ana.name)
    await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue(USERS.ana.email)
    const radios = page.getByRole('radiogroup', { name: 'Carteira de pagamento' }).getByRole('radio')
    await expect(radios.nth(0)).toHaveAccessibleName(/Principal/)
    await expect(radios.nth(0)).toBeChecked()
    await expect(radios.nth(1)).toHaveAccessibleName(/Reserva/)
    await expect(summaryValue(page, 'quote-total')).toHaveAttribute('data-value', '1.206')

    await connect(page)
    // CP7: a criação fica RETIDA no servidor; enquanto a API não responde, nada é criado nem
    // confirmado e a tela não sai do pagamento (asserção determinística, sem janela de tempo).
    await mock(page).hold('orders.create')
    await confirmButton(page).click()
    await expect(confirmButton(page)).toHaveText('Enviando pedido…')
    await expect(page).toHaveURL(/\/pagamento$/)
    expect((await mock(page).orders()).length).toBe(0)
    await expect(page.getByText(/Compra confirmada|Pedido recebido/)).toHaveCount(0)
    await mock(page).release('orders.create')
    await expect(page).toHaveURL(/\/pedidos\/ord_\d+$/)
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'pending')
    await expect(page.getByRole('heading', { name: 'Pedido recebido' })).toBeVisible()
    await expect(page.getByText('Compra confirmada')).toHaveCount(0)
    await expect(page.getByTestId('order-total')).toHaveText('1.206 ETH')
    // PAY-07: enquanto pendente, o carrinho continua com os itens; só a confirmação os remove.
    expect(await cartQuantity(page)).toBe(1)

    const [order] = await mock(page).orders()
    await mock(page).settleOrder(order!.id, 'confirmed')
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed')
    await expect(page.getByRole('heading', { name: 'Compra confirmada' })).toBeVisible()
    await expect.poll(() => cartQuantity(page)).toBe(0)
  })

  test('pagamento recusado: nada de confirmação, carrinho preservado e estoque reservado devolvido', async ({ page }) => {
    await goCheckout(page, 'payment-rejected')
    const available = () => page.evaluate(async () => ((await (await fetch('/api/nfts/nft-001')).json()) as { editions: Array<{ id: string; available: number }> }).editions.find((e) => e.id === 'ed-10')!.available)
    expect(await available()).toBe(4)
    await connect(page)
    await confirmButton(page).click()
    await expect(page).toHaveURL(/\/pedidos\/ord_\d+$/)
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'rejected')
    await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible()
    await expect(page.getByText('Compra confirmada')).toHaveCount(0)
    expect(await cartQuantity(page)).toBe(1)
    await expect.poll(available).toBe(4)
  })

  test('validação: dados do colecionador, carteira externa e conexão obrigatória', async ({ page }) => {
    await goCheckout(page)
    await page.getByLabel('Nome de exibição').fill('')
    await page.getByLabel('E-mail', { exact: true }).fill('ana@')
    await confirmButton(page).click()
    await expect(page.getByLabel('Nome de exibição')).toBeFocused()
    await expect(page.getByLabel('Nome de exibição')).toHaveAccessibleDescription('Informe pelo menos 2 caracteres')
    await expect(page.getByLabel('E-mail', { exact: true })).toHaveAccessibleDescription('Informe um e-mail válido')

    await page.getByLabel('Nome de exibição').fill('Ana C.')
    await page.getByLabel('E-mail', { exact: true }).fill(USERS.ana.email)
    await page.getByRole('radio', { name: 'Usar outra carteira' }).check()
    await page.getByLabel('Endereço da carteira').fill('0x123')
    await confirmButton(page).click()
    await expect(page.getByLabel('Endereço da carteira')).toHaveAccessibleDescription(/0x seguido de 40/)

    await page.getByRole('radio', { name: /Principal/ }).check()
    await confirmButton(page).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Conecte a carteira antes de confirmar a compra.' })).toBeVisible()
    expect(await ordersCount(page)).toBe(0)
  })
})

test.describe('carteiras e redes', () => {
  test('carteira Polygon usa a taxa da rede escolhida; rede compatível com o endereço', async ({ page }) => {
    await goCheckout(page)
    await page.getByRole('radio', { name: /Reserva/ }).check()
    const network = page.getByLabel('Rede', { exact: true })
    await expect(network).toHaveValue('polygon')
    await expect(network.locator('option')).toHaveText(['Ethereum', 'Polygon'])
    await expect(summaryValue(page, 'quote-fee')).toHaveAttribute('data-value', '0.002')
    await expect(summaryValue(page, 'quote-total')).toHaveAttribute('data-value', '1.192')
    // Provedor acompanha o tipo da carteira cadastrada (Coinbase Wallet).
    await expect(page.getByRole('radio', { name: 'Coinbase Wallet' })).toBeChecked()

    await page.getByRole('radio', { name: 'Usar outra carteira' }).check()
    await page.getByLabel('Endereço da carteira').fill('7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2')
    await expect(network).toHaveValue('solana')
    await expect(network.locator('option')).toHaveText(['Solana'])
    await expect(summaryValue(page, 'quote-fee')).toHaveAttribute('data-value', '0.001')
  })

  test('conexão recusada, nova tentativa, desconexão e troca de carteira desconectando', async ({ page }) => {
    await goCheckout(page, 'wallet-refused')
    await page.getByRole('button', { name: 'Conectar MetaMask' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'A conexão foi recusada na MetaMask' })).toBeVisible()
    await connect(page)
    await page.getByRole('button', { name: 'Desconectar' }).click()
    await expect(page.getByRole('button', { name: 'Conectar MetaMask' })).toBeVisible()
    await connect(page)
    await page.getByRole('radio', { name: /Reserva/ }).check()
    await expect(page.getByRole('button', { name: 'Conectar Coinbase Wallet' })).toBeVisible()
  })
})

test.describe('consistência financeira em tempo real', () => {
  test('preço muda durante a revisão: alerta antes → depois, compra bloqueada até aceitar; pedido com o novo valor', async ({ page }) => {
    await goCheckout(page, 'slow-order')
    await connect(page)
    await mock(page).updateNft('nft-001', { price: '1.50' })
    const alert = page.getByTestId('quote-changed')
    await expect(alert).toContainText('1.19 ETH → 1.50 ETH')
    await expect(alert.getByTestId('quote-new-total')).toHaveText('1.516 ETH')
    // O valor aceito NÃO muda sozinho.
    await expect(summaryValue(page, 'quote-total')).toHaveAttribute('data-value', '1.206')
    await confirmButton(page).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Os valores mudaram. Revise e aceite' })).toBeVisible()
    expect(await ordersCount(page)).toBe(0)

    await alert.getByRole('button', { name: 'Aceitar novos valores' }).click()
    await expect(summaryValue(page, 'quote-total')).toHaveAttribute('data-value', '1.516')
    await confirmButton(page).click()
    await expect(page).toHaveURL(/\/pedidos\/ord_\d+$/)
    await expect(page.getByTestId('order-total')).toHaveText('1.516 ETH')
  })

  test('mudança que o cliente não viu (socket offline): a API recusa a cotação antiga e exige nova confirmação', async ({ page }) => {
    await goCheckout(page, 'slow-order')
    await connect(page)
    await mock(page).setOnline(false)
    await mock(page).updateNft('nft-001', { price: '1.40' })
    await confirmButton(page).click()
    await expect(page.getByRole('alert').filter({ hasText: 'mudaram depois da cotação' })).toBeVisible()
    await expect(page.getByTestId('quote-changed').getByTestId('quote-new-total')).toHaveText('1.416 ETH')
    expect(await ordersCount(page)).toBe(0)
    await page.getByRole('button', { name: 'Aceitar novos valores' }).click()
    await confirmButton(page).click()
    await expect(page).toHaveURL(/\/pedidos\/ord_\d+$/)
    await expect(page.getByTestId('order-total')).toHaveText('1.416 ETH')
  })

  test('estoque acaba durante a revisão: pagamento pede revisão do carrinho', async ({ page }) => {
    await goCheckout(page)
    await mock(page).updateNft('nft-001', { editions: [{ id: 'ed-10', available: 0 }] })
    const issue = page.getByTestId('checkout-cart-issue')
    await expect(issue).toContainText('sem estoque')
    await connect(page)
    await confirmButton(page).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Revise o carrinho para continuar' })).toBeVisible()
    expect(await ordersCount(page)).toBe(0)
    await issue.getByRole('link', { name: 'Voltar ao carrinho' }).click()
    await expect(page.getByTestId('cart-line').getByRole('alert')).toContainText('Esta edição esgotou')
  })

  test('cotação expirada: a API recusa, a cotação é renovada com os mesmos valores e a compra é confirmada de novo', async ({ page }) => {
    await goCheckout(page, 'slow-order')
    await connect(page)
    await mock(page).expireQuotes()
    await confirmButton(page).click()
    await expect(page.getByRole('alert').filter({ hasText: 'A cotação expirou' })).toBeVisible()
    expect(await ordersCount(page)).toBe(0)
    await expect(summaryValue(page, 'quote-total')).toHaveAttribute('data-value', '1.206')
    await expect(page.getByTestId('quote-changed')).toHaveCount(0)
    await confirmButton(page).click()
    await expect(page).toHaveURL(/\/pedidos\/ord_\d+$/)
  })
})

test.describe('idempotência e falhas (PEND-01, PEND-02)', () => {
  test('cliques repetidos criam um único pedido', async ({ page }) => {
    await goCheckout(page, 'slow-order')
    await connect(page)
    await confirmButton(page).dblclick()
    await confirmButton(page).click({ force: true }).catch(() => undefined)
    await expect(page).toHaveURL(/\/pedidos\/ord_\d+$/)
    expect(await ordersCount(page)).toBe(1)
  })

  test('API: mesma chave + mesmo conteúdo = mesmo pedido; mesma chave + conteúdo diferente = 409', async ({ page }) => {
    await openApp(page, '/', 'manual-settlement')
    await signIn(page, USERS.ana)
    const result = await page.evaluate(async () => {
      const token = (JSON.parse(sessionStorage.getItem('kurio:session')!) as { token: string }).token
      const headers = (key: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': key })
      const post = (key: string, body: unknown) => fetch('/api/orders', { method: 'POST', headers: headers(key), body: JSON.stringify(body) })
      // Prepara carrinho, cotação e conexão pela API.
      await fetch('/api/cart/items', { method: 'POST', headers: headers('x'), body: JSON.stringify({ nftId: 'nft-002', editionId: 'ed-10', quantity: 1 }) })
      const quote = (await (await fetch('/api/cart/quote', { method: 'POST', headers: headers('x'), body: JSON.stringify({ network: 'ethereum' }) })).json()) as { id: string }
      const conn = (await (await fetch('/api/wallet-connections', { method: 'POST', headers: headers('x'), body: JSON.stringify({ provider: 'metamask', network: 'ethereum', address: '0xA91F7c2D3e4F5a6B7c8D9e0F1a2B3c4D5e6FE82C' }) })).json()) as { id: string }
      const body = { quoteId: quote.id, network: 'ethereum', buyer: { displayName: 'Ana', email: 'ana@kurio.test' }, wallet: { kind: 'saved', walletId: 'wal_ana_1' }, connectionId: conn.id }
      const a = await post('chave-1', body)
      const b = await post('chave-1', body)
      const c = await post('chave-1', { ...body, buyer: { ...body.buyer, displayName: 'Outra' } })
      return { a: [a.status, ((await a.json()) as { id: string }).id], b: [b.status, ((await b.json()) as { id: string }).id], c: [c.status, ((await c.json()) as { code: string }).code] }
    })
    expect(result.a[0]).toBe(201)
    expect(result.b).toEqual([200, result.a[1]])
    expect(result.c).toEqual([409, 'IDEMPOTENCY_KEY_REUSED'])
    expect(await ordersCount(page)).toBe(1)
  })

  test('resposta perdida após a criação: retry com a mesma chave recupera o MESMO pedido', async ({ page }) => {
    await goCheckout(page, 'order-lost-response')
    await connect(page)
    await confirmButton(page).click()
    const alert = page.getByRole('alert').filter({ hasText: 'Não recebemos a resposta do servidor' })
    await expect(alert).toBeVisible()
    const [created] = await mock(page).orders()
    expect(created).toBeDefined()
    await alert.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page).toHaveURL(new RegExp(`/pedidos/${created!.id}$`))
    expect(await ordersCount(page)).toBe(1)
  })

  test('timeout após a criação: retry com a mesma chave recupera o MESMO pedido', async ({ page }) => {
    await goCheckout(page, 'order-timeout')
    await connect(page)
    await confirmButton(page).click()
    const alert = page.getByRole('alert').filter({ hasText: 'Não recebemos a resposta do servidor' })
    // O cliente desiste após ORDER_CREATE_TIMEOUT_MS (5 s); o servidor já gravou o pedido.
    await expect(alert).toBeVisible({ timeout: 8_000 })
    expect(await ordersCount(page)).toBe(1)
    const [created] = await mock(page).orders()
    // A reserva de estoque gerou uma cotação nova com os mesmos valores (id diferente). Mesmo assim,
    // confirmar de novo pelo botão principal reenvia o MESMO conteúdo: nada de segundo pedido.
    await confirmButton(page).click()
    await expect(page).toHaveURL(new RegExp(`/pedidos/${created!.id}$`))
    expect(await ordersCount(page)).toBe(1)
  })

  test('falha antes de gravar: dados preservados, carrinho intacto, nova tentativa cria o pedido', async ({ page }) => {
    await goCheckout(page, 'order-fail')
    await page.getByLabel('Observação do colecionador (opcional)').fill('Presente para a Bia')
    await connect(page)
    await confirmButton(page).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Seus dados foram mantidos' })).toBeVisible()
    expect(await ordersCount(page)).toBe(0)
    await expect(page.getByLabel('Observação do colecionador (opcional)')).toHaveValue('Presente para a Bia')
    await expect(summaryValue(page, 'quote-total')).toHaveAttribute('data-value', '1.206')
    await confirmButton(page).click()
    await expect(page).toHaveURL(/\/pedidos\/ord_\d+$/)
    expect(await ordersCount(page)).toBe(1)
  })
})

test.describe('sessão e acesso', () => {
  test('expiração ao confirmar: login com aviso, volta ao pagamento com o rascunho e nada é enviado sozinho', async ({ page }) => {
    await goCheckout(page)
    await page.getByLabel('Observação do colecionador (opcional)').fill('Entregar à noite')
    await connect(page)
    await mock(page).expireSessions()
    await confirmButton(page).click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fpagamento&motivo=expirada/)
    await expect(page.getByRole('alert')).toContainText('Sua sessão expirou')
    expect(await ordersCount(page)).toBe(0)
    await submitLogin(page, USERS.ana.email, USERS.ana.password)
    await expect(page).toHaveURL(/\/pagamento$/)
    await expect(page.getByLabel('Observação do colecionador (opcional)')).toHaveValue('Entregar à noite')
    // A conexão e a confirmação precisam ser refeitas pela pessoa.
    await expect(page.getByRole('button', { name: 'Conectar MetaMask' })).toBeVisible()
    expect(await ordersCount(page)).toBe(0)
    await connect(page)
    await confirmButton(page).click()
    await expect(page).toHaveURL(/\/pedidos\/ord_\d+$/)
  })

  test('pagamento exige login; pedido de outro usuário não aparece', async ({ page }) => {
    await openApp(page, '/pagamento')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fpagamento/)
    await submitLogin(page, USERS.ana.email, USERS.ana.password)
    await expect(page).toHaveURL(/\/pagamento$/)
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  })

  test('acessibilidade: axe sem violações; carteiras e provedores por teclado', async ({ page }) => {
    await goCheckout(page)
    const principal = page.getByRole('radio', { name: /Principal/ })
    await principal.focus()
    // Radix só seleciona se a seta ainda estiver pressionada quando o foco chega ao próximo rádio
    // (mesma técnica do design-system.spec).
    await page.keyboard.down('ArrowDown')
    await page.waitForTimeout(80)
    await page.keyboard.up('ArrowDown')
    await expect(page.getByRole('radio', { name: /Reserva/ })).toBeChecked()
    await expect(page.getByRole('radio', { name: 'Coinbase Wallet' })).toBeChecked()
    await confirmButton(page).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Conecte a carteira' })).toBeVisible()
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(results.passes.length).toBeGreaterThan(10)
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([])
  })
})
