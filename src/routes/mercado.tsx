/**
 * Mercado: o catálogo completo, sem as seções editoriais da página inicial.
 * Mesmo estado de URL da Início (busca, filtros, aba, ordenação, página).
 */
import { createFileRoute, Link } from '@tanstack/react-router'
import { Container } from '@/components/kurio/basics'
import { MobileTopBar } from '@/components/layout/MobileTopBar'
import { CatalogSection, useCatalogQuery } from '@/features/catalog/CatalogSection'
import { useCatalogController } from '@/features/catalog/controller'
import { MobileCatalogBar } from '@/features/catalog/MobileCatalogBar'
import { toCatalogParams, validateCatalogSearch } from '@/features/catalog/search'
import { nftListQuery } from '@/features/nfts/queries'

export const Route = createFileRoute('/mercado')({
  validateSearch: validateCatalogSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => void context.queryClient.prefetchQuery(nftListQuery(toCatalogParams(deps))),
  component: MarketPage,
})

function MarketPage() {
  const search = Route.useSearch()
  const controller = useCatalogController('/mercado', search)
  const { data } = useCatalogQuery(search)
  return (
    <>
      <MobileTopBar title="Mercado" titleAs="p" />
      <Container className="flex flex-col gap-6 pb-4 lg:pt-6">
        <nav aria-label="Trilha de navegação" className="hidden text-caption text-muted-foreground lg:block">
          <ol className="flex items-center gap-1.5">
            <li>
              <Link to="/" className="hover:text-foreground">
                Início
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-foreground">
              Mercado
            </li>
          </ol>
        </nav>
        <h1 className="sr-only lg:not-sr-only lg:text-title-1">Mercado</h1>
        <MobileCatalogBar controller={controller} data={data} />
        <CatalogSection controller={controller} title="Catálogo do mercado" />
      </Container>
    </>
  )
}
