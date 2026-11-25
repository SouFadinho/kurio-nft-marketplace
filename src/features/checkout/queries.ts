/**
 * Checkout (PAY-01..04): conexão simulada de carteira e criação idempotente do pedido.
 *
 * Idempotência (API-03 / PEND-01 / PEND-02):
 * - Cada TENTATIVA de compra tem uma chave (UUID) ligada ao conteúdo exato do pedido. A chave
 *   fica em sessionStorage: um retry depois de timeout ou erro de rede (mesmo conteúdo) reusa
 *   a chave e recebe o MESMO pedido; mudar o conteúdo (ex.: nova cotação) gera chave nova.
 * - Clique repetido: o botão trava durante o envio e, mesmo que duas requisições saiam, a
 *   chave é a mesma (a API devolve o mesmo pedido).
 * - A requisição carrega a intenção 'checkout': se a sessão expirar, o login volta para
 *   /pagamento (o rascunho é restaurado). A compra NUNCA é reenviada sozinha.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { http } from '@/api/http'
import { queryKeys } from '@/api/queryKeys'
import { Order, WalletConnection, type CheckoutRequest, type Network, type WalletType } from '@/api/contracts'
import { useClientSession } from '@/features/auth/queries'

/** Timeout do envio do pedido (o cenário `order-timeout` responde depois disso). */
export const ORDER_CREATE_TIMEOUT_MS = 5_000

const ATTEMPT_KEY = 'kurio:checkout-attempt'

/** Chave de idempotência da tentativa: mesma para o mesmo conteúdo, nova para conteúdo novo. */
export function idempotencyKeyFor(body: CheckoutRequest): string {
  const payload = JSON.stringify(body)
  try {
    const stored = JSON.parse(sessionStorage.getItem(ATTEMPT_KEY) ?? 'null') as { key: string; payload: string } | null
    if (stored && stored.payload === payload) return stored.key
  } catch {
    // Valor corrompido: começa uma tentativa nova.
  }
  const key = crypto.randomUUID()
  sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify({ key, payload }))
  return key
}

export const clearAttempt = () => sessionStorage.removeItem(ATTEMPT_KEY)

export function useCreateCheckoutOrder() {
  const qc = useQueryClient()
  const session = useClientSession()
  return useMutation({
    scope: { id: 'checkout' },
    mutationFn: async (body: CheckoutRequest) =>
      Order.parse(
        (
          await http.post('/orders', body, {
            headers: { 'Idempotency-Key': idempotencyKeyFor(body) },
            timeout: ORDER_CREATE_TIMEOUT_MS,
            kurioIntent: { kind: 'checkout', path: '/pagamento' },
          })
        ).data,
      ),
    onSuccess: (order) => {
      clearAttempt()
      if (!session) return
      qc.setQueryData(queryKeys.me.order(session.userId, order.id), order)
      // O pedido reservou estoque (as linhas podem mudar de disponibilidade); os itens só saem
      // do carrinho na confirmação (PAY-07).
      void qc.invalidateQueries({ queryKey: queryKeys.me.cart(session.userId) })
    },
  })
}

export function useConnectWallet() {
  return useMutation({
    mutationFn: async (input: { provider: WalletType; network: Network; address: string }) =>
      WalletConnection.parse((await http.post('/wallet-connections', input)).data),
  })
}

export function useDisconnectWallet() {
  return useMutation({
    mutationFn: async (id: string) => {
      await http.delete(`/wallet-connections/${encodeURIComponent(id)}`)
    },
  })
}

// ---------- Rascunho do formulário (sobrevive a expiração de sessão e falhas) ----------
export interface CheckoutDraft {
  displayName: string
  email: string
  note: string
  /** 'saved:<walletId>' ou 'external'. */
  wallet: string
  external: { network: Network; type: WalletType; address: string }
  network: Network
}

const draftKey = (userId: string) => `kurio:checkout-draft:${userId}`

export function loadDraft(userId: string): Partial<CheckoutDraft> | null {
  try {
    return JSON.parse(sessionStorage.getItem(draftKey(userId)) ?? 'null') as Partial<CheckoutDraft> | null
  } catch {
    return null
  }
}

export const saveDraft = (userId: string, draft: CheckoutDraft) => sessionStorage.setItem(draftKey(userId), JSON.stringify(draft))
export const clearDraft = (userId: string) => sessionStorage.removeItem(draftKey(userId))
