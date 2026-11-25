/**
 * CP4: perfil, avatar, senha e carteiras (ACC-06, ACC-07, TELA-08, TELA-09).
 * Sempre pela UI → TanStack Query → Axios → MSW; a persistência é verificada com reload.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './fixtures'
import { USERS, openApp, signIn, signOut, submitLogin } from './support'

// PNG 1×1 válido.
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqOf/DwAEggJ/q7Gn2wAAAABJRU5ErkJggg==', 'base64')

test.describe('perfil', () => {
  test('editar e salvar: sucesso só após a API e persiste após refresh', async ({ page }) => {
    await openApp(page, '/', 'slow')
    await signIn(page, USERS.ana, '/perfil')
    const name = page.getByLabel('Nome de exibição')
    await expect(name).toHaveValue(USERS.ana.name)
    await name.fill('Ana Curadora')
    await page.getByLabel('Apelido da carteira').fill('Cofre da Ana')
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    // Enquanto a API não responde: botão ocupado e nenhuma mensagem de sucesso.
    await expect(page.getByRole('button', { name: 'Salvando…' })).toBeDisabled()
    await expect(page.getByText('Perfil atualizado')).toHaveCount(0)
    await expect(page.getByText('Perfil atualizado')).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana Curadora')
    await expect(page.getByLabel('Apelido da carteira')).toHaveValue('Cofre da Ana')
  })

  test('conflito de nome de usuário e e-mail vem da API para o campo', async ({ page }) => {
    await openApp(page, '/')
    await signIn(page, USERS.ana, '/perfil')
    await page.getByLabel('Nome de usuário').fill(USERS.bruno.username)
    await page.getByLabel('E-mail', { exact: true }).fill(USERS.bruno.email)
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByRole('alert')).toContainText('já estão em uso')
    await expect(page.getByLabel('Nome de usuário')).toHaveAccessibleDescription('Este nome de usuário já está em uso.')
    await expect(page.getByLabel('E-mail', { exact: true })).toHaveAccessibleDescription('Este e-mail já está em uso por outra conta.')
    await page.reload()
    await expect(page.getByLabel('Nome de usuário')).toHaveValue(USERS.ana.username)
  })

  test('falha ao salvar mantém o que foi digitado, sem persistir; descartar volta ao salvo', async ({ page }) => {
    await openApp(page, '/', 'profile-save-fail')
    await signIn(page, USERS.ana, '/perfil')
    const name = page.getByLabel('Nome de exibição')
    await name.fill('Nome Temporário')
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByRole('alert')).toContainText('Suas alterações não foram salvas')
    await expect(name).toHaveValue('Nome Temporário')
    await page.getByRole('button', { name: 'Descartar alterações' }).click()
    await expect(name).toHaveValue(USERS.ana.name)
    await page.reload()
    await expect(page.getByLabel('Nome de exibição')).toHaveValue(USERS.ana.name)
  })

  test('validação: campos obrigatórios e formato', async ({ page }) => {
    await openApp(page, '/')
    await signIn(page, USERS.ana, '/perfil')
    await page.getByLabel('Nome de exibição').fill('')
    await page.getByLabel('E-mail', { exact: true }).fill('ana@')
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByLabel('Nome de exibição')).toBeFocused()
    await expect(page.getByLabel('Nome de exibição')).toHaveAccessibleDescription('Informe pelo menos 2 caracteres')
    await expect(page.getByLabel('E-mail', { exact: true })).toHaveAccessibleDescription('Informe um e-mail válido')
  })
})

test.describe('avatar (upload simulado)', () => {
  test('envia, persiste após refresh e remove', async ({ page }) => {
    await openApp(page, '/')
    await signIn(page, USERS.ana, '/perfil')
    await page.getByTestId('avatar-input').setInputFiles({ name: 'ana.png', mimeType: 'image/png', buffer: PNG_1PX })
    await expect(page.getByText('Foto de perfil atualizada')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('img', { name: `Foto de perfil de ${USERS.ana.name}` })).toBeVisible()
    await page.getByRole('button', { name: 'Remover', exact: true }).click()
    await expect(page.getByText('Foto de perfil removida')).toBeVisible()
    await expect(page.getByRole('img', { name: /Foto de perfil de/ })).toHaveCount(0)
  })

  test('arquivo inválido (tipo e tamanho) é recusado antes do envio', async ({ page }) => {
    await openApp(page, '/')
    await signIn(page, USERS.ana, '/perfil')
    const input = page.getByTestId('avatar-input')
    await input.setInputFiles({ name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('texto') })
    await expect(page.getByRole('alert')).toHaveText('Formato não suportado. Use PNG, JPEG ou WebP.')
    await input.setInputFiles({ name: 'grande.png', mimeType: 'image/png', buffer: Buffer.alloc(600 * 1024, 1) })
    await expect(page.getByRole('alert')).toHaveText('A imagem excede 512 KB. Escolha um arquivo menor.')
  })

  test('falha no upload informa e não altera o avatar', async ({ page }) => {
    await openApp(page, '/', 'avatar-fail')
    await signIn(page, USERS.ana, '/perfil')
    await page.getByTestId('avatar-input').setInputFiles({ name: 'ana.png', mimeType: 'image/png', buffer: PNG_1PX })
    await expect(page.getByRole('alert')).toContainText('Não foi possível enviar a foto')
    await expect(page.getByRole('img', { name: /Foto de perfil de/ })).toHaveCount(0)
  })
})

test.describe('senha', () => {
  test('senha atual errada: erro no campo, com foco', async ({ page }) => {
    await openApp(page, '/')
    await signIn(page, USERS.ana, '/perfil')
    await page.getByLabel('Senha atual').fill('Errada#2026')
    await page.getByLabel('Nova senha', { exact: true }).fill('NovaAna#2027')
    await page.getByLabel('Confirmar nova senha').fill('NovaAna#2027')
    await page.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page.getByLabel('Senha atual')).toHaveAccessibleDescription('A senha atual está incorreta.')
    await expect(page.getByLabel('Senha atual')).toBeFocused()
  })

  test('troca a senha: a nova funciona e a antiga não', async ({ page }) => {
    await openApp(page, '/')
    await signIn(page, USERS.ana, '/perfil')
    await page.getByLabel('Senha atual').fill(USERS.ana.password)
    await page.getByLabel('Nova senha', { exact: true }).fill('NovaAna#2027')
    await page.getByLabel('Confirmar nova senha').fill('Diferente#1')
    await page.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page.getByLabel('Confirmar nova senha')).toHaveAccessibleDescription('As senhas não conferem')
    await page.getByLabel('Confirmar nova senha').fill('NovaAna#2027')
    await page.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Senha alterada.' })).toBeVisible()
    await expect(page.getByLabel('Senha atual')).toHaveValue('')

    await signOut(page)
    await page.goto('/login')
    await submitLogin(page, USERS.ana.email, USERS.ana.password)
    await expect(page.getByRole('alert')).toHaveText('E-mail ou senha inválidos.')
    await submitLogin(page, USERS.ana.email, 'NovaAna#2027')
    await expect(page).not.toHaveURL(/\/login/)
  })
})

test.describe('carteiras', () => {
  test('lista principal e secundária; trocar a principal persiste', async ({ page }) => {
    await openApp(page, '/')
    await signIn(page, USERS.ana, '/perfil/carteiras')
    const primary = page.getByRole('region', { name: 'Carteira principal' })
    const secondary = page.getByRole('region', { name: 'Carteira secundária' })
    // CP8: a principal é um formulário aberto (como no Figma); os dados estão nos campos.
    await expect(primary.getByLabel('Apelido da carteira')).toHaveValue('Principal')
    await expect(primary.getByLabel('Rede')).toHaveValue('ethereum')
    await expect(secondary).toContainText('Reserva')
    await expect(secondary).toContainText('nova.kurio.eth')
    // Limite de 2: não há "Adicionar carteira".
    await expect(page.getByRole('button', { name: 'Adicionar carteira' })).toHaveCount(0)

    await secondary.getByRole('button', { name: 'Tornar principal a carteira Reserva' }).click()
    await expect(page.getByText('Reserva agora é a carteira principal')).toBeVisible()
    await expect(primary.getByLabel('Apelido da carteira')).toHaveValue('Reserva')
    await page.reload()
    await expect(page.getByRole('form', { name: 'Dados da carteira principal' }).getByLabel('Apelido da carteira')).toHaveValue('Reserva')
    await expect(page.getByRole('region', { name: 'Carteira secundária' })).toContainText('Principal')
  })

  test('adicionar: valida endereço conforme a rede, salva e persiste', async ({ page }) => {
    await openApp(page, '/')
    await signIn(page, USERS.bruno, '/perfil/carteiras')
    const secondary = page.getByRole('region', { name: 'Carteira secundária' })
    await expect(page.getByRole('form', { name: 'Dados da carteira principal' }).getByLabel('Apelido da carteira')).toHaveValue('Cofre')
    await secondary.getByRole('button', { name: 'Adicionar carteira' }).click()
    const form = page.getByRole('form', { name: 'Nova carteira' })
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(form.getByLabel('Apelido da carteira')).toBeFocused()
    await expect(form.getByLabel('Rede')).toHaveAttribute('aria-invalid', 'true')

    await form.getByLabel('Apelido da carteira').fill('Galeria')
    await form.getByLabel('Rede').selectOption('polygon')
    await form.getByLabel('Tipo de carteira').selectOption('metamask')
    await form.getByLabel('Endereço da carteira').fill('7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2') // Solana em rede EVM
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(form.getByLabel('Endereço da carteira')).toHaveAccessibleDescription(/0x seguido de 40/)

    await form.getByLabel('Endereço da carteira').fill('0x1234567890abcdef1234567890ABCDEF12345678')
    await form.getByLabel('Nome ENS (opcional)').fill('galeria.bruno')
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira Galeria adicionada')).toBeVisible()
    await page.reload()
    const saved = page.getByRole('region', { name: 'Carteira secundária' })
    await expect(saved).toContainText('Galeria')
    await expect(saved).toContainText('Polygon')
    await expect(saved).toContainText('galeria.bruno.eth')
  })

  test('endereço já cadastrado: conflito da API no campo', async ({ page }) => {
    await openApp(page, '/')
    await signIn(page, USERS.bruno, '/perfil/carteiras')
    await page.getByRole('button', { name: 'Adicionar carteira' }).click()
    const form = page.getByRole('form', { name: 'Nova carteira' })
    await form.getByLabel('Apelido da carteira').fill('Cópia')
    await form.getByLabel('Rede').selectOption('solana')
    await form.getByLabel('Tipo de carteira').selectOption('walletconnect')
    await form.getByLabel('Endereço da carteira').fill('7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2')
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(form.getByLabel('Endereço da carteira')).toHaveAccessibleDescription('Esta carteira já está cadastrada.')
  })

  test('editar: muda apelido e rede; cancelar não altera nada', async ({ page }) => {
    await openApp(page, '/')
    await signIn(page, USERS.ana, '/perfil/carteiras')
    await page.getByRole('button', { name: 'Editar Reserva' }).click()
    let form = page.getByRole('form', { name: 'Editar Reserva' })
    await form.getByLabel('Apelido da carteira').fill('Descartado')
    await form.getByRole('button', { name: 'Cancelar' }).click()
    await expect(page.getByRole('region', { name: 'Carteira secundária' })).toContainText('Reserva')

    await page.getByRole('button', { name: 'Editar Reserva' }).click()
    form = page.getByRole('form', { name: 'Editar Reserva' })
    await form.getByLabel('Apelido da carteira').fill('Reserva Eth')
    await form.getByLabel('Rede').selectOption('ethereum')
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira Reserva Eth atualizada')).toBeVisible()
    await page.reload()
    const secondary = page.getByRole('region', { name: 'Carteira secundária' })
    await expect(secondary).toContainText('Reserva Eth')
    await expect(secondary).toContainText('Ethereum')
  })

  test('axe sem violações em perfil e carteiras (com erros visíveis)', async ({ page }) => {
    await openApp(page, '/')
    await signIn(page, USERS.bruno, '/perfil')
    await page.getByLabel('Nome de exibição').fill('')
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByLabel('Nome de exibição')).toHaveAttribute('aria-invalid', 'true')
    let results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(results.passes.length).toBeGreaterThan(10)
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([])

    await page.getByRole('navigation', { name: 'Conta' }).getByRole('link', { name: 'Carteiras' }).click()
    await page.getByRole('button', { name: 'Adicionar carteira' }).click()
    const nova = page.getByRole('form', { name: 'Nova carteira' })
    await nova.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(nova.getByLabel('Rede')).toHaveAttribute('aria-invalid', 'true')
    results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(results.passes.length).toBeGreaterThan(10)
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([])
  })
})
