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

// ---------- Regras de validação compartilhadas (formulários e mock usam as MESMAS) ----------
export const EmailField = z.string().trim().min(1, 'Informe o e-mail').email('Informe um e-mail válido').max(120, 'E-mail muito longo')
export const UsernameField = z
  .string()
  .trim()
  .min(3, 'Use pelo menos 3 caracteres')
  .max(24, 'Use no máximo 24 caracteres')
  .regex(/^[a-z0-9._]+$/, 'Use apenas letras minúsculas, números, ponto e sublinhado')
/** Requisitos de senha: 8+ caracteres, com letra e número. */
export const PasswordField = z
  .string()
  .min(8, 'A senha precisa ter pelo menos 8 caracteres')
  .max(72, 'A senha pode ter no máximo 72 caracteres')
  .regex(/[A-Za-z]/, 'A senha precisa ter pelo menos uma letra')
  .regex(/\d/, 'A senha precisa ter pelo menos um número')
export const PASSWORD_HINT = 'Mínimo de 8 caracteres, com pelo menos uma letra e um número.'
export const DisplayNameField = z.string().trim().min(2, 'Informe pelo menos 2 caracteres').max(40, 'Use no máximo 40 caracteres')
export const WalletNicknameField = z.string().trim().min(2, 'Informe pelo menos 2 caracteres').max(30, 'Use no máximo 30 caracteres')

// ---------- Sessão ----------
export const User = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  username: z.string(),
  /** Data URL da imagem (upload simulado) ou null. */
  avatarUrl: z.string().nullable(),
})
export type User = z.infer<typeof User>

export const LoginRequest = z.object({
  email: EmailField,
  password: z.string().min(1, 'Informe a senha'),
})
export type LoginRequest = z.infer<typeof LoginRequest>

