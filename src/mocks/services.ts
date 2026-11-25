/**
 * Operações de domínio da simulação. Cada mudança de estado que interessa ao cliente
 * gera o evento Socket.IO correspondente AQUI, junto da escrita no db.
 * Assim, REST e tempo real nunca divergem (MOCK-10).
 */
import type { CartUpdatedEvent, NftUpdatedEvent, Order, OrderUpdatedEvent } from '@/api/contracts'
import { db, now, type DbNft, type DbOrder } from './db'
import { availableOf } from './catalog-model'
import { broadcast, emitToUser, makeEvent } from './realtime/server'

const timers = new Map<string, number>()

export interface NftPatch {
  price?: string
  /** Disponibilidade TOTAL: ajustada na maior edição; as demais são reduzidas se necessário. */
  available?: number
  /** Disponibilidade por edição (tem precedência sobre `available`). */
  editions?: Array<{ id: string; available: number }>
}

const editionsData = (n: DbNft) => n.editions.map((e) => ({ id: e.id, available: e.available }))

export function updateNft(id: string, patch: NftPatch) {
  const nft = db.commit((s) => {
    const found = s.nfts.find((n) => n.id === id)
    if (!found) return null
    if (patch.price !== undefined) found.price = patch.price
    if (patch.editions) {
      for (const e of patch.editions) {
        const target = found.editions.find((x) => x.id === e.id)
        if (target) target.available = Math.max(0, Math.trunc(e.available))
      }
    } else if (patch.available !== undefined) {
      // Mantém a soma igual a `available`: reduz as primeiras edições se preciso e ajusta a última.
      let rest = Math.max(0, Math.trunc(patch.available))
      const last = found.editions[found.editions.length - 1]!
      for (const e of found.editions.slice(0, -1)) {
        e.available = Math.min(e.available, rest)
        rest -= e.available
      }
      last.available = rest
    }
    found.version += 1
    return structuredClone(found)
  })
  if (!nft) throw new Error(`NFT inexistente: ${id}`)

  const event = makeEvent<NftUpdatedEvent>({
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    data: { price: nft.price, available: availableOf(nft), editions: editionsData(nft) },
  })
  broadcast(event)
  return event
}

/** Evento com versão ANTIGA e eventId novo: o cliente deve descartá-lo (RT-04). */
export function emitStaleNftUpdate(id: string, fakePrice: string) {
  const nft = db.get().nfts.find((n) => n.id === id)
  if (!nft) throw new Error(`NFT inexistente: ${id}`)
  const event = makeEvent<NftUpdatedEvent>({
    type: 'nft.updated',
    resource: { type: 'nft', id },
    version: Math.max(1, nft.version - 1),
    data: { price: fakePrice, available: availableOf(nft), editions: editionsData(nft) },
  })
  broadcast(event)
  return event
}

/** CP7: avisa as conexões do DONO que o carrinho mudou (só carrinhos de usuário). */
export function emitCartUpdated(ownerKey: string) {
  if (!ownerKey.startsWith('user:')) return
  const userId = ownerKey.slice(5)
  const cart = db.get().carts[ownerKey]
  if (!cart) return
  emitToUser(
    userId,
    makeEvent<CartUpdatedEvent>({ type: 'cart.updated', resource: { type: 'cart', id: userId }, version: cart.version, userId, data: { version: cart.version } }),
  )
}

export function orderEvent(order: Order) {
  return makeEvent<OrderUpdatedEvent>({
    type: 'order.updated',
    resource: { type: 'order', id: order.id },
    version: order.version,
    userId: order.userId,
    data: { status: order.status, txHash: order.txHash, settledAt: order.settledAt ?? null, failureReason: order.failureReason ?? null },
  })
}

function fakeTxHash(orderId: string) {
  // Referência de transação simulada e determinística (PAY-08).
  let h = 0n
  for (const ch of orderId) h = (h * 131n + BigInt(ch.charCodeAt(0))) % 2n ** 160n
  return `0x${h.toString(16).padStart(40, '0')}`
}

