/**
 * Injeção determinística de falhas e latência por rota, conforme o cenário ativo.
 * Os contadores ficam em memória e são zerados no reset do cenário.
 */
import { delay, HttpResponse } from 'msw'
import type { ApiErrorBody } from '@/api/contracts'
import { db } from './db'
import type { RouteKey } from './scenarios'

const used = new Map<RouteKey, number>()
const held = new Map<RouteKey, Array<() => void>>()
const released = new Set<RouteKey>()

export function resetFailures() {
  used.clear()
  released.clear()
  heldOnDemand.clear()
  for (const waiters of held.values()) waiters.forEach((w) => w())
  held.clear()
}

/** Encerra as falhas injetadas de uma rota (o "servidor" volta a responder normalmente). */
export function recoverRoute(route: RouteKey) {
  used.set(route, Infinity)
}

/** Rotas retidas sob demanda (CP6: `__kurioMock.hold(rota)`), além das do cenário. */
const heldOnDemand = new Set<RouteKey>()

/** Começa a reter as respostas de uma rota até `releaseRoute` (testes de corrida determinísticos). */
export function holdRoute(route: RouteKey) {
  released.delete(route)
  heldOnDemand.add(route)
}

/** A rota está retendo respostas agora? (handlers usam para fotografar o estado ANTES de reter). */
export function isHeld(route: RouteKey) {
  return (heldOnDemand.has(route) || !!db.scenario().holdRoutes?.includes(route)) && !released.has(route)
}

/** Libera as respostas retidas de uma rota (cenários com `holdRoutes` ou `holdRoute`). */
export function releaseRoute(route: RouteKey) {
  released.add(route)
  heldOnDemand.delete(route)
  held.get(route)?.forEach((w) => w())
  held.delete(route)
}

/** Latência global + latência específica da rota (quando o cenário define). */
export async function routeDelay(route: RouteKey, url: URL) {
  const scenario = db.scenario()
  const extra = scenario.routeLatency?.[route]?.(url) ?? 0
  if (isHeld(route)) {
    await new Promise<void>((resolve) => held.set(route, [...(held.get(route) ?? []), resolve]))
  }
  await delay(scenario.latencyMs + extra)
}

/** Devolve a resposta de falha, se o cenário mandar falhar esta requisição. */
const AFTER_COMMIT = new Set(['network-after-commit', 'timeout-after-commit'])

/**
 * Falha que acontece DEPOIS de gravar (só a criação de pedidos usa). Consome a regra e diz o
 * tipo; quem chama decide como "perder" a resposta.
 */
export function takeAfterCommitFailure(route: RouteKey): 'network-after-commit' | 'timeout-after-commit' | null {
  const rule = db.scenario().failures?.[route]
  if (!rule || !AFTER_COMMIT.has(rule.kind)) return null
  const count = used.get(route) ?? 0
  if (count >= rule.times) return null
  used.set(route, count + 1)
  return rule.kind as 'network-after-commit' | 'timeout-after-commit'
}

export function maybeFail(route: RouteKey): Response | null {
  const rule = db.scenario().failures?.[route]
  if (!rule || AFTER_COMMIT.has(rule.kind)) return null
  const count = used.get(route) ?? 0
  if (count >= rule.times) return null
  used.set(route, count + 1)
  if (rule.kind === 'network') return HttpResponse.error()
  if (rule.kind === 'rejected') {
    const rejected: ApiErrorBody = { code: 'WALLET_REJECTED', message: 'A conexão foi recusada na carteira.' }
    return HttpResponse.json(rejected, { status: 403 })
  }
  const status = rule.kind === 'http-503' ? 503 : 500
  const body: ApiErrorBody = { code: 'TRANSIENT', message: 'O serviço está temporariamente indisponível.' }
  return HttpResponse.json(body, { status })
}
