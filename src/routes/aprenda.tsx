import { createFileRoute } from '@tanstack/react-router'
import { OutOfScopePage } from '@/components/kurio/pages'

// DEFINITIVO: conteúdo editorial fora do escopo da entrega (CHALLENGE §3).
export const Route = createFileRoute('/aprenda')({
  component: () => (
    <OutOfScopePage title="Aprenda" description="Guias e artigos editoriais não fazem parte desta demonstração. Você pode explorar e comprar NFTs no mercado." />
  ),
})
