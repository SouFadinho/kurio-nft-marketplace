/**
 * CP1 — Prova de conceito da integração.
 * Roda contra o build de produção (vite build + preview) com MSW ativo.
 * Cada `test` é independente: contexto de navegador novo + `?reset=1` restaura o seed.
 */
import { expect, test } from './fixtures'
import { createOrder, login, mock, openApp, POC, USERS } from './support'

test.describe('PoC CP1 — REST (Axios → MSW) + TanStack Query', () => {
  test('1. GET /api/nfts é respondido pelo service worker do MSW e renderizado via Query', async ({ page }) => {
    const response = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/nfts')
    await openApp(page, POC)
    const res = await response
    expect(res.status()).toBe(200)
    expect(res.fromServiceWorker()).toBe(true)
    const body = (await res.json()) as { items: Array<{ price: unknown }> }
    expect(typeof body.items[0]?.price).toBe('string') // ETH trafega como string decimal
    await expect(page.getByTestId('nft-list').getByRole('listitem')).toHaveCount(9)
  })

  test('2. login (mutation) + criação de pedido (mutation idempotente) + consulta do pedido', async ({ page }) => {
    await openApp(page, POC, 'manual-settlement')
    await login(page, USERS.ana)
    const orderId = await createOrder(page)
    await page.getByTestId('order-link').click()
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'pending')
    await expect(page.getByTestId('order-total')).toHaveText('1.19 ETH')
    expect(await mock(page).orders()).toEqual([expect.objectContaining({ id: orderId, userId: USERS.ana.id, status: 'pending' })])
  })

  test('2b. clique repetido não duplica o pedido (mesma Idempotency-Key)', async ({ page }) => {
    await openApp(page, POC, 'manual-settlement')
    await login(page, USERS.ana)
    await page.getByTestId('buy').dblclick()
    await expect(page.getByTestId('order-link')).toBeVisible()
    expect(await mock(page).orders()).toHaveLength(1)
  })
})

