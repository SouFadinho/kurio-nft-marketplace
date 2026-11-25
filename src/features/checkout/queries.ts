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
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, http } from '@/api/http'
import { queryKeys } from '@/api/queryKeys'
import { Order, WalletConnection, type CheckoutRequest, type Network, type WalletType } from '@/api/contracts'
import { useClientSession } from '@/features/auth/queries'

/** Timeout do envio do pedido (o cenário `order-timeout` responde depois disso). */
export const ORDER_CREATE_TIMEOUT_MS = 5_000

/**
 * Tentativa de compra em andamento, POR USUÁRIO e em localStorage (CP7): sobrevive a refresh e ao
 * fechamento da aba. Só sai daqui quando o desfecho é conhecido (pedido criado ou recusa
 * definitiva da API). Ao voltar ao pagamento, `useRecoverAttempt` consulta o pedido pela chave.
 */
const attemptKey = (userId: string) => `kurio:checkout-attempt:${userId}`
type StoredAttempt = { key: string; payload: string }

export function readAttempt(userId: string): StoredAttempt | null {
  try {
    return JSON.parse(localStorage.getItem(attemptKey(userId)) ?? 'null') as StoredAttempt | null
  } catch {
    return null
  }
}

/** Chave de idempotência da tentativa: mesma para o mesmo conteúdo, nova para conteúdo novo. */
export function idempotencyKeyFor(userId: string, body: CheckoutRequest): string {
  const payload = JSON.stringify(body)
  const stored = readAttempt(userId)
  if (stored && stored.payload === payload) return stored.key
  const key = crypto.randomUUID()
  localStorage.setItem(attemptKey(userId), JSON.stringify({ key, payload }))
  return key
}

export const clearAttempt = (userId: string) => localStorage.removeItem(attemptKey(userId))

/**
 * Recuperação segura (CP7): havendo uma tentativa sem desfecho conhecido, consulta a API pela
 * chave (GET /orders/by-key/:key, NÃO cria nada). Se o pedido existe, devolve-o; se não existe,
 * a tentativa é descartada (nada foi gravado) e a pessoa decide de novo.
 *
 * Só a tentativa que já existia AO ENTRAR na página é procurada (estado inicial). Uma tentativa
 * criada agora por esta mesma página (envio em andamento) nunca é consultada nem apagada aqui:
 * a consulta chegaria antes da gravação, receberia 404 e descartaria a chave (defeito do CP7).
 */
export function useRecoverAttempt(userId: string) {
  const [stored] = useState(() => readAttempt(userId))
  return useQuery({
    queryKey: [...queryKeys.me.all(userId), 'attempt', stored?.key ?? 'none'],
    enabled: !!stored,
    retry: false,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      try {
        return Order.parse((await http.get(`/orders/by-key/${encodeURIComponent(stored!.key)}`, { signal })).data)
      } catch (error) {
        if (error instanceof ApiError && error.code === 'NOT_FOUND') {
          // Só apaga se ainda for a mesma tentativa (nunca uma mais nova).
          if (readAttempt(userId)?.key === stored!.key) clearAttempt(userId)
          return null
        }
        throw error
      }
    },
  })
}

export function useCreateCheckoutOrder() {
  const qc = useQueryClient()
  const session = useClientSession()
  return useMutation({
    scope: { id: 'checkout' },
    mutationFn: async (body: CheckoutRequest) =>
      Order.parse(
        (
          await http.post('/orders', body, {
            headers: { 'Idempotency-Key': idempotencyKeyFor(session!.userId, body) },
            timeout: ORDER_CREATE_TIMEOUT_MS,
            kurioIntent: { kind: 'checkout', path: '/pagamento' },
          })
        ).data,
      ),
    onSuccess: (order) => {
      if (!session) return
      clearAttempt(session.userId)
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
