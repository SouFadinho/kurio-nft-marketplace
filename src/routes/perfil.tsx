import { createFileRoute, Outlet } from '@tanstack/react-router'
import { requireAuth } from '@/features/auth/guards'

// Área privada da conta (ACC-02): o guard vale para todas as rotas filhas.
export const Route = createFileRoute('/perfil')({
  beforeLoad: requireAuth,
  component: Outlet,
})
