/**
 * Regras do catálogo no "servidor" simulado: filtros, ordenação, paginação, facetas e
 * conversões para os contratos. Funções puras sobre o db (testáveis e reutilizadas pelos
 * handlers e pelos eventos).
 */
import type { CatalogSort, CatalogTab, CategoryId, Network, Nft, NftDetail, NftList, Review } from '@/api/contracts'
import { parseEth } from '@/lib/eth'
import type { DbNft } from './db'
import { CATEGORIES, NEW_RELEASE_SINCE, TRENDING_MIN_POPULARITY } from './fixtures/catalog'

export const DEFAULT_PAGE_SIZE = 9
export const MAX_PAGE_SIZE = 36

const NETWORKS: Array<{ id: Network; label: string }> = [
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'solana', label: 'Solana' },
]

export const availableOf = (n: Pick<DbNft, 'editions'>) => n.editions.reduce((sum, e) => sum + e.available, 0)

export function toSummary(n: DbNft): Nft {
  return {
    id: n.id,
    name: n.name,
    collection: n.collection,
    category: n.category,
    image: n.image,
    imageAlt: n.imageAlt,
    network: n.network,
    rarity: n.rarity,
    price: n.price,
    previousPrice: n.previousPrice,
    available: availableOf(n),
    listedAt: n.listedAt,
    rating: n.rating,
    reviewsCount: n.reviewsCount,
    version: n.version,
  }
}

const AUTHORS = ['Marina C.', 'Rafael T.', 'Júlia P.', 'Caio M.', 'Beatriz L.', 'Otávio R.']
const COMMENTS = [
  'Arte impecável e procedência clara. Chegou na carteira em minutos.',
  'Os detalhes em alta resolução valem cada ETH. Recomendo a coleção.',
  'Ótima curadoria. Gostaria de mais edições abertas.',
  'Comunidade ativa e criador presente. Compra tranquila.',
]

function reviewsOf(n: DbNft): Review[] {
  const seed = Number(n.id.replace(/\D/g, ''))
  return Array.from({ length: 3 }, (_, i) => ({
    id: `${n.id}-r${i + 1}`,
    author: AUTHORS[(seed + i) % AUTHORS.length]!,
    rating: 5 - ((seed + i) % 2),
    text: COMMENTS[(seed + i) % COMMENTS.length]!,
    createdAt: new Date(Date.parse(n.listedAt) + (i + 1) * 86_400_000).toISOString(),
  }))
}

export function toDetail(n: DbNft): NftDetail {
  const hex = Array.from(n.id).reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(16).padStart(8, '0')
  return {
    ...toSummary(n),
    description: n.description,
    tokenId: n.tokenId,
    attributes: n.attributes,
    gallery: n.gallery.map((src, i) => ({ src, alt: i === 0 ? n.imageAlt : `Detalhe ampliado: ${n.imageAlt.charAt(0).toLowerCase()}${n.imageAlt.slice(1)}` })),
    editions: n.editions.map((e) => ({ id: e.id, label: e.label, supply: e.supply, available: e.available })),
    contract: `0x7A${hex.toUpperCase()}…${hex.slice(0, 4).toUpperCase()}`,
    royalties: '5%',
    reviews: reviewsOf(n),
  }
}

/** Busca sem acento e sem diferenciar maiúsculas. */
const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export interface ListQuery {
  q?: string
  category?: CategoryId
  network?: Network
  minPrice?: bigint
  maxPrice?: bigint
  tab: CatalogTab
  sort: CatalogSort
  page: number
  pageSize: number
  collection?: string
  exclude?: string
}

type Filter = (n: DbNft) => boolean

function filters(q: ListQuery): Record<'text' | 'category' | 'network' | 'price' | 'tab' | 'collection' | 'exclude', Filter> {
  const term = q.q ? normalize(q.q) : ''
  return {
    text: (n) => !term || normalize(`${n.name} ${n.collection} ${CATEGORIES.find((c) => c.id === n.category)?.label ?? ''}`).includes(term),
    category: (n) => !q.category || n.category === q.category,
    network: (n) => !q.network || n.network === q.network,
    price: (n) => {
      const p = parseEth(n.price)
      return (q.minPrice === undefined || p >= q.minPrice) && (q.maxPrice === undefined || p <= q.maxPrice)
    },
    tab: (n) => (q.tab === 'new' ? n.listedAt >= NEW_RELEASE_SINCE : q.tab === 'trending' ? n.popularity >= TRENDING_MIN_POPULARITY : true),
    collection: (n) => !q.collection || n.collection === q.collection,
    exclude: (n) => !q.exclude || n.id !== q.exclude,
  }
}

// CP9.2 (perfil de CPU): `localeCompare` cria um colador ICU; na ordenação padrão ("recentes") isso
// custava ~35 ms (CPU 4×) em toda listagem da abertura. Datas ISO ordenam corretamente por
// comparação simples de strings (mesma ordem). O colador pt-BR dos nomes é criado só quando uma
// ordenação por nome é usada.
let nameCollator: Intl.Collator | undefined
const byName = (a: DbNft, b: DbNft) => (nameCollator ??= new Intl.Collator('pt-BR')).compare(a.name, b.name)
const newestFirst = (a: DbNft, b: DbNft) => (a.listedAt < b.listedAt ? 1 : a.listedAt > b.listedAt ? -1 : 0)

const SORTERS: Record<CatalogSort, (a: DbNft, b: DbNft) => number> = {
  recent: newestFirst,
  'price-asc': (a, b) => Number(parseEth(a.price) - parseEth(b.price)) || byName(a, b),
  'price-desc': (a, b) => Number(parseEth(b.price) - parseEth(a.price)) || byName(a, b),
  popular: (a, b) => b.popularity - a.popularity || byName(a, b),
  name: byName,
}

export function listNfts(all: DbNft[], q: ListQuery): NftList {
  const f = filters(q)
  const applyExcept = (skip: keyof typeof f) => all.filter((n) => (Object.keys(f) as Array<keyof typeof f>).every((k) => k === skip || f[k](n)))
  const matched = applyExcept('exclude').filter(f.exclude).sort(SORTERS[q.sort])

  const byCategory = applyExcept('category')
  const byNetwork = applyExcept('network')
  const prices = all.map((n) => parseEth(n.price))
  const min = prices.reduce((a, b) => (b < a ? b : a), prices[0] ?? 0n)
  const max = prices.reduce((a, b) => (b > a ? b : a), prices[0] ?? 0n)
  const toEth = (v: bigint) => (Number(v / 10n ** 14n) / 10_000).toFixed(2)

  const pageCount = Math.ceil(matched.length / q.pageSize)
  const start = (q.page - 1) * q.pageSize
  return {
    items: matched.slice(start, start + q.pageSize).map(toSummary),
    total: matched.length,
    page: q.page,
    pageSize: q.pageSize,
    pageCount,
    facets: {
      categories: CATEGORIES.map((c) => ({ id: c.id, label: c.label, count: byCategory.filter((n) => n.category === c.id).length })),
      networks: NETWORKS.map((n) => ({ id: n.id, label: n.label, count: byNetwork.filter((x) => x.network === n.id).length })),
    },
    priceBounds: { min: toEth(min), max: toEth(max) },
  }
}
