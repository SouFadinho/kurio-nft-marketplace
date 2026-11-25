/**
 * CP3 — Catálogo (E2E-01, E2E-12, parte de E2E-04 e E2E-09).
 * Integração real: TanStack Router (URL) → TanStack Query → Axios → MSW; tempo real via
 * socket.io-client. Roda nos projetos desktop (1440) e mobile (390).
 */
import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { mock, openApp, USERS } from './support'

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 1024
const cards = (page: Page) => page.getByTestId('nft-card')
const cardNames = (page: Page) => cards(page).locator('h3')
const searchField = (page: Page) => page.getByTestId('catalog-search').filter({ visible: true })

/** Abre o painel de filtros: barra lateral (desktop) ou drawer (mobile). */
async function filters(page: Page) {
  if (isMobile(page)) {
    await page.getByRole('button', { name: /Filtros e ordenação/ }).click()
    return page.getByRole('dialog', { name: 'Filtros' })
  }
  return page.getByRole('complementary', { name: 'Filtros do catálogo' })
}

async function sortBy(page: Page, label: string) {
  const scope = await filters(page)
  const root = isMobile(page) ? scope : page
  await root.getByRole('combobox', { name: 'Ordenar por:' }).filter({ visible: true }).click()
  await page.getByRole('option', { name: label }).click()
  if (isMobile(page)) await page.keyboard.press('Escape')
}

