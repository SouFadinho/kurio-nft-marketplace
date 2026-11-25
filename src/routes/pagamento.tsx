import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '@/features/auth/guards'
import { CheckoutPage } from '@/features/checkout/CheckoutPage'

// Pagamento (TELA-04): rota privada; visitante passa pelo login e volta para cá.
export const Route = createFileRoute('/pagamento')({
  beforeLoad: requireAuth,
  staticData: { hideBottomNav: true },
  component: CheckoutPage,
})
