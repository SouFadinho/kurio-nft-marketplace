/**
 * Página da PROVA DE CONCEITO (CP1). Não é a tela definitiva de Início.
 * Ela exercita a stack inteira: Router → Query → Axios → MSW (REST) e
 * socket.io-client → MSW (Socket.IO), com um painel de diagnóstico do tempo real.
 */
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatEth } from '@/lib/eth'
import { useNftList } from '@/features/nfts/queries'
import { useClientSession, useLogout, useSessionUser } from '@/features/auth/queries'
import { useCreateOrder } from '@/features/orders/queries'

export const Route = createFileRoute('/')({
  component: PocHome,
})

function PocHome() {
  return (
    <div className="grid gap-6">
      <SessionCard />
      <NftListCard />
    </div>
  )
}

function NftListCard() {
  const { data, isPending, isError, refetch } = useNftList()
  return (
    <Card>
      <CardHeader>
        <CardTitle>NFTs (GET /api/nfts)</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending && <p role="status">Carregando…</p>}
        {isError && (
          <p role="alert">
            Falha ao carregar. <Button variant="link" onClick={() => void refetch()}>Tentar novamente</Button>
          </p>
        )}
        {data && (
          <ul className="divide-y divide-border" data-testid="nft-list">
            {data.items.map((nft) => (
              <li key={nft.id} className="flex items-center justify-between gap-4 py-2">
                <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="hover:text-price">
                  {nft.name}
                </Link>
                <span className="text-right text-sm">
                  <span data-testid={`nft-price-${nft.id}`} className="font-bold text-price">
                    {formatEth(nft.price)}
                  </span>{' '}
                  <span className="text-muted-foreground">
                    · {nft.available} disp. · v<span data-testid={`nft-version-${nft.id}`}>{nft.version}</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function SessionCard() {
  const session = useClientSession()
  const user = useSessionUser()
  const logout = useLogout()
  const createOrder = useCreateOrder()
  // Uma chave de idempotência por TENTATIVA de compra: cliques repetidos e retries
  // reutilizam a mesma chave; só uma compra concluída libera uma nova.
  const [attemptKey, setAttemptKey] = useState<string | null>(null)

  const buy = () => {
    const key = attemptKey ?? crypto.randomUUID()
    setAttemptKey(key)
    createOrder.mutate(
      { body: { items: [{ nftId: 'nft-001', quantity: 1 }] }, idempotencyKey: key },
      { onSuccess: () => setAttemptKey(null) },
    )
  }

  if (!session) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sessão</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">Visitante</p>
          <Button asChild>
            <Link to="/login">Entrar</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sessão</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-sm" data-testid="session-user">
          {user.data ? `${user.data.displayName} (${user.data.email})` : 'Validando sessão…'}
        </p>
        <Button onClick={buy} disabled={createOrder.isPending} data-testid="buy">
          {createOrder.isPending ? 'Enviando pedido…' : 'Comprar Emerald Ape #042 (1 un.)'}
        </Button>
        {createOrder.isError && <p role="alert">{createOrder.error.message}</p>}
        {createOrder.data && (
          <Link
            to="/pedidos/$orderId"
            params={{ orderId: createOrder.data.id }}
            className="text-sm text-price underline"
            data-testid="order-link"
          >
            Acompanhar pedido {createOrder.data.id}
          </Link>
        )}
        <Button variant="outline" onClick={() => logout.mutate()} data-testid="logout">
          Sair
        </Button>
      </CardContent>
    </Card>
  )
}
