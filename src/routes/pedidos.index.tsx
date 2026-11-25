import { createFileRoute } from '@tanstack/react-router'
import { AccountLayout } from '@/components/layout/AccountLayout'
import { requireAuth } from '@/features/auth/guards'
import { OrdersPage } from '@/features/orders/OrdersPage'

// Histórico de pedidos (rota privada, CP6).
export const Route = createFileRoute('/pedidos/')({
  beforeLoad: requireAuth,
  component: () => (
    <AccountLayout active="orders" title="Meus pedidos">
      <OrdersPage />
    </AccountLayout>
  ),
})
