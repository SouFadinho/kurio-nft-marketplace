/**
 * Contratos tipados entre transporte (REST/Socket.IO), estado (TanStack Query) e interface.
 *
 * Os schemas zod são a fonte única: o cliente valida as respostas e a camada de mocks
 * usa os mesmos tipos para produzir os dados. Assim, um contrato quebrado falha cedo.
 *
 * Valores em ETH trafegam SEMPRE como string decimal (ex.: "1.19"). Nunca como number.
 */
import { z } from 'zod'

/** String decimal positiva com até 18 casas (precisão de wei). */
export const EthAmount = z.string().regex(/^\d+(\.\d{1,18})?$/, 'Valor ETH inválido')
export type EthAmount = z.infer<typeof EthAmount>

// ---------- Sessão ----------
export const User = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
})
export type User = z.infer<typeof User>

export const LoginRequest = z.object({
  email: z.string().email('Informe um e-mail válido'),
  password: z.string().min(1, 'Informe a senha'),
})
export type LoginRequest = z.infer<typeof LoginRequest>

export const SessionResponse = z.object({ user: User, token: z.string(), expiresAt: z.string() })
export type SessionResponse = z.infer<typeof SessionResponse>

// ---------- NFTs ----------
export const Network = z.enum(['ethereum', 'polygon', 'solana'])
export type Network = z.infer<typeof Network>

export const Nft = z.object({
  id: z.string(),
  name: z.string(),
  collection: z.string(),
  /** URL da arte (servida localmente em /assets/nfts). */
  image: z.string(),
  /** Texto alternativo descritivo da arte (A11Y-04). */
  imageAlt: z.string(),
  network: Network,
  rare: z.boolean(),
  price: EthAmount,
  available: z.number().int().nonnegative(),
  /** Versão do recurso: cresce a cada mudança; usada para ordenar eventos. */
  version: z.number().int().positive(),
})
export type Nft = z.infer<typeof Nft>

export const NftList = z.object({
  items: z.array(Nft),
  total: z.number().int(),
})
export type NftList = z.infer<typeof NftList>

// ---------- Pedidos ----------
export const OrderStatus = z.enum(['pending', 'confirmed', 'rejected'])
export type OrderStatus = z.infer<typeof OrderStatus>
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ['confirmed', 'rejected']

export const OrderLine = z.object({
  nftId: z.string(),
  name: z.string(),
  unitPrice: EthAmount,
  quantity: z.number().int().positive(),
  lineTotal: EthAmount,
})

export const Order = z.object({
  id: z.string(),
  userId: z.string(),
  status: OrderStatus,
  version: z.number().int().positive(),
  lines: z.array(OrderLine),
  total: EthAmount,
  txHash: z.string().nullable(),
  createdAt: z.string(),
})
export type Order = z.infer<typeof Order>

export const CreateOrderRequest = z.object({
  items: z.array(z.object({ nftId: z.string(), quantity: z.number().int().positive() })).min(1),
})
export type CreateOrderRequest = z.infer<typeof CreateOrderRequest>

// ---------- Erros ----------
export const ApiErrorCode = z.enum([
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'IDEMPOTENCY_KEY_REUSED',
  'OUT_OF_STOCK',
  'TRANSIENT',
])
export type ApiErrorCode = z.infer<typeof ApiErrorCode>

export const ApiErrorBody = z.object({
  code: ApiErrorCode,
  message: z.string(),
  details: z.record(z.string(), z.string()).optional(),
})
export type ApiErrorBody = z.infer<typeof ApiErrorBody>

// ---------- Eventos Socket.IO ----------
/**
 * Envelope comum: identidade estável (eventId), recurso afetado e versão.
 * `userId` só existe em eventos privados (ex.: pedidos).
 */
const EventEnvelope = <T extends string, R extends string, D extends z.ZodTypeAny>(type: T, resource: R, data: D) =>
  z.object({
    eventId: z.string(),
    type: z.literal(type),
    resource: z.object({ type: z.literal(resource), id: z.string() }),
    version: z.number().int().positive(),
    occurredAt: z.string(),
    userId: z.string().optional(),
    data,
  })

export const NftUpdatedEvent = EventEnvelope(
  'nft.updated',
  'nft',
  z.object({ price: EthAmount, available: z.number().int().nonnegative() }),
)
export type NftUpdatedEvent = z.infer<typeof NftUpdatedEvent>

export const OrderUpdatedEvent = EventEnvelope(
  'order.updated',
  'order',
  z.object({ status: OrderStatus, txHash: z.string().nullable() }),
)
export type OrderUpdatedEvent = z.infer<typeof OrderUpdatedEvent>

export type RealtimeEvent = NftUpdatedEvent | OrderUpdatedEvent

export const REALTIME_EVENTS = {
  nftUpdated: 'nft.updated',
  orderUpdated: 'order.updated',
} as const
