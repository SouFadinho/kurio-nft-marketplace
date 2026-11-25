/**
 * Seção de catálogo (Figma Desktop / Início e Mobile / Início).
 *
 * DESKTOP (≥ lg): barra lateral com filtros + "NFT em destaque / Oferta limitada"; à direita,
 * abas ("Todos os NFTs | Novos lançamentos | Em alta"), "Ordenar por", busca, grade 3×3 e
 * paginação alinhada à direita.
 * MOBILE: busca e botão de filtros ficam ACIMA do hero (MobileCatalogBar, renderizada pela
 * página); aqui ficam as abas, a grade em masonry e a paginação.
 *
 * Desvio documentado: o Figma desktop não desenha um campo de busca (só o ícone no header).
 * O enunciado exige busca; o campo fica na barra de ferramentas do catálogo e o ícone do
 * header leva até ele.
 */
import { useEffect, useId, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { X } from 'lucide-react'
import type { CatalogSort, NftList } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NFTCard } from '@/components/kurio/NFTCard'
import { NFTGrid } from '@/components/kurio/NFTGrid'
import { NftImage } from '@/components/kurio/NftImage'
import { Pagination } from '@/components/kurio/Pagination'
import { EmptyState, ErrorState } from '@/components/kurio/states'
import { useFavoriteAction } from '@/features/favorites/queries'
import { useCartActions } from '@/features/cart/actions'
import { highlightsQuery, nftListQuery } from '@/features/nfts/queries'
import { cn } from '@/lib/utils'
import { type CatalogController } from './controller'
import { FiltersPanel } from './FiltersPanel'
import { CatalogSearchField } from './CatalogSearchField'
import { hasActiveFilters, SORT_LABEL, TAB_LABEL, toCatalogParams, type CatalogSearch } from './search'

export function useCatalogQuery(search: CatalogSearch) {
  return useQuery(nftListQuery(toCatalogParams(search)))
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'NETWORK_ERROR') return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.'
    if (error.code === 'TIMEOUT') return 'O servidor demorou para responder.'
    if (error.status) return `O servidor respondeu com erro (HTTP ${error.status}).`
  }
  return 'Ocorreu um erro inesperado.'
}

export function CatalogTabs({ controller, className }: { controller: CatalogController; className?: string }) {
  const current = controller.search.tab ?? 'all'
  return (
    <div role="group" aria-label="Filtrar por destaque" className={cn('flex items-center gap-5 overflow-x-auto [scrollbar-width:none]', className)}>
      {(Object.keys(TAB_LABEL) as Array<keyof typeof TAB_LABEL>).map((tab) => (
        <button
          key={tab}
          type="button"
          aria-pressed={current === tab}
          onClick={() => controller.setFilters({ tab: tab === 'all' ? undefined : tab })}
          className={cn(
            'relative inline-flex min-h-11 shrink-0 items-center whitespace-nowrap text-body text-foreground/85 transition-colors hover:text-foreground lg:min-h-9 lg:text-caption',
            'after:absolute after:inset-x-0 after:bottom-1 after:h-0.5 after:rounded-full after:bg-primary after:opacity-0',
            'aria-pressed:font-semibold aria-pressed:text-price aria-pressed:after:opacity-100',
            'outline-none focus-visible:outline-2 focus-visible:outline-ring',
          )}
        >
          {TAB_LABEL[tab]}
        </button>
      ))}
    </div>
  )
}

export function SortSelect({ controller, className }: { controller: CatalogController; className?: string }) {
  const id = useId()
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <label htmlFor={id} className="text-caption whitespace-nowrap text-foreground">
        Ordenar por:
      </label>
      <Select value={controller.search.sort ?? 'recent'} onValueChange={(v) => controller.setFilters({ sort: v === 'recent' ? undefined : (v as CatalogSort) })}>
        <SelectTrigger id={id} className="h-9 min-w-48 border-transparent bg-transparent px-1 text-caption hover:border-input lg:h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {(Object.keys(SORT_LABEL) as CatalogSort[]).map((s) => (
            <SelectItem key={s} value={s}>
              {SORT_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** Chips dos filtros ativos, com remoção individual e "Limpar filtros". */
export function ActiveFilters({ data, controller }: { data: NftList | undefined; controller: CatalogController }) {
  const { search, setFilters, clearAll } = controller
  const chips: Array<{ key: string; label: string; clear: () => void }> = []
  if (search.q) chips.push({ key: 'q', label: `Busca: “${search.q}”`, clear: () => setFilters({ q: undefined }) })
  if (search.category) chips.push({ key: 'category', label: data?.facets.categories.find((c) => c.id === search.category)?.label ?? search.category, clear: () => setFilters({ category: undefined }) })
  if (search.network) chips.push({ key: 'network', label: data?.facets.networks.find((n) => n.id === search.network)?.label ?? search.network, clear: () => setFilters({ network: undefined }) })
  if (search.minPrice || search.maxPrice)
    chips.push({ key: 'price', label: `Preço: ${search.minPrice ?? '0'} – ${search.maxPrice ?? 'máx.'} ETH`, clear: () => setFilters({ minPrice: undefined, maxPrice: undefined }) })
  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Filtros ativos" role="group">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={c.clear}
          aria-label={`Remover filtro ${c.label}`}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-input px-3 text-caption text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          {c.label}
          <X className="size-3.5" aria-hidden />
        </button>
      ))}
      <Button variant="link" size="sm" className="text-caption" onClick={clearAll}>
        Limpar filtros
      </Button>
    </div>
  )
}

