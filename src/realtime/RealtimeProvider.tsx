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
import { io } from 'socket.io-client'
import { NftUpdatedEvent, OrderUpdatedEvent, REALTIME_EVENTS } from '@/api/contracts'
import { queryKeys } from '@/api/queryKeys'
import { useClientSession } from '@/features/auth/queries'
import { EventGuard, type GuardDecision } from './eventGuard'
import { applyNftUpdated, applyOrderUpdated } from './applyEvent'
import { diagnostics } from './diagnostics'

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
    diagnostics.reset(userId)
    diagnostics.update({ state: 'connecting' })

    const socket = io(window.location.origin, {
      transports: ['websocket'],
      auth: token ? { token } : {},
      reconnectionDelay: 250,
      reconnectionDelayMax: 1_000,
      randomizationFactor: 0,
    })

    let connectedBefore = false

    const reconcile = async () => {
      // Só as queries ativas (montadas) são refeitas; as demais ficam marcadas como stale.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.nfts.all }),
        userId ? queryClient.invalidateQueries({ queryKey: queryKeys.me.all(userId) }) : Promise.resolve(),
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
      if (isReconnect || queryClient.getQueryCache().getAll().some((q) => q.state.dataUpdatedAt > 0)) void reconcile()
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
      count(applyNftUpdated(queryClient, guard, parsed.data), parsed.data.type)
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

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      diagnostics.update({ state: 'idle' })
    }
  }, [queryClient, token, userId])

  return children
}
