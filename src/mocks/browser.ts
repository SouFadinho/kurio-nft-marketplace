/**
 * Inicialização da camada de mocks (MOCK-09). Carregada por import dinâmico em
 * main.tsx somente quando VITE_ENABLE_MOCKS=true; fora disso, não entra no bundle inicial.
 *
 * Controle de cenário por URL: `?scenario=<nome>` e `?reset=1`. Os parâmetros são
 * removidos da URL antes do Router iniciar, para não poluírem o estado da aplicação.
 *
 * `window.__kurioMock` expõe o "lado servidor" da simulação para testes e demonstração.
 * Ele altera o db e emite eventos pelo servidor Socket.IO simulado; nunca toca no
 * cache ou nos componentes da aplicação (MOCK-08 / ELIM-05).
 *
 * CP6 (PEND-03): as abas formam um cluster (cluster.ts). Só o LÍDER executa os handlers e o
 * banco; as demais encaminham REST e comandos de controle a ele. Com uma única aba (todos os
 * testes de aba única), ela é o líder e nada muda.
 */
import { getResponse, http, passthrough } from 'msw'
import { setupWorker } from 'msw/browser'
import type { OrderStatus } from '@/api/contracts'
import { isLeader, joinCluster, onRpc, rpc } from './cluster'
import { db } from './db'
import { holdRoute, recoverRoute, releaseRoute, resetFailures } from './failures'
import { restHandlers } from './handlers'
import { realtimeControl, realtimeHandler, emitToUser } from './realtime/server'
import { isScenarioName, type RouteKey, type ScenarioName } from './scenarios'
import { resolveSession } from './session'
import { clearTimers, emitStaleNftUpdate, expireReservations, orderEvent, resumePendingSettlements, settleOrder, updateNft } from './services'

type UrlControls = { scenario: ScenarioName | null; reset: boolean }

function readUrlControls(): UrlControls {
  const url = new URL(window.location.href)
  const rawScenario = url.searchParams.get('scenario')
  const reset = url.searchParams.get('reset') === '1'
  const scenario = rawScenario && isScenarioName(rawScenario) ? rawScenario : null
  if (rawScenario !== null || url.searchParams.has('reset')) {
    url.searchParams.delete('scenario')
    url.searchParams.delete('reset')
    window.history.replaceState(window.history.state, '', url)
  }
  return { scenario, reset }
}

/** Comandos do "servidor" (executados no LÍDER). */
const serverControl = {
  async reset(scenario: ScenarioName = 'default') {
    clearTimers()
    realtimeControl.resetStats()
    resetFailures()
    await db.reset(scenario)
  },
  scenario: () => db.get().scenario,
  /** Libera respostas retidas pelo cenário (ex.: 'nfts.list' em hold-catalog) ou por `hold`. */
  release: (route: RouteKey) => releaseRoute(route),
  /** Passa a reter as respostas de uma rota até `release` (testes de corrida, CP6). */
  hold: (route: RouteKey) => holdRoute(route),
  /** Encerra as falhas injetadas de uma rota (recuperação determinística). */
  recover: (route: RouteKey) => recoverRoute(route),
  /** Expira todas as sessões ativas: a próxima requisição privada recebe 401 SESSION_EXPIRED. */
  expireSessions: () =>
    db.commit((s) => {
      for (const x of s.sessions) x.expiresAt = new Date(0).toISOString()
      return s.sessions.length
    }),
  /** Expira todas as cotações: o próximo pedido recebe 409 QUOTE_EXPIRED. */
  expireQuotes: () =>
    db.commit((s) => {
      for (const q of s.quotes) q.expiresAt = new Date(0).toISOString()
      return s.quotes.length
    }),
  /**
   * Avança o relógio da simulação (reservas de estoque) e aplica os vencimentos (CP6).
   * `sweep=false` não varre: testa a regra no próprio `settleOrder` (confirmação atrasada).
   */
  advanceClock(ms: number, sweep = true) {
    db.commit((s) => {
      s.clockOffsetMs += ms
    })
    return sweep ? expireReservations() : 0
  },
  updateNft,
  emitStaleNftUpdate,
  settleOrder,
  orders: () => db.get().orders.map((o) => ({ id: o.id, userId: o.userId, status: o.status, version: o.version, failureReason: o.failureReason ?? null })),
  /** Disponibilidade de uma edição (conferência de reserva e liberação). */
  available: (nftId: string, editionId: string) => db.get().nfts.find((n) => n.id === nftId)?.editions.find((e) => e.id === editionId)?.available ?? null,
  /**
   * Emite um `order.updated` ARBITRÁRIO pelo servidor (sem mudar o banco): teste de eventos
   * antigos, fora de ordem e de tentativa de regredir estado terminal (CP6).
   */
  emitOrderEvent(orderId: string, status: OrderStatus, version: number) {
    const order = db.get().orders.find((o) => o.id === orderId)
    if (!order) throw new Error(`Pedido inexistente: ${orderId}`)
    const event = orderEvent({ ...order, status, version, txHash: status === 'confirmed' ? order.txHash : null })
    emitToUser(order.userId, event)
    return event
  },
  /** Envia o order.updated de um pedido a TODAS as conexões desta aba (erro de roteamento simulado). */
  misrouteOrder(orderId: string) {
    const order = db.get().orders.find((o) => o.id === orderId)
    if (!order) throw new Error(`Pedido inexistente: ${orderId}`)
    const event = orderEvent({ ...order, version: order.version + 1, status: 'rejected' })
    realtimeControl.misrouteToAll(event)
    return event
  },
}

