/**
 * Intenção pendente: a ação que a pessoa tentou fazer sem sessão (ou quando a sessão
 * expirou) e que deve ser retomada depois do login (ACC-04).
 *
 * - Guardada em sessionStorage (sobrevive ao redirecionamento e a um refresh na tela de login).
 * - Expira em 15 minutos (não retoma ações antigas por surpresa).
 * - `checkout` está preparado para o CP5 (retomar a compra após expiração no pagamento).
 */
const KEY = 'kurio:pending-intent'
const TTL_MS = 15 * 60_000

export type PendingIntent =
  | { kind: 'favorite'; nftId: string; name: string; next: boolean; createdAt: number }
  | { kind: 'checkout'; path: string; createdAt: number }

export type NewIntent = PendingIntent extends infer T ? (T extends PendingIntent ? Omit<T, 'createdAt'> : never) : never

export function saveIntent(intent: NewIntent) {
  sessionStorage.setItem(KEY, JSON.stringify({ ...intent, createdAt: Date.now() }))
}

export function peekIntent(): PendingIntent | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const intent = JSON.parse(raw) as PendingIntent
    if (Date.now() - intent.createdAt > TTL_MS) {
      clearIntent()
      return null
    }
    return intent
  } catch {
    clearIntent()
    return null
  }
}

export function clearIntent() {
  sessionStorage.removeItem(KEY)
}
