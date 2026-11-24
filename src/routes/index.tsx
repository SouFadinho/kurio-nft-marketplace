/**
 * Início (TELA-01): destaques, catálogo com busca/filtros/ordenação/paginação na URL,
 * banners e "Diário da Cunhagem".
 * O loader pré-carrega a primeira consulta do catálogo e os destaques: o acesso direto e o
 * refresh já chegam com dados (e as mesmas query keys evitam requisições duplicadas).
 */
import { createFileRoute } from '@tanstack/react-router'
import { Container } from '@/components/kurio/basics'
import { CatalogSection, useCatalogQuery } from '@/features/catalog/CatalogSection'
import { useCatalogController } from '@/features/catalog/controller'
import { MobileCatalogBar } from '@/features/catalog/MobileCatalogBar'
import { toCatalogParams, validateCatalogSearch } from '@/features/catalog/search'
import { Hero } from '@/features/home/Hero'
import { MintDiary, PromoBanners } from '@/features/home/HomeSections'
import { highlightsQuery, nftListQuery } from '@/features/nfts/queries'

export const Route = createFileRoute('/')({
  validateSearch: validateCatalogSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    // Sem await: a navegação não espera a rede; skeletons cobrem o carregamento.
    void context.queryClient.prefetchQuery(nftListQuery(toCatalogParams(deps)))
    void context.queryClient.prefetchQuery(highlightsQuery())
  },
  component: HomePage,
})

function HomePage() {
  const search = Route.useSearch()
  const controller = useCatalogController('/', search)
  const { data } = useCatalogQuery(search)
  return (
    <Container className="flex flex-col gap-6 pt-4 pb-4 lg:gap-14 lg:pt-0">
      <MobileCatalogBar controller={controller} data={data} />
      <Hero />
      <CatalogSection controller={controller} />
      <PromoBanners />
      <MintDiary />
    </Container>
  )
}
