/**
 * Handlers REST do MSW. Contratos em src/api/contracts.ts (os mesmos usados pelo cliente).
 * Nenhuma regra de negócio vive no cliente: estoque, totais, idempotência e
 * autorização são decididos aqui.
 */
import { delay, http, HttpResponse } from 'msw'
import { CreateOrderRequest, type Order } from '@/api/contracts'
import { addEth, mulEth, parseEth, toEthString } from '@/lib/eth'
import { db, type DbOrder } from '../db'
import { digest } from '../crypto'
import { apiError, requireSession } from '../session'
import { scheduleSettlement } from '../services'
import { availableOf } from '../catalog-model'
import { catalogHandlers } from './catalog'
import { accountHandlers } from './account'

const latency = () => delay(db.scenario().latencyMs)

function publicOrder(order: DbOrder): Order {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { idempotencyKey, requestHash, settleAt, ...rest } = order
  return rest
}

export const restHandlers = [
  ...catalogHandlers,
  ...accountHandlers,
  // ---------- Pedidos ----------
  http.post('/api/orders', async ({ request }) => {
    await latency()
    const session = requireSession(request)
    if (session instanceof Response) return session

    const key = request.headers.get('Idempotency-Key')
    if (!key) return apiError(422, { code: 'VALIDATION_ERROR', message: 'Idempotency-Key é obrigatória.' })

    const parsed = CreateOrderRequest.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return apiError(422, { code: 'VALIDATION_ERROR', message: 'Pedido inválido.' })

    const requestHash = await digest({ userId: session.userId, body: parsed.data })
    const existing = db.get().orders.find((o) => o.idempotencyKey === key && o.userId === session.userId)
    if (existing) {
      // Mesma tentativa → mesmo pedido. Mesma chave com outro conteúdo → conflito (API-03).
      if (existing.requestHash !== requestHash) {
        return apiError(409, { code: 'IDEMPOTENCY_KEY_REUSED', message: 'Chave de idempotência já usada com outro conteúdo.' })
      }
      return HttpResponse.json(publicOrder(existing), { status: 200 })
    }

    const nfts = db.get().nfts
    const lines = []
    for (const item of parsed.data.items) {
      const nft = nfts.find((n) => n.id === item.nftId)
      if (!nft) return apiError(404, { code: 'NOT_FOUND', message: `NFT ${item.nftId} não encontrado.` })
      if (item.quantity > availableOf(nft)) {
        return apiError(409, { code: 'OUT_OF_STOCK', message: `${nft.name} não tem disponibilidade suficiente.` })
      }
      const lineTotal = mulEth(parseEth(nft.price), item.quantity)
      lines.push({ nftId: nft.id, name: nft.name, unitPrice: nft.price, quantity: item.quantity, lineTotal: toEthString(lineTotal) })
    }

    const scenario = db.scenario()
    const order: DbOrder = {
      id: db.nextId('ord'),
      userId: session.userId,
      status: 'pending',
      version: 1,
      lines,
      total: toEthString(addEth(...lines.map((l) => parseEth(l.lineTotal)))),
      txHash: null,
      createdAt: new Date().toISOString(),
      idempotencyKey: key,
      requestHash,
      settleAt: scenario.settlement === 'auto' ? Date.now() + scenario.settleDelayMs : null,
    }
    db.commit((s) => {
      s.orders.push(order)
    })
    scheduleSettlement(order)
    return HttpResponse.json(publicOrder(order), { status: 201 })
  }),

  http.get('/api/orders/:id', async ({ request, params }) => {
    await latency()
    const session = requireSession(request)
    if (session instanceof Response) return session
    const order = db.get().orders.find((o) => o.id === params.id)
    // Pedido de outro usuário responde 404 (não revela que existe) — ELIM-04.
    if (!order || order.userId !== session.userId) return apiError(404, { code: 'NOT_FOUND', message: 'Pedido não encontrado.' })
    return HttpResponse.json(publicOrder(order))
  }),

  http.get('/api/orders', async ({ request }) => {
    await latency()
    const session = requireSession(request)
    if (session instanceof Response) return session
    return HttpResponse.json({ items: db.get().orders.filter((o) => o.userId === session.userId).map(publicOrder) })
  }),
]
