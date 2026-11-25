/**
 * CP9.1: smoke test da aplicação PUBLICADA (playwright.smoke.config.ts, SMOKE_URL=https://...).
 *
 * Valida o que só a URL pública mostra: HTTPS, headers e rewrites da Vercel, Service Worker do MSW,
 * Socket.IO simulado sobre página HTTPS (wss://), deep links, e os fluxos principais de ponta a
 * ponta. Falha com qualquer exceção não tratada (fixture) ou erro no console.
 */
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { EMERALD_LINE, USERS, mock, openApp, placeOrder, seedCart, signIn, signOut, submitLogin, summaryValue } from './support'

const status = (page: Page) => page.getByTestId('order-status')

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  // O navegador registra no console toda resposta HTTP 4xx/5xx ('Failed to load resource'), inclusive as
  // ESPERADAS da API simulada (401 de credencial errada ou de sessão encerrada). Só essas são ignoradas.
  page.on('console', (m) => m.type() === 'error' && !/^Failed to load resource: the server responded with a status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  ;(page as unknown as { __consoleErrors: string[] }).__consoleErrors = errors
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { __consoleErrors: string[] }).__consoleErrors, 'erros no console').toEqual([])
})

test.describe('infraestrutura da publicação', () => {
  test('HTTPS, headers do Service Worker, cache dos assets, rewrites e /api sem fallback', async ({ request, baseURL }) => {
    expect(baseURL).toMatch(/^https:\/\//)
    const html = await request.get('/')
    expect(html.status()).toBe(200)
    const asset = /\/assets\/index-[\w-]+\.js/.exec(await html.text())?.[0]
    expect(asset, 'chunk de entrada no HTML').toBeTruthy()

    const sw = await request.get('/mockServiceWorker.js')
    expect(sw.status()).toBe(200)
    expect(sw.headers()['content-type']).toMatch(/javascript/)
    expect(sw.headers()['cache-control']).toMatch(/no-cache/)

    const js = await request.get(asset!)
    expect(js.headers()['cache-control']).toMatch(/immutable/)
    const nftImage = await request.get('/assets/nfts/catalog/emerald-ape-original.webp')
    expect(nftImage.status()).toBe(200)
    expect(nftImage.headers()['cache-control'] ?? '').not.toMatch(/immutable/)

    for (const deep of ['/mercado', '/nft/nft-001', '/pedidos/ord_000001', '/perfil/carteiras', '/rota-inexistente']) {
      const res = await request.get(deep)
      expect(res.status(), deep).toBe(200)
      expect(await res.text(), deep).toContain('<div id="root">')
    }
    // Fora do Service Worker não há backend: /api não cai no index.html.
    expect((await request.get('/api/nfts')).status()).toBe(404)
  })

  test('Service Worker do MSW controla a página; /demo/* fica em 404 no build público', async ({ page }) => {
    await openApp(page, '/')
    expect(await page.evaluate(() => location.protocol)).toBe('https:')
    expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null)).toMatch(/\/mockServiceWorker\.js$/)
    await page.goto('/demo/poc')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/não encontrada/i)
  })
})

test.describe('fluxos na URL pública', () => {
  test('catálogo, filtro na URL, refresh e preço em tempo real pelo Socket.IO (wss)', async ({ page }) => {
    await openApp(page, '/mercado?network=ethereum')
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    await page.reload()
    await expect(page).toHaveURL(/network=ethereum/)
    await expect.poll(async () => (await mock(page).connections()).length).toBeGreaterThan(0)
    const card = page.locator('[data-testid="nft-card"][data-nft-id="nft-001"] [data-value]')
    await expect(card).toBeVisible()
    await mock(page).updateNft('nft-001', { price: '1.25' })
    await expect(card).toHaveText('1.25 ETH')
  })

  test('cadastro inexistente não entra; login, logout e isolamento entre Ana e Bruno', async ({ page }) => {
    await openApp(page, '/login')
    await submitLogin(page, 'ninguem@kurio.test', 'Errada#2026')
    await expect(page.getByRole('alert')).toHaveText('E-mail ou senha inválidos.')
    await signIn(page, USERS.ana, '/favoritos')
    await page.goto('/')
    await page.getByRole('button', { name: 'Favoritar Sage Nomad #009' }).click()
    await expect(page.getByRole('button', { name: 'Remover Sage Nomad #009 dos favoritos' })).toHaveAttribute('aria-pressed', 'true')
    // O favorito é otimista: o aviso só aparece com a confirmação da API (sem ele, a navegação abortaria a gravação).
    await expect(page.getByText('Sage Nomad #009 adicionado aos favoritos')).toBeVisible()
    await page.goto('/favoritos')
    await expect(page.locator('[data-testid="nft-card"][data-nft-id="nft-002"]')).toBeVisible()
    await page.goto('/perfil')
    await signOut(page)
    await signIn(page, USERS.bruno, '/favoritos')
    await expect(page.getByRole('heading', { level: 1, name: 'Favoritos' })).toBeAttached()
    await expect(page.locator('[data-testid="nft-card"][data-nft-id="nft-002"]')).toHaveCount(0)
  })

  test('perfil e carteiras carregam os dados da conta', async ({ page }) => {
    await openApp(page, '/')
    await signIn(page, USERS.ana, '/perfil')
    await expect(page.getByLabel('Nome de exibição')).toHaveValue(USERS.ana.name)
    await page.goto('/perfil/carteiras')
    await expect(page.getByRole('form', { name: 'Dados da carteira principal' }).getByLabel('Apelido da carteira')).toHaveValue('Principal')
  })

  test('compra completa: carrinho, cupom, pagamento e recibo confirmado', async ({ page }) => {
    await openApp(page, '/')
    await signIn(page, USERS.ana)
    await seedCart(page, [EMERALD_LINE])
    await page.goto('/carrinho')
    await page.getByLabel('Código promocional').fill('kurio10')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(summaryValue(page, 'quote-total')).toHaveAttribute('data-value', '1.087')
    await page.getByRole('button', { name: 'Conectar e finalizar' }).filter({ visible: true }).first().click()
    await expect(page).toHaveURL(/\/pagamento/)
    await page.getByRole('button', { name: 'Conectar MetaMask' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Conectada via MetaMask' })).toBeVisible()
    await page.getByRole('button', { name: 'Confirmar compra' }).filter({ visible: true }).click()
    await expect(page).toHaveURL(/\/pedidos\/ord_\d+$/)
    // Cenário padrão: a rede simulada confirma em ~1,5 s, via order.updated.
    await expect(status(page)).toHaveAttribute('data-status', 'confirmed', { timeout: 15_000 })
    await expect(page.getByTestId('order-total')).toHaveText('1.087 ETH')
  })

  test('pagamento recusado e pedido pendente com queda de conexão: recupera após reconectar e após refresh', async ({ page }) => {
    const rejected = await placeOrder(page, { scenario: 'payment-rejected' })
    await expect(status(page)).toHaveAttribute('data-status', 'rejected', { timeout: 15_000 })
    expect(rejected).toMatch(/^ord_/)

    const pending = await placeOrder(page, { scenario: 'manual-settlement' })
    await expect(status(page)).toHaveAttribute('data-status', 'pending')
    await mock(page).setOnline(false)
    await mock(page).settleOrder(pending, 'confirmed')
    await mock(page).setOnline(true)
    await expect(status(page)).toHaveAttribute('data-status', 'confirmed', { timeout: 15_000 })
    await page.reload()
    await expect(status(page)).toHaveAttribute('data-status', 'confirmed')
  })
})
