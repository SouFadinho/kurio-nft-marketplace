import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/kurio/pages'

// TEMPORÁRIO: a tela de Início (destaques, catálogo, busca, filtros) é o CP3.
export const Route = createFileRoute('/')({
  component: () => <PlaceholderPage title="Início" checkpoint="CP3 (Catálogo e detalhes)" back={false} />,
})
