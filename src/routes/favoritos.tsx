import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/kurio/pages'
import { requireAuth } from '@/features/auth/guards'

// TEMPORÁRIO: favoritos exigem autenticação (CHALLENGE §3); a lista entra no CP3/CP4.
export const Route = createFileRoute('/favoritos')({
  beforeLoad: requireAuth,
  component: () => <PlaceholderPage title="Favoritos" checkpoint="CP3/CP4" />,
})
