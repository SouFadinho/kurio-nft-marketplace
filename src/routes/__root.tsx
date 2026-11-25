import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { SessionEffects } from '@/features/auth/SessionEffects'
import { Container } from '@/components/kurio/basics'
import { MobileTopBar } from '@/components/layout/MobileTopBar'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <AppShell>
      <SessionEffects />
      <Outlet />
    </AppShell>
  ),
  notFoundComponent: NotFound,
})

function NotFound() {
  return (
    <>
      <MobileTopBar brand />
      <Container>
        <section aria-labelledby="nf-title" className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="text-display-sm text-price lg:text-display">404</p>
          <h1 id="nf-title" className="text-title-1">
            Página não encontrada
          </h1>
          <p className="text-muted-foreground">O endereço acessado não existe.</p>
          <Link to="/" className="mt-4 text-price underline underline-offset-4">
            Voltar ao início
          </Link>
        </section>
      </Container>
    </>
  )
}
