import { expect, test } from '@playwright/test'
import { hashPassword } from '../../src/mocks/crypto'
import { SEED_USERS } from '../../src/mocks/db'

// CP8: os hashes dos usuários fictícios foram calculados offline (sem PBKDF2 na inicialização).
// Este teste garante que eles continuam correspondendo às senhas documentadas no README.
const DOCUMENTED = { usr_ana: 'Kurio#Ana2026', usr_bruno: 'Kurio#Bruno2026' } as const

test('hashes do seed correspondem às senhas de demonstração (PBKDF2, salt por usuário)', async () => {
  for (const u of SEED_USERS) {
    expect(await hashPassword(DOCUMENTED[u.id], `salt-${u.id}`)).toBe(u.passwordHash)
    expect(JSON.stringify(u)).not.toContain(DOCUMENTED[u.id]) // senha em claro não está no código
  }
})
