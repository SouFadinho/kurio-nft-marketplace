/** Cadastro (TELA-07). Mesma apresentação do login; após criar a conta, a sessão já começa. */
import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthScreen } from '@/features/auth/AuthScreen'
import { AuthSearch } from '@/features/auth/authSearch'
import { sessionStore } from '@/features/auth/sessionStore'

export const Route = createFileRoute('/cadastro')({
  validateSearch: AuthSearch,
  beforeLoad: ({ search }) => {
    if (sessionStore.get()) throw redirect({ href: search.redirect ?? '/' })
  },
  staticData: { hideBottomNav: true, mobileChrome: 'minimal' },
  component: RegisterPage,
})

function RegisterPage() {
  const { redirect: target } = Route.useSearch()
  return <AuthScreen mode="register" redirect={target} />
}
