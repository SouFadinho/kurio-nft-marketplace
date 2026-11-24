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

/**
 * Último `nft.updated` aplicado por NFT. Uma resposta REST que já estava em trânsito quando o
 * evento chegou pode gravar dados ANTIGOS depois do evento (o cache ainda estava vazio, então
 * o guard não tinha o que proteger). `reapplyNewerNftEvents` corrige isso: qualquer NFT em
 * cache com versão menor que a do último evento volta ao estado do evento (estado monotônico).
 */
export type LatestNftEvents = Map<string, NftUpdatedEvent>

export function applyNftUpdated(qc: QueryClient, guard: EventGuard, event: NftUpdatedEvent, latest?: LatestNftEvents): GuardDecision {
  const id = event.resource.id
  const decision = guard.decide(event, cachedNftVersion(qc, id))
  if (decision !== 'apply') return decision
  latest?.set(id, event)
  patchNft(qc, event)
  // O item é atualizado no lugar. Filtros e ordenação dependentes do preço passam a valer na
  // próxima consulta: as listas são só marcadas como desatualizadas (sem refetch imediato,
  // para não reordenar a grade sob o cursor do usuário).
  void qc.invalidateQueries({ queryKey: queryKeys.nfts.lists, refetchType: 'none' })
  return 'apply'
}

/** Corrige NFTs em cache que estejam mais antigos que o último evento conhecido. */
export function reapplyNewerNftEvents(qc: QueryClient, latest: LatestNftEvents) {
  for (const event of latest.values()) {
    if (cachedMinNftVersion(qc, event.resource.id) < event.version) patchNft(qc, event)
  }
}

/** Menor versão do NFT entre os caches que o contêm (Infinity se não está em cache). */
function cachedMinNftVersion(qc: QueryClient, id: string) {
  let version = Infinity
  const detail = qc.getQueryData<NftDetail>(queryKeys.nfts.detail(id))
  if (detail) version = Math.min(version, detail.version)
  for (const [, list] of qc.getQueriesData<NftList>({ queryKey: queryKeys.nfts.lists })) {
    const found = list?.items.find((n) => n.id === id)
    if (found) version = Math.min(version, found.version)
  }
  return version
}

function patchNft(qc: QueryClient, event: NftUpdatedEvent) {
  const id = event.resource.id
  const { price, available, editions } = event.data
  // Só avança: nunca troca uma versão mais nova (vinda do REST) por uma mais antiga.
  const patch = <T extends Nft>(nft: T): T => (nft.id === id && nft.version < event.version ? { ...nft, price, available, version: event.version } : nft)

  qc.setQueryData<NftDetail>(queryKeys.nfts.detail(id), (old) =>
    old && old.version < event.version
      ? {
          ...patch(old),
          editions: old.editions.map((e) => ({ ...e, available: editions.find((x) => x.id === e.id)?.available ?? e.available })),
        }
      : old,
  )
  qc.setQueriesData<NftList>({ queryKey: queryKeys.nfts.lists }, (old) => (old?.items.some((n) => n.id === id && n.version < event.version) ? { ...old, items: old.items.map(patch) } : old))
  // Só grava quando há de fato um item mais antigo: cada setQueryData notifica o cache, e
  // gravar sem mudança alimentaria a reaplicação em loop (defeito do CP3: estouro de pilha).
  const stale = (n: Nft) => n.id === id && n.version < event.version
  qc.setQueryData<Highlights>(queryKeys.nfts.highlights, (old) =>
    old && (old.hero.some(stale) || stale(old.limitedOffer)) ? { hero: old.hero.map(patch), limitedOffer: patch(old.limitedOffer) } : old,
  )
  qc.setQueriesData<FavoriteList>({ predicate: (q) => q.queryKey[0] === 'me' && q.queryKey[2] === 'favorites' }, (old) =>
    old?.items.some(stale) ? { ...old, items: old.items.map(patch) } : old,
  )
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