export const RegisterRequest = z
  .object({
    username: UsernameField,
    email: EmailField,
    password: PasswordField,
    confirmPassword: z.string().min(1, 'Confirme a senha'),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não conferem' })
export type RegisterRequest = z.infer<typeof RegisterRequest>

// ---------- Perfil ----------
export const Profile = User.extend({ walletNickname: z.string(), version: z.number().int().positive() })
export type Profile = z.infer<typeof Profile>

export const ProfileUpdate = z.object({
  displayName: DisplayNameField,
  username: UsernameField,
  email: EmailField,
  walletNickname: WalletNicknameField,
})
export type ProfileUpdate = z.infer<typeof ProfileUpdate>

export const AVATAR_MAX_BYTES = 512 * 1024
export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const AvatarUpload = z.object({
  dataUrl: z.string().regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'Formato de imagem não suportado (use PNG, JPEG ou WebP)'),
})

export const PasswordChange = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: PasswordField,
    confirmPassword: z.string().min(1, 'Confirme a nova senha'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não conferem' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'A nova senha precisa ser diferente da atual' })
export type PasswordChange = z.infer<typeof PasswordChange>

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

// ---------- Carteiras (principal e secundária) ----------
export const WalletType = z.enum(['metamask', 'walletconnect', 'coinbase'])
export type WalletType = z.infer<typeof WalletType>
export const WALLET_TYPE_LABEL: Record<WalletType, string> = { metamask: 'MetaMask', walletconnect: 'WalletConnect', coinbase: 'Coinbase Wallet' }
/** Limite do enunciado: uma carteira principal e uma secundária. */
export const MAX_WALLETS = 2

/** Endereço válido por rede: EVM (Ethereum/Polygon) = 0x + 40 hex; Solana = base58 com 32–44 caracteres. */
export function isValidAddress(network: Network, address: string) {
  return network === 'solana' ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address) : /^0x[a-fA-F0-9]{40}$/.test(address)
}

export const Wallet = z.object({
  id: z.string(),
  nickname: z.string(),
  network: Network,
  type: WalletType,
  address: z.string(),
  ens: z.string().nullable(),
  primary: z.boolean(),
  version: z.number().int().positive(),
})
export type Wallet = z.infer<typeof Wallet>
export const WalletList = z.object({ items: z.array(Wallet) })

export const WalletInput = z
  .object({
    nickname: WalletNicknameField,
    network: Network,
    type: WalletType,
    address: z.string().trim().min(1, 'Informe o endereço da carteira'),
    /** Sem o sufixo ".eth" (o campo mostra o sufixo fixo, como no Figma). */
    ens: z
      .string()
      .trim()
      .max(40, 'Use no máximo 40 caracteres')
      .regex(/^([a-z0-9-]{2,}(\.[a-z0-9-]{2,})*)?$/, 'Use letras minúsculas, números, hífen e ponto (ex.: nova.kurio)')
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (v.address && !isValidAddress(v.network, v.address)) {
      ctx.addIssue({
        code: 'custom',
        path: ['address'],
        message: v.network === 'solana' ? 'Endereço Solana inválido (base58, 32 a 44 caracteres)' : 'Endereço inválido: use 0x seguido de 40 caracteres hexadecimais',
      })
    }
  })
export type WalletInput = z.infer<typeof WalletInput>

// ---------- Pedidos ----------
export const OrderStatus = z.enum(['pending', 'confirmed', 'rejected'])
export type OrderStatus = z.infer<typeof OrderStatus>
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ['confirmed', 'rejected']
/** Motivo da recusa: pagamento recusado pela rede ou reserva de estoque vencida (R-40). */
export const OrderFailureReason = z.enum(['payment_rejected', 'reservation_expired'])
export type OrderFailureReason = z.infer<typeof OrderFailureReason>

export const OrderLine = z.object({
  nftId: z.string(),
  /** CP5: edição comprada (pedidos da PoC do CP1 não têm). */
  editionId: z.string().optional(),
  name: z.string(),
  /** CP6: snapshot de exibição gravado na criação (o recibo nunca lê o catálogo). */
  editionLabel: z.string().optional(),
  image: z.string().optional(),
  imageAlt: z.string().optional(),
  unitPrice: EthAmount,
  quantity: z.number().int().positive(),
  lineTotal: EthAmount,
})

/** Valores congelados da cotação aceita (pedidos criados pelo checkout do CP5). */
export const OrderPricing = z.object({
  quoteId: z.string(),
  network: Network,
  subtotal: EthAmount,
  discount: EthAmount,
  networkFee: EthAmount,
  couponCode: z.string().nullable(),
  walletAddress: z.string(),
  /** CP6: carteira como estava na compra (apelido e provedor da conexão). */
  walletLabel: z.string().optional(),
  provider: WalletType.optional(),
})
export type OrderPricing = z.infer<typeof OrderPricing>

export const Order = z.object({
  id: z.string(),
  userId: z.string(),
  status: OrderStatus,
  version: z.number().int().positive(),
  lines: z.array(OrderLine),
  total: EthAmount,
  txHash: z.string().nullable(),
  createdAt: z.string(),
  pricing: OrderPricing.nullable().optional(),
  /** CP6: momento da liquidação (confirmação ou recusa) e motivo da recusa. */
  settledAt: z.string().nullable().optional(),
  failureReason: OrderFailureReason.nullable().optional(),
  /** CP6: prazo da reserva de estoque de um pedido pendente (R-40). */
  reservedUntil: z.string().nullable().optional(),
})
export type Order = z.infer<typeof Order>

export const OrderList = z.object({ items: z.array(Order) })

/** Explorador SIMULADO (demonstração): dados públicos de uma transação confirmada. */
export const ExplorerTx = z.object({
  hash: z.string(),
  status: z.literal('confirmed'),
  network: Network,
  blockNumber: z.number().int().positive(),
  from: z.string(),
  value: EthAmount,
  confirmedAt: z.string(),
  demo: z.literal(true),
})
export type ExplorerTx = z.infer<typeof ExplorerTx>

/** Pedido direto por itens (PoC do CP1, em /demo/poc). O checkout usa `CheckoutRequest`. */
export const CreateOrderRequest = z.object({
  items: z.array(z.object({ nftId: z.string(), quantity: z.number().int().positive() })).min(1),
})
export type CreateOrderRequest = z.infer<typeof CreateOrderRequest>

// ---------- Carrinho, cupons e cotação (CP5) ----------
/** Limite por linha (evita quantidades absurdas; o estoque real é validado pela API). */
export const MAX_LINE_QUANTITY = 99

/** Problema atual da linha: estoque menor que a quantidade, ou edição esgotada. */
export const CartLineIssue = z.enum(['insufficient', 'unavailable'])
export type CartLineIssue = z.infer<typeof CartLineIssue>

export const CartLine = z.object({
  /** Identidade da linha: NFT + edição (`nftId:editionId`). */
  id: z.string(),
  nftId: z.string(),
  editionId: z.string(),
  editionLabel: z.string(),
  name: z.string(),
  image: z.string(),
  imageAlt: z.string(),
  unitPrice: EthAmount,
  /** Preço quando o item foi adicionado; diferente de `unitPrice` = o preço mudou desde então. */
  priceAtAdd: EthAmount,
  quantity: z.number().int().positive(),
  /** Disponibilidade atual da edição. */
  available: z.number().int().nonnegative(),
  issue: CartLineIssue.nullable(),
})
export type CartLine = z.infer<typeof CartLine>

export const AppliedCoupon = z.object({ code: z.string(), label: z.string() })

export const Cart = z.object({
  /** Dono: usuário autenticado ou carrinho de visitante. */
  owner: z.enum(['user', 'guest']),
  /** Cresce a cada mudança de conteúdo (itens, quantidades, cupom). */
  version: z.number().int().nonnegative(),
  lines: z.array(CartLine),
  coupon: AppliedCoupon.nullable(),
})
export type Cart = z.infer<typeof Cart>

const Quantity = z.number().int().positive('A quantidade mínima é 1').max(MAX_LINE_QUANTITY, `A quantidade máxima é ${MAX_LINE_QUANTITY}`)

export const AddCartItem = z.object({
  nftId: z.string().min(1),
  /** Opcional: sem edição (ex.: card do catálogo), a API escolhe a primeira edição disponível. */
  editionId: z.string().min(1).optional(),
  quantity: Quantity,
})
export type AddCartItem = z.infer<typeof AddCartItem>

export const UpdateCartItem = z.object({ quantity: Quantity })

export const ApplyCoupon = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Informe o código promocional')
    .max(32, 'Código muito longo')
    .transform((v) => v.toUpperCase()),
})

