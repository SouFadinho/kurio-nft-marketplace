/**
 * CP8: auditoria de acessibilidade automatizada das 9 telas obrigatórias + Mercado, Favoritos e
 * Meus pedidos, desktop e mobile. Complementa os testes de teclado/foco já existentes
 * (design-system, auth, catalog, nft-detail, cart, checkout). Não substitui avaliação manual:
 * limitações em planning/CP8_REPORT.md §4.
 */
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { USERS, isDesktop, mock, openApp, placeOrder, seedCart, signIn, summaryValue } from './support'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/** Estrutura que o axe não cobre por completo: um h1, sem saltos de nível, imagens e botões nomeados. */
async function structure(page: Page) {
  return page.evaluate(() => {
    // Exposto à tecnologia assistiva: renderizado (inclui .sr-only) e fora de conteúdo inerte
    // (o Radix marca o fundo de um modal com aria-hidden).
    const exposed = (el: Element) => el.checkVisibility({ visibilityProperty: true }) && !el.closest('[aria-hidden="true"], [inert]')
    // Escopo: documento inteiro (o diálogo de login fica num portal fora do <main>).
    const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(exposed)
    const levels = headings.map((h) => Number(h.tagName[1]))
    const skips = levels.filter((l, i) => i > 0 && l > levels[i - 1]! + 1)
    const imgsNoAlt = [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length
    const unnamedButtons = [...document.querySelectorAll('button, a[href], [role="button"]')]
      .filter(exposed)
      .filter((b) => {
        const labels = (b as HTMLButtonElement).labels
        return !(b.getAttribute('aria-label') || (b as HTMLElement).innerText.trim() || b.getAttribute('aria-labelledby') || (labels && labels.length > 0) || b.querySelector('img[alt]:not([alt=""])'))
      })
      .map((b) => b.outerHTML.slice(0, 80))
    return { h1: levels.filter((l) => l === 1).length, skips: skips.length, imgsNoAlt, unnamedButtons }
  })
}

async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  // Seletor e mensagem de cada nó: a falha diz exatamente qual elemento violou a regra.
  expect.soft(results.violations.map((v) => `${label}: ${v.id} (${v.nodes.length}) ${v.nodes.map((n) => `${n.target.join(' ')} → ${n.failureSummary?.replace(/\s+/g, ' ').slice(0, 160)}`).join(' | ')}`)).toEqual([])
  expect.soft(results.passes.length, `${label}: o axe precisa ter verificado regras`).toBeGreaterThan(10)
  const s = await structure(page)
  expect.soft(s.h1, `${label}: exatamente um h1`).toBe(1)
  expect.soft(s.skips, `${label}: níveis de título sem saltos`).toBe(0)
  expect.soft(s.imgsNoAlt, `${label}: imagens sem alt`).toBe(0)
  expect.soft(s.unnamedButtons, `${label}: controles sem nome acessível`).toEqual([])
}

test.describe('auditoria das telas (axe WCAG 2.2 A/AA + estrutura)', () => {
  test('públicas: Início, Mercado, Detalhe, Login, Cadastro', async ({ page }) => {
    for (const path of ['/', '/mercado', '/nft/nft-001', '/login', '/cadastro']) {
      await openApp(page, path)
      await page.waitForLoadState('networkidle')
      await audit(page, path)
    }
  })

  test('privadas: Perfil, Carteiras, Favoritos, Carrinho, Pagamento', async ({ page }) => {
    await openApp(page, '/')
    await signIn(page, USERS.ana, '/perfil')
    await expect(page.getByLabel('Nome de exibição')).toHaveValue(USERS.ana.name)
    await audit(page, '/perfil')
    await page.goto('/perfil/carteiras')
    await expect(page.getByRole('form', { name: 'Dados da carteira principal' })).toBeVisible()
    await audit(page, '/perfil/carteiras')
    await page.goto('/favoritos')
    await page.waitForLoadState('networkidle')
    await audit(page, '/favoritos')
    await seedCart(page, [{ nftId: 'nft-001', editionId: 'ed-10', quantity: 1 }])
    await page.goto('/carrinho')
    await expect(summaryValue(page, 'quote-total')).toBeVisible()
    await audit(page, '/carrinho')
    await page.goto('/pagamento')
    await expect(summaryValue(page, 'quote-total')).toBeVisible()
    await audit(page, '/pagamento')
  })

  test('Confirmação (pendente, confirmado, recusado) e Meus pedidos', async ({ page }) => {
    const id = await placeOrder(page)
    await audit(page, 'pedido pendente')
    await mock(page).settleOrder(id, 'confirmed')
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed')
    await audit(page, 'recibo')
    const rejected = await placeOrder(page, { items: [{ nftId: 'nft-002', editionId: 'ed-10', quantity: 1 }], open: false })
    await mock(page).settleOrder(rejected, 'rejected')
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'rejected')
    await audit(page, 'pedido recusado')
    await page.goto('/pedidos')
    await expect(page.getByTestId('order-row')).toHaveCount(2)
    await audit(page, '/pedidos')
  })
})

