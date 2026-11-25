/**
 * Handlers de carrinho, cupons, cotação, conexão de carteira e criação de pedido pelo
 * checkout (CP5). Toda regra de negócio vive aqui, no "servidor":
 *
 * - Carrinho por dono: usuário autenticado (`user:<id>`) ou visitante (`guest:<id>`, enviado no
 *   header `X-Cart-Id`, um id aleatório gerado pelo cliente). Linha = NFT + edição.
 * - Estoque validado em toda escrita; a leitura devolve o problema atual de cada linha.
 * - Merge determinístico visitante → usuário após o login (ver `mergeCarts`).
 * - Cotação: preços atuais × quantidades, cupom e taxa da rede, em wei (pricing.ts). Guarda
 *   uma impressão digital das condições; o pedido só é aceito se as condições não mudaram.
 * - Pedido do checkout: idempotente (index.ts), com cotação válida, carteira conectada e
 *   estoque; grava e reserva o estoque (emite `nft.updated`). O carrinho só perde os itens
 *   comprados quando o pedido é confirmado; recusa devolve o estoque (services.settleOrder).
 */
import { delay, http, HttpResponse } from 'msw'
import {
  AddCartItem,
  ApplyCoupon,
  MergeCartRequest,
  QuoteRequest,
  UpdateCartItem,
  WalletConnectionRequest,
  isValidAddress,
  networksForAddress,
  type ApiErrorBody,
  type Cart,
  type CartLine,
  type CheckoutRequest,
  type MergeCartResponse,
  type Network,
  type Order,
  type Quote,
  type WalletConnection,
} from '@/api/contracts'
import { db, now, type DbCart, type DbNft, type DbOrder, type DbState } from '../db'
import { isHeld, maybeFail, routeDelay, takeAfterCommitFailure } from '../failures'
import { priceCart, type Pricing } from '../pricing'
import { mergeCartLines } from '../cart-model'
import { RESERVATION_TTL_MS, emitCartUpdated, scheduleSettlement, updateNft } from '../services'
import { apiError, bearer, requireSession } from '../session'
import type { DbSession } from '../db'

/** Validade da cotação. */
export const QUOTE_TTL_MS = 5 * 60_000
/** Tempo que a resposta "atrasada" leva no cenário `order-timeout` (maior que o timeout do cliente). */
const LATE_RESPONSE_MS = 8_000

const json = async (request: Request) => request.json().catch(() => null)
const emptyCart = (): DbCart => ({ version: 0, lines: [], couponCode: null })
const lineId = (nftId: string, editionId: string) => `${nftId}:${editionId}`

type Owner = { key: string; userId: string | null; kind: 'user' | 'guest' }

/** Dono do carrinho: sessão (se houver token) ou id de visitante. */
function ownerOf(request: Request): Owner | Response {
  if (bearer(request)) {
    const session = requireSession(request)
    if (session instanceof Response) return session
    return { key: `user:${session.userId}`, userId: session.userId, kind: 'user' }
  }
  const guest = request.headers.get('X-Cart-Id')
  if (guest && /^[A-Za-z0-9-]{8,64}$/.test(guest)) return { key: `guest:${guest}`, userId: null, kind: 'guest' }
  return apiError(400, { code: 'VALIDATION_ERROR', message: 'Carrinho não identificado.' })
}

const findNft = (s: DbState, id: string) => s.nfts.find((n) => n.id === id)
const editionOf = (nft: DbNft, editionId: string) => nft.editions.find((e) => e.id === editionId)

function toLine(s: DbState, l: DbCart['lines'][number]): CartLine | null {
  const nft = findNft(s, l.nftId)
  const edition = nft && editionOf(nft, l.editionId)
  if (!nft || !edition) return null
  const issue = edition.available === 0 ? 'unavailable' : l.quantity > edition.available ? 'insufficient' : null
  return {
    id: lineId(l.nftId, l.editionId),
    nftId: nft.id,
    editionId: edition.id,
    editionLabel: edition.label,
    name: nft.name,
    image: nft.image,
    imageAlt: nft.imageAlt,
    unitPrice: nft.price,
    priceAtAdd: l.priceAtAdd,
    quantity: l.quantity,
    available: edition.available,
    issue,
  }
}