export const MergeCartRequest = z.object({ guestCartId: z.string().min(8) })
export const MergeCartResponse = z.object({
  cart: Cart,
  /** Linhas cuja quantidade foi reduzida (ou removida) pelo estoque durante o merge. */
  adjusted: z.array(z.object({ name: z.string(), requested: z.number().int(), kept: z.number().int().nonnegative() })),
  merged: z.number().int().nonnegative(),
})
export type MergeCartResponse = z.infer<typeof MergeCartResponse>

export const QuoteRequest = z.object({ network: Network })

export const QuoteLine = z.object({
  lineId: z.string(),
  nftId: z.string(),
  editionId: z.string(),
  name: z.string(),
  unitPrice: EthAmount,
  quantity: z.number().int().positive(),
  lineTotal: EthAmount,
})

/**
 * Cotação: a FONTE DE VERDADE dos valores (CART-03 / PAY-02). Calculada pela API em wei
 * (bigint) e devolvida como strings decimais. O cliente só exibe; nunca soma.
 */
export const Quote = z.object({
  id: z.string(),
  cartVersion: z.number().int().nonnegative(),
  network: Network,
  lines: z.array(QuoteLine),
  subtotal: EthAmount,
  discount: EthAmount,
  networkFee: EthAmount,
  total: EthAmount,
  coupon: AppliedCoupon.nullable(),
  expiresAt: z.string(),
})
export type Quote = z.infer<typeof Quote>