test.describe('PoC CP1 — Socket.IO (socket.io-client → MSW ws.link + @mswjs/socket.io-binding)', () => {
  test('3/4. nft.updated atualiza lista e detalhe; o REST reflete a mesma mudança após refresh', async ({ page }) => {
    await openApp(page, POC)
    await mock(page).updateNft('nft-001', { price: '2.5' })
    await expect(page.getByTestId('nft-price-nft-001')).toHaveText('2.50 ETH')
    await expect(page.getByTestId('nft-version-nft-001')).toHaveText('2')
    await expect(page.getByTestId('rt-last')).toHaveText('nft.updated:apply')

    await page.getByRole('link', { name: 'Emerald Ape #042' }).click()
    await expect(page.getByTestId('detail-price')).toHaveText('2.50 ETH')
    await mock(page).updateNft('nft-001', { price: '3.1', available: 7 })
    await expect(page.getByTestId('detail-price')).toHaveText('3.10 ETH')
    await expect(page.getByTestId('detail-available')).toHaveText('7')
    await expect(page.getByTestId('rt-applied')).toHaveText('2')

    await page.reload()
    await expect(page.getByTestId('detail-price')).toHaveText('3.10 ETH')
  })

  test('5. order.updated (privado) leva o pedido de pendente a confirmado, sem polling', async ({ page }) => {
    await openApp(page, POC, 'manual-settlement')
    await login(page, USERS.ana)
    const orderId = await createOrder(page)
    await page.getByTestId('order-link').click()
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'pending')

    await mock(page).settleOrder(orderId, 'confirmed')
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed')
    await expect(page.getByTestId('order-tx')).toHaveText(/^0x[0-9a-f]{40}$/)
    await expect(page.getByTestId('rt-last')).toHaveText('order.updated:apply')
  })

  test('5b. pedido recusado é terminal e não mostra confirmação', async ({ page }) => {
    await openApp(page, POC, 'manual-settlement')
    await login(page, USERS.ana)
    const orderId = await createOrder(page)
    await page.getByTestId('order-link').click()
    await mock(page).settleOrder(orderId, 'rejected')
    await expect(page.getByTestId('order-status')).toHaveText('Pagamento recusado')
    expect(await mock(page).settleOrder(orderId, 'confirmed')).toBeNull() // terminal no servidor
    await expect(page.getByText('Pedido confirmado')).toHaveCount(0)
  })

  test('6. handshake autenticado e isolamento: eventos e dados de Ana não chegam a Bruno', async ({ page }) => {
    await openApp(page, POC, 'manual-settlement')
    await login(page, USERS.ana)
    await expect.poll(async () => (await mock(page).connections()).map((c) => `${c.state}:${c.userId}`)).toEqual([`authenticated:${USERS.ana.id}`])
    const anaOrder = await createOrder(page)

    await page.getByTestId('logout').click()
    await login(page, USERS.bruno)
    // O socket de Ana foi destruído; só existe a conexão autenticada de Bruno.
    await expect.poll(async () => (await mock(page).connections()).map((c) => `${c.state}:${c.userId}`)).toEqual([`authenticated:${USERS.bruno.id}`])

    // Servidor roteia corretamente: Bruno não recebe nada.
    await mock(page).settleOrder(anaOrder, 'confirmed')
    // Servidor roteia errado (simulado): o cliente descarta o evento de outro usuário.
    await mock(page).misrouteOrder(anaOrder)
    await expect(page.getByTestId('rt-foreign')).toHaveText('1')
    await expect(page.getByTestId('rt-applied')).toHaveText('0')

    // REST também isola: Bruno não enxerga o pedido de Ana.
    await page.goto(`${POC}/pedidos/${anaOrder}`)
    await expect(page.getByRole('alert')).toHaveText('Pedido não encontrado.')
  })

  test('6b. token inválido no handshake é recusado (CONNECT_ERROR) e a sessão cai para anônima', async ({ page }) => {
    await openApp(page, POC)
    expect(await mock(page).connections()).toEqual([expect.objectContaining({ state: 'anonymous', userId: null })])

    // Sessão forjada no cliente: token que o servidor simulado não emitiu.
    await page.evaluate(() =>
      sessionStorage.setItem('kurio:session', JSON.stringify({ token: 'forjado', userId: 'usr_ana', expiresAt: '2999-01-01T00:00:00Z' })),
    )
    await page.reload()

    await expect.poll(() => mock(page).stats().then((s) => s.rejected)).toBe(1)
    // O REST também recusa (401) → sessão local limpa → novo socket anônimo.
    await expect(page.getByTestId('poc-login')).toBeVisible()
    await expect(page.getByTestId('rt-state')).toHaveText('conectado')
    const conns = await mock(page).connections()
    expect(conns.every((c) => c.state === 'anonymous' && c.userId === null)).toBe(true)
    expect((await mock(page).stats()).accepted).toBe(0)
  })

  test('6c. protocolo: nenhum ACK nem evento antes de validar o CONNECT (sem corrida no handshake)', async ({ page }) => {
    await openApp(page, POC)
    // Cliente WebSocket bruto falando o protocolo Engine.IO/Socket.IO "na mão",
    // para observar exatamente o que o servidor simulado envia e quando.
    const frames = await page.evaluate(async () => {
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
      const open = (connect: string | null) => {
        const ws = new WebSocket(`${location.origin.replace(/^http/, 'ws')}/socket.io/?EIO=4&transport=websocket`)
        const log: string[] = []
        ws.onmessage = (e) => {
          const data = String(e.data)
          log.push(data.startsWith('42') ? '42' : data.slice(0, 2))
          if (data.startsWith('0') && connect !== null) ws.send(connect)
        }
        return { ws, log }
      }

      // a) Conexão que ainda não mandou CONNECT: não recebe ACK nem eventos públicos.
      const pending = open(null)
      await wait(150)
      window.__kurioMock.updateNft('nft-002', { price: '1.70' })
      await wait(150)

      // b) Token inválido: OPEN e depois CONNECT_ERROR ("44"), nunca "40" nem "42".
      const forged = open('40{"token":"forjado"}')
      await wait(150)
      window.__kurioMock.updateNft('nft-002', { price: '1.71' })
      await wait(150)

      // c) Anônimo: OPEN → (envia CONNECT) → ACK "40" → evento público "42".
      const anon = open('40{}')
      await wait(150)
      window.__kurioMock.updateNft('nft-002', { price: '1.72' })
      await wait(150)

      for (const c of [pending, forged, anon]) c.ws.close()
      return { pending: pending.log, forged: forged.log, anon: anon.log }
    })

    expect(frames.pending).toEqual(['0{'])
    expect(frames.forged).toEqual(['0{', '44'])
    expect(frames.anon).toEqual(['0{', '40', '42'])
  })

  test('7/8. desconexão com pedido pendente → reconexão → reconciliação pelo REST', async ({ page }) => {
    await openApp(page, POC, 'manual-settlement')
    await login(page, USERS.ana)
    const orderId = await createOrder(page)
    await page.getByTestId('order-link').click()
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'pending')

    await mock(page).setOnline(false)
    await expect(page.getByTestId('rt-state')).toHaveText('desconectado')
    expect(await mock(page).connections()).toHaveLength(0)

    // Confirmação acontece enquanto o cliente está offline: o evento se perde.
    await mock(page).settleOrder(orderId, 'confirmed')
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'pending')

    // Adaptado no CP3: a primeira conexão também reconcilia (correção de corrida), então o
    // total varia; o que importa é a reconexão gerar UMA reconciliação a mais.
    const before = Number(await page.getByTestId('rt-reconciliations').textContent())
    await mock(page).setOnline(true)
    await expect(page.getByTestId('rt-state')).toHaveText('conectado')
    await expect(page.getByTestId('rt-reconnections')).toHaveText('1')
    await expect(page.getByTestId('rt-reconciliations')).toHaveText(String(before + 1))
    // Estado recuperado pelo REST, não por evento.
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed')
    await expect(page.getByTestId('rt-applied')).toHaveText('0')
  })

  test('7b. refresh com pedido pendente recupera o estado; liquidação automática persiste', async ({ page }) => {
    await openApp(page, POC) // cenário default: liquida automaticamente em 1,5 s
    await login(page, USERS.ana)
    const orderId = await createOrder(page)
    await page.goto(`${POC}/pedidos/${orderId}`)
    await page.reload()
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed', { timeout: 10_000 })
    expect(await mock(page).orders()).toHaveLength(1)
  })

  test('9. eventos duplicados e antigos são descartados sem regredir o estado', async ({ page }) => {
    await openApp(page, POC)
    await mock(page).updateNft('nft-001', { price: '2.5' })
    await expect(page.getByTestId('nft-price-nft-001')).toHaveText('2.50 ETH')

    await mock(page).replayLast() // mesmo eventId
    await expect(page.getByTestId('rt-duplicates')).toHaveText('1')

    await mock(page).emitStaleNftUpdate('nft-001', '9.99') // versão antiga
    await expect(page.getByTestId('rt-stale')).toHaveText('1')

    await expect(page.getByTestId('rt-applied')).toHaveText('1')
    await expect(page.getByTestId('nft-price-nft-001')).toHaveText('2.50 ETH')
  })

  test('heartbeat: a conexão sobrevive além do ping timeout do binding (30 s)', async ({ page }) => {
    test.slow()
    await page.clock.install()
    await openApp(page, POC)
    await page.clock.runFor(65_000)
    await expect(page.getByTestId('rt-state')).toHaveText('conectado')
    await expect(page.getByTestId('rt-reconnections')).toHaveText('0')
  })
})

