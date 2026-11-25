/**
 * CP4: isolamento de dados privados entre sessões (ACC-05 / ELIM-04).
 *
 * "Dados de Ana não podem aparecer na sessão de Bruno, nem durante carregamento, respostas
 * atrasadas ou reconexão." O cenário `slow-private` RETÉM as respostas de favoritos e
 * carteiras até o teste liberá-las: a resposta de Ana chega depois que Bruno já entrou.
 * Um MutationObserver instalado ANTES da liberação registra se algum dado de Ana aparece,
 * mesmo que por um único frame.
 */
import { expect, test } from './fixtures'
import { USERS, isDesktop, mock, openAccount, openApp, signIn, signOut, submitLogin } from './support'
import type { Page } from '@playwright/test'

/** Registra no window se algum texto/atributo proibido aparecer no DOM. */
async function watchForbidden(page: Page, needles: string[]) {
  await page.evaluate((list) => {
    const w = window as unknown as { __leaks: string[] }
    w.__leaks = []
    const scan = () => {
      const html = document.body.innerHTML
      for (const n of list) if (html.includes(n) && !w.__leaks.includes(n)) w.__leaks.push(n)
    }
    scan()
    new MutationObserver(scan).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
  }, needles)
}
/** Favorita direto na API simulada, com uma sessão própria (não toca a sessão do cliente). */
async function seedFavorite(page: Page, user: { email: string; password: string }, nftId: string) {
  const status = await page.evaluate(
    async ([email, password, id]) => {
      const login = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const { token } = (await login.json()) as { token: string }
      const put = await fetch(`/api/favorites/${id}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } })
      await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      return put.status
    },
    [user.email, user.password, nftId] as const,
  )
  expect(status).toBeLessThan(300)
}

const leaks = (page: Page) => page.evaluate(() => (window as unknown as { __leaks: string[] }).__leaks)

test.describe('isolamento entre usuários', () => {
  test('favoritos: resposta atrasada de Ana não aparece para Bruno', async ({ page }) => {
    // Preparação (não é o que está sob teste): pela API simulada, Ana favorita Sage Nomad e
    // Bruno favorita Emerald Ape. Favoritar pela UI já é coberto em catalog.spec.
    await openApp(page, '/')
    await seedFavorite(page, USERS.ana, 'nft-002')
    await seedFavorite(page, USERS.bruno, 'nft-001')

    // Ativa a retenção sem resetar o db e entra como Ana: a leitura de favoritos fica presa.
    await page.goto('/?scenario=slow-private')
    await page.locator('main#conteudo').waitFor()
    const aborted: string[] = []
    page.on('requestfailed', (r) => r.url().includes('/api/favorites') && aborted.push(r.failure()?.errorText ?? ''))
    await signIn(page, USERS.ana)
    await expect(page.getByRole('button', { name: 'Favoritar Sage Nomad #009' })).toBeVisible()

    // Ana sai com a requisição pendente; Bruno entra (pela UI, sem recarregar).
    await openAccount(page)
    await signOut(page)
    if (isDesktop(page)) await page.getByRole('banner').getByRole('link', { name: 'Entrar' }).click()
    else await page.goto('/login')
    await submitLogin(page, USERS.bruno.email, USERS.bruno.password)
    await expect(page).not.toHaveURL(/\/login/)

    await watchForbidden(page, ['Remover Sage Nomad #009 dos favoritos'])
    await mock(page).release('favorites.read')
    await expect(page.getByRole('button', { name: 'Remover Emerald Ape #042 dos favoritos' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Favoritar Sage Nomad #009' })).toBeVisible()
    expect(await leaks(page)).toEqual([])
    // A requisição de Ana foi cancelada no logout (AbortController do TanStack Query/Axios).
    expect(aborted.length).toBeGreaterThan(0)
  })

  test('carteiras: Ana sai durante o carregamento e Bruno nunca vê as carteiras dela', async ({ page }) => {
    await openApp(page, '/', 'slow-private')
    await signIn(page, USERS.ana, '/perfil/carteiras')
    await expect(page.getByLabel('Carregando carteiras')).toBeVisible()
    await signOut(page)

    await page.goto('/login?redirect=%2Fperfil%2Fcarteiras')
    await submitLogin(page, USERS.bruno.email, USERS.bruno.password)
    await expect(page).toHaveURL(/\/perfil\/carteiras$/)
    await watchForbidden(page, ['Reserva', 'nova.kurio', '0xA91F7c2D3e4F5a6B7c8D9e0F1a2B3c4D5e6FE82C'])
    await mock(page).release('me.wallets.read')
    await expect(page.getByRole('region', { name: 'Carteira principal' })).toContainText('Cofre')
    expect(await leaks(page)).toEqual([])
  })

  test('a API não deixa Bruno ler nem alterar carteira de Ana (404)', async ({ page }) => {
    await openApp(page, '/')
    await signIn(page, USERS.bruno, '/perfil/carteiras')
    const result = await page.evaluate(async () => {
      const token = JSON.parse(sessionStorage.getItem('kurio:session') ?? '{}').token as string
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      const body = JSON.stringify({ nickname: 'Hack', network: 'ethereum', type: 'metamask', address: '0x1234567890abcdef1234567890abcdef12345678' })
      const put = await fetch('/api/me/wallets/wal_ana_1', { method: 'PUT', headers, body })
      const primary = await fetch('/api/me/wallets/wal_ana_2/primary', { method: 'POST', headers })
      const list = (await (await fetch('/api/me/wallets', { headers })).json()) as { items: Array<{ id: string }> }
      return { put: put.status, primary: primary.status, ids: list.items.map((w) => w.id) }
    })
    expect(result).toEqual({ put: 404, primary: 404, ids: ['wal_bruno_1'] })
  })

  test('logout encerra o socket autenticado de Ana; Bruno recebe um novo', async ({ page }) => {
    await openApp(page, '/')
    await signIn(page, USERS.ana, '/perfil')
    await expect.poll(async () => (await mock(page).connections()).filter((c) => c.userId === USERS.ana.id && c.state === 'authenticated').length).toBe(1)
    await signOut(page)
    await expect.poll(async () => (await mock(page).connections()).filter((c) => c.userId === USERS.ana.id).length).toBe(0)
    await signIn(page, USERS.bruno, '/perfil')
    await expect.poll(async () => (await mock(page).connections()).filter((c) => c.userId === USERS.bruno.id && c.state === 'authenticated').length).toBe(1)
    expect((await mock(page).connections()).some((c) => c.userId === USERS.ana.id)).toBe(false)
  })

  test('expiração durante ação de favoritar: intenção é retomada após novo login', async ({ page }) => {
    await openApp(page, '/')
    await signIn(page, USERS.ana)
    await expect(page.getByRole('button', { name: 'Favoritar Sage Nomad #009' })).toBeVisible()
    // Expira e clica no MESMO tick: sem isso, qualquer outra requisição privada em segundo plano
    // pode receber o 401 antes e abrir o login antes do clique (corrida do teste, não do app).
    await page.waitForFunction(() => window.__kurioMock !== undefined)
    await page.evaluate(() => {
      window.__kurioMock.expireSessions()
      document.querySelector<HTMLButtonElement>('[aria-label="Favoritar Sage Nomad #009"]')!.click()
    })
    await expect(page).toHaveURL(/\/login\?.*motivo=expirada/)
    // Otimista desfeito: nada ficou marcado como favorito sem a API confirmar.
    await submitLogin(page, USERS.ana.email, USERS.ana.password)
    await expect(page.getByRole('button', { name: 'Remover Sage Nomad #009 dos favoritos' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Sage Nomad #009 adicionado aos favoritos')).toBeVisible()
  })
})