test.describe('toque, reflow e notificações', () => {
  test('mobile: alvos de toque com pelo menos 24×24 px (WCAG 2.5.8) nas telas principais', async ({ page }) => {
    test.skip(isDesktop(page), 'critério de toque avaliado no projeto mobile')
    await openApp(page, '/')
    await signIn(page, USERS.ana)
    await seedCart(page, [{ nftId: 'nft-001', editionId: 'ed-10', quantity: 1 }])
    for (const path of ['/', '/nft/nft-001', '/carrinho', '/pagamento', '/perfil/carteiras']) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const small = await page.evaluate(() => {
        // Alvo efetivo: o próprio controle ou, se maior, o <label> associado (clicar nele ativa o controle).
        const rectOf = (el: Element) => {
          let r = el.getBoundingClientRect()
          for (const l of [...((el as HTMLInputElement).labels ?? []), el.closest('label')].filter(Boolean) as Element[]) {
            const lr = l.getBoundingClientRect()
            if (lr.width * lr.height > r.width * r.height) r = lr
          }
          return r
        }
        const targets = [...document.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea, [role="radio"], [role="checkbox"]')]
          .filter((el) => el.checkVisibility({ visibilityProperty: true }) && !el.closest('[aria-hidden="true"], [inert]'))
          // .sr-only fora de foco não é alvo visível (o link de pular só aparece no foco, com 40 px).
          .filter((el) => !el.classList.contains('sr-only'))
          // Exceção "inline": link dentro de uma frase.
          .filter((el) => !(el.tagName === 'A' && getComputedStyle(el).display === 'inline'))
          .map((el) => ({ el, r: rectOf(el) }))
          .filter(({ r }) => r.width > 0 && r.height > 0)
        const center = (r: DOMRect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 })
        const distToRect = (p: { x: number; y: number }, r: DOMRect) => Math.hypot(Math.max(r.x - p.x, 0, p.x - (r.x + r.width)), Math.max(r.y - p.y, 0, p.y - (r.y + r.height)))
        const undersized = targets.filter(({ r }) => r.width < 24 || r.height < 24)
        return undersized
          .filter(({ el, r }) => {
            // Exceção de espaçamento (2.5.8): um círculo de 24 px centrado no alvo não pode tocar
            // outro alvo nem o círculo de outro alvo pequeno.
            const c = center(r)
            return targets.some((o) => o.el !== el && !o.el.contains(el) && !el.contains(o.el) && (undersized.includes(o) ? Math.hypot(c.x - center(o.r).x, c.y - center(o.r).y) < 24 : distToRect(c, o.r) < 12))
          })
          .map(({ el, r }) => `${el.tagName.toLowerCase()}[${(el.getAttribute('aria-label') || (el as HTMLElement).innerText || '').slice(0, 30)}] ${Math.round(r.width)}×${Math.round(r.height)}`)
      })
      expect.soft(small, `${path}: alvos menores que 24×24`).toEqual([])
    }
  })

  test('reflow a 320 px (equivalente a 400% de zoom em 1280 px): sem rolagem horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await openApp(page, '/')
    await signIn(page, USERS.ana)
    await seedCart(page, [{ nftId: 'nft-001', editionId: 'ed-10', quantity: 1 }])
    for (const path of ['/', '/mercado', '/nft/nft-001', '/carrinho', '/pagamento', '/perfil', '/perfil/carteiras', '/pedidos']) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
      expect.soft(scroll, `${path} @320px`).toBeLessThanOrEqual(client)
    }
  })

  test('VIS-05: barra fixa do mobile não esconde o fim da página (detalhe, carrinho, pagamento)', async ({ page }) => {
    test.skip(isDesktop(page), 'barra fixa só existe no mobile')
    await openApp(page, '/')
    await signIn(page, USERS.ana)
    await seedCart(page, [{ nftId: 'nft-001', editionId: 'ed-10', quantity: 1 }])
    for (const [path, bar] of [
      ['/nft/nft-001', '[data-testid="mobile-buy-bar"]'],
      ['/carrinho', '[data-testid="mobile-total"]'],
      ['/pagamento', '[data-testid="mobile-total"]'],
    ] as const) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      const { lastBottom, barTop } = await page.evaluate((sel) => {
        const fixedBar = document.querySelector(sel)!.closest('.fixed') ?? document.querySelector(sel)!
        const footerText = [...document.querySelectorAll('footer p')].filter((p) => p.checkVisibility()).at(-1)!
        return { lastBottom: footerText.getBoundingClientRect().bottom, barTop: fixedBar.getBoundingClientRect().top }
      }, bar)
      expect.soft(lastBottom, `${path}: último texto do rodapé acima da barra fixa`).toBeLessThanOrEqual(barTop)
    }
  })

  test('notificação não cobre a ação fixa nem o total do mobile', async ({ page }) => {
    test.skip(isDesktop(page), 'barra fixa só existe no mobile')
    await openApp(page, '/')
    await seedCart(page, [{ nftId: 'nft-001', editionId: 'ed-10', quantity: 1 }])
    await page.goto('/carrinho')
    await expect(summaryValue(page, 'quote-total')).toBeVisible()
    await page.getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042' }).click()
    const toast = page.locator('[data-sonner-toast]').first()
    await expect(toast).toBeVisible()
    const [t, cta, total] = await Promise.all([
      toast.boundingBox(),
      page.getByRole('button', { name: 'Conectar e finalizar' }).filter({ visible: true }).boundingBox(),
      page.getByTestId('mobile-total').boundingBox(),
    ])
    const overlaps = (a: NonNullable<typeof t>, b: NonNullable<typeof t>) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
    expect(overlaps(t!, cta!)).toBe(false)
    expect(overlaps(t!, total!)).toBe(false)
  })
})
