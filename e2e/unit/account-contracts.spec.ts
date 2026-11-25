import { expect, test } from '@playwright/test'
import { LoginRequest, PasswordChange, ProfileUpdate, RegisterRequest, WalletInput, isValidAddress } from '../../src/api/contracts'
import { AuthSearch, isProtectedPath } from '../../src/features/auth/authSearch'

const firstError = (r: { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } }) =>
  r.error?.issues.map((i) => `${String(i.path[0])}: ${i.message}`)

test.describe('contratos de conta (mesmo schema no cliente e no mock)', () => {
  test('login: e-mail normalizado e senha obrigatória', () => {
    expect(LoginRequest.safeParse({ email: '  ana@kurio.test ', password: 'x' }).data?.email).toBe('ana@kurio.test')
    expect(firstError(LoginRequest.safeParse({ email: 'ana', password: '' }))).toEqual(['email: Informe um e-mail válido', 'password: Informe a senha'])
  })

  test('cadastro: requisitos de senha, usuário e confirmação', () => {
    const ok = { username: 'carla.nova', email: 'c@kurio.test', password: 'Carla#2026', confirmPassword: 'Carla#2026' }
    expect(RegisterRequest.safeParse(ok).success).toBe(true)
    expect(firstError(RegisterRequest.safeParse({ ...ok, password: 'abcdefgh', confirmPassword: 'abcdefgh' }))).toEqual(['password: A senha precisa ter pelo menos um número'])
    expect(firstError(RegisterRequest.safeParse({ ...ok, password: 'Ab1', confirmPassword: 'Ab1' }))).toEqual(['password: A senha precisa ter pelo menos 8 caracteres'])
    expect(firstError(RegisterRequest.safeParse({ ...ok, username: 'Carla Nova' }))).toEqual(['username: Use apenas letras minúsculas, números, ponto e sublinhado'])
    expect(firstError(RegisterRequest.safeParse({ ...ok, confirmPassword: 'Outra#2026' }))).toEqual(['confirmPassword: As senhas não conferem'])
  })

  test('troca de senha: confirmação e nova diferente da atual', () => {
    expect(firstError(PasswordChange.safeParse({ currentPassword: 'Kurio#Ana2026', newPassword: 'Kurio#Ana2026', confirmPassword: 'Kurio#Ana2026' }))).toEqual([
      'newPassword: A nova senha precisa ser diferente da atual',
    ])
  })

  test('perfil: limites de tamanho', () => {
    const r = ProfileUpdate.safeParse({ displayName: 'A', username: 'ab', email: 'a@b.co', walletNickname: 'x'.repeat(31) })
    expect(firstError(r)).toEqual(['displayName: Informe pelo menos 2 caracteres', 'username: Use pelo menos 3 caracteres', 'walletNickname: Use no máximo 30 caracteres'])
  })

  test('carteira: endereço validado conforme a rede', () => {
    const evm = '0x1234567890abcdef1234567890ABCDEF12345678'
    const sol = '7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2'
    expect(isValidAddress('ethereum', evm)).toBe(true)
    expect(isValidAddress('polygon', evm)).toBe(true)
    expect(isValidAddress('solana', evm)).toBe(false)
    expect(isValidAddress('solana', sol)).toBe(true)
    expect(isValidAddress('ethereum', sol)).toBe(false)
    expect(isValidAddress('ethereum', evm.slice(0, -1))).toBe(false)
    const base = { nickname: 'Galeria', network: 'polygon', type: 'metamask', address: evm }
    expect(WalletInput.safeParse(base).success).toBe(true)
    expect(WalletInput.safeParse({ ...base, ens: 'galeria.bruno' }).success).toBe(true)
    expect(WalletInput.safeParse({ ...base, ens: 'Com Espaço' }).success).toBe(false)
    expect(firstError(WalletInput.safeParse({ ...base, network: 'solana' }))?.[0]).toMatch(/^address: Endereço Solana inválido/)
    expect(WalletInput.safeParse({ ...base, network: 'bitcoin' }).success).toBe(false)
  })
})

test.describe('busca das rotas de login/cadastro', () => {
  test('redirect só aceita caminhos internos; motivo desconhecido é descartado', () => {
    expect(AuthSearch.parse({ redirect: '/perfil?x=1', motivo: 'expirada' })).toEqual({ redirect: '/perfil?x=1', motivo: 'expirada' })
    expect(AuthSearch.parse({ redirect: '//evil.example', motivo: 'hack' })).toEqual({ redirect: undefined, motivo: undefined })
    expect(AuthSearch.parse({ redirect: 'https://evil.example' }).redirect).toBeUndefined()
  })

  test('rotas privadas não são destino ao fechar o login', () => {
    expect(isProtectedPath('/perfil')).toBe(true)
    expect(isProtectedPath('/perfil/carteiras?x=1')).toBe(true)
    expect(isProtectedPath('/favoritos')).toBe(true)
    expect(isProtectedPath('/perfilx')).toBe(false)
    expect(isProtectedPath('/nft/nft-001')).toBe(false)
    expect(isProtectedPath('/')).toBe(false)
  })
})
