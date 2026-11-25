/**
 * Notificações (toasts) com o sonner carregado sob demanda. CP9.2 (performance medida).
 *
 * Mesma API usada no app (`toast.success | info | error(mensagem, opções)`), mas o sonner (33 kB)
 * e o `Toaster` saem do carregamento inicial: nenhum toast aparece antes de uma ação do usuário ou
 * de um evento posterior à abertura da tela.
 *
 * Acessibilidade: o `Toaster` contém a região `aria-live` que anuncia as mensagens; ela precisa
 * existir ANTES da primeira mensagem. Por isso o App monta o Toaster na primeira interação
 * (ponteiro/teclado) ou após 4 s, o que vier primeiro (`useToasterRequested`), e um toast pedido
 * antes disso monta o Toaster primeiro e só então é exibido (`whenToasterMounted`).
 */
import { useSyncExternalStore } from 'react'
import type { ExternalToast } from 'sonner'

type SonnerModule = typeof import('sonner')
type Message = Parameters<SonnerModule['toast']['success']>[0]

let sonner: Promise<SonnerModule> | null = null
/** Baixa o sonner (uma vez). */
export const loadSonner = () => (sonner ??= import('sonner'))

let requested = false
const listeners = new Set<() => void>()
let resolveMounted!: () => void
const mounted = new Promise<void>((resolve) => {
  resolveMounted = resolve
})

/** Pede a montagem do Toaster (idempotente). */
export function requestToaster() {
  if (requested) return
  requested = true
  void loadSonner()
  for (const listener of listeners) listener()
}

/** O App monta o Toaster quando isto vira `true`. */
export function useToasterRequested() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => requested,
  )
}

/** Chamado pelo Toaster depois de montado (a região aria-live já existe e o sonner já assina). */
export const markToasterMounted = () => resolveMounted()

function show(kind: 'success' | 'info' | 'error') {
  return (message: Message, options?: ExternalToast) => {
    requestToaster()
    void Promise.all([loadSonner(), mounted]).then(([{ toast }]) => toast[kind](message, options))
  }
}

export const toast = { success: show('success'), info: show('info'), error: show('error') }
