/**
 * Login (TELA-06). Desktop: modal sobre a Home; mobile: tela cheia (AuthScreen).
 * `redirect` só aceita caminhos internos (evita open redirect); `motivo=expirada` mostra o
 * aviso de sessão expirada.
 */
import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthScreen } from '@/features/auth/AuthScreen'
import { AuthSearch } from '@/features/auth/authSearch'
import { sessionStore } from '@/features/auth/sessionStore'

export const Route = createFileRoute('/login')({
  validateSearch: AuthSearch,
  beforeLoad: ({ search }) => {
    if (sessionStore.get()) throw redirect({ href: search.redirect ?? '/' })
  },
  staticData: { hideBottomNav: true, mobileChrome: 'minimal' },
  component: LoginPage,
})

function LoginPage() {
  const { redirect: target, motivo } = Route.useSearch()
  return <AuthScreen mode="login" redirect={target} expired={motivo === 'expirada'} />
}
