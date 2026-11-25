/**
 * Identidade do carrinho de VISITANTE: um id aleatório (não adivinhável) guardado em
 * localStorage. O carrinho em si fica na API simulada; o id só diz qual é.
 *
 * - Criado sob demanda (primeira adição).
 * - Depois do login, o carrinho de visitante é mesclado no do usuário e o id é descartado:
 *   ao sair, um visitante começa com um carrinho novo e vazio (nada do usuário anterior).
 */
const KEY = 'kurio:guest-cart'
type Listener = () => void
const listeners = new Set<Listener>()

function read(): string | null {
  try {
    const value = localStorage.getItem(KEY)
    return value && /^[A-Za-z0-9-]{8,64}$/.test(value) ? value : null
  } catch {
    return null
  }
}

let current = read()

export const guestCart = {
  /** Id atual, sem criar. */
  peek: () => current,
  /** Id atual; cria um novo se não houver. */
  ensure(): string {
    if (!current) {
      current = crypto.randomUUID()
      localStorage.setItem(KEY, current)
      for (const l of listeners) l()
    }
    return current
  },
  clear() {
    if (!current) return
    current = null
    localStorage.removeItem(KEY)
    for (const l of listeners) l()
  },
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
