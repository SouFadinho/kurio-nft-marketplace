/**
 * Aplica eventos recebidos PELO CLIENTE Socket.IO ao cache do TanStack Query.
 * Este é o único ponto onde eventos tocam o cache (INT-06). A origem do evento é
 * sempre o socket; nada aqui fabrica eventos.
 */
import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/queryKeys'
import { TERMINAL_ORDER_STATUSES, type Nft, type NftList, type NftUpdatedEvent, type Order, type OrderUpdatedEvent } from '@/api/contracts'
import type { EventGuard, GuardDecision } from './eventGuard'

export function applyNftUpdated(qc: QueryClient, guard: EventGuard, event: NftUpdatedEvent): GuardDecision {
  const detail = qc.getQueryData<Nft>(queryKeys.nfts.detail(event.resource.id))
  const inList = qc.getQueryData<NftList>(queryKeys.nfts.list())?.items.find((n) => n.id === event.resource.id)
  const cachedVersion = Math.max(detail?.version ?? 0, inList?.version ?? 0)

  const decision = guard.decide(event, cachedVersion)
  if (decision !== 'apply') return decision

  const patch = (nft: Nft): Nft => ({ ...nft, ...event.data, version: event.version })
  qc.setQueryData<Nft>(queryKeys.nfts.detail(event.resource.id), (old) => (old ? patch(old) : old))
  qc.setQueryData<NftList>(queryKeys.nfts.list(), (old) =>
    old ? { ...old, items: old.items.map((n) => (n.id === event.resource.id ? patch(n) : n)) } : old,
  )
  return 'apply'
}

export function applyOrderUpdated(qc: QueryClient, guard: EventGuard, userId: string, event: OrderUpdatedEvent): GuardDecision {
  const key = queryKeys.me.order(userId, event.resource.id)
  const cached = qc.getQueryData<Order>(key)

  // Estados terminais nunca são sobrescritos, mesmo com versão maior (RT-09).
  if (cached && TERMINAL_ORDER_STATUSES.includes(cached.status)) {
    return guard.decide(event, Number.MAX_SAFE_INTEGER)
  }

  const decision = guard.decide(event, cached?.version)
  if (decision !== 'apply') return decision

  if (cached) {
    qc.setQueryData<Order>(key, { ...cached, status: event.data.status, txHash: event.data.txHash, version: event.version })
  } else {
    // Pedido ainda não está no cache: buscar o estado completo pelo REST.
    void qc.invalidateQueries({ queryKey: key })
  }
  void qc.invalidateQueries({ queryKey: queryKeys.me.orders(userId), exact: true })
  return 'apply'
}
