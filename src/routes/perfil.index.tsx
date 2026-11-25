import { createFileRoute } from '@tanstack/react-router'
import { AccountLayout } from '@/components/layout/AccountLayout'
import { ProfilePage } from '@/features/account/ProfilePage'

export const Route = createFileRoute('/perfil/')({
  component: () => (
    <AccountLayout active="profile" title="Perfil do colecionador">
      <ProfilePage />
    </AccountLayout>
  ),
})
