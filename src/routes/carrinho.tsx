import { createFileRoute } from '@tanstack/react-router'
import { CartPage } from '@/features/cart/CartPage'

// Carrinho (TELA-03): público (visitante tem carrinho próprio). No mobile, o Figma não tem
// navegação inferior nesta tela (a ação principal fica fixa na base).
export const Route = createFileRoute('/carrinho')({
  staticData: { hideBottomNav: true },
  component: CartPage,
})
