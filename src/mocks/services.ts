/**
 * Operações de domínio da simulação. Cada mudança de estado que interessa ao cliente
 * gera o evento Socket.IO correspondente AQUI, junto da escrita no db.
 * Assim, REST e tempo real nunca divergem (MOCK-10).
 */
import type { NftUpdatedEvent, Order, OrderUpdatedEvent } from '@/api/contracts'
import { db, type DbOrder } from './db'
import { broadcast, emitToUser, makeEvent } from './realtime/server'

const timers = new Map<string, number>()

export function updateNft(id: string, patch: { price?: string; available?: number }) {
  const nft = db.commit((s) => {
    const found = s.nfts.find((n) => n.id === id)
    if (!found) return null
    if (patch.price !== undefined) found.price = patch.price
    if (patch.available !== undefined) found.available = patch.available
    found.version += 1
    return { ...found }
  })
  if (!nft) throw new Error(`NFT inexistente: ${id}`)

  const event = makeEvent<NftUpdatedEvent>({
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    data: { price: nft.price, available: nft.available },
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
    data: { price: fakePrice, available: nft.available },
  })
  broadcast(event)
  return event
}

export function orderEvent(order: Order) {
  return makeEvent<OrderUpdatedEvent>({
    type: 'order.updated',
    resource: { type: 'order', id: order.id },
    version: order.version,
    userId: order.userId,
    data: { status: order.status, txHash: order.txHash },
  })
}

function fakeTxHash(orderId: string) {
  // Referência de transação simulada e determinística (PAY-08).
  let h = 0n
  for (const ch of orderId) h = (h * 131n + BigInt(ch.charCodeAt(0))) % 2n ** 160n
  return `0x${h.toString(16).padStart(40, '0')}`
}

/** Liquida um pedido pendente. Pedidos terminais nunca mudam (RT-09). */
export function settleOrder(orderId: string, status: 'confirmed' | 'rejected') {
  const order = db.commit((s) => {
    const found = s.orders.find((o) => o.id === orderId)
    if (!found || found.status !== 'pending') return null
    found.status = status
    found.version += 1
    found.txHash = status === 'confirmed' ? fakeTxHash(found.id) : null
    found.settleAt = null
    return { ...found }
  })
  timers.delete(orderId)
  if (!order) return null
  const event = orderEvent(order)
  emitToUser(order.userId, event)
  return event
}

export function scheduleSettlement(order: DbOrder) {
  if (order.settleAt === null || timers.has(order.id)) return
  const { settleResult } = db.scenario()
  const wait = Math.max(0, order.settleAt - Date.now())
  timers.set(order.id, window.setTimeout(() => settleOrder(order.id, settleResult), wait))
}

/** Após refresh, reagenda liquidações pendentes persistidas (recuperação de pedido pendente). */
export function resumePendingSettlements() {
  for (const order of db.get().orders) if (order.status === 'pending') scheduleSettlement(order)
}

export function clearTimers() {
  for (const t of timers.values()) window.clearTimeout(t)
  timers.clear()
}
