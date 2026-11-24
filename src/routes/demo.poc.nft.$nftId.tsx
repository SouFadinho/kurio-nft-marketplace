import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiError } from '@/api/http'
import { formatEth } from '@/lib/eth'
import { nftDetailQuery } from '@/features/nfts/queries'

export const Route = createFileRoute('/demo/poc/nft/$nftId')({
  // Acesso direto e refresh: o loader garante os dados antes do render (INT-10 / CAT-04).
  loader: async ({ context, params }) => {
    try {
      await context.queryClient.ensureQueryData(nftDetailQuery(params.nftId))
    } catch (error) {
      if (error instanceof ApiError && error.code === 'NOT_FOUND') throw notFound()
      throw error
    }
  },
  pendingComponent: () => <p role="status">Carregando NFT…</p>,
  errorComponent: () => <p role="alert">Não foi possível carregar o NFT.</p>,
  notFoundComponent: () => (
    <section className="py-16 text-center">
      <h1 className="text-2xl font-bold">NFT não encontrado</h1>
      <Link to="/demo/poc" className="mt-6 inline-block text-price underline">
        Voltar ao início
      </Link>
    </section>
  ),
  component: NftDetail,
})

function NftDetail() {
  const { nftId } = Route.useParams()
  // useQuery (e não só o loader) para receber as atualizações do cache feitas por nft.updated.
  const { data: nft } = useQuery(nftDetailQuery(nftId))
  if (!nft) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 data-testid="nft-name">{nft.name}</h1>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-1 text-sm">
        <p>
          Preço:{' '}
          <strong data-testid="detail-price" className="text-price">
            {formatEth(nft.price)}
          </strong>
        </p>
        <p>
          Disponível: <span data-testid="detail-available">{nft.available}</span>
        </p>
        <p className="text-muted-foreground">
          Coleção: {nft.collection} · versão {nft.version}
        </p>
      </CardContent>
    </Card>
  )
}
