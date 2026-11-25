import { expect, type Page } from '@playwright/test'

/**
 * Helpers de teste.
 *
 * `mock(page)` aciona o LADO SERVIDOR da simulação (window.__kurioMock, carregado pela
 * camada MSW). Ele altera o db do mock e emite eventos pelo servidor Socket.IO simulado.
 * Os testes nunca escrevem no cache nem chamam setters da aplicação: o efeito
 * observado na UI precisa atravessar o socket.io-client ou o Axios (TEST-05).
 */
export const USERS = {
  ana: { email: 'ana@kurio.test', password: 'Kurio#Ana2026', id: 'usr_ana', name: 'Ana Colecionadora', username: 'ana.coleciona' },
  bruno: { email: 'bruno@kurio.test', password: 'Kurio#Bruno2026', id: 'usr_bruno', name: 'Bruno Curador', username: 'bruno.curador' },
} as const

type OrderStatus = 'confirmed' | 'rejected'
export type NftPatch = { price?: string; available?: number; editions?: Array<{ id: string; available: number }> }

interface MockControl {
  scenario(): string
  release(route: string): void
  recover(route: string): void
  expireSessions(): number
  expireQuotes(): number
  updateNft(id: string, patch: NftPatch): unknown
  emitStaleNftUpdate(id: string, price: string): unknown
  settleOrder(id: string, status: OrderStatus): unknown
  orders(): Array<{ id: string; userId: string; status: string; version: number }>
  realtime: {
    connections(): Array<{ id: string; state: string; userId: string | null }>
    stats(): { accepted: number; anonymous: number; rejected: number }
    setOnline(value: boolean): void
    replayLast(): unknown
    misrouteOrder(orderId: string): unknown
  }
}

declare global {
  interface Window {
    __kurioMock: MockControl
  }
}

export function mock(page: Page) {
  // Após navegação/reload, o controle só existe depois que o MSW reinicia.
  const ready = () => page.waitForFunction(() => window.__kurioMock !== undefined)
  return {
    updateNft: async (id: string, patch: NftPatch) =>
      (await ready(), page.evaluate(([i, p]) => window.__kurioMock.updateNft(i, p), [id, patch] as const)),
    emitStaleNftUpdate: async (id: string, price: string) =>
      (await ready(), page.evaluate(([i, p]) => window.__kurioMock.emitStaleNftUpdate(i, p), [id, price] as const)),
    settleOrder: async (id: string, status: OrderStatus) =>
      (await ready(), page.evaluate(([i, s]) => window.__kurioMock.settleOrder(i, s), [id, status] as const)),
    expireSessions: async () => (await ready(), page.evaluate(() => window.__kurioMock.expireSessions())),
    expireQuotes: async () => (await ready(), page.evaluate(() => window.__kurioMock.expireQuotes())),
    release: async (route: string) => (await ready(), page.evaluate((r) => window.__kurioMock.release(r), route)),
    recover: async (route: string) => (await ready(), page.evaluate((r) => window.__kurioMock.recover(r), route)),
    orders: async () => (await ready(), page.evaluate(() => window.__kurioMock.orders())),
    connections: async () => (await ready(), page.evaluate(() => window.__kurioMock.realtime.connections())),
    stats: async () => (await ready(), page.evaluate(() => window.__kurioMock.realtime.stats())),
    setOnline: async (value: boolean) => (await ready(), page.evaluate((v) => window.__kurioMock.realtime.setOnline(v), value)),
    replayLast: async () => (await ready(), page.evaluate(() => window.__kurioMock.realtime.replayLast())),
    misrouteOrder: async (id: string) => (await ready(), page.evaluate((i) => window.__kurioMock.realtime.misrouteOrder(i), id)),
  }
}

/** Rota da prova de conceito do CP1 (fora da navegação pública desde o CP2). */
export const POC = '/demo/poc'

/**
 * Abre a aplicação com um cenário conhecido e o db restaurado do seed.
 * Nas páginas da PoC, espera o socket conectar (painel de diagnóstico); nas demais, espera
 * a camada de mocks estar ativa.
 */
