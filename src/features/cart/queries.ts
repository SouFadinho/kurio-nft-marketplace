/**
 * Carrinho e cotação (CART-01..05): UI → TanStack Query → Axios → MSW.
 *
 * - Dono: usuário autenticado (cache em ['me', userId, 'cart'], limpo em toda troca de sessão)
 *   ou visitante (['guest', id, 'cart'], com o id no header `X-Cart-Id`).
 * - Mutações NÃO são otimistas: a API valida estoque e devolve o carrinho inteiro, que
 *   substitui o cache. Mutações em sequência (escopo 'cart'), sem corrida entre si.
 * - A cotação (subtotal, desconto, taxa, total) vem SEMPRE da API. A chave inclui uma
 *   assinatura do carrinho (versão, preços, quantidades, estoque, cupom): qualquer mudança,
 *   inclusive por `nft.updated`, gera uma cotação nova. O cliente nunca soma valores.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { http, ApiError } from '@/api/http'
import { queryKeys, quoteKey } from '@/api/queryKeys'
import { Cart, MergeCartResponse, Quote, type AddCartItem, type Network } from '@/api/contracts'
import { useClientSession } from '@/features/auth/queries'
import { guestCart } from './guestCart'

export const EMPTY_CART: Cart = { owner: 'guest', version: 0, lines: [], coupon: null }

/** Dono atual do carrinho e a chave de cache correspondente. */
export function useCartOwner() {
  const session = useClientSession()
  const guestId = useSyncExternalStore(guestCart.subscribe, guestCart.peek)
  if (session) return { kind: 'user' as const, key: queryKeys.me.cart(session.userId), guestId: null }
  return { kind: 'guest' as const, key: guestId ? queryKeys.guest.cart(guestId) : null, guestId }
}

/** Headers do dono: o token vai pelo interceptor; o visitante se identifica pelo id. */
function ownerHeaders(kind: 'user' | 'guest', create: boolean) {
  if (kind === 'user') return undefined
  const id = create ? guestCart.ensure() : guestCart.peek()
  return id ? { 'X-Cart-Id': id } : undefined
}

export function useCart() {
  const owner = useCartOwner()
  const qc = useQueryClient()
  const key = owner.key ?? ['guest', 'none', 'cart']
  const query = useQuery({
    queryKey: key,
    enabled: owner.key !== null,
    queryFn: async ({ signal }) => {
      const fresh = Cart.parse((await http.get('/cart', { signal, headers: ownerHeaders(owner.kind, false) })).data)
      // Monotônico pela versão do carrinho: uma leitura que saiu ANTES de uma escrita (ex.: a
      // primeira adição do visitante cria o id, habilita esta consulta e dispara o POST junto)
      // não pode sobrescrever o carrinho mais novo que a escrita já gravou no cache.
      const cached = qc.getQueryData<Cart>(key)
      return cached && cached.version > fresh.version ? cached : fresh
    },
  })
  // Visitante que nunca adicionou nada: carrinho vazio, sem requisição.
  return owner.key === null ? { ...query, data: EMPTY_CART, isPending: false as const, isError: false as const } : query
}

/** Quantidade total de itens (badge do header e da navegação inferior). */
export function useCartCount() {
  const { data } = useCart()
  return data?.lines.reduce((sum, l) => sum + l.quantity, 0) ?? 0
}

/** Escrita no carrinho: devolve o carrinho da API e grava no cache do dono. */
function useCartWrite<TInput>(request: (input: TInput, headers: Record<string, string> | undefined) => Promise<unknown>) {
  const qc = useQueryClient()
  const session = useClientSession()
  return useMutation({
    scope: { id: 'cart' },
    mutationFn: async (input: TInput) => {
      const kind = session ? 'user' : 'guest'
      const headers = ownerHeaders(kind, true)
      const cart = Cart.parse(await request(input, headers))
      const key = session ? queryKeys.me.cart(session.userId) : queryKeys.guest.cart(guestCart.ensure())
      return { cart, key }
    },
    onSuccess: async ({ cart, key }) => {
      // Leituras em trânsito são canceladas antes de gravar o resultado da escrita.
      await qc.cancelQueries({ queryKey: key, exact: true })
      qc.setQueryData(key, cart)
    },
    onError: (error) => {
      // Estoque mudou (409) ou item sumiu (404): mostra o estado atual do servidor.
      if (error instanceof ApiError && (error.code === 'OUT_OF_STOCK' || error.code === 'NOT_FOUND')) {
        void qc.invalidateQueries({ queryKey: session ? queryKeys.me.cart(session.userId) : queryKeys.guest.all })
      }
    },
  })
}

