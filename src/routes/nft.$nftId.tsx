/**
 * Rota do detalhe do NFT (TELA-02 / CAT-04).
 * - Acesso direto e refresh: o loader garante os dados antes do render.
 * - NFT inexistente: 404 da API → `notFound()` → tela "NFT não encontrado".
 * - Falha transitória: errorComponent com "Tentar novamente" (sem dados falsos).
 * - A edição escolhida fica na URL (`?edicao=`): o link é compartilhável e sobrevive a refresh.
 * - Mobile: sem navegação inferior; a tela tem a própria barra de compra (Figma).
 */
import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { ApiError } from '@/api/http'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/kurio/basics'
import { EmptyState, ErrorState } from '@/components/kurio/states'
import { Skeleton } from '@/components/ui/skeleton'
import { MobileTopBar } from '@/components/layout/MobileTopBar'
import { nftDetailQuery } from '@/features/nfts/queries'
import { NftDetailPage } from '@/features/nft-detail/NftDetailPage'

export const Route = createFileRoute('/nft/$nftId')({
  staticData: { hideBottomNav: true },
  validateSearch: z.object({ edicao: z.string().max(20).optional().catch(undefined) }),
  loader: async ({ context, params }) => {
    try {
      await context.queryClient.ensureQueryData(nftDetailQuery(params.nftId))
    } catch (error) {
      if (error instanceof ApiError && error.code === 'NOT_FOUND') throw notFound()
      throw error
    }
  },
  pendingMs: 400,
  pendingComponent: DetailSkeleton,
  errorComponent: DetailError,
  notFoundComponent: () => (
    <>
      <MobileTopBar fallback="/mercado" />
      <Container className="py-10 lg:py-16">
        <EmptyState
          headingLevel="h1"
          title="NFT não encontrado"
          description="Este NFT não existe ou não está mais disponível no mercado."
          action={
            <Button asChild variant="outline">
              <Link to="/mercado">Voltar ao mercado</Link>
            </Button>
          }
        />
      </Container>
    </>
  ),
  component: DetailRoute,
})

function DetailRoute() {
  const { nftId } = Route.useParams()
  const { edicao } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <NftDetailPage
      nftId={nftId}
      edition={edicao}
      onEditionChange={(id) => void navigate({ search: { edicao: id }, replace: true, resetScroll: false })}
    />
  )
}

function DetailError({ reset }: { reset: () => void }) {
  const router = useRouter()
  return (
    <>
      <MobileTopBar fallback="/mercado" />
      <Container className="py-10 lg:py-16">
        <ErrorState
          headingLevel="h1"
          title="Não foi possível carregar este NFT"
          message="Ocorreu uma falha de comunicação com o servidor."
          onRetry={() => {
            reset()
            void router.invalidate()
          }}
        />
      </Container>
    </>
  )
}

/** Mesmo layout da página carregada (sem deslocamento quando os dados chegam). */
function DetailSkeleton() {
  return (
    <Container className="pb-10 lg:pt-6" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando NFT…
      </p>
      <Skeleton className="mb-6 hidden h-4 w-64 lg:block" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,580px)_minmax(0,1fr)] lg:gap-16">
        <div className="lg:grid lg:grid-cols-[104px_minmax(0,1fr)] lg:gap-4">
          <div className="hidden flex-col gap-3 lg:flex">
            {Array.from({ length: 2 }, (_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-sm" />
            ))}
          </div>
          <Skeleton className="aspect-square rounded-2xl lg:rounded-lg" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-9 w-64 rounded-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </Container>
  )
}
