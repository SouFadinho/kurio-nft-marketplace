import { createFileRoute, Link, Navigate, redirect, useLocation } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiError } from '@/api/http'
import { formatEth } from '@/lib/eth'
import { sessionStore } from '@/features/auth/sessionStore'
import { useClientSession } from '@/features/auth/queries'
import { useOrder } from '@/features/orders/queries'

export const Route = createFileRoute('/pedidos/$orderId')({
  // Rota privada (ACC-02): sem sessão, vai ao login preservando o destino.
  beforeLoad: ({ location }) => {
    if (!sessionStore.get()) throw redirect({ to: '/login', search: { redirect: location.href } })
  },
  component: OrderPage,
})

const STATUS_TEXT = {
  pending: 'Aguardando confirmação da rede…',
  confirmed: 'Pedido confirmado',
  rejected: 'Pagamento recusado',
} as const

function OrderPage() {
  const { orderId } = Route.useParams()
  const location = useLocation()
  const session = useClientSession()
  const { data: order, error, isPending } = useOrder(orderId)

  // Sessão expirada durante a navegação: o interceptor limpou a sessão; volta ao login.
  if (!session) return <Navigate to="/login" search={{ redirect: location.href }} />
  if (isPending) return <p role="status">Carregando pedido…</p>
  if (error) {
    const notFound = error instanceof ApiError && error.code === 'NOT_FOUND'
    return <p role="alert">{notFound ? 'Pedido não encontrado.' : 'Não foi possível carregar o pedido.'}</p>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Pedido {order.id}</h1>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {/* A confirmação só aparece com status vindo da simulação (PAY-06 / ELIM-03). */}
        <p aria-live="polite" data-testid="order-status" data-status={order.status} className="text-base font-bold">
          {STATUS_TEXT[order.status]}
        </p>
        {order.status === 'confirmed' && order.txHash && (
          <p>
            Transação (simulada): <code data-testid="order-tx">{order.txHash}</code>
          </p>
        )}
        <ul className="divide-y divide-border">
          {order.lines.map((l) => (
            <li key={l.nftId} className="flex justify-between py-1">
              <span>
                {l.name} × {l.quantity}
              </span>
              <span>{formatEth(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <p className="flex justify-between font-bold">
          <span>Total</span>
          <span data-testid="order-total">{formatEth(order.total)}</span>
        </p>
        <p className="text-xs text-muted-foreground">Versão do recurso: v{order.version}</p>
        <Link to="/" className="text-price underline">
          Voltar
        </Link>
      </CardContent>
    </Card>
  )
}
