/**
 * CP2: design system e estrutura global. Roda nos projetos desktop (1440) e mobile (390).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { openApp } from './support'

const isMobile = (name: string) => name.startsWith('mobile')

test.describe('estrutura global', () => {
  test('link "Pular para o conteúdo" é o primeiro foco e leva ao <main>', async ({ page }) => {
    await openApp(page, '/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page.locator('main#conteudo')).toBeFocused()
  })

  test('navegação principal marca a página atual (aria-current, não só cor)', async ({ page }, info) => {
    await openApp(page, '/criadores')
    if (isMobile(info.project.name)) {
      await expect(page.getByTestId('bottom-nav').getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current', 'page')
      await page.getByTestId('bottom-nav').getByRole('link', { name: 'Início' }).click()
      await expect(page.getByTestId('bottom-nav').getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page')
    } else {
      const nav = page.getByRole('navigation', { name: 'Principal', exact: true })
      await expect(nav.getByRole('link', { name: 'Criadores' })).toHaveAttribute('aria-current', 'page')
      await nav.getByRole('link', { name: 'Mercado' }).click()
      await expect(page).toHaveURL(/\/mercado$/)
      await expect(nav.getByRole('link', { name: 'Mercado' })).toHaveAttribute('aria-current', 'page')
    }
  })

  test('páginas fora do escopo são coerentes e não simulam função', async ({ page }) => {
    await openApp(page, '/aprenda')
    await expect(page.getByRole('heading', { name: 'Conteúdo fora desta demonstração' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Explorar o mercado' })).toBeVisible()
  })

  test('ação fora do escopo informa indisponibilidade (toast informativo, sem sucesso)', async ({ page }) => {
    await openApp(page, '/')
    const footer = page.getByTestId('site-footer')
    await footer.getByRole('button', { name: /Central de ajuda \(indisponível/ }).filter({ visible: true }).first().click()
    await expect(page.getByText('Indisponível na demonstração')).toBeVisible()
  })

  test('newsletter valida o e-mail e não finge inscrição', async ({ page }) => {
    await openApp(page, '/')
    const form = page.getByTestId('site-footer').locator('form').filter({ visible: true })
    await form.getByRole('button', { name: 'Enviar' }).click()
    await expect(form.getByText('Informe um e-mail válido.')).toBeVisible()
    await expect(form.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
    await form.getByRole('textbox').fill('ana@kurio.test')
    await form.getByRole('button', { name: 'Enviar' }).click()
    await expect(page.getByText('Indisponível na demonstração')).toBeVisible()
  })

  test('rota privada de conta exige login e preserva o destino', async ({ page }) => {
    await openApp(page, '/perfil/carteiras')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fperfil%2Fcarteiras/)
  })

  test('fonte Roboto Mono self-hosted carregada e aplicada', async ({ page }) => {
    await openApp(page, '/')
    await page.evaluate(() => document.fonts.ready)
    const result = await page.evaluate(() => ({
      loaded: document.fonts.check('16px "Roboto Mono Variable"'),
      family: getComputedStyle(document.body).fontFamily,
    }))
    expect(result.loaded).toBe(true)
    expect(result.family).toContain('Roboto Mono Variable')
  })
})

test.describe('componentes', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, '/demo/componentes')
  })

  test('diálogo: foco preso dentro, Esc fecha e devolve o foco ao gatilho', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Abrir diálogo' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Entrar' })
    await expect(dialog).toBeVisible()
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('drawer de filtros: abre, mantém foco, Esc fecha e devolve o foco', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Abrir filtros (drawer)' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const drawer = page.getByRole('dialog', { name: 'Filtros' })
    await expect(drawer).toBeVisible()
    await page.keyboard.press('Tab')
    expect(await drawer.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('seletor de quantidade respeita limites inteiros e anuncia o valor', async ({ page }) => {
    const group = page.getByRole('group', { name: 'Quantidade de Emerald Ape #042' })
    const minus = group.getByRole('button', { name: 'Diminuir quantidade de Emerald Ape #042' })
    const plus = group.getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042' })
    const value = group.locator('output')
    await expect(value).toHaveText('1')
    await expect(minus).toBeDisabled()
    for (let i = 0; i < 6; i++) if (await plus.isEnabled()) await plus.click()
    await expect(value).toHaveText('5')
    await expect(plus).toBeDisabled()
    await expect(value).toHaveAttribute('aria-live', 'polite')
  })

  test('slider de preço: polegares com nome acessível e operáveis por teclado', async ({ page }) => {
    const min = page.getByRole('slider', { name: 'Preço mínimo' })
    await expect(page.getByRole('slider', { name: 'Preço máximo' })).toBeVisible()
    await min.focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByText('Preço: 0.03 – 12.30 ETH')).toBeVisible()
  })

  test('card de NFT: dados da API simulada, imagem com alt e espaço reservado, favoritar com aria-pressed', async ({ page }) => {
    const card = page.locator('[data-testid="nft-card"][data-nft-id="nft-001"]')
    await expect(card.getByRole('link', { name: 'Emerald Ape #042' })).toHaveAttribute('href', '/nft/nft-001')
    await expect(card.locator('[data-slot="price"] [data-value]')).toHaveText('1.19 ETH')
    const img = card.getByRole('img')
    await expect(img).toHaveAttribute('alt', /Macaco de pelo castanho/)
    await expect(img).toHaveAttribute('width', '512')
    await expect(img).toHaveAttribute('height', '512')
    const box = await img.boundingBox()
    expect(box && Math.abs(box.width - box.height)).toBeLessThanOrEqual(1) // 1:1 reservado
    const fav = card.getByRole('button', { name: 'Favoritar Emerald Ape #042' })
    await expect(fav).toHaveAttribute('aria-pressed', 'false')
    await fav.click()
    await expect(card.getByRole('button', { name: 'Remover Emerald Ape #042 dos favoritos' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-nft-id="nft-003"]').getByText('Raro')).toBeVisible()
  })

  test('skeletons: mesmas dimensões do card, aria-busy e anúncio de carregamento', async ({ page }) => {
    const firstCard = page.getByTestId('nft-card').first()
    const cardBox = await firstCard.boundingBox()
    await page.getByLabel('Mostrar skeletons').check()
    const grid = page.getByRole('region', { name: 'NFTs de exemplo' })
    await expect(grid).toHaveAttribute('aria-busy', 'true')
    await expect(grid.getByRole('status')).toHaveText('Carregando NFTs…')
    const skeleton = page.getByTestId('nft-card-skeleton').first()
    const skBox = await skeleton.boundingBox()
    expect(cardBox && skBox).toBeTruthy()
    expect(Math.abs(cardBox!.width - skBox!.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(cardBox!.height - skBox!.height)).toBeLessThanOrEqual(2)
  })

  test('shimmer ativo por padrão e desligado com prefers-reduced-motion', async ({ page }) => {
    await page.getByLabel('Mostrar skeletons').check()
    const shimmer = page.locator('.skeleton').first()
    expect(await shimmer.evaluate((el) => getComputedStyle(el).animationName)).toBe('shimmer')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    expect(await shimmer.evaluate((el) => getComputedStyle(el).animationName)).toBe('none')
  })

  test('toast de erro é anunciado em região de notificações', async ({ page }) => {
    await page.getByRole('button', { name: 'Toast de erro' }).click()
    await expect(page.getByRole('region', { name: /Notificações/ })).toContainText('Não foi possível favoritar')
  })

  test('paginação: página atual com aria-current e navegação', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Paginação' })
    await expect(nav.getByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page')
    await expect(nav.getByRole('button', { name: 'Página anterior' })).toBeDisabled()
    await nav.getByRole('button', { name: 'Próxima página' }).click()
    await expect(nav.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
  })

  test('carteiras: grupo de rádio operável por setas', async ({ page }) => {
    const group = page.getByRole('radiogroup', { name: 'Carteira para pagamento' })
    const reserva = group.getByRole('radio', { name: /Reserva/ })
    await expect(reserva).toBeChecked()
    await reserva.focus()
    // Segura a tecla como numa pessoa: o Radix só seleciona se a seta ainda estiver pressionada
    // quando o foco (movido num setTimeout) chega ao próximo rádio. press() solta na hora.
    await page.keyboard.down('ArrowDown')
    await page.waitForTimeout(80)
    await page.keyboard.up('ArrowDown')
    await expect(group.getByRole('radio', { name: /Principal/ })).toBeChecked()
  })
})

test.describe('acessibilidade automatizada (axe, WCAG 2.1 A/AA)', () => {
  for (const route of ['/', '/mercado', '/nft/nft-001', '/nft/nao-existe', '/demo/componentes', '/demo/conta', '/demo/checkout', '/criadores', '/rota-inexistente']) {
    test(`sem violações em ${route}`, async ({ page }) => {
      await openApp(page, route)
      await page.waitForLoadState('networkidle')
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)
      expect(summary).toEqual([])
      // A auditoria não pode ser vácua: a página precisa ter sido de fato avaliada.
      expect(results.passes.length).toBeGreaterThan(15)
      expect(results.passes.map((p) => p.id)).toContain('color-contrast')
    })
  }

  test('controle negativo: o axe detecta violações injetadas', async ({ page }) => {
    await openApp(page, '/')
    await page.evaluate(() => {
      const main = document.querySelector('main')!
      main.insertAdjacentHTML('beforeend', '<img src="/assets/nfts/emerald-ape.webp" width="10" height="10"><button><svg width="10" height="10"></svg></button>')
    })
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(results.violations.map((v) => v.id)).toEqual(expect.arrayContaining(['image-alt', 'button-name']))
  })
})
