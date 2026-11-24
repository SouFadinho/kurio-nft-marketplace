import { createFileRoute } from '@tanstack/react-router'
import { AccountLayout } from '@/components/layout/AccountLayout'
import { EmptyState } from '@/components/kurio/states'

// TEMPORÁRIO: cadastro e edição de carteiras principal e secundária no CP4.
export const Route = createFileRoute('/perfil/carteiras')({
  component: () => (
    <AccountLayout active="wallets" title="Carteiras">
      <div data-testid="placeholder-page">
        <EmptyState title="Tela em construção" description="Cadastro e edição de carteiras fazem parte do CP4." />
      </div>
    </AccountLayout>
  ),
})
