/**
 * Aplica eventos recebidos PELO CLIENTE Socket.IO ao cache do TanStack Query.
 * Este é o único ponto onde eventos tocam o cache (INT-06). A origem do evento é sempre o
 * socket; nada aqui fabrica eventos.
 */
import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/queryKeys'
import {
  TERMINAL_ORDER_STATUSES,
  type FavoriteList,
  type Highlights,
  type Nft,
  type NftDetail,
  type NftList,
  type NftUpdatedEvent,
  type Order,
  type OrderUpdatedEvent,
} from '@/api/contracts'
import type { EventGuard, GuardDecision } from './eventGuard'

/** Maior versão do NFT conhecida em QUALQUER cache (detalhe, listas, destaques, favoritos). */
function cachedNftVersion(qc: QueryClient, id: string) {
  let version = qc.getQueryData<NftDetail>(queryKeys.nfts.detail(id))?.version ?? 0
  for (const [, list] of qc.getQueriesData<NftList>({ queryKey: queryKeys.nfts.lists })) {
    const found = list?.items.find((n) => n.id === id)
    if (found) version = Math.max(version, found.version)
  }
  return version
}

export function applyNftUpdated(qc: QueryClient, guard: EventGuard, event: NftUpdatedEvent): GuardDecision {
  const id = event.resource.id
  const decision = guard.decide(event, cachedNftVersion(qc, id))
  if (decision !== 'apply') return decision

  const { price, available, editions } = event.data
  const patch = <T extends Nft>(nft: T): T => (nft.id === id ? { ...nft, price, available, version: event.version } : nft)

  qc.setQueryData<NftDetail>(queryKeys.nfts.detail(id), (old) =>
    old
      ? {
          ...patch(old),
          editions: old.editions.map((e) => ({ ...e, available: editions.find((x) => x.id === e.id)?.available ?? e.available })),
        }
      : old,
  )
  qc.setQueriesData<NftList>({ queryKey: queryKeys.nfts.lists }, (old) => (old ? { ...old, items: old.items.map(patch) } : old))
  qc.setQueryData<Highlights>(queryKeys.nfts.highlights, (old) => (old ? { hero: old.hero.map(patch), limitedOffer: patch(old.limitedOffer) } : old))
  qc.setQueriesData<FavoriteList>({ predicate: (q) => q.queryKey[0] === 'me' && q.queryKey[2] === 'favorites' }, (old) =>
    old ? { ...old, items: old.items.map(patch) } : old,
  )
  // O item é atualizado no lugar. Filtros e ordenação dependentes do preço passam a valer na
  // próxima consulta: as listas são só marcadas como desatualizadas (sem refetch imediato,
  // para não reordenar a grade sob o cursor do usuário).
  void qc.invalidateQueries({ queryKey: queryKeys.nfts.lists, refetchType: 'none' })
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
