import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { RealtimeProvider } from '@/realtime/RealtimeProvider'
import { ApiError } from '@/api/http'

/**
 * Política de cache (INT-12, versão inicial):
 * - staleTime de 30s para dados de catálogo; eventos e reconciliação mantêm o frescor.
 * - Retry só para falhas transitórias (rede/timeout/5xx), no máximo 2 vezes;
 *   4xx nunca é repetido. Mutations não têm retry automático (idempotência é explícita).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status !== null && error.status < 500) return false
        return failureCount < 2
      },
    },
    mutations: { retry: false },
  },
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        <RouterProvider router={router} />
      </RealtimeProvider>
    </QueryClientProvider>
  )
}
