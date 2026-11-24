/**
 * Handlers REST do catálogo, detalhe, destaques e favoritos (CP3).
 * Toda regra (filtro, ordenação, paginação, facetas, estoque) fica aqui, no "servidor".
 */
import { http, HttpResponse } from 'msw'
import { CatalogSort, CatalogTab, CategoryId, Network, type FavoriteList, type Highlights } from '@/api/contracts'
import { parseEth } from '@/lib/eth'
import { db } from '../db'
import { maybeFail, routeDelay } from '../failures'
import { HIGHLIGHTS } from '../fixtures/catalog'
import { apiError, requireSession } from '../session'
import { DEFAULT_PAGE_SIZE, listNfts, MAX_PAGE_SIZE, toDetail, toSummary, type ListQuery } from '../catalog-model'

function parseList(url: URL): ListQuery | Response {
  const p = url.searchParams
  const invalid = (field: string) => apiError(422, { code: 'VALIDATION_ERROR', message: `Parâmetro inválido: ${field}`, details: { [field]: 'inválido' } })
  const enumOf = <T extends string>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }, key: string): T | undefined | Response => {
    const raw = p.get(key)
    if (raw === null || raw === '') return undefined
    const r = schema.safeParse(raw)
    return r.success ? r.data : invalid(key)
  }
  const price = (key: string): bigint | undefined | Response => {
    const raw = p.get(key)
    if (raw === null || raw === '') return undefined
    try {
      return parseEth(raw)
    } catch {
      return invalid(key)
    }
  }
  const int = (key: string, fallback: number, max: number): number | Response => {
    const raw = p.get(key)
    if (raw === null) return fallback
    const n = Number(raw)
    return Number.isInteger(n) && n >= 1 && n <= max ? n : invalid(key)
  }

  const values = {
    category: enumOf(CategoryId, 'category'),
    network: enumOf(Network, 'network'),
    tab: enumOf(CatalogTab, 'tab'),
    sort: enumOf(CatalogSort, 'sort'),
    minPrice: price('minPrice'),
    maxPrice: price('maxPrice'),
    page: int('page', 1, 10_000),
    pageSize: int('pageSize', DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  }
  for (const v of Object.values(values)) if (v instanceof Response) return v
  const v = values as { [K in keyof typeof values]: Exclude<(typeof values)[K], Response> }
  return {
    q: p.get('q')?.trim().slice(0, 60) || undefined,
    category: v.category,
    network: v.network,
    minPrice: v.minPrice,
    maxPrice: v.maxPrice,
    tab: v.tab ?? 'all',
    sort: v.sort ?? 'recent',
    page: v.page,
    pageSize: v.pageSize,
    collection: p.get('collection') ?? undefined,
    exclude: p.get('exclude') ?? undefined,
  }
}

const findNft = (id: unknown) => db.get().nfts.find((n) => n.id === id)

export const catalogHandlers = [
  http.get('/api/nfts', async ({ request }) => {
    const url = new URL(request.url)
    await routeDelay('nfts.list', url)
    const failure = maybeFail('nfts.list')
    if (failure) return failure
    const query = parseList(url)
    if (query instanceof Response) return query
    const all = db.scenario().emptyCatalog ? [] : db.get().nfts
    return HttpResponse.json(listNfts(all, query))
  }),

  http.get('/api/nfts/:id', async ({ request, params }) => {
    await routeDelay('nfts.detail', new URL(request.url))
    const failure = maybeFail('nfts.detail')
    if (failure) return failure
    const nft = db.scenario().emptyCatalog ? undefined : findNft(params.id)
    if (!nft) return apiError(404, { code: 'NOT_FOUND', message: 'NFT não encontrado.' })
    return HttpResponse.json(toDetail(nft))
  }),

  http.get('/api/highlights', async ({ request }) => {
    await routeDelay('highlights', new URL(request.url))
    const failure = maybeFail('highlights')
    if (failure) return failure
    const hero = HIGHLIGHTS.hero.map(findNft).filter((n) => n !== undefined)
    const offer = findNft(HIGHLIGHTS.limitedOffer)
    if (!offer || hero.length === 0) return apiError(404, { code: 'NOT_FOUND', message: 'Sem destaques.' })
    const body: Highlights = { hero: hero.map(toSummary), limitedOffer: toSummary(offer) }
    return HttpResponse.json(body)
  }),

  // ---------- Favoritos (CAT-05): exigem sessão; persistem por usuário ----------
  http.get('/api/favorites', async ({ request }) => {
    await routeDelay('favorites.read', new URL(request.url))
    const session = requireSession(request)
    if (session instanceof Response) return session
    const failure = maybeFail('favorites.read')
    if (failure) return failure
    const ids = db.get().favorites[session.userId] ?? []
    const body: FavoriteList = { ids, items: ids.map(findNft).filter((n) => n !== undefined).map(toSummary) }
    return HttpResponse.json(body)
  }),

  http.put('/api/favorites/:nftId', async ({ request, params }) => {
    await routeDelay('favorites.write', new URL(request.url))
    const session = requireSession(request)
    if (session instanceof Response) return session
    const failure = maybeFail('favorites.write')
    if (failure) return failure
    if (!findNft(params.nftId)) return apiError(404, { code: 'NOT_FOUND', message: 'NFT não encontrado.' })
    const id = String(params.nftId)
    db.commit((s) => {
      const list = s.favorites[session.userId] ?? []
      s.favorites[session.userId] = [id, ...list.filter((x) => x !== id)]
    })
    return new HttpResponse(null, { status: 204 })
  }),

  http.delete('/api/favorites/:nftId', async ({ request, params }) => {
    await routeDelay('favorites.write', new URL(request.url))
    const session = requireSession(request)
    if (session instanceof Response) return session
    const failure = maybeFail('favorites.write')
    if (failure) return failure
    const id = String(params.nftId)
    db.commit((s) => {
      s.favorites[session.userId] = (s.favorites[session.userId] ?? []).filter((x) => x !== id)
    })
    return new HttpResponse(null, { status: 204 })
  }),

  // Imagens: só interferimos no cenário "broken-images"; sem resposta = passthrough (rede).
  http.get('/assets/nfts/*', () => (db.scenario().brokenImages ? new HttpResponse(null, { status: 404 }) : undefined)),
]
