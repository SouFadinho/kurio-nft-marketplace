/**
 * Armazenamento mínimo da sessão no cliente.
 *
 * - O token fica em memória, espelhado em sessionStorage para sobreviver a refresh (ACC-03).
 *   Limitação documentada: em produção real seria um cookie httpOnly; aqui toda a API é
 *   simulada. sessionStorage é por aba: abrir uma aba nova pede login de novo.
 * - `epoch` aumenta a cada troca de sessão (login, logout, expiração, troca de usuário).
 *   Código assíncrono iniciado na sessão anterior (respostas atrasadas, eventos) detecta que
 *   ficou obsoleto comparando a época (ELIM-04).
 * - `endReason` diz por que a última sessão terminou: o login mostra "sua sessão expirou".
 */
import type { SessionResponse } from '@/api/contracts'

const STORAGE_KEY = 'kurio:session'

export interface ClientSession {
  token: string
  userId: string
  expiresAt: string
}

export type EndReason = 'logout' | 'expired' | null

type Listener = () => void

let current: ClientSession | null = readStorage()
let epoch = 0
let endReason: EndReason = null
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

function end(reason: Exclude<EndReason, null>) {
  if (!current) return
  current = null
  endReason = reason
  sessionStorage.removeItem(STORAGE_KEY)
  emit()
}

export const sessionStore = {
  get: () => current,
  getEpoch: () => epoch,
  getEndReason: () => endReason,
  set(res: SessionResponse) {
    current = { token: res.token, userId: res.user.id, expiresAt: res.expiresAt }
    endReason = null
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current))
    emit()
  },
  /** Logout voluntário. */
  clear: () => end('logout'),
  /** A API recusou o token (expirado ou inválido). */
  expire: () => end('expired'),
  /** O aviso de expiração já foi exibido. */
  acknowledgeEnd() {
    endReason = null
  },
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
