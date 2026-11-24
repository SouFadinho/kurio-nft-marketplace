/**
 * Armazenamento mínimo da sessão no cliente.
 *
 * - O token fica em memória, espelhado em sessionStorage para sobreviver a refresh (ACC-03).
 *   Limitação documentada: em produção real seria um cookie httpOnly; aqui toda a API é simulada.
 * - `epoch` aumenta a cada troca de sessão. Assim, código assíncrono iniciado na sessão
 *   anterior (respostas atrasadas, eventos) consegue detectar que ficou obsoleto (ELIM-04).
 */
import type { SessionResponse } from '@/api/contracts'

const STORAGE_KEY = 'kurio:session'

export interface ClientSession {
  token: string
  userId: string
  expiresAt: string
}

type Listener = () => void

let current: ClientSession | null = readStorage()
let epoch = 0
const listeners = new Set<Listener>()

function readStorage(): ClientSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ClientSession>
    if (typeof parsed.token === 'string' && typeof parsed.userId === 'string' && typeof parsed.expiresAt === 'string') {
      return { token: parsed.token, userId: parsed.userId, expiresAt: parsed.expiresAt }
    }
  } catch {
    // Dados corrompidos: tratar como sem sessão.
  }
  sessionStorage.removeItem(STORAGE_KEY)
  return null
}

function emit() {
  epoch += 1
  for (const l of listeners) l()
}

export const sessionStore = {
  get: () => current,
  getEpoch: () => epoch,
  set(res: SessionResponse) {
    current = { token: res.token, userId: res.user.id, expiresAt: res.expiresAt }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current))
    emit()
  },
  clear() {
    if (!current) return
    current = null
    sessionStorage.removeItem(STORAGE_KEY)
    emit()
  },
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