test.describe('catálogo: busca, filtros, ordenação e paginação na URL', () => {
  test('primeira página reproduz o Figma (ordem "Listados recentemente")', async ({ page }) => {
    await openApp(page, '/')
    await expect(cardNames(page)).toHaveText([
      'Emerald Ape #042',
      'Sage Nomad #009',
      'Neon Vessel #552',
      'Cosmic Bloom #118',
      'Violet Nomad #314',
      'Ivory Baron #088',
      'Golden Beat #207',
      'Golden Frequency #071',
      'Golden Signal #160',
    ])
    await expect(page.getByRole('navigation', { name: 'Paginação' }).getByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page')
  })

  test('busca por texto (debounce, URL com replace) e busca sem resultados', async ({ page }) => {
    await openApp(page, '/')
    await searchField(page).fill('golden')
    await expect(page).toHaveURL(/[?&]q=golden/)
    await expect(cardNames(page).first()).toContainText('Golden') // espera a grade nova (a anterior fica visível enquanto carrega)
    await expect(cards(page)).toHaveCount(9)
    for (const name of await cardNames(page).allTextContents()) expect(name).toContain('Golden')
    await expect(page.getByRole('navigation', { name: 'Paginação' }).getByRole('button', { name: 'Página 2' })).toBeVisible()

    await searchField(page).fill('zzzz')
    await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()
    await page.getByRole('button', { name: 'Limpar filtros' }).filter({ visible: true }).last().click()
    await expect(cards(page)).toHaveCount(9)
    await expect(searchField(page)).toHaveValue('')
    await expect(page).not.toHaveURL(/q=/)
  })

  test('filtros combinados (coleção + rede), contagens e limpeza individual', async ({ page }) => {
    await openApp(page, '/')
    let panel = await filters(page)
    await expect(panel.getByRole('button', { name: /Música/ })).toContainText('(7)')
    await panel.getByRole('button', { name: /Música/ }).click()
    await expect(page).toHaveURL(/category=musica/)
    panel = await filters(page)
    await panel.getByRole('button', { name: /Solana/ }).click()
    await expect(page).toHaveURL(/category=musica.*network=solana|network=solana.*category=musica/)
    await expect(cardNames(page)).toHaveText(['Golden Beat #207', 'Golden Frequency #071', 'Golden Remix #019'])

    // Remoção individual pelo chip: só a rede sai; a coleção continua.
    await page.getByRole('button', { name: 'Remover filtro Solana' }).click()
    await expect(page).not.toHaveURL(/network=/)
    await expect(page).toHaveURL(/category=musica/)
    await expect(cards(page)).toHaveCount(7)
  })

  test('faixa de preço pela URL e ordenação por menor preço', async ({ page }) => {
    await openApp(page, '/?maxPrice=1.00')
    // CP9.2: a tela renderiza antes da resposta da API (skeletons); espera o resultado antes de ler a lista.
    await expect(cards(page).first()).toBeVisible()
    const prices = await cards(page).locator('[data-slot="price"] [data-value]').allTextContents()
    expect(prices.length).toBeGreaterThan(0)
    for (const p of prices) expect(Number.parseFloat(p)).toBeLessThanOrEqual(1)

    await sortBy(page, 'Menor preço')
    await expect(page).toHaveURL(/sort=price-asc/)
    await expect(cardNames(page).first()).toHaveText('Golden Riff #175')
    await expect(cards(page).first().locator('[data-value]')).toHaveText('0.05 ETH')
  })

  test('paginação + histórico do navegador (voltar/avançar) + refresh', async ({ page }) => {
    await openApp(page, '/')
    await page.getByRole('navigation', { name: 'Paginação' }).getByRole('button', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/[?&]page=2/)
    await expect(cardNames(page).first()).toHaveText('Amber Ape #133')

    await page.goBack()
    await expect(page).not.toHaveURL(/page=/)
    await expect(cardNames(page).first()).toHaveText('Emerald Ape #042')
    await page.goForward()
    await expect(cardNames(page).first()).toHaveText('Amber Ape #133')

    await page.reload()
    await expect(page).toHaveURL(/[?&]page=2/)
    await expect(cardNames(page).first()).toHaveText('Amber Ape #133')
    await expect(page.getByRole('navigation', { name: 'Paginação' }).getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
  })

  test('mudar um filtro volta para a página 1', async ({ page }) => {
    await openApp(page, '/?page=3')
    await expect(page).toHaveURL(/page=3/)
    const panel = await filters(page)
    await panel.getByRole('button', { name: /Ethereum/ }).click()
    await expect(page).toHaveURL(/network=ethereum/)
    await expect(page).not.toHaveURL(/page=/)
  })

  test('link compartilhável restaura todo o estado (abas, filtro, ordem, página)', async ({ page }) => {
    await openApp(page, '/mercado?tab=trending&network=ethereum&sort=name')
    await expect(page.getByRole('button', { name: 'Em alta' })).toHaveAttribute('aria-pressed', 'true')
    // CP9.2: as abas aparecem antes da resposta da API; espera o resultado antes de ler a lista.
    await expect(cardNames(page).first()).toBeVisible()
    const names = await cardNames(page).allTextContents()
    expect(names.length).toBeGreaterThan(0)
    expect([...names].sort((a, b) => a.localeCompare(b, 'pt-BR'))).toEqual(names)
    if (!isMobile(page)) await expect(page.getByRole('complementary', { name: 'Filtros do catálogo' }).getByRole('button', { name: /Ethereum/ })).toHaveAttribute('aria-pressed', 'true')
  })

  test('parâmetros inválidos são descartados; página além do fim vai para a última', async ({ page }) => {
    await openApp(page, '/?network=bitcoin&sort=xyz&page=-3&category=nada')
    await expect(cardNames(page).first()).toHaveText('Emerald Ape #042')
    await expect(cards(page)).toHaveCount(9)

    await page.goto('/?page=99')
    await expect(page).toHaveURL(/page=4/)
    await expect(cards(page)).toHaveCount(9)
  })

  test('respostas fora de ordem não sobrescrevem a busca atual', async ({ page }) => {
    // Cenário: termos curtos respondem mais devagar ("g" ≈ 1,2 s; termo longo ≈ 0 s).
    await openApp(page, '/', 'out-of-order')
    const field = searchField(page)
    // CP7: sem esperas arbitrárias. Espera a consulta lenta de "g" SAIR (após o debounce) e, no
    // fim, o desfecho dela (resposta atrasada entregue ou requisição cancelada pelo Query).
    const isSlowG = (url: string) => new URL(url).pathname === '/api/nfts' && new URL(url).searchParams.get('q') === 'g'
    const slowSent = page.waitForRequest((r) => isSlowG(r.url()))
    const slowSettled = Promise.race([
      page.waitForResponse((r) => isSlowG(r.url())).then(() => 'entregue'),
      page.waitForEvent('requestfailed', (r) => isSlowG(r.url())).then(() => 'cancelada'),
    ])
    await field.fill('g')
    await slowSent
    await field.fill('golden pulse')
    await expect(cardNames(page)).toHaveText(['Golden Pulse #120'])
    await slowSettled
    await expect(cardNames(page)).toHaveText(['Golden Pulse #120'])
    await expect(page).toHaveURL(/q=golden(\+|%20)pulse/)
  })
})

test.describe('catálogo: estados', () => {
  test('carregamento mostra skeletons (resposta retida) e depois os cards', async ({ page }) => {
    // Determinístico: a listagem só responde quando o teste liberar (cenário hold-catalog).
    await openApp(page, '/', 'hold-catalog')
    await expect(page.getByTestId('nft-card-skeleton')).toHaveCount(9)
    await expect(page.getByRole('region', { name: 'NFTs do catálogo' })).toHaveAttribute('aria-busy', 'true')
    await expect(cards(page)).toHaveCount(0)
    await mock(page).release('nfts.list')
    await expect(cards(page)).toHaveCount(9)
    await expect(page.getByRole('region', { name: 'NFTs do catálogo' })).toHaveAttribute('aria-busy', 'false')
  })

  test('erro HTTP mostra feedback e "Tentar novamente" recupera', async ({ page }) => {
    await openApp(page, '/', 'catalog-error')
    const alert = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar' })
    await expect(alert).toContainText('HTTP 503', { timeout: 15_000 })
    await alert.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(cards(page)).toHaveCount(9)
  })

  test('erro de conexão mostra feedback específico e recupera', async ({ page }) => {
    await openApp(page, '/', 'catalog-offline')
    const alert = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar' })
    await expect(alert).toContainText('Sem conexão', { timeout: 15_000 })
    await alert.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(cards(page)).toHaveCount(9)
  })

  test('catálogo vazio mostra estado vazio sem simular dados', async ({ page }) => {
    await openApp(page, '/', 'empty')
    await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()
    await expect(page.getByText('O catálogo está vazio no momento.')).toBeVisible()
    await expect(cards(page)).toHaveCount(0)
  })

  test('falha ao carregar imagem mostra fallback no mesmo espaço', async ({ page }) => {
    await openApp(page, '/', 'broken-images')
    const first = cards(page).first()
    await expect(first.getByTestId('image-fallback')).toBeVisible()
    await expect(first.getByRole('img', { name: /imagem indisponível/ })).toBeVisible()
    const box = await first.getByTestId('image-fallback').boundingBox()
    expect(box && Math.abs(box.width - box.height)).toBeLessThanOrEqual(1)
  })
})

test.describe('catálogo: tempo real e favoritos', () => {
  test('nft.updated (Socket.IO) atualiza preço e disponibilidade no card', async ({ page }) => {
    await openApp(page, '/')
    const card = page.locator('[data-testid="nft-card"][data-nft-id="nft-002"]')
    await expect(card.locator('[data-value]')).toHaveText('1.69 ETH')
    await mock(page).updateNft('nft-002', { price: '2.05' })
    await expect(card.locator('[data-value]')).toHaveText('2.05 ETH')
    await mock(page).updateNft('nft-002', { available: 0 })
    await expect(card.getByText('Esgotado')).toBeVisible()
  })

  test('resposta REST antiga que chega DEPOIS do evento não regride o preço', async ({ page }) => {
    // Determinístico: a listagem é lida (1.69) e retida; o evento (2.05, v2) chega antes dela.
    await openApp(page, '/', 'stale-in-flight')
    await expect(page.getByTestId('nft-card-skeleton').first()).toBeVisible()
    await mock(page).updateNft('nft-002', { price: '2.05' })
    await mock(page).release('nfts.list')
    const card = page.locator('[data-testid="nft-card"][data-nft-id="nft-002"]')
    await expect(card.locator('[data-value]')).toHaveText('2.05 ETH')
  })

  // CP4: a intenção de favoritar é retomada automaticamente após o login (não é preciso clicar de novo).
  test('visitante ao favoritar vai ao login, volta e o favorito é aplicado; persiste após refresh', async ({ page }) => {
    await openApp(page, '/')
    await page.getByRole('button', { name: 'Favoritar Sage Nomad #009' }).click()
    await expect(page).toHaveURL(/\/login\?redirect=/)
    await page.getByLabel('E-mail', { exact: true }).fill(USERS.ana.email)
    await page.getByLabel('Senha', { exact: true }).fill(USERS.ana.password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(/\/(\?|$)/)

    await expect(page.getByRole('button', { name: 'Remover Sage Nomad #009 dos favoritos' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Sage Nomad #009 adicionado aos favoritos')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Remover Sage Nomad #009 dos favoritos' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('falha ao favoritar desfaz a atualização otimista (rollback) e avisa', async ({ page }) => {
    await openApp(page, '/', 'favorite-fail')
    await page.goto('/login?redirect=/')
    await page.getByLabel('E-mail', { exact: true }).fill(USERS.bruno.email)
    await page.getByLabel('Senha', { exact: true }).fill(USERS.bruno.password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    const fav = page.locator('[data-nft-id="nft-001"]').getByRole('button', { name: /^(Favoritar Emerald Ape #042|Remover Emerald Ape #042 dos favoritos)$/ }) // CP5: o card também tem o botão de carrinho
    await expect(fav).toHaveAttribute('aria-pressed', 'false')
    await fav.click()
    await expect(page.getByText('Não foi possível favoritar Emerald Ape #042')).toBeVisible()
    await expect(fav).toHaveAttribute('aria-pressed', 'false')
  })
})

test.describe('catálogo: teclado', () => {
  test('filtro de coleção operável por teclado', async ({ page }) => {
    test.skip(isMobile(page), 'no mobile os filtros ficam no drawer (coberto em design-system.spec)')
    await openApp(page, '/')
    const button = page.getByRole('complementary', { name: 'Filtros do catálogo' }).getByRole('button', { name: /Fotografia/ })
    await button.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/category=fotografia/)
    await expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  test('drawer de filtros mobile: foco interno, aplicar fecha e devolve o foco', async ({ page }) => {
    test.skip(!isMobile(page), 'drawer existe só abaixo de 1024px')
    await openApp(page, '/')
    const trigger = page.getByRole('button', { name: /Filtros e ordenação/ })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const drawer = page.getByRole('dialog', { name: 'Filtros' })
    await expect(drawer).toBeVisible()
    expect(await drawer.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    await drawer.getByRole('button', { name: /Polygon/ }).click()
    await expect(drawer).toBeHidden()
    await expect(page).toHaveURL(/network=polygon/)
    await expect(trigger).toBeFocused()
  })
})