function publicCart(owner: Owner): Cart {
  const s = db.get()
  const cart = s.carts[owner.key] ?? emptyCart()
  const coupon = cart.couponCode ? s.coupons.find((c) => c.code === cart.couponCode) : undefined
  return {
    owner: owner.kind,
    version: cart.version,
    lines: cart.lines.map((l) => toLine(s, l)).filter((l): l is CartLine => l !== null),
    coupon: coupon ? { code: coupon.code, label: coupon.label } : null,
  }
}

/** Aplica uma mudança no carrinho do dono e incrementa a versão. */
function mutateCart(owner: Owner, change: (cart: DbCart, s: DbState) => void) {
  db.commit((s) => {
    const cart = s.carts[owner.key] ?? emptyCart()
    change(cart, s)
    cart.version += 1
    s.carts[owner.key] = cart
  })
  emitCartUpdated(owner.key)
}

const outOfStock = (available: number, field = 'quantity') =>
  apiError(409, {
    code: 'OUT_OF_STOCK',
    message: available === 0 ? 'Esta edição está esgotada.' : `Só ${available === 1 ? 'resta 1 unidade' : `restam ${available} unidades`} desta edição.`,
    details: { [field]: available === 0 ? 'Edição esgotada.' : `Disponível: ${available}.` },
  } satisfies ApiErrorBody)

/** Valores e impressão digital das condições atuais do carrinho para uma rede. */
function currentPricing(owner: Owner, network: Network): { pricing: Pricing; fingerprint: string; cart: Cart; percentOff: number } | Response {
  const cart = publicCart(owner)
  if (cart.lines.length === 0) return apiError(409, { code: 'CART_EMPTY', message: 'O carrinho está vazio.' })
  const issues = cart.lines.filter((l) => l.issue)
  if (issues.length > 0) {
    return apiError(409, {
      code: 'OUT_OF_STOCK',
      message: 'Alguns itens não têm mais a quantidade escolhida. Revise o carrinho.',
      details: Object.fromEntries(issues.map((l) => [l.id, l.issue === 'unavailable' ? 'Edição esgotada.' : `Disponível: ${l.available}.`])),
    })
  }
  const percentOff = cart.coupon ? (db.get().coupons.find((c) => c.code === cart.coupon!.code)?.percentOff ?? 0) : 0
  const pricing = priceCart(
    cart.lines.map((l) => ({ lineId: l.id, nftId: l.nftId, editionId: l.editionId, name: l.name, unitPrice: l.unitPrice, quantity: l.quantity })),
    percentOff,
    network,
  )
  const fingerprint = JSON.stringify([network, cart.coupon?.code ?? null, pricing.lines.map((l) => [l.lineId, l.unitPrice, l.quantity])])
  return { pricing, fingerprint, cart, percentOff }
}

/** Merge visitante → usuário: regra pura em cart-model.ts; aqui só lê e grava o estado. */
function mergeCarts(s: DbState, userKey: string, guestKey: string): Omit<MergeCartResponse, 'cart'> {
  const user = s.carts[userKey] ?? emptyCart()
  const guest = s.carts[guestKey]
  delete s.carts[guestKey]
  if (!guest || guest.lines.length === 0) return { adjusted: [], merged: 0 }
  const result = mergeCartLines(
    user,
    guest,
    (nftId, editionId) => {
      const nft = findNft(s, nftId)
      return (nft && editionOf(nft, editionId)?.available) ?? 0
    },
    (nftId) => findNft(s, nftId)?.name ?? nftId,
  )
  s.carts[userKey] = { version: user.version + 1, lines: result.cart.lines, couponCode: result.cart.couponCode }
  return { adjusted: result.adjusted, merged: result.merged }
}

