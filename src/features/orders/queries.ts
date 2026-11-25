import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/api/http'
import { queryKeys } from '@/api/queryKeys'
import { ExplorerTx, Order, OrderList, type CreateOrderRequest } from '@/api/contracts'
import { useClientSession } from '@/features/auth/queries'

export function useOrder(orderId: string) {
  const session = useClientSession()
  const queryClient = useQueryClient()
  const userId = session?.userId ?? 'anonymous'
  const key = queryKeys.me.order(userId, orderId)
  return useQuery({
    queryKey: key,
    enabled: !!session,
    queryFn: async ({ signal }) => {
      const fresh = Order.parse((await http.get(`/orders/${encodeURIComponent(orderId)}`, { signal })).data)
      // Monotônico (como os NFTs no CP3): uma leitura REST que já estava em trânsito quando o
      // `order.updated` chegou traz uma versão ANTERIOR e não pode desfazer o evento (ex.: voltar
      // de "recusado" para "pendente"). Mantém a versão mais nova do cache.
      const cached = queryClient.getQueryData<Order>(key)
      return cached && cached.version > fresh.version ? cached : fresh
    },
    // Sem polling: o estado chega por order.updated (Socket.IO) e é reconciliado via REST
    // na reconexão. Isso deixa claro, nos testes, que a atualização veio do socket.
    refetchOnWindowFocus: false,
  })
}

/**
 * Criação idempotente (API-03 / PAY-04).
 * A chave é gerada pelo chamador uma vez por tentativa de compra e reutilizada em retries.
 */
export function useCreateOrder() {
  const queryClient = useQueryClient()
  const session = useClientSession()
  return useMutation({
    mutationFn: async ({ body, idempotencyKey }: { body: CreateOrderRequest; idempotencyKey: string }) =>
      Order.parse((await http.post('/orders', body, { headers: { 'Idempotency-Key': idempotencyKey } })).data),
    onSuccess: (order) => {
      if (!session) return
      queryClient.setQueryData(queryKeys.me.order(session.userId, order.id), order)
      // exact: a lista; sem prefixo, para não refazer a leitura do pedido recém-gravado no cache.
      void queryClient.invalidateQueries({ queryKey: queryKeys.me.orders(session.userId), exact: true })
    },
  })
}

/** Histórico de pedidos do usuário (mais recentes primeiro; ordem dada pela API). */
export function useOrders() {
  const session = useClientSession()
  return useQuery({
    queryKey: queryKeys.me.orders(session?.userId ?? 'anonymous'),
    enabled: !!session,
    queryFn: async ({ signal }) => OrderList.parse((await http.get('/orders', { signal })).data).items,
  })
}

/** Explorador SIMULADO: dados públicos de uma transação confirmada (demonstração). */
export function useExplorerTx(hash: string) {
  return useQuery({
    queryKey: ['explorer', hash],
    queryFn: async ({ signal }) => ExplorerTx.parse((await http.get(`/explorer/tx/${encodeURIComponent(hash)}`, { signal })).data),
    staleTime: Infinity,
  })
}
