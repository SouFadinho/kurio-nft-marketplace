import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { RealtimePanel } from '@/realtime/RealtimePanel'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return (
    <div className="mx-auto min-h-dvh max-w-5xl p-4 sm:p-8">
      <header className="mb-6 flex items-center justify-between border-b border-border pb-4">
        <Link to="/" className="text-lg font-bold tracking-[0.3em]">
          KURIO
        </Link>
        <span className="text-xs text-muted-foreground">Prova de conceito · CP1</span>
      </header>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <main>
          <Outlet />
        </main>
        <aside aria-label="Diagnóstico do tempo real">
          <RealtimePanel />
        </aside>
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <section aria-labelledby="nf-title" className="py-16 text-center">
      <h1 id="nf-title" className="text-2xl font-bold">
        Página não encontrada
      </h1>
      <p className="mt-2 text-muted-foreground">O endereço acessado não existe.</p>
      <Link to="/" className="mt-6 inline-block text-price underline">
        Voltar ao início
      </Link>
    </section>
  )
}