/** "NFT EM DESTAQUE / OFERTA LIMITADA" (barra lateral do Figma desktop). */
function LimitedOfferCard() {
  const { data } = useQuery(highlightsQuery())
  const nft = data?.limitedOffer
  return (
    <section aria-labelledby="limited-offer-title" className="overflow-hidden rounded-sm bg-surface">
      <div className="px-4 pt-4 pb-3">
        <p className="text-title-3 font-bold text-price uppercase">NFT em destaque</p>
        <h2 id="limited-offer-title" className="text-caption font-bold tracking-wide text-foreground uppercase">
          Oferta limitada
        </h2>
      </div>
      <div className="relative mx-3 mb-3 aspect-[4/5] overflow-hidden rounded-lg bg-surface-2">
        {nft ? (
          <Link to="/nft/$nftId" params={{ nftId: nft.id }} aria-label={`Ver ${nft.name}`} className="block size-full focus-visible:outline-2 focus-visible:outline-ring">
            <NftImage src={nft.image} alt={nft.imageAlt} />
          </Link>
        ) : (
          <div className="skeleton size-full" aria-hidden />
        )}
      </div>
    </section>
  )
}

export function CatalogSection({ controller, title }: { controller: CatalogController; title?: string }) {
  const { search, setPage, clearAll } = controller
  const query = useCatalogQuery(search)
  const favorites = useFavoriteAction()
  const cart = useCartActions()
  const sectionRef = useRef<HTMLElement>(null)
  const page = search.page ?? 1
  const data = query.data

  // Página além do fim (ex.: link antigo depois de filtrar): vai para a última página válida.
  useEffect(() => {
    if (data && !query.isPlaceholderData && data.pageCount > 0 && page > data.pageCount) setPage(data.pageCount)
  }, [data, query.isPlaceholderData, page, setPage])

  const changePage = (next: number) => {
    setPage(next)
    sectionRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  const updating = query.isFetching && query.isPlaceholderData
  const showSkeleton = query.isPending

  let body: React.ReactNode
  if (query.isError) {
    body = <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} retrying={query.isFetching} />
  } else if (data && data.total === 0 && !updating) {
    body = (
      <EmptyState
        title="Nenhum NFT encontrado"
        description={hasActiveFilters(search) ? 'Nenhum resultado para esta combinação de busca e filtros.' : 'O catálogo está vazio no momento.'}
        action={
          hasActiveFilters(search) ? (
            <Button variant="outline" onClick={clearAll}>
              Limpar filtros
            </Button>
          ) : undefined
        }
      />
    )
  } else {
    body = (
      <div className={cn('transition-opacity', updating && 'opacity-60')} aria-busy={updating}>
        <NFTGrid
          label="NFTs do catálogo"
          loading={showSkeleton}
          skeletonCount={9}
          items={data?.items ?? []}
          getKey={(n) => n.id}
          renderItem={(n, i) => (
            <NFTCard
              nft={n}
              priority={i < 3 && page === 1}
              favorite={favorites.isFavorite(n.id)}
              favoritePending={favorites.pendingId === n.id}
              onToggleFavorite={(next) => favorites.toggle(n, next)}
              onAddToCart={() => void cart.addToCart({ nftId: n.id, name: n.name, quantity: 1 })}
              addPending={cart.pendingNftId === n.id}
            />
          )}
        />
      </div>
    )
  }

  return (
    <section ref={sectionRef} id="catalogo" aria-labelledby="catalog-title" className="scroll-mt-24 lg:grid lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] lg:gap-8">
      <h2 id="catalog-title" className="sr-only">
        {title ?? 'Catálogo de NFTs'}
      </h2>
      <aside aria-label="Filtros do catálogo" className="hidden lg:flex lg:flex-col lg:gap-6">
        <div className="rounded-sm bg-surface p-4">
          <FiltersPanel data={data} controller={controller} />
        </div>
        <LimitedOfferCard />
      </aside>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CatalogTabs controller={controller} />
          <div className="hidden items-center gap-3 lg:flex">
            <CatalogSearchField controller={controller} variant="outline" className="w-56" />
            <SortSelect controller={controller} />
          </div>
        </div>
        <ActiveFilters data={data} controller={controller} />
        <p role="status" className="sr-only">
          {query.isPending ? '' : updating ? 'Atualizando resultados…' : data ? `${data.total} NFTs encontrados. Página ${data.page} de ${Math.max(1, data.pageCount)}.` : ''}
        </p>
        {body}
        {data && data.pageCount > 1 && !query.isError && <Pagination page={Math.min(page, data.pageCount)} pageCount={data.pageCount} onPageChange={changePage} className="mt-2 justify-center lg:justify-end" />}
      </div>
    </section>
  )
}
