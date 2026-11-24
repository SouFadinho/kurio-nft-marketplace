import { createFileRoute } from '@tanstack/react-router'
import { OutOfScopePage } from '@/components/kurio/pages'

// DEFINITIVO: página editorial fora do escopo da entrega (CHALLENGE §3).
export const Route = createFileRoute('/criadores')({
  component: () => (
    <OutOfScopePage title="Criadores" description="Perfis e páginas editoriais de criadores não fazem parte desta demonstração. Os NFTs de cada coleção estão disponíveis no mercado." />
  ),
})