/** Mesmos valores = mesma oferta (ids e validade podem mudar). */
export function sameQuoteValues(a: Quote, b: Quote) {
  const key = (q: Quote) =>
    JSON.stringify([q.network, q.subtotal, q.discount, q.networkFee, q.total, q.coupon?.code ?? null, q.lines.map((l) => [l.lineId, l.unitPrice, l.quantity, l.lineTotal])])
  return key(a) === key(b)
}

// ---------- Checkout (CP5) ----------
/** Conexão simulada de carteira (WalletConnect, MetaMask, Coinbase Wallet): nada real. */
export const WalletConnectionRequest = z.object({
  provider: WalletType,
  network: Network,
  address: z.string().min(1),
})
export const WalletConnection = WalletConnectionRequest.extend({ id: z.string(), connectedAt: z.string() })
export type WalletConnection = z.infer<typeof WalletConnection>

/** Redes compatíveis com o formato do endereço (EVM ↔ Ethereum/Polygon; base58 ↔ Solana). */
export function networksForAddress(address: string): Network[] {
  return /^0x/i.test(address) ? ['ethereum', 'polygon'] : ['solana']
}

export const CheckoutBuyer = z.object({
  displayName: DisplayNameField,
  email: EmailField,
  note: z.string().trim().max(280, 'Use no máximo 280 caracteres').optional(),
})
export type CheckoutBuyer = z.infer<typeof CheckoutBuyer>

/** Carteira de pagamento: uma cadastrada no perfil ou outra informada só para esta compra. */
export const PaymentWallet = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('saved'), walletId: z.string().min(1, 'Selecione uma carteira') }),
  z
    .object({
      kind: z.literal('external'),
      network: Network,
      type: WalletType,
      address: z.string().trim().min(1, 'Informe o endereço da carteira'),
    })
    .superRefine((v, ctx) => {
      if (!isValidAddress(v.network, v.address)) {
        ctx.addIssue({
          code: 'custom',
          path: ['address'],
          message: v.network === 'solana' ? 'Endereço Solana inválido (base58, 32 a 44 caracteres)' : 'Endereço inválido: use 0x seguido de 40 caracteres hexadecimais',
        })
      }
    }),
])
export type PaymentWallet = z.infer<typeof PaymentWallet>

export const CheckoutRequest = z.object({
  quoteId: z.string().min(1),
  network: Network,
  buyer: CheckoutBuyer,
  wallet: PaymentWallet,
  connectionId: z.string().min(1, 'Conecte a carteira antes de confirmar'),
})
export type CheckoutRequest = z.infer<typeof CheckoutRequest>

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
  // CP5
  'COUPON_INVALID',
  'COUPON_EXPIRED',
  'QUOTE_EXPIRED',
  'QUOTE_STALE',
  'CART_EMPTY',
  'WALLET_REJECTED',
  'WALLET_DISCONNECTED',
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
  z.object({
    status: OrderStatus,
    txHash: z.string().nullable(),
    /** CP6: momento da liquidação e motivo da recusa (o recibo não espera o REST para mostrá-los). */
    settledAt: z.string().nullable().optional(),
    failureReason: OrderFailureReason.nullable().optional(),
  }),
)
export type OrderUpdatedEvent = z.infer<typeof OrderUpdatedEvent>

export type RealtimeEvent = NftUpdatedEvent | OrderUpdatedEvent

export const REALTIME_EVENTS = {
  nftUpdated: 'nft.updated',
  orderUpdated: 'order.updated',
} as const