type ServerControl = typeof serverControl
type Remote<T> = { [K in keyof T]: T[K] extends (...args: infer A) => infer R ? (...args: A) => R | Promise<Awaited<R>> : T[K] }

/** Encaminha ao líder quando esta aba é seguidora (CP6). */
function viaLeader<K extends keyof ServerControl>(name: K) {
  return ((...args: unknown[]) =>
    isLeader() ? (serverControl[name] as (...a: unknown[]) => unknown)(...args) : rpc('control', { name, args })) as Remote<ServerControl>[K]
}

const control = {
  ...(Object.fromEntries(Object.keys(serverControl).map((k) => [k, viaLeader(k as keyof ServerControl)])) as Remote<Omit<ServerControl, 'misrouteOrder'>>),
  /** Papel desta aba no cluster de abas. */
  role: () => (isLeader() ? 'leader' : 'follower'),
  // Transporte Socket.IO desta aba (cada aba tem as próprias conexões).
  realtime: {
    connections: realtimeControl.connections,
    stats: realtimeControl.stats,
    setOnline: realtimeControl.setOnline,
    replayLast: realtimeControl.replayLast,
    misrouteOrder: viaLeader('misrouteOrder'),
  },
}

declare global {
  interface Window {
    __kurioMock?: typeof control
  }
}

type WireRequest = { method: string; url: string; headers: Array<[string, string]>; body: string | null }
type WireResponse = { kind: 'response'; status: number; headers: Array<[string, string]>; body: string } | { kind: 'error' } | { kind: 'passthrough' }

/** Executa a requisição nos handlers REST (no líder). */
async function handleLocally(request: Request): Promise<WireResponse> {
  // Toda requisição aplica antes os vencimentos de reserva (estado sempre coerente com o relógio).
  expireReservations()
  const response = await getResponse(restHandlers, request, { baseUrl: location.origin })
  if (!response) return { kind: 'passthrough' }
  if (response.type === 'error') return { kind: 'error' }
  return { kind: 'response', status: response.status, headers: [...response.headers.entries()], body: await response.text() }
}

function toResponse(wire: WireResponse): Response | undefined {
  if (wire.kind === 'passthrough') return undefined
  if (wire.kind === 'error') return Response.error()
  return new Response(wire.status === 204 || wire.status === 304 ? null : wire.body, { status: wire.status, headers: wire.headers })
}

/**
 * Único handler HTTP do worker: o líder responde com os handlers REST; a seguidora envia ao
 * líder (só rotas da API e das artes, que podem ser afetadas por cenários).
 */
const dispatcher = http.all('*', async ({ request }) => {
  const path = new URL(request.url).pathname
  if (!path.startsWith('/api/') && !path.startsWith('/assets/nfts/')) return passthrough()
  if (isLeader()) return toResponse(await handleLocally(request))
  const wire: WireRequest = { method: request.method, url: request.url, headers: [...request.headers.entries()], body: request.method === 'GET' || request.method === 'HEAD' ? null : await request.text() }
  const reply = await rpc<WireResponse>('http', wire).catch(() => ({ kind: 'error' }) as WireResponse)
  return toResponse(reply) ?? passthrough()
})

// RPCs atendidas pelo líder.
onRpc('http', (wire: WireRequest) => handleLocally(new Request(wire.url, { method: wire.method, headers: wire.headers, body: wire.body })))
onRpc('control', ({ name, args }: { name: keyof ServerControl; args: unknown[] }) => (serverControl[name] as (...a: unknown[]) => unknown)(...args))
onRpc('resolveSession', (token: string) => {
  const session = resolveSession(token)
  return session ? { userId: session.userId } : null
})
onRpc('init', async (controls: UrlControls) => {
  if (controls.reset) await serverControl.reset(controls.scenario ?? 'default')
  else if (controls.scenario) await db.commit((s) => void (s.scenario = controls.scenario!))
})

let sweeper: number | undefined
async function startAsLeader(controls: UrlControls) {
  await db.init(controls)
  resumePendingSettlements()
  expireReservations()
  // Varredura periódica das reservas (pedidos abandonados não prendem estoque).
  sweeper ??= window.setInterval(() => expireReservations(), 1_000)
}

export async function startMocks() {
  const controls = readUrlControls()
  const role = await joinCluster(() => startAsLeader({ reset: false, scenario: null }))
  if (role === 'leader') await startAsLeader(controls)
  else if (controls.reset || controls.scenario) await rpc('init', controls)

  const worker = setupWorker(dispatcher, realtimeHandler)
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
    serviceWorker: { url: '/mockServiceWorker.js' },
  })
  window.__kurioMock = control
}
