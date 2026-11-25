import { createFileRoute } from '@tanstack/react-router'
import { AccountLayout } from '@/components/layout/AccountLayout'
import { WalletsPage } from '@/features/account/WalletsPage'

export const Route = createFileRoute('/perfil/carteiras')({
  component: () => (
    <AccountLayout active="wallets" title="Carteiras">
      <WalletsPage />
    </AccountLayout>
  ),
})
