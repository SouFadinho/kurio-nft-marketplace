/**
 * Histórico de pedidos (CP6). Sem frame no Figma: derivado do layout de conta.
 * Lista os pedidos do usuário (privados; a API filtra pelo dono), mais recentes primeiro,
 * com status vindo da API e atualização em tempo real (`order.updated` invalida a lista).
 */
import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/kurio/states'
import { apiErrorMessage } from '@/components/kurio/form'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { formatDateTime, statusView } from './OrderStatusPage'
import { useOrders } from './queries'

export function OrdersPage() {
  const orders = useOrders()
  if (orders.isPending) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando pedidos">
        <Skeleton className="h-24 w-full rounded-sm" />
        <Skeleton className="h-24 w-full rounded-sm" />
      </div>
    )
  }
  if (orders.isError) return <ErrorState title="Não foi possível carregar seus pedidos" message={apiErrorMessage(orders.error)} onRetry={() => void orders.refetch()} retrying={orders.isFetching} />
  if (orders.data.length === 0) {
    return (
      <EmptyState
        title="Você ainda não fez pedidos"
        description="Quando você comprar NFTs, os pedidos e recibos aparecem aqui."
        action={
          <Button asChild>
            <Link to="/mercado">Explorar NFTs</Link>
          </Button>
        }
      />
    )
  }
  return (
    <ul className="flex flex-col gap-3" aria-label="Pedidos">
      {orders.data.map((o) => {
        const s = statusView(o)
        const units = o.lines.reduce((sum, l) => sum + l.quantity, 0)
        return (
          <li key={o.id} className="relative flex flex-col gap-2 rounded-sm bg-surface p-4 md:flex-row md:items-center md:justify-between" data-testid="order-row" data-order-id={o.id}>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="flex flex-wrap items-center gap-2 text-caption">
                <span className="font-mono font-semibold">{o.id}</span>
                <Badge variant="neutral" className={cn('font-semibold', s.tone)} data-testid="order-row-status">
                  {s.label}
                </Badge>
              </p>
              <p className="text-caption text-muted-foreground">
                {formatDateTime(o.createdAt)} · {units} {units === 1 ? 'item' : 'itens'}: {o.lines.map((l) => l.name).join(', ')}
              </p>
            </div>
            <div className="flex items-center justify-between gap-4 md:justify-end">
              <span className="font-mono text-body font-bold text-price">{formatEth(o.total)}</span>
              <Link
                to="/pedidos/$orderId"
                params={{ orderId: o.id }}
                className="text-caption text-price underline underline-offset-4 after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-ring"
                aria-label={`Ver pedido ${o.id}`}
              >
                Ver pedido
              </Link>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
