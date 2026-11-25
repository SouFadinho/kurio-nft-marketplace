/**
 * Início (TELA-01): destaques, catálogo com busca/filtros/ordenação/paginação na URL,
 * banners e "Diário da Cunhagem".
 * O loader pré-carrega a primeira consulta do catálogo e os destaques: o acesso direto e o
 * refresh já chegam com dados (e as mesmas query keys evitam requisições duplicadas).
 */
import { createFileRoute } from '@tanstack/react-router'
import { toCatalogParams, validateCatalogSearch } from '@/features/catalog/search'
import { HomeContent } from '@/features/home/HomeContent'
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
  return <HomeContent search={Route.useSearch()} />
}
