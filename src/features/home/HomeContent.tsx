/**
 * Conteúdo da página inicial. Usado pela rota "/" e, no desktop, como fundo do modal de
 * login/cadastro (o Figma mostra o modal sobre a Home). Enquanto o modal está aberto, o
 * Radix torna o fundo inerte (aria-hidden + sem foco), então nada atrás dele é interativo.
 */
import { Container } from '@/components/kurio/basics'
import { CatalogSection, useCatalogQuery } from '@/features/catalog/CatalogSection'
import { useCatalogController } from '@/features/catalog/controller'
import { MobileCatalogBar } from '@/features/catalog/MobileCatalogBar'
import type { CatalogSearch } from '@/features/catalog/search'
import { Hero } from './Hero'
import { MintDiary, PromoBanners } from './HomeSections'

export function HomeContent({ search }: { search: CatalogSearch }) {
  const controller = useCatalogController('/', search)
  const { data } = useCatalogQuery(search)
  return (
    <Container className="flex flex-col gap-6 pt-4 pb-4 lg:gap-10 lg:pt-0">
      <MobileCatalogBar controller={controller} data={data} />
      <Hero />
      <CatalogSection controller={controller} />
      <PromoBanners />
      <MintDiary />
    </Container>
  )
}