function toQuote(id: string, cartVersion: number, network: Network, pricing: Pricing, coupon: Cart['coupon'], expiresAt: string): Quote {
  return { id, cartVersion, network, lines: pricing.lines, subtotal: pricing.subtotal, discount: pricing.discount, networkFee: pricing.networkFee, total: pricing.total, coupon, expiresAt }
}

export const commerceHandlers = [
  // ---------- Carrinho ----------
  http.get('/api/cart', async ({ request }) => {
    // Teste de corrida (R-44): com a rota retida, o carrinho é FOTOGRAFADO antes de reter (uma
    // leitura que saiu antes de uma escrita e chega depois dela).
    const early = ownerOf(request)
    const snapshot = isHeld('cart.read') && !(early instanceof Response) ? publicCart(early) : undefined
    await routeDelay('cart.read', new URL(request.url))
    const owner = ownerOf(request)
    if (owner instanceof Response) return owner
    const failure = maybeFail('cart.read')
    if (failure) return failure
    return HttpResponse.json(snapshot ?? publicCart(owner))
  }),

  http.post('/api/cart/items', async ({ request }) => {
    await routeDelay('cart.write', new URL(request.url))
    const owner = ownerOf(request)
    if (owner instanceof Response) return owner
    const failure = maybeFail('cart.write')
    if (failure) return failure
    const body = AddCartItem.safeParse(await json(request))
    if (!body.success) return apiError(422, { code: 'VALIDATION_ERROR', message: body.error.issues[0]?.message ?? 'Item inválido.' })
    const s = db.get()
    const nft = findNft(s, body.data.nftId)
    if (!nft) return apiError(404, { code: 'NOT_FOUND', message: 'NFT não encontrado.' })
    const edition = body.data.editionId ? editionOf(nft, body.data.editionId) : (nft.editions.find((e) => e.available > 0) ?? nft.editions[0])
    if (!edition) return apiError(404, { code: 'NOT_FOUND', message: 'Edição não encontrada.' })
    const current = (s.carts[owner.key]?.lines ?? []).find((l) => l.nftId === nft.id && l.editionId === edition.id)?.quantity ?? 0
    const next = current + body.data.quantity
    if (next > edition.available) return outOfStock(Math.max(0, edition.available - current))
    if (next > 99) return apiError(422, { code: 'VALIDATION_ERROR', message: 'A quantidade máxima por item é 99.' })
    mutateCart(owner, (cart) => {
      const line = cart.lines.find((l) => l.nftId === nft.id && l.editionId === edition.id)
      if (line) line.quantity = next
      else cart.lines.push({ nftId: nft.id, editionId: edition.id, quantity: next, priceAtAdd: nft.price })
    })
    return HttpResponse.json(publicCart(owner))
  }),

  http.patch('/api/cart/items/:lineId', async ({ request, params }) => {
    await routeDelay('cart.write', new URL(request.url))
    const owner = ownerOf(request)
    if (owner instanceof Response) return owner
    const failure = maybeFail('cart.write')
    if (failure) return failure
    const body = UpdateCartItem.safeParse(await json(request))
    if (!body.success) return apiError(422, { code: 'VALIDATION_ERROR', message: body.error.issues[0]?.message ?? 'Quantidade inválida.' })
    const s = db.get()
    const line = (s.carts[owner.key]?.lines ?? []).find((l) => lineId(l.nftId, l.editionId) === params.lineId)
    if (!line) return apiError(404, { code: 'NOT_FOUND', message: 'Item não está no carrinho.' })
    const nft = findNft(s, line.nftId)
    const available = (nft && editionOf(nft, line.editionId)?.available) ?? 0
    if (body.data.quantity > available) return outOfStock(available)
    mutateCart(owner, (cart) => {
      cart.lines.find((l) => lineId(l.nftId, l.editionId) === params.lineId)!.quantity = body.data.quantity
    })
    return HttpResponse.json(publicCart(owner))
  }),

  http.delete('/api/cart/items/:lineId', async ({ request, params }) => {
    await routeDelay('cart.write', new URL(request.url))
    const owner = ownerOf(request)
    if (owner instanceof Response) return owner
    const failure = maybeFail('cart.write')
    if (failure) return failure
    const exists = (db.get().carts[owner.key]?.lines ?? []).some((l) => lineId(l.nftId, l.editionId) === params.lineId)
    if (!exists) return apiError(404, { code: 'NOT_FOUND', message: 'Item não está no carrinho.' })
    mutateCart(owner, (cart) => {
      cart.lines = cart.lines.filter((l) => lineId(l.nftId, l.editionId) !== params.lineId)
    })
    return HttpResponse.json(publicCart(owner))
  }),

  // ---------- Cupom ----------
  http.post('/api/cart/coupon', async ({ request }) => {
    await routeDelay('cart.write', new URL(request.url))
    const owner = ownerOf(request)
    if (owner instanceof Response) return owner
    const failure = maybeFail('cart.write')
    if (failure) return failure
    const body = ApplyCoupon.safeParse(await json(request))
    if (!body.success) return apiError(422, { code: 'VALIDATION_ERROR', message: body.error.issues[0]?.message ?? 'Código inválido.', details: { code: body.error.issues[0]?.message ?? 'Código inválido.' } })
    const coupon = db.get().coupons.find((c) => c.code === body.data.code)
    if (!coupon) return apiError(422, { code: 'COUPON_INVALID', message: 'Cupom inválido.', details: { code: 'Cupom inválido. Confira o código.' } })
    if (Date.parse(coupon.expiresAt) <= Date.now()) {
      const date = new Date(coupon.expiresAt).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
      return apiError(422, { code: 'COUPON_EXPIRED', message: `Este cupom expirou em ${date}.`, details: { code: `Este cupom expirou em ${date}.` } })
    }
    mutateCart(owner, (cart) => {
      cart.couponCode = coupon.code
    })
    return HttpResponse.json(publicCart(owner))
  }),

  http.delete('/api/cart/coupon', async ({ request }) => {
    await routeDelay('cart.write', new URL(request.url))
    const owner = ownerOf(request)
    if (owner instanceof Response) return owner
    const failure = maybeFail('cart.write')
    if (failure) return failure
    mutateCart(owner, (cart) => {
      cart.couponCode = null
    })
    return HttpResponse.json(publicCart(owner))
  }),

  // ---------- Merge após login ----------
  http.post('/api/cart/merge', async ({ request }) => {
    await routeDelay('cart.write', new URL(request.url))
    const session = requireSession(request)
    if (session instanceof Response) return session
    const body = MergeCartRequest.safeParse(await json(request))
    if (!body.success) return apiError(422, { code: 'VALIDATION_ERROR', message: 'Carrinho de visitante inválido.' })
    const owner: Owner = { key: `user:${session.userId}`, userId: session.userId, kind: 'user' }
    const result = db.commit((s) => mergeCarts(s, owner.key, `guest:${body.data.guestCartId}`))
    emitCartUpdated(owner.key)
    return HttpResponse.json({ cart: publicCart(owner), ...result } satisfies MergeCartResponse)
  }),

  // ---------- Cotação ----------
  http.post('/api/cart/quote', async ({ request }) => {
    await routeDelay('quote', new URL(request.url))
    const owner = ownerOf(request)
    if (owner instanceof Response) return owner
    const failure = maybeFail('quote')
    if (failure) return failure
    const body = QuoteRequest.safeParse(await json(request))
    if (!body.success) return apiError(422, { code: 'VALIDATION_ERROR', message: 'Rede inválida.' })
    const current = currentPricing(owner, body.data.network)
    if (current instanceof Response) return current
    const id = db.nextId('qt')
    const expiresAt = new Date(Date.now() + QUOTE_TTL_MS).toISOString()
    db.commit((s) => {
      // Mantém só as cotações recentes do dono (as antigas não podem mais virar pedido).
      s.quotes = [...s.quotes.filter((q) => q.ownerKey !== owner.key || !q.consumed).slice(-50), { id, ownerKey: owner.key, network: body.data.network, fingerprint: current.fingerprint, expiresAt, consumed: false }]
    })
    return HttpResponse.json(toQuote(id, current.cart.version, body.data.network, current.pricing, current.cart.coupon, expiresAt))
  }),

  // ---------- Conexão de carteira (simulada) ----------
  http.post('/api/wallet-connections', async ({ request }) => {
    await routeDelay('wallet.connect', new URL(request.url))
    const session = requireSession(request)
    if (session instanceof Response) return session
    const failure = maybeFail('wallet.connect')
    if (failure) return failure
    const body = WalletConnectionRequest.safeParse(await json(request))
    if (!body.success) return apiError(422, { code: 'VALIDATION_ERROR', message: 'Dados da carteira inválidos.' })
    if (!isValidAddress(body.data.network, body.data.address) || !networksForAddress(body.data.address).includes(body.data.network)) {
      return apiError(422, { code: 'VALIDATION_ERROR', message: 'O endereço não pertence à rede escolhida.', details: { network: 'Rede incompatível com a carteira.' } })
    }
    const connection: WalletConnection = { id: db.nextId('wc'), ...body.data, connectedAt: new Date().toISOString() }
    db.commit((s) => {
      // Uma conexão ativa por usuário: conectar outra substitui a anterior.
      s.walletConnections = [...s.walletConnections.filter((c) => c.userId !== session.userId), { ...connection, userId: session.userId }]
    })
    return HttpResponse.json(connection, { status: 201 })
  }),

  http.delete('/api/wallet-connections/:id', async ({ request, params }) => {
    await routeDelay('wallet.connect', new URL(request.url))
    const session = requireSession(request)
    if (session instanceof Response) return session
    db.commit((s) => {
      s.walletConnections = s.walletConnections.filter((c) => !(c.id === params.id && c.userId === session.userId))
    })
    return new HttpResponse(null, { status: 204 })
  }),
]

