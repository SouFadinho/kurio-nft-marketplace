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
  ana: { email: 'ana@kurio.test', password: 'Kurio#Ana2026', id: 'usr_ana', name: 'Ana Colecionadora' },
  bruno: { email: 'bruno@kurio.test', password: 'Kurio#Bruno2026', id: 'usr_bruno', name: 'Bruno Curador' },
} as const

type OrderStatus = 'confirmed' | 'rejected'

interface MockControl {
  scenario(): string
  updateNft(id: string, patch: { price?: string; available?: number }): unknown
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
    updateNft: async (id: string, patch: { price?: string; available?: number }) =>
      (await ready(), page.evaluate(([i, p]) => window.__kurioMock.updateNft(i, p), [id, patch] as const)),
    emitStaleNftUpdate: async (id: string, price: string) =>
      (await ready(), page.evaluate(([i, p]) => window.__kurioMock.emitStaleNftUpdate(i, p), [id, price] as const)),
    settleOrder: async (id: string, status: OrderStatus) =>
      (await ready(), page.evaluate(([i, s]) => window.__kurioMock.settleOrder(i, s), [id, status] as const)),
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