export type AddToCartInput = AddCartItem & { name: string }

export function useAddToCart() {
  return useCartWrite<AddToCartInput>(async ({ nftId, editionId, quantity }, headers) => (await http.post('/cart/items', { nftId, editionId, quantity }, { headers })).data)
}

export function useUpdateCartLine() {
  return useCartWrite<{ lineId: string; quantity: number; name: string }>(
    async ({ lineId, quantity }, headers) => (await http.patch(`/cart/items/${encodeURIComponent(lineId)}`, { quantity }, { headers })).data,
  )
}

export function useRemoveCartLine() {
  return useCartWrite<{ lineId: string; name: string }>(async ({ lineId }, headers) => (await http.delete(`/cart/items/${encodeURIComponent(lineId)}`, { headers })).data)
}

export function useApplyCoupon() {
  return useCartWrite<string>(async (code, headers) => (await http.post('/cart/coupon', { code }, { headers })).data)
}

export function useRemoveCoupon() {
  return useCartWrite<void>(async (_v, headers) => (await http.delete('/cart/coupon', { headers })).data)
}

/** Assinatura do que afeta a cotação: muda = cotação nova. */
export function cartSignature(cart: Cart) {
  return [cart.version, cart.coupon?.code ?? '', ...cart.lines.map((l) => `${l.id}:${l.unitPrice}:${l.quantity}:${l.available}`)].join('|')
}

export const cartHasIssues = (cart: Cart) => cart.lines.some((l) => l.issue !== null)

export function useQuote(network: Network, cart: Cart | undefined) {
  const owner = useCartOwner()
  const enabled = !!owner.key && !!cart && cart.lines.length > 0 && !cartHasIssues(cart)
  return useQuery({
    queryKey: quoteKey(owner.key ?? ['guest', 'none', 'cart'], network, cart ? cartSignature(cart) : ''),
    enabled,
    queryFn: async ({ signal }) => Quote.parse((await http.post('/cart/quote', { network }, { signal, headers: ownerHeaders(owner.kind, false) })).data),
    // A cotação só muda quando o carrinho (a assinatura) muda; a validade é conferida pela API no pedido.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: (count, error) => !(error instanceof ApiError && error.status !== null && error.status < 500) && count < 2,
  })
}

/**
 * Merge do carrinho de visitante após o login (chamado pelo SessionEffects).
 * Regra determinística no servidor (somar, limitar ao estoque, cupom do usuário prevalece).
 */
export function useMergeGuestCart() {
  const qc = useQueryClient()
  return useMutation({
    scope: { id: 'cart' },
    mutationFn: async ({ guestCartId }: { guestCartId: string; userId: string }) => MergeCartResponse.parse((await http.post('/cart/merge', { guestCartId })).data),
    onSuccess: (result, { userId }) => {
      guestCart.clear()
      qc.removeQueries({ queryKey: queryKeys.guest.all })
      qc.setQueryData(queryKeys.me.cart(userId), result.cart)
      void qc.invalidateQueries({ queryKey: queryKeys.me.cart(userId) })
      if (result.merged > 0) {
        toast.success('Carrinho atualizado', {
          description:
            result.adjusted.length > 0
              ? `Itens do visitante foram somados ao seu carrinho. Ajustados pelo estoque: ${result.adjusted.map((a) => `${a.name} (${a.kept} de ${a.requested})`).join(', ')}.`
              : 'Os itens que você escolheu antes de entrar foram somados ao seu carrinho.',
        })
      }
    },
  })
}