/**
 * Cria o pedido a partir do checkout (chamado por POST /api/orders DEPOIS da verificação de
 * idempotência, que devolve o mesmo pedido para a mesma chave + mesmo conteúdo).
 */
export async function createCheckoutOrder(
  session: DbSession,
  body: CheckoutRequest,
  idempotency: { key: string; requestHash: string },
  publicOrder: (o: DbOrder) => Order,
): Promise<Response> {
  const failure = maybeFail('orders.create')
  if (failure) return failure

  const s = db.get()
  const owner: Owner = { key: `user:${session.userId}`, userId: session.userId, kind: 'user' }
  const quote = s.quotes.find((q) => q.id === body.quoteId && q.ownerKey === owner.key)
  if (!quote || quote.consumed) return apiError(409, { code: 'QUOTE_STALE', message: 'A cotação não é mais válida. Revise os valores.' })
  if (Date.parse(quote.expiresAt) <= Date.now()) return apiError(409, { code: 'QUOTE_EXPIRED', message: 'A cotação expirou. Gere uma nova e confirme os valores.' })
  if (body.network !== quote.network) return apiError(409, { code: 'QUOTE_STALE', message: 'A rede mudou depois da cotação. Revise os valores.' })

  const current = currentPricing(owner, quote.network)
  if (current instanceof Response) return current
  if (current.fingerprint !== quote.fingerprint) {
    return apiError(409, { code: 'QUOTE_STALE', message: 'Preços, estoque ou itens mudaram depois da cotação. Revise os novos valores.' })
  }

  // Carteira: cadastrada (do próprio usuário) ou informada para esta compra.
  let address: string
  let walletLabel: string
  if (body.wallet.kind === 'saved') {
    const walletId = body.wallet.walletId
    const wallet = (s.wallets[session.userId] ?? []).find((w) => w.id === walletId)
    if (!wallet) return apiError(422, { code: 'VALIDATION_ERROR', message: 'Carteira não encontrada.', details: { wallet: 'Selecione uma das suas carteiras.' } })
    address = wallet.address
    walletLabel = wallet.ens ? `${wallet.nickname} (${wallet.ens}.eth)` : wallet.nickname
  } else {
    address = body.wallet.address
    walletLabel = 'Carteira informada no pagamento'
  }
  if (!networksForAddress(address).includes(body.network)) {
    return apiError(422, { code: 'VALIDATION_ERROR', message: 'Rede incompatível com a carteira.', details: { network: 'Rede incompatível com a carteira.' } })
  }
  const connection = s.walletConnections.find((c) => c.id === body.connectionId && c.userId === session.userId)
  if (!connection || connection.address.toLowerCase() !== address.toLowerCase() || connection.network !== body.network) {
    return apiError(409, { code: 'WALLET_DISCONNECTED', message: 'A carteira não está conectada. Conecte-a novamente.', details: { wallet: 'Conecte a carteira selecionada.' } })
  }

  const scenario = db.scenario()
  const order: DbOrder = {
    id: db.nextId('ord'),
    userId: session.userId,
    status: 'pending',
    version: 1,
    // Snapshot (CP6): tudo o que o recibo mostra é copiado agora; nada é lido do catálogo depois.
    lines: current.pricing.lines.map((l) => {
      const cartLine = current.cart.lines.find((c) => c.id === l.lineId)
      return { nftId: l.nftId, editionId: l.editionId, editionLabel: cartLine?.editionLabel, image: cartLine?.image, imageAlt: cartLine?.imageAlt, name: l.name, unitPrice: l.unitPrice, quantity: l.quantity, lineTotal: l.lineTotal }
    }),
    total: current.pricing.total,
    txHash: null,
    createdAt: new Date().toISOString(),
    pricing: {
      quoteId: quote.id,
      network: quote.network,
      subtotal: current.pricing.subtotal,
      discount: current.pricing.discount,
      networkFee: current.pricing.networkFee,
      couponCode: current.cart.coupon?.code ?? null,
      walletAddress: address,
      walletLabel,
      provider: connection.provider,
    },
    settledAt: null,
    failureReason: null,
    reservedUntil: new Date(now() + RESERVATION_TTL_MS).toISOString(),
    idempotencyKey: idempotency.key,
    requestHash: idempotency.requestHash,
    settleAt: scenario.settlement === 'auto' ? Date.now() + scenario.settleDelayMs : null,
  }
  db.commit((st) => {
    st.orders.push(order)
    st.quotes.find((q) => q.id === quote.id)!.consumed = true
    // O carrinho NÃO muda aqui (PAY-07): os itens comprados saem só quando o pedido for
    // CONFIRMADO (services.settleOrder); se for recusado, o carrinho fica intacto.
  })
  // Baixa do estoque: cada NFT afetado emite `nft.updated` (catálogo, detalhe e carrinhos de outros usuários reagem).
  for (const line of order.lines) {
    const nft = findNft(db.get(), line.nftId)!
    const edition = editionOf(nft, line.editionId!)!
    updateNft(nft.id, { editions: [{ id: edition.id, available: edition.available - line.quantity }] })
  }
  scheduleSettlement(order)

  // Falhas DEPOIS de gravar (PEND-02): o pedido existe, mas o cliente não recebe a resposta.
  const lost = takeAfterCommitFailure('orders.create')
  if (lost === 'network-after-commit') return HttpResponse.error()
  if (lost === 'timeout-after-commit') await delay(LATE_RESPONSE_MS)
  return HttpResponse.json(publicOrder(order), { status: 201 })
}

