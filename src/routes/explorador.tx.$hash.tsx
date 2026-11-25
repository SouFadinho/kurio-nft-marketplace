import { createFileRoute } from '@tanstack/react-router'
import { ExplorerPage } from '@/features/orders/ExplorerPage'

// Explorador SIMULADO (público, demonstração): dados de uma transação confirmada.
export const Route = createFileRoute('/explorador/tx/$hash')({
  component: ExplorerRoute,
})

function ExplorerRoute() {
  return <ExplorerPage hash={Route.useParams().hash} />
}