/**
 * Prazo da reserva de estoque de um pedido pendente (R-40). Política: a reserva nasce na
 * criação e vale 10 minutos no relógio da simulação; confirmação consolida, recusa ou
 * vencimento devolvem o estoque UMA vez (só na transição pendente → terminal).
 */
export const RESERVATION_TTL_MS = 10 * 60_000

const reservationExpired = (o: DbOrder) => !!o.reservedUntil && now() >= Date.parse(o.reservedUntil)

/**
 * Liquida um pedido pendente. Pedidos terminais nunca mudam (RT-09). Uma confirmação que
 * chega DEPOIS do vencimento da reserva não confirma: o pedido é recusado por reserva vencida.
 */
export function settleOrder(orderId: string, requested: 'confirmed' | 'rejected') {
  const order = db.commit((s) => {
    const found = s.orders.find((o) => o.id === orderId)
    if (!found || found.status !== 'pending') return null
    const expired = reservationExpired(found)
    const status = expired ? 'rejected' : requested
    found.status = status
    found.version += 1
    found.txHash = status === 'confirmed' ? fakeTxHash(found.id) : null
    found.settleAt = null
    found.settledAt = new Date(now()).toISOString()
    found.failureReason = status === 'confirmed' ? null : expired ? 'reservation_expired' : 'payment_rejected'
    return structuredClone(found)
  })
  timers.delete(orderId)
  if (!order) return null
  if (order.pricing) applyCheckoutSettlement(order)
  const event = orderEvent(order)
  emitToUser(order.userId, event)
  return event
}

/**
 * Efeitos da liquidação de um pedido do checkout (PAY-07):
 * - confirmado: remove do carrinho do usuário APENAS os itens e quantidades comprados (o que foi
 *   adicionado depois continua lá); o cupom usado sai;
 * - recusado: o carrinho fica intacto e o estoque reservado na criação volta (emite `nft.updated`).
 */
function applyCheckoutSettlement(order: DbOrder) {
  if (order.status === 'confirmed') {
    db.commit((s) => {
      const key = `user:${order.userId}`
      const cart = s.carts[key]
      if (!cart) return
      for (const bought of order.lines) {
        const line = cart.lines.find((l) => l.nftId === bought.nftId && l.editionId === bought.editionId)
        if (line) line.quantity -= bought.quantity
      }
      cart.lines = cart.lines.filter((l) => l.quantity > 0)
      if (order.pricing && cart.couponCode === order.pricing.couponCode) cart.couponCode = null
      cart.version += 1
    })
    emitCartUpdated(`user:${order.userId}`)
    return
  }
  for (const line of order.lines) {
    const nft = db.get().nfts.find((n) => n.id === line.nftId)
    const edition = nft?.editions.find((e) => e.id === line.editionId)
    if (nft && edition) updateNft(nft.id, { editions: [{ id: edition.id, available: edition.available + line.quantity }] })
  }
}

export function scheduleSettlement(order: DbOrder) {
  if (order.settleAt === null || timers.has(order.id)) return
  const { settleResult } = db.scenario()
  const wait = Math.max(0, order.settleAt - Date.now())
  timers.set(order.id, window.setTimeout(() => settleOrder(order.id, settleResult), wait))
}

/** Vence as reservas de pedidos pendentes cujo prazo passou (varredura do líder do cluster). */
export function expireReservations() {
  const due = db.get().orders.filter((o) => o.status === 'pending' && reservationExpired(o)).map((o) => o.id)
  for (const id of due) settleOrder(id, 'rejected')
  return due.length
}

/** Após refresh, reagenda liquidações pendentes persistidas (recuperação de pedido pendente). */
export function resumePendingSettlements() {
  for (const order of db.get().orders) if (order.status === 'pending') scheduleSettlement(order)
}

export function clearTimers() {
  for (const t of timers.values()) window.clearTimeout(t)
  timers.clear()
}
