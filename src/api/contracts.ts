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

export const Rarity = z.enum(['common', 'rare', 'legendary'])
export type Rarity = z.infer<typeof Rarity>

export const CategoryId = z.enum(['arte-digital', 'fotografia', 'musica', 'arte-3d', 'colecionaveis', 'generativa', 'jogos', 'assinaturas', 'utilidade'])
export type CategoryId = z.infer<typeof CategoryId>

export const Edition = z.object({
  id: z.string(),
  /** Rótulo do Figma: "1/10", "1/1", "1/50", "Aberta". */
  label: z.string(),
  /** Tiragem; null = edição aberta. */
  supply: z.number().int().positive().nullable(),
  available: z.number().int().nonnegative(),
})
export type Edition = z.infer<typeof Edition>

/** Resumo do NFT (listagens e cards). */
export const Nft = z.object({
  id: z.string(),
  name: z.string(),
  collection: z.string(),
  category: CategoryId,
  /** URL da arte (servida localmente em /assets/nfts). */
  image: z.string(),
  /** Texto alternativo descritivo da arte (A11Y-04). */
  imageAlt: z.string(),
  network: Network,
  rarity: Rarity,
  price: EthAmount,
  previousPrice: EthAmount.nullable(),
  /** Soma da disponibilidade de todas as edições. */
  available: z.number().int().nonnegative(),
  listedAt: z.string(),
  rating: z.number(),
  reviewsCount: z.number().int().nonnegative(),
  /** Versão do recurso: cresce a cada mudança; usada para ordenar eventos. */
  version: z.number().int().positive(),
})
export type Nft = z.infer<typeof Nft>

export const Review = z.object({ id: z.string(), author: z.string(), rating: z.number().int().min(1).max(5), text: z.string(), createdAt: z.string() })
export type Review = z.infer<typeof Review>

/** Detalhe do NFT (rota /nft/$nftId). */
export const NftDetail = Nft.extend({
  description: z.string(),
  tokenId: z.string(),
  attributes: z.array(z.string()),
  gallery: z.array(z.object({ src: z.string(), alt: z.string() })).min(1),
  editions: z.array(Edition).min(1),
  contract: z.string(),
  royalties: z.string(),
  reviews: z.array(Review),
})
export type NftDetail = z.infer<typeof NftDetail>

// ---------- Catálogo (busca, filtros, ordenação, paginação) ----------
export const CatalogTab = z.enum(['all', 'new', 'trending'])
export type CatalogTab = z.infer<typeof CatalogTab>
export const CatalogSort = z.enum(['recent', 'price-asc', 'price-desc', 'popular', 'name'])
export type CatalogSort = z.infer<typeof CatalogSort>

/** Parâmetros enviados à API. Os mesmos nomes são usados na URL (TanStack Router). */
export interface CatalogParams {
  q?: string
  category?: CategoryId
  network?: Network
  minPrice?: string
  maxPrice?: string
  tab?: CatalogTab
  sort?: CatalogSort
  page?: number
  pageSize?: number
  collection?: string
  exclude?: string
}

const Facet = z.object({ id: z.string(), label: z.string(), count: z.number().int().nonnegative() })

export const NftList = z.object({
  items: z.array(Nft),
  total: z.number().int(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  pageCount: z.number().int().nonnegative(),
  /** Contagens por faceta, calculadas com os DEMAIS filtros aplicados. */
  facets: z.object({ categories: z.array(Facet), networks: z.array(Facet) }),
  /** Faixa de preço de todo o catálogo (limites do slider). */
  priceBounds: z.object({ min: EthAmount, max: EthAmount }),
})
export type NftList = z.infer<typeof NftList>

export const Highlights = z.object({ hero: z.array(Nft).min(1), limitedOffer: Nft })
export type Highlights = z.infer<typeof Highlights>

// ---------- Favoritos ----------
export const FavoriteList = z.object({ ids: z.array(z.string()), items: z.array(Nft) })
export type FavoriteList = z.infer<typeof FavoriteList>

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
  z.object({
    price: EthAmount,
    available: z.number().int().nonnegative(),
    /** Disponibilidade por edição (detalhe e seleção de edição). */
    editions: z.array(z.object({ id: z.string(), available: z.number().int().nonnegative() })),
  }),
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
