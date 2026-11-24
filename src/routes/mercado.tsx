import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/kurio/pages'

// TEMPORÁRIO: o Mercado é o catálogo com busca, filtros e ordenação (CP3).
export const Route = createFileRoute('/mercado')({
  component: () => <PlaceholderPage title="Mercado" checkpoint="CP3 (Catálogo e detalhes)" />,
})
