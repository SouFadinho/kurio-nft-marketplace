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
 */
import { setupWorker } from 'msw/browser'
import { db } from './db'
import { restHandlers } from './handlers'
import { realtimeControl, realtimeHandler } from './realtime/server'
import { isScenarioName, type ScenarioName } from './scenarios'
import { clearTimers, emitStaleNftUpdate, resumePendingSettlements, settleOrder, updateNft, orderEvent } from './services'

function readUrlControls(): { scenario: ScenarioName | null; reset: boolean } {
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

const control = {
  async reset(scenario: ScenarioName = 'default') {
    clearTimers()
    realtimeControl.resetStats()
    await db.reset(scenario)
  },
  scenario: () => db.get().scenario,
  updateNft,
  emitStaleNftUpdate,
  settleOrder,
  orders: () => db.get().orders.map((o) => ({ id: o.id, userId: o.userId, status: o.status, version: o.version })),
  realtime: {
    connections: realtimeControl.connections,
    stats: realtimeControl.stats,
    setOnline: realtimeControl.setOnline,
    replayLast: realtimeControl.replayLast,
    /** Envia o order.updated de um pedido a TODAS as conexões (erro de roteamento simulado). */
    misrouteOrder(orderId: string) {
      const order = db.get().orders.find((o) => o.id === orderId)
      if (!order) throw new Error(`Pedido inexistente: ${orderId}`)
      const event = orderEvent({ ...order, version: order.version + 1, status: 'rejected' })
      realtimeControl.misrouteToAll(event)
      return event
    },
  },
}

declare global {
  interface Window {
    __kurioMock?: typeof control
  }
}

export async function startMocks() {
  const controls = readUrlControls()
  await db.init(controls)

  const worker = setupWorker(...restHandlers, realtimeHandler)
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
    serviceWorker: { url: '/mockServiceWorker.js' },
  })

  resumePendingSettlements()
  window.__kurioMock = control
}
