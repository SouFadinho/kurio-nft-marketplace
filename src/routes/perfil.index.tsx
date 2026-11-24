import { createFileRoute } from '@tanstack/react-router'
import { AccountLayout } from '@/components/layout/AccountLayout'
import { EmptyState } from '@/components/kurio/states'

// TEMPORÁRIO: o formulário de perfil (dados, avatar, senha) é o CP4.
export const Route = createFileRoute('/perfil/')({
  component: () => (
    <AccountLayout active="profile" title="Perfil do colecionador">
      <div data-testid="placeholder-page">
        <EmptyState title="Tela em construção" description="Edição de dados, avatar e senha fazem parte do CP4." />
      </div>
    </AccountLayout>
  ),
})