export async function openApp(page: Page, path = '/', scenario = 'default') {
  const sep = path.includes('?') ? '&' : '?'
  await page.goto(`${path}${sep}scenario=${scenario}&reset=1`)
  await page.waitForFunction(() => window.__kurioMock !== undefined)
  // O App é importado DEPOIS do MSW (main.tsx): espera a aplicação estar renderizada.
  await page.locator('main#conteudo').waitFor()
  if (path.startsWith(POC)) await expect(page.getByTestId('rt-state')).toHaveText('conectado')
}

export async function login(page: Page, user: (typeof USERS)[keyof typeof USERS]) {
  await page.getByTestId('poc-login').click()
  await page.getByLabel('E-mail', { exact: true }).fill(user.email)
  await page.getByLabel('Senha', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByTestId('session-user')).toContainText(user.name)
  await expect(page.getByTestId('rt-state')).toHaveText('conectado')
}

export async function createOrder(page: Page): Promise<string> {
  await page.getByTestId('buy').click()
  const link = page.getByTestId('order-link')
  await expect(link).toBeVisible()
  const id = /ord_\d+/.exec((await link.textContent()) ?? '')?.[0]
  if (!id) throw new Error('id do pedido não encontrado')
  return id
}

/** Desktop = header + modais (≥ 1024px); abaixo disso, telas cheias e bottom nav. */
export const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024

/** Preenche e envia o formulário de login aberto (modal no desktop, tela no mobile). */
export async function submitLogin(page: Page, email: string, password: string) {
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

/** Entra pela rota de login e espera voltar ao destino. */
export async function signIn(page: Page, user: { email: string; password: string }, redirect = '/') {
  await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`)
  await submitLogin(page, user.email, user.password)
  await expect(page).not.toHaveURL(/\/login/)
}

/** Vai para a conta pela navegação da aplicação (sem recarregar a página). */
export async function openAccount(page: Page) {
  if (isDesktop(page)) await page.getByRole('banner').getByRole('link', { name: 'Minha conta' }).click()
  else await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Perfil' }).click()
  await expect(page).toHaveURL(/\/perfil/)
}

/** "Sair" no menu da conta. */
export async function signOut(page: Page) {
  await page.getByRole('navigation', { name: 'Conta' }).getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/$|\/\?/)
}

/**
 * Preparação de carrinho PELA API simulada (não é o que está sob teste nos testes de checkout).
 * Usa a sessão atual da aba (token em sessionStorage) ou o id de visitante (criado se preciso).
 */
export async function seedCart(page: Page, items: Array<{ nftId: string; editionId?: string; quantity: number }>) {
  const statuses = await page.evaluate(async (list) => {
    const token = (JSON.parse(sessionStorage.getItem('kurio:session') ?? 'null') as { token?: string } | null)?.token
    let guest = localStorage.getItem('kurio:guest-cart')
    if (!token && !guest) {
      guest = crypto.randomUUID()
      localStorage.setItem('kurio:guest-cart', guest)
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : { 'X-Cart-Id': guest! }) }
    const out: number[] = []
    for (const item of list) out.push((await fetch('/api/cart/items', { method: 'POST', headers, body: JSON.stringify(item) })).status)
    return out
  }, items)
  expect(statuses.every((st) => st === 200)).toBe(true)
}

/** Total exibido no resumo (valor exato da cotação, em ETH decimal). */
export const summaryValue = (page: Page, id: 'quote-subtotal' | 'quote-discount' | 'quote-fee' | 'quote-total') =>
  page.getByRole('complementary', { name: 'Resumo' }).getByTestId(id)

/** Quantidade total no carrinho atual, lida da API (independe de header/bottom nav no viewport). */
export async function cartQuantity(page: Page) {
  return page.evaluate(async () => {
    const token = (JSON.parse(sessionStorage.getItem('kurio:session') ?? 'null') as { token?: string } | null)?.token
    const guest = localStorage.getItem('kurio:guest-cart')
    if (!token && !guest) return 0
    const res = await fetch('/api/cart', { headers: token ? { Authorization: 'Bearer ' + token } : { 'X-Cart-Id': guest! } })
    const cart = (await res.json()) as { lines: Array<{ quantity: number }> }
    return cart.lines.reduce((sum, l) => sum + l.quantity, 0)
  })
}
