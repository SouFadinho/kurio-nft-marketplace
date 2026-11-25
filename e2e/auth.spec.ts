/**
 * CP4 — Autenticação e sessão (ACC-01..05, E2E-03).
 * Roda em desktop (modal sobre a Home) e mobile (tela cheia).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './fixtures'
import { USERS, isDesktop, mock, openApp, signIn, signOut, submitLogin } from './support'

test.describe('login', () => {
  test('credenciais válidas: entra, volta ao início e a sessão sobrevive ao refresh', async ({ page }) => {
    await openApp(page, '/login')
    await submitLogin(page, USERS.ana.email, USERS.ana.password)
    await expect(page).toHaveURL(/\/$/)
    await page.reload()
    await page.goto('/perfil')
    await expect(page.getByLabel('Nome de exibição')).toHaveValue(USERS.ana.name)
  })

  test('credenciais inválidas: alerta acessível, sem revelar qual campo errou', async ({ page }) => {
    await openApp(page, '/login')
    await submitLogin(page, USERS.ana.email, 'Senha#Errada1')
    await expect(page.getByRole('alert')).toHaveText('E-mail ou senha inválidos.')
    await expect(page).toHaveURL(/\/login/)
  })

  test('validação no cliente: erros associados aos campos e foco no primeiro inválido', async ({ page }) => {
    await openApp(page, '/login')
    await page.getByLabel('E-mail', { exact: true }).fill('nao-e-email')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    const email = page.getByLabel('E-mail', { exact: true })
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toBeFocused()
    await expect(email).toHaveAccessibleDescription(/e-mail válido/i)
    await expect(page.getByLabel('Senha', { exact: true })).toHaveAccessibleDescription('Informe a senha')
  })

  test('falha de conexão mostra mensagem de rede', async ({ page }) => {
    await openApp(page, '/login', 'auth-offline')
    await submitLogin(page, USERS.ana.email, USERS.ana.password)
    await expect(page.getByRole('alert')).toContainText('Sem conexão com o servidor')
  })

  test('envio duplicado é bloqueado enquanto a requisição está em andamento', async ({ page }) => {
    await openApp(page, '/login', 'slow')
    await page.getByLabel('E-mail', { exact: true }).fill(USERS.ana.email)
    await page.getByLabel('Senha', { exact: true }).fill(USERS.ana.password)
    const requests: string[] = []
    page.on('request', (r) => r.url().includes('/api/auth/login') && requests.push(r.method()))
    const submit = page.getByRole('button', { name: 'Entrar', exact: true })
    await submit.click()
    await expect(page.getByRole('button', { name: 'Entrando…' })).toBeDisabled()
    await page.getByLabel('Senha', { exact: true }).press('Enter')
    await expect(page).toHaveURL(/\/$/)
    expect(requests).toEqual(['POST'])
  })

  test('mostrar/ocultar senha', async ({ page }) => {
    await openApp(page, '/login')
    const password = page.getByLabel('Senha', { exact: true })
    await password.fill('segredo1')
    await expect(password).toHaveAttribute('type', 'password')
    await page.getByRole('button', { name: 'Mostrar senha' }).click()
    await expect(password).toHaveAttribute('type', 'text')
    await page.getByRole('button', { name: 'Ocultar senha' }).click()
    await expect(password).toHaveAttribute('type', 'password')
  })

  test('login social visível, mas avisa que não está disponível na demonstração', async ({ page }) => {
    await openApp(page, '/login')
    await page.getByRole('button', { name: /Continuar com Google/ }).click()
    await expect(page.getByText('Indisponível na demonstração').first()).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('redirect externo é ignorado (sem open redirect)', async ({ page }) => {
    await openApp(page, '/login?redirect=//evil.example')
    await submitLogin(page, USERS.ana.email, USERS.ana.password)
    await expect(page).toHaveURL(/^http:\/\/localhost:4173\/$/)
  })
})

test.describe('cadastro', () => {
  test('conta nova: valida, cria, entra automaticamente e persiste', async ({ page }) => {
    await openApp(page, '/cadastro')
    await page.getByLabel('Nome de usuário').fill('carla.nova')
    await page.getByLabel('E-mail', { exact: true }).fill('carla@kurio.test')
    await page.getByLabel('Senha', { exact: true }).fill('Carla#2026')
    await page.getByLabel('Confirmar senha').fill('Carla#2026')
    await page.getByRole('button', { name: 'Criar perfil' }).click()
    await expect(page.getByText('Conta criada. Boas-vindas à Kurio!')).toBeVisible()
    await expect(page).toHaveURL(/\/$/)

    // Persistida: sai e entra de novo com as mesmas credenciais.
    await page.goto('/perfil')
    await expect(page.getByLabel('Nome de usuário')).toHaveValue('carla.nova')
    await signOut(page)
    await signIn(page, { email: 'carla@kurio.test', password: 'Carla#2026' }, '/perfil')
    await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue('carla@kurio.test')
  })

  test('e-mail e usuário já existentes: conflito da API no campo certo', async ({ page }) => {
    await openApp(page, '/cadastro')
    await page.getByLabel('Nome de usuário').fill(USERS.bruno.username)
    await page.getByLabel('E-mail', { exact: true }).fill(USERS.ana.email)
    await page.getByLabel('Senha', { exact: true }).fill('Outra#2026')
    await page.getByLabel('Confirmar senha').fill('Outra#2026')
    await page.getByRole('button', { name: 'Criar perfil' }).click()
    await expect(page.getByRole('alert')).toContainText('já estão em uso')
    await expect(page.getByLabel('Nome de usuário')).toHaveAccessibleDescription(/já está em uso/)
    await expect(page.getByLabel('E-mail', { exact: true })).toHaveAccessibleDescription(/já/)
    await expect(page.getByLabel('Nome de usuário')).toBeFocused()
  })

  test('requisitos de senha e confirmação', async ({ page }) => {
    await openApp(page, '/cadastro')
    await page.getByLabel('Nome de usuário').fill('Nome Inválido')
    await page.getByLabel('E-mail', { exact: true }).fill('x@kurio.test')
    await page.getByLabel('Senha', { exact: true }).fill('curta')
    await page.getByLabel('Confirmar senha').fill('outra')
    await page.getByRole('button', { name: 'Criar perfil' }).click()
    await expect(page.getByLabel('Nome de usuário')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('aria-invalid', 'true')
    await page.getByLabel('Nome de usuário').fill('nome.valido')
    await page.getByLabel('Senha', { exact: true }).fill('Valida#2026')
    await page.getByRole('button', { name: 'Criar perfil' }).click()
    await expect(page.getByLabel('Confirmar senha')).toHaveAccessibleDescription('As senhas não conferem')
    await expect(page).toHaveURL(/\/cadastro/)
  })
})

test.describe('sessão e rotas protegidas', () => {
  for (const path of ['/perfil', '/perfil/carteiras', '/favoritos']) {
    test(`${path} exige login e volta para a rota após entrar`, async ({ page }) => {
      await openApp(page, path)
      await expect(page).toHaveURL(new RegExp(`/login\\?redirect=${encodeURIComponent(path)}`))
      await submitLogin(page, USERS.bruno.email, USERS.bruno.password)
      await expect(page).toHaveURL(new RegExp(`${path}$`))
    })
  }

  test('expiração: volta ao login com aviso e retoma a rota de origem', async ({ page }) => {
    await openApp(page, '/')
    await signIn(page, USERS.ana, '/perfil/carteiras')
    await expect(page.getByText('Principal', { exact: true }).first()).toBeVisible()
    await mock(page).expireSessions()
    // Próxima requisição privada (mudar de aba da conta) recebe 401 SESSION_EXPIRED.
    await page.getByRole('navigation', { name: 'Conta' }).getByRole('link', { name: 'Dados do perfil' }).click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fperfil&motivo=expirada/)
    await expect(page.getByRole('alert')).toContainText('Sua sessão expirou')
    await submitLogin(page, USERS.ana.email, USERS.ana.password)
    await expect(page).toHaveURL(/\/perfil$/)
    await expect(page.getByLabel('Nome de exibição')).toHaveValue(USERS.ana.name)
  })

  test('expiração em página pública sem ação pendente: continua como visitante, com aviso', async ({ page }) => {
    await openApp(page, '/')
    await signIn(page, USERS.ana)
    await expect(page.getByRole('button', { name: 'Favoritar Sage Nomad #009' })).toBeVisible()
    // Determinístico (CP5): o token guardado NA ABA passa a ser um que a API não aceita, e só a
    // página recarregada o usa. Expirar no servidor e recarregar era instável: uma leitura privada
    // ainda em trânsito na página ANTIGA podia receber o 401 antes do reload (aviso exibido e
    // perdido com a página; a nova já nascia deslogada). Reproduzido em 7 de 24 repetições.
    await page.evaluate(() => {
      const stored = JSON.parse(sessionStorage.getItem('kurio:session')!) as { token: string }
      sessionStorage.setItem('kurio:session', JSON.stringify({ ...stored, token: 'token-expirado-no-servidor' }))
    })
    await page.reload() // a leitura de favoritos (privada) recebe 401 SESSION_EXPIRED
    await expect(page.getByText('Sua sessão expirou')).toBeVisible()
    await expect(page).toHaveURL(/\/$/)
    expect(await page.evaluate(() => sessionStorage.getItem('kurio:session'))).toBeNull()
    await page.getByRole('button', { name: 'Entrar' }).last().click()
    await expect(page).toHaveURL(/\/login\?redirect=%2F/)
  })

  test('logout encerra a sessão, limpa o armazenamento e protege as rotas de novo', async ({ page }) => {
    await openApp(page, '/')
    await signIn(page, USERS.ana, '/perfil')
    await signOut(page)
    expect(await page.evaluate(() => sessionStorage.getItem('kurio:session'))).toBeNull()
    await page.goto('/perfil')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fperfil/)
  })

  test('troca de usuário: Bruno não vê dados de Ana', async ({ page }) => {
    await openApp(page, '/')
    await signIn(page, USERS.ana, '/perfil')
    await expect(page.getByLabel('Nome de exibição')).toHaveValue(USERS.ana.name)
    await signOut(page)
    await signIn(page, USERS.bruno, '/perfil')
    await expect(page.getByLabel('Nome de exibição')).toHaveValue(USERS.bruno.name)
    await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue(USERS.bruno.email)
    await expect(page.getByText(USERS.ana.email)).toHaveCount(0)
  })
})

test.describe('apresentação e acessibilidade', () => {
  test('desktop: modal com foco preso, Esc fecha e o foco volta ao botão Entrar', async ({ page }) => {
    test.skip(!isDesktop(page), 'modal só no desktop; no mobile o login é uma tela cheia')
    await openApp(page, '/')
    const trigger = page.getByRole('banner').getByRole('link', { name: 'Entrar' })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Entrar' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Entrar' })).toHaveAttribute('aria-current', 'page')
    // Foco preso: 25 tabs nunca saem do diálogo.
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/\/$/)
    await expect(trigger).toBeFocused()
  })

  test('desktop: abas Entrar | Criar conta preservam o destino', async ({ page }) => {
    test.skip(!isDesktop(page), 'abas existem só no modal desktop')
    await openApp(page, '/login?redirect=%2Ffavoritos')
    await page.getByRole('dialog').getByRole('link', { name: 'Criar conta' }).click()
    await expect(page).toHaveURL(/\/cadastro\?redirect=%2Ffavoritos/)
    await expect(page.getByRole('dialog', { name: 'Criar perfil de colecionador' })).toBeVisible()
  })

  test('mobile: tela cheia, sem rodapé nem navegação inferior', async ({ page }) => {
    test.skip(isDesktop(page), 'cenário mobile')
    await openApp(page, '/login')
    await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('contentinfo')).toBeHidden()
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(0)
  })

  for (const path of ['/login', '/cadastro']) {
    test(`axe sem violações em ${path}`, async ({ page }) => {
      await openApp(page, path)
      await expect(page.getByLabel('E-mail', { exact: true })).toBeVisible()
      // Mostra os erros: os estados de erro também precisam passar.
      await page.getByRole('button', { name: path === '/login' ? 'Entrar' : 'Criar perfil', exact: true }).click()
      await expect(page.getByLabel('E-mail', { exact: true })).toHaveAttribute('aria-invalid', 'true')
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(results.passes.length).toBeGreaterThan(10)
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([])
    })
  }
})
