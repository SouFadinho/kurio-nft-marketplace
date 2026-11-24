/**
 * Contadores observáveis do canal de tempo real.
 * Servem para a UI (indicador de conexão) e como evidência nos testes E2E:
 * mostram o que o CLIENTE Socket.IO recebeu e decidiu, sem acessar o mock.
 */
export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected'

export interface RealtimeDiagnostics {
  state: ConnectionState
  userId: string | null
  connects: number
  reconnections: number
  reconciliations: number
  received: number
  applied: number
  duplicates: number
  stale: number
  foreign: number
  authErrors: number
  lastEvent: string | null
}

const initial: RealtimeDiagnostics = {
  state: 'idle',
  userId: null,
  connects: 0,
  reconnections: 0,
  reconciliations: 0,
  received: 0,
  applied: 0,
  duplicates: 0,
  stale: 0,
  foreign: 0,
  authErrors: 0,
  lastEvent: null,
}

let snapshot: RealtimeDiagnostics = initial
const listeners = new Set<() => void>()

export const diagnostics = {
  get: () => snapshot,
  update(patch: Partial<RealtimeDiagnostics> | ((d: RealtimeDiagnostics) => Partial<RealtimeDiagnostics>)) {
    snapshot = { ...snapshot, ...(typeof patch === 'function' ? patch(snapshot) : patch) }
    for (const l of listeners) l()
  },
  reset(userId: string | null) {
    snapshot = { ...initial, userId }
    for (const l of listeners) l()
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}