test.describe('PoC CP1 — cenários', () => {
  test('reset integral: ?reset=1 restaura catálogo, pedidos e sessões do seed', async ({ page }) => {
    await openApp(page, POC, 'manual-settlement')
    await login(page, USERS.ana)
    await createOrder(page)
    await mock(page).updateNft('nft-001', { price: '5' })
    await expect(page.getByTestId('nft-price-nft-001')).toHaveText('5.00 ETH')

    await openApp(page, POC, 'default')
    await expect(page.getByTestId('nft-price-nft-001')).toHaveText('1.19 ETH')
    await expect(page.getByTestId('nft-version-nft-001')).toHaveText('1')
    expect(await mock(page).orders()).toEqual([])
    expect(await page.evaluate(() => window.__kurioMock.scenario())).toBe('default')
    // A sessão de Ana não existe mais no servidor: o token antigo recebe 401 e o cliente volta a visitante.
    await expect(page.getByTestId('poc-login')).toBeVisible()
  })
})

test.describe('PoC CP1 — rotas no build de produção', () => {
  test('11. acesso direto, refresh, NFT inexistente, rota inexistente e rota protegida', async ({ page }) => {
    await openApp(page, `${POC}/nft/nft-003`)
    await expect(page.getByTestId('nft-name')).toHaveText('Neon Vessel #552')
    await page.reload()
    await expect(page.getByTestId('nft-name')).toHaveText('Neon Vessel #552')

    await page.goto(`${POC}/nft/nao-existe`)
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()

    await page.goto('/rota/que/nao/existe')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()

    await page.goto(`${POC}/pedidos/ord_000001`)
    await expect(page).toHaveURL(/\/login\?redirect=/)
    await page.getByLabel('E-mail', { exact: true }).fill(USERS.ana.email)
    await page.getByLabel('Senha', { exact: true }).fill(USERS.ana.password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(/\/pedidos\/ord_000001$/)
  })

  test('login com credenciais erradas mostra o erro da API', async ({ page }) => {
    await openApp(page, '/login')
    await page.getByLabel('E-mail', { exact: true }).fill(USERS.ana.email)
    await page.getByLabel('Senha', { exact: true }).fill('senha-errada')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('alert')).toHaveText('E-mail ou senha inválidos.')
  })
})
