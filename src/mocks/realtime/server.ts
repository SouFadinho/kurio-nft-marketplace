/**
 * Servidor Socket.IO simulado sobre o MSW (MOCK-07).
 *
 * Transporte: o MSW intercepta a classe WebSocket do navegador (`ws.link`), e o
 * `@mswjs/socket.io-binding` codifica e decodifica os pacotes de EVENTO Engine.IO/Socket.IO.
 * O cliente da aplicação é o socket.io-client real, com `transports: ['websocket']`, porque
 * o long-polling HTTP do Engine.IO não é interceptado por `ws.link`.
 *
 * Complementos ao binding 0.2.0 (verificados no código-fonte dele, src/index.ts):
 *
 *  1. HANDSHAKE AUTENTICADO, SEM CORRIDA. Quando não há servidor real, o binding envia,
 *     numa microtask, o OPEN ("0{...}") e também o ACK do CONNECT ("40{"sid":"test"}") —
 *     antes de o cliente mandar seu pacote CONNECT com o token. Assim, o cliente dispararia
 *     `connect` sem validação nenhuma. Solução: um "portão" em `client.send` descarta QUALQUER
 *     "40..." vindo do binding. O ACK só é enviado por este servidor, depois de ler o CONNECT
 *     do cliente e validar o token:
 *       - sem token        → conexão anônima (apenas eventos públicos);
 *       - token válido     → conexão autenticada (eventos públicos + privados do dono);
 *       - token inválido   → CONNECT_ERROR ("44{...}"); a conexão nunca recebe dados.
 *     Não há dependência de ordem entre a microtask do binding e a mensagem do cliente.
 *
 *  2. HEARTBEAT. O binding anuncia pingInterval=25s/pingTimeout=5s, mas não envia pings.
 *     Sem eles, o cliente encerra a conexão por "ping timeout" (~30s). Enviamos o ping
 *     Engine.IO ("2") a cada 20s; o cliente responde "3" (pong).
 */
import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { NftUpdatedEvent, OrderUpdatedEvent, RealtimeEvent } from '@/api/contracts'
import { db } from '../db'
import { resolveSession } from '../session'

type SocketIo = ReturnType<typeof toSocketIo>
type RawClient = Parameters<typeof toSocketIo>[0]['client']
type AuthState = 'pending' | 'anonymous' | 'authenticated' | 'rejected'

interface Connection {
  id: string
  state: AuthState
  token: string | null
  userId: string | null
  io: SocketIo
  client: RawClient
}

export const HEARTBEAT_MS = 20_000
const connections = new Map<string, Connection>()
const stats = { accepted: 0, anonymous: 0, rejected: 0 }
let online = true
let lastEmitted: { event: RealtimeEvent; target: 'all' | string } | null = null

/**
 * URL do endpoint Socket.IO.
 *
 * O socket.io-client conecta em "ws://<host>/socket.io/?EIO=4&transport=websocket".
 * Antes de comparar, o MSW 2.15 (core/handlers/WebSocketHandler.mjs, `parse`) REMOVE o
 * prefixo "/socket.io/" do pathname e depois descarta a query (`getCleanUrl`). A URL
 * efetivamente comparada é "ws://<host>/". Por isso, uma string ".../socket.io/" nunca
 * casava, e a conexão ia para a rede real (evidência no CP1: "Unexpected response code: 200").
 * A RegExp abaixo aceita as duas formas, para não depender desse detalhe interno.
 */
