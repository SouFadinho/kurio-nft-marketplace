import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/api/http'
import { queryKeys } from '@/api/queryKeys'
import { Order, type CreateOrderRequest } from '@/api/contracts'
import { useClientSession } from '@/features/auth/queries'

export function useOrder(orderId: string) {
  const session = useClientSession()
  const userId = session?.userId ?? 'anonymous'
  return useQuery({
    queryKey: queryKeys.me.order(userId, orderId),
    enabled: !!session,
    queryFn: async ({ signal }) => Order.parse((await http.get(`/orders/${encodeURIComponent(orderId)}`, { signal })).data),
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.me.orders(session.userId) })
    },
  })
}
