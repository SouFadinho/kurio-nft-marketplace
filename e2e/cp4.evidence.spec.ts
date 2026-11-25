/**
 * Evidências visuais do CP4 (rodar com EVIDENCE=1; grava em planning/evidence/cp4/).
 * Login, cadastro, perfil e carteiras em 390/768/1440, mais estados (erros, expiração).
 */
import { expect, test, type Page } from '@playwright/test'
import { USERS, openApp, signIn } from './support'

const OUT = 'planning/evidence/cp4'
test.use({ reducedMotion: 'reduce' })

async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await expect.poll(() => page.evaluate(() => [...document.images].filter((i) => i.offsetParent !== null).every((i) => i.complete))).toBe(true)
}

const size = (width: number) => ({ width, height: width < 768 ? 844 : 900 })

for (const width of [390, 768, 1440]) {
  test(`login e cadastro @${width}`, async ({ page }) => {
    await page.setViewportSize(size(width))
    await openApp(page, '/login')
    await expect(page.getByLabel('E-mail', { exact: true })).toBeVisible()
    await settle(page)
    await page.screenshot({ path: `${OUT}/login-${width}.png` })
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByLabel('E-mail', { exact: true })).toHaveAttribute('aria-invalid', 'true')
    await page.screenshot({ path: `${OUT}/login-erros-${width}.png` })

    await page.goto('/cadastro')
    await expect(page.getByLabel('Nome de usuário')).toBeVisible()
    await settle(page)
    await page.screenshot({ path: `${OUT}/cadastro-${width}.png`, fullPage: width < 1024 })
  })

  test(`perfil e carteiras @${width}`, async ({ page }) => {
    await page.setViewportSize(size(width))
    await openApp(page, '/')
    await signIn(page, USERS.ana, '/perfil')
    await expect(page.getByLabel('Nome de exibição')).toHaveValue(USERS.ana.name)
    await settle(page)
    await page.screenshot({ path: `${OUT}/perfil-${width}.png`, fullPage: true })

    await page.getByRole('navigation', { name: 'Conta' }).getByRole('link', { name: 'Carteiras' }).click()
    await expect(page.getByRole('region', { name: 'Carteira secundária' })).toContainText('Reserva')
    await settle(page)
    await page.screenshot({ path: `${OUT}/carteiras-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Editar Reserva' }).click()
    await page.getByLabel('Endereço da carteira').fill('0x123')
    await page.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByLabel('Endereço da carteira')).toHaveAttribute('aria-invalid', 'true')
    await page.screenshot({ path: `${OUT}/carteiras-edicao-erro-${width}.png`, fullPage: true })
  })
}

test('login: sessão expirada @1440 e @390', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize(size(width))
    await openApp(page, '/login?redirect=%2Fperfil&motivo=expirada')
    await expect(page.getByText('Sua sessão expirou')).toBeVisible()
    await settle(page)
    await page.screenshot({ path: `${OUT}/login-expirada-${width}.png` })
  }
})

test('cadastro: conflito da API @1440', async ({ page }) => {
  await page.setViewportSize(size(1440))
  await openApp(page, '/cadastro')
  await page.getByLabel('Nome de usuário').fill(USERS.bruno.username)
  await page.getByLabel('E-mail', { exact: true }).fill(USERS.ana.email)
  await page.getByLabel('Senha', { exact: true }).fill('Outra#2026')
  await page.getByLabel('Confirmar senha').fill('Outra#2026')
  await page.getByRole('button', { name: 'Criar perfil' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.screenshot({ path: `${OUT}/cadastro-conflito-1440.png` })
})
