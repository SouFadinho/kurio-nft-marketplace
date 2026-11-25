/**
 * Ciclo de vida do socket.io-client, amarrado à sessão.
 *
 * - Um socket por sessão: trocar de usuário (ou deslogar) destrói o socket anterior,
 *   remove todos os listeners (RT-07) e cria outro com o novo token no handshake.
 *   Eventos de uma sessão antiga não alcançam a nova (RT-06 / ELIM-04).
 * - Transporte apenas WebSocket: o MSW intercepta WebSocket, não o long-polling HTTP
 *   do Engine.IO (limitação documentada em TECHNICAL_ARCHITECTURE §3).
 * - Reconexão: o Manager do socket.io reconecta sozinho; a cada reconexão os recursos
 *   ativos são reconciliados pelo REST (RT-05).
 */
import { useEffect, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { io as ioFactory } from 'socket.io-client'
import { CartUpdatedEvent, NftUpdatedEvent, OrderUpdatedEvent, REALTIME_EVENTS } from '@/api/contracts'
import { queryKeys } from '@/api/queryKeys'
import { useClientSession } from '@/features/auth/queries'
import { EventGuard, type GuardDecision } from './eventGuard'
import { applyCartUpdated, applyNftUpdated, applyOrderUpdated, reapplyNewerNftEvents, type LatestNftEvents } from './applyEvent'
import { diagnostics } from './diagnostics'

type IoFactory = typeof ioFactory

function count(decision: GuardDecision, type: string) {
  diagnostics.update((d) => ({
    received: d.received + 1,
    applied: d.applied + (decision === 'apply' ? 1 : 0),
    duplicates: d.duplicates + (decision === 'duplicate' ? 1 : 0),
    stale: d.stale + (decision === 'stale' ? 1 : 0),
    lastEvent: `${type}:${decision}`,
  }))
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const session = useClientSession()
  const token = session?.token ?? null
  const userId = session?.userId ?? null

  useEffect(() => {
    const guard = new EventGuard()
    const latestNft: LatestNftEvents = new Map()
    // Resposta REST de NFT que chegou DEPOIS de um evento mais novo: reaplica o evento.
    // Guarda de reentrância: a própria reaplicação grava no cache e notificaria esta assinatura.
    let reapplying = false
    const unsubscribeCache = queryClient.getQueryCache().subscribe((e) => {
      if (reapplying || latestNft.size === 0 || e.type !== 'updated' || e.action.type !== 'success' || e.query.queryKey[0] !== 'nfts') return
      reapplying = true
      try {
        reapplyNewerNftEvents(queryClient, latestNft)
      } finally {
        reapplying = false
      }
    })
    diagnostics.reset(userId)
    diagnostics.update({ state: 'connecting' })

    const connect = (io: IoFactory) => {
    const socket = io(window.location.origin, {
      transports: ['websocket'],
      auth: token ? { token } : {},
      reconnectionDelay: 250,
      reconnectionDelayMax: 1_000,
      randomizationFactor: 0,
    })

    let connectedBefore = false

    /** Consultas cobertas pela reconciliação: catálogo/NFTs, dados do usuário e do visitante. */
    const reconcilable = (key: readonly unknown[]) => key[0] === 'nfts' || key[0] === 'guest' || (!!userId && key[0] === 'me' && key[1] === userId)

    /**
     * CP9.2: uma consulta na PRIMEIRA busca (sem dados) quando a reconciliação roda não é refeita
     * pelo `invalidateQueries` do TanStack Query v5: sem dados, o `cancelRefetch` não se aplica, a
     * chamada só se junta à requisição em andamento e o "invalidado" é limpo quando ela termina. Se
     * essa requisição começou antes de um evento perdido, o dado antigo ficaria. Estas consultas são
     * refeitas quando a busca em andamento termina. (Corrida exposta no CP9.2: catalog.spec ›
     * "evento emitido ANTES de o socket conectar".)
     */
    const refetchWhenSettled = (queries: ReturnType<ReturnType<typeof queryClient.getQueryCache>['getAll']>) => {
      if (queries.length === 0) return
      const cache = queryClient.getQueryCache()
      const unsubscribe = cache.subscribe(() => {
        if (queries.some((q) => q.state.fetchStatus === 'fetching')) return
        unsubscribe()
        // Em tempo ocioso (no máximo 2 s): a busca extra não disputa a thread com a renderização
        // do primeiro conteúdo (medido no A/B do CP9.2). A convergência continua garantida.
        const run = () => {
          // Só as que terminaram com SUCESSO podem ter trazido dado antigo. Uma busca que terminou
          // em erro não tem dado a corrigir, e a recuperação fica com o usuário ("Tentar
          // novamente"); refazê-la sozinho escondia o estado de erro (catalog.spec › estados).
          const succeeded = queries.filter((q) => q.state.status === 'success')
          if (socket.connected && succeeded.length) void queryClient.invalidateQueries({ predicate: (q) => succeeded.includes(q) })
        }
        if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 2_000 })
        else window.setTimeout(run, 200)
      })
    }

    const reconcile = async () => {
      const firstFetchInFlight = queryClient
        .getQueryCache()
        .getAll()
        .filter((q) => q.state.fetchStatus === 'fetching' && q.state.data === undefined && reconcilable(q.queryKey))
      refetchWhenSettled(firstFetchInFlight)
      // Só as queries ativas (montadas) são refeitas; as demais ficam marcadas como stale.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.nfts.all }),
        userId ? queryClient.invalidateQueries({ queryKey: queryKeys.me.all(userId) }) : Promise.resolve(),
        queryClient.invalidateQueries({ queryKey: queryKeys.guest.all }),
      ])
      diagnostics.update((d) => ({ reconciliations: d.reconciliations + 1 }))
    }

    socket.on('connect', () => {
      const isReconnect = connectedBefore
      connectedBefore = true
      diagnostics.update((d) => ({
        state: 'connected',
        connects: d.connects + 1,
        reconnections: d.reconnections + (isReconnect ? 1 : 0),
      }))
      // Reconciliação também na PRIMEIRA conexão: dados buscados antes de o socket se autenticar
      // podem ter perdido eventos emitidos nesse intervalo (corrida encontrada no CP3, teste 7b).
      // CP9.2: também quando há consultas em trânsito (começaram antes do socket e podem ter
      // perdido eventos emitidos antes da conexão); `reconcile` refaz essas ao terminarem.
      const cache = queryClient.getQueryCache()
      if (isReconnect || cache.getAll().some((q) => q.state.dataUpdatedAt > 0 || (q.state.fetchStatus === 'fetching' && reconcilable(q.queryKey)))) void reconcile()
    })
    socket.on('disconnect', () => diagnostics.update({ state: 'disconnected' }))
    socket.on('connect_error', (error) => {
      // Token recusado no handshake: o servidor não aceita a conexão nem envia dados.
      // O socket.io-client não tenta de novo; a sessão é revalidada pelo REST
      // (GET /auth/session → 401 → sessão limpa → novo socket anônimo).
      const unauthorized = error.message === 'UNAUTHORIZED'
      diagnostics.update((d) => ({ state: 'disconnected', authErrors: d.authErrors + (unauthorized ? 1 : 0) }))
    })

    socket.on(REALTIME_EVENTS.nftUpdated, (raw: unknown) => {
      const parsed = NftUpdatedEvent.safeParse(raw)
      if (!parsed.success) return
      count(applyNftUpdated(queryClient, guard, parsed.data, latestNft), parsed.data.type)
    })

    socket.on(REALTIME_EVENTS.orderUpdated, (raw: unknown) => {
      const parsed = OrderUpdatedEvent.safeParse(raw)
      if (!parsed.success) return
      // Defesa em profundidade: mesmo que o servidor erre o roteamento,
      // um evento privado de outro usuário nunca toca o cache desta sessão.
      if (!userId || parsed.data.userId !== userId) {
        diagnostics.update((d) => ({ received: d.received + 1, foreign: d.foreign + 1, lastEvent: 'order.updated:foreign' }))
        return
      }
      count(applyOrderUpdated(queryClient, guard, userId, parsed.data), parsed.data.type)
    })

    socket.on(REALTIME_EVENTS.cartUpdated, (raw: unknown) => {
      const parsed = CartUpdatedEvent.safeParse(raw)
      if (!parsed.success || !userId || parsed.data.userId !== userId) return
      count(applyCartUpdated(queryClient, guard, userId, parsed.data), parsed.data.type)
    })

    // CP6 (PEND-03): aba suspensa ou em segundo plano pode ter perdido eventos (o navegador congela
    // timers e a conexão pode ter caído sem o cliente perceber). Ao voltar a ficar visível ou ser
    // restaurada do bfcache, reconcilia pelo REST e reconecta o socket se preciso.
    const onResume = () => {
      if (document.visibilityState !== 'visible') return
      if (!socket.connected) socket.connect()
      void reconcile()
    }
    const onPageShow = (e: PageTransitionEvent) => e.persisted && onResume()
    document.addEventListener('visibilitychange', onResume)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      document.removeEventListener('visibilitychange', onResume)
      window.removeEventListener('pageshow', onPageShow)
      socket.removeAllListeners()
      socket.disconnect()
    }
    }

    // CP8 (performance): o socket.io-client é carregado sob demanda, depois da primeira renderização.
    // Assim o App pode ser baixado em paralelo com a camada de mocks (main.tsx) sem capturar o
    // WebSocket nativo antes de o MSW instalar a interceptação (motivo da ordem descrita no CP1).
    let disposed = false
    let teardown: (() => void) | undefined
    void import('socket.io-client').then(({ io }) => {
      if (!disposed) teardown = connect(io)
    })
    return () => {
      disposed = true
      teardown?.()
      unsubscribeCache()
      diagnostics.update({ state: 'idle' })
    }
  }, [queryClient, token, userId])

  return children
}
