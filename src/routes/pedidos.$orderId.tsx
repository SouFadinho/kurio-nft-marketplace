import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '@/features/auth/guards'
import { OrderStatusPage } from '@/features/orders/OrderStatusPage'

// Situação do pedido (rota privada). O recibo completo é consolidado no CP6.
export const Route = createFileRoute('/pedidos/$orderId')({
  beforeLoad: requireAuth,
  component: OrderRoute,
})

function OrderRoute() {
  return <OrderStatusPage orderId={Route.useParams().orderId} />
}
