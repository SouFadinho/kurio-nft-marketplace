/**
 * Consistência entre abas da simulação (PEND-03).
 *
 * Problema: cada aba executa os handlers do MSW no próprio contexto, com uma cópia do "banco"
 * em memória. Duas abas gravando no mesmo `localStorage` perderiam atualizações (não há
 * compare-and-set no localStorage), e um evento emitido numa aba não chegaria às outras.
 *
 * Solução: um único "servidor" lógico para todas as abas da mesma origem.
 * - LÍDER: a aba que obtém o Web Lock `kurio-mock-leader` executa os handlers, o banco, os
 *   timers de liquidação e a varredura de reservas. Como tudo roda numa única thread JS,
 *   não há atualizações concorrentes perdidas e a idempotência vale entre abas.
 * - SEGUIDORAS: encaminham as requisições REST e os comandos de controle ao líder por um
 *   `BroadcastChannel` (RPC) e devolvem a resposta do líder ao próprio cliente.
 * - EVENTOS DE DOMÍNIO: o líder publica no barramento interno; o servidor Socket.IO simulado
 *   de CADA aba entrega às suas conexões (público para todos; privado só ao dono). O cache da
 *   UI continua sendo alterado apenas pelo socket.io-client (o barramento não toca na UI).
 * - FAILOVER: as seguidoras ficam na fila do lock; se a aba líder fechar, a próxima assume,
 *   recarrega o estado persistido e retoma liquidações e reservas.
 * Sessão continua por aba (sessionStorage); o banco de sessões é do líder.
 */

type Role = 'leader' | 'follower'
type Message =
  | { type: 'rpc'; id: string; kind: string; payload: unknown }
  | { type: 'rpc-reply'; id: string; ok: true; result: unknown }
  | { type: 'rpc-reply'; id: string; ok: false; error: string }
  | { type: 'bus'; topic: string; payload: unknown }

const CHANNEL = 'kurio-mock-cluster'
const LOCK = 'kurio-mock-leader'
const RPC_TIMEOUT_MS = 20_000

let role: Role = 'follower'
let channel: BroadcastChannel | null = null
const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: number }>()
const rpcHandlers = new Map<string, (payload: unknown) => Promise<unknown> | unknown>()
const busHandlers = new Map<string, (payload: unknown) => void>()

export const isLeader = () => role === 'leader'

function onMessage(event: MessageEvent<Message>) {
  const msg = event.data
  if (msg.type === 'rpc' && role === 'leader') {
    const handler = rpcHandlers.get(msg.kind)
    void Promise.resolve()
      .then(() => {
        if (!handler) throw new Error(`RPC desconhecida: ${msg.kind}`)
        return handler(msg.payload)
      })
      .then(
        (result) => channel?.postMessage({ type: 'rpc-reply', id: msg.id, ok: true, result } satisfies Message),
        (error: unknown) => channel?.postMessage({ type: 'rpc-reply', id: msg.id, ok: false, error: String(error) } satisfies Message),
      )
  } else if (msg.type === 'rpc-reply') {
    const waiting = pending.get(msg.id)
    if (!waiting) return
    pending.delete(msg.id)
    window.clearTimeout(waiting.timer)
    if (msg.ok) waiting.resolve(msg.result)
    else waiting.reject(new Error(msg.error))
  } else if (msg.type === 'bus') {
    busHandlers.get(msg.topic)?.(msg.payload)
  }
}

/** Chamada ao líder (seguidoras). Se esta aba virou líder, executa localmente. */
export function rpc<T>(kind: string, payload: unknown): Promise<T> {
  if (role === 'leader') return Promise.resolve(rpcHandlers.get(kind)!(payload)) as Promise<T>
  return new Promise<T>((resolve, reject) => {
    const id = crypto.randomUUID()
    const timer = window.setTimeout(() => {
      pending.delete(id)
      reject(new Error(`RPC sem resposta do líder: ${kind}`))
    }, RPC_TIMEOUT_MS)
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer })
    channel!.postMessage({ type: 'rpc', id, kind, payload } satisfies Message)
  })
}

export const onRpc = (kind: string, handler: (payload: never) => Promise<unknown> | unknown) => rpcHandlers.set(kind, handler as (p: unknown) => unknown)

/** Publica no barramento interno (as OUTRAS abas recebem; a própria aba trata localmente). */
export const publish = (topic: string, payload: unknown) => channel?.postMessage({ type: 'bus', topic, payload } satisfies Message)
export const onBus = (topic: string, handler: (payload: never) => void) => busHandlers.set(topic, handler as (p: unknown) => void)

/**
 * Entra no cluster. Resolve com o papel inicial. `onPromoted` roda quando uma seguidora vira
 * líder (a aba líder anterior fechou).
 */
export function joinCluster(onPromoted: () => Promise<void>): Promise<Role> {
  channel = new BroadcastChannel(CHANNEL)
  channel.addEventListener('message', onMessage)
  // Encerramento: o canal e o lock são liberados quando a aba é descartada.
  window.addEventListener('pagehide', (e) => {
    if (!e.persisted) channel?.close()
  })
  const forever = () => new Promise<void>(() => undefined)
  return new Promise<Role>((resolve) => {
    void navigator.locks.request(LOCK, { ifAvailable: true }, async (lock) => {
      if (lock) {
        role = 'leader'
        resolve('leader')
        return forever()
      }
      resolve('follower')
      // Fica na fila: assume quando o líder atual sair.
      void navigator.locks.request(LOCK, async () => {
        await onPromoted()
        role = 'leader'
        return forever()
      })
      return undefined
    })
  })
}