function socketUrl(): RegExp {
  const origin = window.location.origin.replace(/^http/, 'ws').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${origin}/(socket\\.io/?)?$`)
}

/** Pacote CONNECT do cliente: Engine.IO "4" (message) + Socket.IO "0" (CONNECT) + JSON opcional. */
function parseConnectPacket(data: unknown): { token: string | null } | null {
  if (typeof data !== 'string' || !data.startsWith('40')) return null
  const json = data.slice(2)
  if (!json.startsWith('{')) return { token: null }
  try {
    const payload = JSON.parse(json) as { token?: unknown }
    return { token: typeof payload.token === 'string' ? payload.token : null }
  } catch {
    return { token: null }
  }
}

export const realtimeHandler = ws.link(socketUrl()).addEventListener('connection', (connection) => {
  const { client } = connection

  // Portão do handshake (ver item 1 do cabeçalho). Instalado ANTES de toSocketIo,
  // então a microtask do binding já encontra o portão no lugar.
  const rawSend = client.send.bind(client)
  client.send = (data) => {
    if (typeof data === 'string' && data.startsWith('40')) return // ACK automático do binding: descartado
    rawSend(data)
  }

  if (!online) {
    // Servidor indisponível. Fechar ANTES de abrir não funciona no MSW: o WebSocket
    // simulado dispara só "close" (sem "error"), e o Manager do socket.io-client, que
    // durante a abertura escuta apenas "error", espera o timeout de 20s para tentar de
    // novo (verificado no CP1). Aqui o transporte abre (OPEN do Engine.IO), o CONNECT
    // nunca é confirmado e a conexão cai logo depois: o cliente vê uma queda de
    // transporte e reconecta com backoff, como diante de um servidor instável.
    toSocketIo(connection)
    window.setTimeout(() => client.close(), 50)
    return
  }

  const conn: Connection = { id: client.id, state: 'pending', token: null, userId: null, io: toSocketIo(connection), client }
  connections.set(conn.id, conn)

  client.addEventListener('message', (event) => {
    if (conn.state !== 'pending') return
    const packet = parseConnectPacket(event.data)
    if (!packet) return

    if (packet.token === null) {
      conn.state = 'anonymous'
      stats.anonymous += 1
      rawSend(`40${JSON.stringify({ sid: conn.id })}`)
      return
    }
    const session = resolveSession(packet.token)
    if (!session) {
      conn.state = 'rejected'
      stats.rejected += 1
      rawSend(`44${JSON.stringify({ message: 'UNAUTHORIZED' })}`)
      return
    }
    conn.state = 'authenticated'
    conn.token = packet.token
    conn.userId = session.userId
    stats.accepted += 1
    rawSend(`40${JSON.stringify({ sid: conn.id })}`)
  })

  const heartbeat = window.setInterval(() => rawSend('2'), HEARTBEAT_MS)
  client.addEventListener('close', () => {
    window.clearInterval(heartbeat)
    connections.delete(conn.id)
  })
})

const isOpen = (conn: Connection) => conn.state === 'anonymous' || conn.state === 'authenticated'

function send(conn: Connection, event: RealtimeEvent) {
  conn.io.client.emit(event.type, event)
}

/** Evento público (ex.: nft.updated): conexões já aceitas (anônimas ou autenticadas). */
export function broadcast(event: RealtimeEvent) {
  lastEmitted = { event, target: 'all' }
  for (const conn of connections.values()) if (isOpen(conn)) send(conn, event)
}

/** Evento privado (ex.: order.updated): só conexões AUTENTICADAS do dono. */
export function emitToUser(userId: string, event: RealtimeEvent) {
  lastEmitted = { event, target: userId }
  for (const conn of connections.values()) if (conn.state === 'authenticated' && conn.userId === userId) send(conn, event)
}

export const realtimeControl = {
  connections: () => [...connections.values()].map(({ id, state, userId }) => ({ id, state, userId })),
  stats: () => ({ ...stats }),

  /** Derruba todas as conexões; com online=false recusa novas até reabrir. */
  setOnline(value: boolean) {
    online = value
    if (!value) for (const conn of [...connections.values()]) conn.client.close()
  },

  /** Revoga conexões de um token (logout ou sessão expirada). */
  dropToken(token: string) {
    for (const conn of [...connections.values()]) if (conn.token === token) conn.client.close()
  },

  /** Reenvia exatamente o último evento (mesmo eventId): teste de duplicata. */
  replayLast() {
    if (!lastEmitted) return null
    const { event, target } = lastEmitted
    if (target === 'all') broadcast(event)
    else emitToUser(target, event)
    return event
  },

  /** Envia um evento a TODAS as conexões abertas, ignorando o dono: simula erro de roteamento. */
  misrouteToAll(event: OrderUpdatedEvent | NftUpdatedEvent) {
    for (const conn of connections.values()) if (isOpen(conn)) send(conn, event)
  },

  resetStats() {
    stats.accepted = 0
    stats.anonymous = 0
    stats.rejected = 0
  },
}

export function makeEvent<E extends RealtimeEvent>(event: Omit<E, 'eventId' | 'occurredAt'>): E {
  return { ...event, eventId: db.nextId('evt'), occurredAt: new Date().toISOString() } as E
}
