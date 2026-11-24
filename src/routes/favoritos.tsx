/**
 * Favoritos do usuário (CAT-05): lista vinda da API simulada, persistida por usuário.
 * Rota privada (ACC-02). Remover um favorito usa a mesma mutation otimista do catálogo.
 */
import { createFileRoute, Link } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/kurio/basics'
import { NFTCard } from '@/components/kurio/NFTCard'
import { NFTGrid } from '@/components/kurio/NFTGrid'
import { EmptyState, ErrorState } from '@/components/kurio/states'
import { MobileTopBar } from '@/components/layout/MobileTopBar'
import { requireAuth } from '@/features/auth/guards'
import { useFavoriteAction, useFavorites } from '@/features/favorites/queries'

export const Route = createFileRoute('/favoritos')({
  beforeLoad: requireAuth,
  component: FavoritesPage,
})

function FavoritesPage() {
  const favorites = useFavorites()
  const action = useFavoriteAction()
  const items = favorites.data?.items ?? []
  return (
    <>
      <MobileTopBar title="Favoritos" titleAs="p" />
      <Container className="flex flex-col gap-6 pb-8 lg:pt-8">
        <h1 className="sr-only lg:not-sr-only lg:text-title-1">Favoritos</h1>
        {favorites.isError ? (
          <ErrorState message="Não foi possível carregar seus favoritos." onRetry={() => void favorites.refetch()} />
        ) : !favorites.isPending && items.length === 0 ? (
          <EmptyState
            icon={<Heart className="size-5" />}
            title="Você ainda não tem favoritos"
            description="Toque no coração de um NFT para guardá-lo aqui."
            action={
              <Button asChild variant="outline">
                <Link to="/mercado">Explorar o mercado</Link>
              </Button>
            }
          />
        ) : (
          <NFTGrid
            label="NFTs favoritos"
            loading={favorites.isPending}
            skeletonCount={3}
            items={items}
            getKey={(n) => n.id}
            renderItem={(n) => <NFTCard nft={n} favorite={action.isFavorite(n.id)} favoritePending={action.pendingId === n.id} onToggleFavorite={(next) => action.toggle(n, next)} />}
          />
        )}
      </Container>
    </>
  )
}
