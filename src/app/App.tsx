import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { RealtimeProvider } from '@/realtime/RealtimeProvider'
import { ApiError } from '@/api/http'
import { lazy, Suspense, useEffect } from 'react'
import { requestToaster, useToasterRequested } from '@/lib/toast'

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
      {/* CP9.2: o TooltipProvider (Radix Tooltip + floating-ui) só é usado na galeria interna de
          componentes e foi movido para lá; antes, entrava no carregamento inicial de todas as telas. */}
      <RealtimeProvider>
        <RouterProvider router={router} />
      </RealtimeProvider>
      <DeferredToaster />
    </QueryClientProvider>
  )
}

const Toaster = lazy(() => import('@/components/ui/sonner').then((m) => ({ default: m.Toaster })))

/**
 * CP9.2: o Toaster (sonner) monta na primeira interação ou após 4 s, o que vier primeiro, e
 * imediatamente se um toast for pedido antes. Fica fora do carregamento inicial e a região
 * aria-live existe antes da primeira mensagem (src/lib/toast.ts).
 */
function DeferredToaster() {
  const requested = useToasterRequested()
  useEffect(() => {
    const request = () => requestToaster()
    const timer = window.setTimeout(request, 4_000)
    window.addEventListener('pointerdown', request, { once: true, capture: true })
    window.addEventListener('keydown', request, { once: true, capture: true })
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', request, { capture: true })
      window.removeEventListener('keydown', request, { capture: true })
    }
  }, [])
  return requested ? (
    <Suspense fallback={null}>
      <Toaster />
    </Suspense>
  ) : null
}
