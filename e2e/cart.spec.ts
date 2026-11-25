/**
 * CP5: carrinho (CART-01..05). Desktop e mobile. Tráfego real: UI → Query → Axios → MSW, e
 * mudanças de preço/estoque pelo servidor Socket.IO simulado.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './fixtures'
import { USERS, cartQuantity, mock, openApp, seedCart, signIn, signOut, openAccount, summaryValue } from './support'
import type { Page } from '@playwright/test'

const line = (page: Page, name: string) => page.getByTestId('cart-line').filter({ hasText: name })
const badge = (page: Page) => page.getByRole('link', { name: /^Carrinho/ }).first()

test.describe('adicionar, quantidade e remoção', () => {
  test('pelo card do catálogo: adiciona, mostra no carrinho com valores da API e persiste no refresh', async ({ page }) => {
    await openApp(page, '/')
    await page.getByRole('button', { name: 'Adicionar Emerald Ape #042 ao carrinho' }).click()
    await expect(page.getByText('Emerald Ape #042 adicionado ao carrinho')).toBeVisible()
    // Badge: header no desktop, navegação inferior no mobile (a Início tem as duas conforme o viewport).
    await expect(badge(page)).toHaveAccessibleName('Carrinho, 1 itens')

    await page.goto('/carrinho')
    await expect(line(page, 'Emerald Ape #042')).toContainText('Edição: 1/10')
    await expect(summaryValue(page, 'quote-subtotal')).toHaveAttribute('data-value', '1.19')
    await expect(summaryValue(page, 'quote-fee')).toHaveAttribute('data-value', '0.016')
    await expect(summaryValue(page, 'quote-total')).toHaveAttribute('data-value', '1.206')
    await page.reload()
    await expect(line(page, 'Emerald Ape #042')).toBeVisible()
    await expect(summaryValue(page, 'quote-total')).toHaveAttribute('data-value', '1.206')
  })

  test('pelo detalhe: edição e quantidade; mesma linha soma, outra edição é outra linha', async ({ page }) => {
    await openApp(page, '/nft/nft-001?edicao=ed-50')
    await page.getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042' }).first().click()
    await page.getByRole('button', { name: 'Adicionar Emerald Ape #042 ao carrinho' }).first().click()
    await expect(page.getByText('Emerald Ape #042 adicionado ao carrinho')).toBeVisible()
    await page.getByRole('button', { name: 'Adicionar Emerald Ape #042 ao carrinho' }).first().click()
    await expect.poll(() => cartQuantity(page)).toBe(4)
    await page.goto('/nft/nft-001?edicao=ed-10')
    await page.getByRole('button', { name: 'Adicionar Emerald Ape #042 ao carrinho' }).first().click()
    await expect.poll(() => cartQuantity(page)).toBe(5)

    await page.goto('/carrinho')
    await expect(page.getByTestId('cart-line')).toHaveCount(2)
    const ed50 = page.locator('[data-line-id="nft-001:ed-50"]')
    await expect(ed50).toContainText('Edição: 1/50')
    await expect(ed50.locator('output')).toHaveText('4')
    // 4 × 1.19 + 1 × 1.19 = 5.95 (wei na API, sem ponto flutuante)
    await expect(summaryValue(page, 'quote-subtotal')).toHaveAttribute('data-value', '5.95')
  })

  test('alterar quantidade, limite pelo estoque e remover até o carrinho vazio', async ({ page }) => {
    await openApp(page, '/')
    await seedCart(page, [{ nftId: 'nft-004', editionId: 'ed-10', quantity: 1 }])
    await page.goto('/carrinho')
    const row = line(page, 'Cosmic Bloom #118')
    await row.getByRole('button', { name: 'Aumentar quantidade de Cosmic Bloom #118' }).click()
    await expect(page.getByText('Quantidade de Cosmic Bloom #118: 2')).toBeVisible()
    await expect(summaryValue(page, 'quote-subtotal')).toHaveAttribute('data-value', '2.58')
    // Estoque da edição 1/10 é 2: o "+" desabilita no limite.
    await expect(row.getByRole('button', { name: 'Aumentar quantidade de Cosmic Bloom #118' })).toBeDisabled()
    await row.getByRole('button', { name: 'Diminuir quantidade de Cosmic Bloom #118' }).click()
    await expect(summaryValue(page, 'quote-subtotal')).toHaveAttribute('data-value', '1.29')
    await row.getByRole('button', { name: 'Remover Cosmic Bloom #118 do carrinho' }).filter({ visible: true }).click()
    await expect(page.getByText('Cosmic Bloom #118 removido do carrinho')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  })

  test('adicionar além do estoque: a API recusa e o carrinho não muda', async ({ page }) => {
    await openApp(page, '/')
    await seedCart(page, [{ nftId: 'nft-004', editionId: 'ed-10', quantity: 2 }])
    await page.reload()
    await page.goto('/nft/nft-004?edicao=ed-10')
    await page.getByRole('button', { name: 'Adicionar Cosmic Bloom #118 ao carrinho' }).first().click()
    await expect(page.getByText('Sem estoque suficiente de Cosmic Bloom #118')).toBeVisible()
    await expect.poll(() => cartQuantity(page)).toBe(2)
  })
})

test.describe('tempo real no carrinho', () => {
  test('estoque cai abaixo da quantidade: linha alerta, checkout bloqueia, "Ajustar" corrige', async ({ page }) => {
    await openApp(page, '/')
    await seedCart(page, [{ nftId: 'nft-004', editionId: 'ed-10', quantity: 2 }])
    await page.goto('/carrinho')
    await expect(summaryValue(page, 'quote-total')).toHaveAttribute('data-value', '2.596')
    await mock(page).updateNft('nft-004', { editions: [{ id: 'ed-10', available: 1 }] })
    const row = line(page, 'Cosmic Bloom #118')
    await expect(row.getByRole('alert')).toContainText('Só resta 1 unidade')
    await expect(page.getByRole('button', { name: 'Conectar e finalizar' }).filter({ visible: true })).toBeDisabled()
    await row.getByRole('button', { name: 'Ajustar para 1' }).click()
    await expect(row.getByRole('alert')).toHaveCount(0)
    await expect(summaryValue(page, 'quote-total')).toHaveAttribute('data-value', '1.306')
    await expect(page.getByRole('button', { name: 'Conectar e finalizar' }).filter({ visible: true })).toBeEnabled()
  })

  test('preço muda: linha avisa o preço anterior e o resumo é recotado pela API', async ({ page }) => {
    await openApp(page, '/')
    await seedCart(page, [{ nftId: 'nft-001', quantity: 1 }])
    await page.goto('/carrinho')
    await expect(summaryValue(page, 'quote-subtotal')).toHaveAttribute('data-value', '1.19')
    await mock(page).updateNft('nft-001', { price: '1.25' })
    await expect(line(page, 'Emerald Ape #042').getByRole('status').filter({ hasText: 'Preço atualizado' })).toContainText('era 1.19 ETH, agora 1.25 ETH')
    await expect(summaryValue(page, 'quote-subtotal')).toHaveAttribute('data-value', '1.25')
    // Evento repetido/antigo não regride o valor.
    await mock(page).emitStaleNftUpdate('nft-001', '0.50')
    await mock(page).replayLast()
    await expect(summaryValue(page, 'quote-subtotal')).toHaveAttribute('data-value', '1.25')
  })
})

test.describe('cupons', () => {
  test('válido aplica o desconto da API; inválido e expirado mostram erro no campo; remover', async ({ page }) => {
    await openApp(page, '/')
    await seedCart(page, [{ nftId: 'nft-001', quantity: 1 }])
    await page.goto('/carrinho')
    const code = page.getByLabel('Código promocional')

    await code.fill('xpto')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(code).toHaveAccessibleDescription('Cupom inválido. Confira o código.')
    await code.fill('natal2024')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(code).toHaveAccessibleDescription('Este cupom expirou em 31/12/2024.')
    await expect(summaryValue(page, 'quote-discount')).toHaveAttribute('data-value', '0')

    await code.fill('kurio10')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('Cupom KURIO10 aplicado').first()).toBeVisible()
    // 10% de 1.19 = 0.119; total = 1.19 − 0.119 + 0.016 = 1.087
    await expect(summaryValue(page, 'quote-discount')).toHaveAttribute('data-value', '0.119')
    await expect(summaryValue(page, 'quote-total')).toHaveAttribute('data-value', '1.087')
    await page.reload()
    await expect(summaryValue(page, 'quote-total')).toHaveAttribute('data-value', '1.087')

    await page.getByRole('button', { name: 'Remover cupom' }).click()
    await expect(page.getByText('Cupom removido')).toBeVisible()
    await expect(summaryValue(page, 'quote-total')).toHaveAttribute('data-value', '1.206')
  })
})

test.describe('visitante, merge e isolamento', () => {
  test('merge determinístico após login: soma quantidades, limita ao estoque, mantém a ordem', async ({ page }) => {
    await openApp(page, '/')
    // Carrinho de Ana: Emerald (1/10) × 1 e Cosmic (1/10) × 2 (todo o estoque).
    await signIn(page, USERS.ana)
    await seedCart(page, [
      { nftId: 'nft-001', editionId: 'ed-10', quantity: 1 },
      { nftId: 'nft-004', editionId: 'ed-10', quantity: 2 },
    ])
    await openAccount(page)
    await signOut(page)
    // Visitante: Emerald × 2, Cosmic × 1 (excede o estoque somado) e Sage × 1 (nova).
    await seedCart(page, [
      { nftId: 'nft-001', editionId: 'ed-10', quantity: 2 },
      { nftId: 'nft-004', editionId: 'ed-10', quantity: 1 },
      { nftId: 'nft-002', editionId: 'ed-10', quantity: 1 },
    ])
    await page.goto('/login?redirect=%2Fcarrinho')
    await page.getByLabel('E-mail', { exact: true }).fill(USERS.ana.email)
    await page.getByLabel('Senha', { exact: true }).fill(USERS.ana.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/carrinho$/)
    await expect(page.getByText(/Ajustados pelo estoque: Cosmic Bloom #118 \(2 de 3\)/)).toBeVisible()
    const rows = page.getByTestId('cart-line')
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(0)).toHaveAttribute('data-line-id', 'nft-001:ed-10')
    await expect(rows.nth(0).locator('output')).toHaveText('3')
    await expect(rows.nth(1).locator('output')).toHaveText('2')
    await expect(rows.nth(2)).toHaveAttribute('data-line-id', 'nft-002:ed-10')
    // O carrinho de visitante deixou de existir.
    expect(await page.evaluate(() => localStorage.getItem('kurio:guest-cart'))).toBeNull()
  })

  test('isolamento: depois do logout o visitante tem carrinho vazio; Bruno não vê o de Ana', async ({ page }) => {
    await openApp(page, '/')
    await signIn(page, USERS.ana)
    await seedCart(page, [{ nftId: 'nft-001', quantity: 2 }])
    await page.goto('/carrinho')
    await expect(line(page, 'Emerald Ape #042')).toBeVisible()
    await page.goto('/')
    await openAccount(page)
    await signOut(page)
    await page.goto('/carrinho')
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
    await signIn(page, USERS.bruno, '/carrinho')
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
    await expect(page.getByText('Emerald Ape #042')).toHaveCount(0)
    // E a Ana continua com o carrinho dela.
    await page.goto('/')
    await openAccount(page)
    await signOut(page)
    await signIn(page, USERS.ana, '/carrinho')
    await expect(line(page, 'Emerald Ape #042').locator('output')).toHaveText('2')
  })
})

test.describe('estados e falhas', () => {
  test('erro ao carregar e recuperação com "Tentar novamente"', async ({ page }) => {
    await openApp(page, '/')
    await seedCart(page, [{ nftId: 'nft-001', quantity: 1 }])
    await page.goto('/carrinho?scenario=cart-error')
    // Espera explícita: o erro só aparece depois da tentativa + 2 retries automáticos (backoff de 1 s e 2 s).
    await expect(page.getByRole('heading', { name: 'Não foi possível carregar o carrinho' })).toBeVisible({ timeout: 10_000 })
    await mock(page).recover('cart.read')
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(line(page, 'Emerald Ape #042')).toBeVisible()
  })

  test('falha ao alterar: o carrinho anterior é preservado e o erro é anunciado', async ({ page }) => {
    await openApp(page, '/')
    await seedCart(page, [{ nftId: 'nft-001', quantity: 1 }])
    await page.goto('/carrinho?scenario=cart-write-fail')
    await line(page, 'Emerald Ape #042').getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042' }).click()
    await expect(page.getByText('Não foi possível alterar a quantidade de Emerald Ape #042')).toBeVisible()
    await expect(line(page, 'Emerald Ape #042').locator('output')).toHaveText('1')
    await expect(summaryValue(page, 'quote-subtotal')).toHaveAttribute('data-value', '1.19')
  })

  test('cotação em andamento: resumo em carregamento e checkout bloqueado até a API responder', async ({ page }) => {
    await openApp(page, '/')
    await seedCart(page, [{ nftId: 'nft-001', quantity: 1 }])
    await page.goto('/carrinho?scenario=hold-quote')
    await expect(page.getByText('Calculando os valores…')).toBeAttached()
    await expect(page.getByRole('button', { name: 'Conectar e finalizar' }).filter({ visible: true })).toBeDisabled()
    await mock(page).release('quote')
    await expect(summaryValue(page, 'quote-total')).toHaveAttribute('data-value', '1.206')
    await expect(page.getByRole('button', { name: 'Conectar e finalizar' }).filter({ visible: true })).toBeEnabled()
  })

  test('acessibilidade: axe sem violações e controles operáveis por teclado', async ({ page }) => {
    await openApp(page, '/')
    await seedCart(page, [{ nftId: 'nft-001', quantity: 1 }])
    await page.goto('/carrinho')
    await expect(summaryValue(page, 'quote-total')).toBeVisible()
    const plus = line(page, 'Emerald Ape #042').getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042' })
    await plus.focus()
    await page.keyboard.press('Enter')
    await expect(line(page, 'Emerald Ape #042').locator('output')).toHaveText('2')
    await page.getByLabel('Código promocional').fill('xpto')
    await page.getByLabel('Código promocional').press('Enter')
    await expect(page.getByLabel('Código promocional')).toHaveAttribute('aria-invalid', 'true')
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(results.passes.length).toBeGreaterThan(10)
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([])
  })
})
