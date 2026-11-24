/**
 * Páginas genéricas:
 * - `PlaceholderPage`: TEMPORÁRIA. Marca rotas cuja implementação entra em checkpoints
 *   seguintes (CP3–CP6). Existe para a estrutura global, a navegação e os links tipados do
 *   Router funcionarem desde já. Não simula funcionalidade.
 * - `OutOfScopePage`: DEFINITIVA, para páginas fora da entrega (Criadores, Aprenda),
 *   coerente com o visual e sem aparentar função (CHALLENGE §3).
 */
import { Link } from '@tanstack/react-router'
import { Compass, Hammer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MobileTopBar } from '@/components/layout/MobileTopBar'
import { Container } from './basics'
import { EmptyState } from './states'

export function PlaceholderPage({ title, checkpoint, back = true }: { title: string; checkpoint: string; back?: boolean }) {
  return (
    <>
      <MobileTopBar title={title} back={back} />
      <Container className="py-6 lg:py-12" data-testid="placeholder-page">
        <h1 className="mb-6 hidden text-title-1 lg:block">{title}</h1>
        <EmptyState
          icon={<Hammer className="size-5" />}
          title="Tela em construção"
          description={`Esta tela faz parte do ${checkpoint} e ainda não foi implementada.`}
        />
      </Container>
    </>
  )
}

export function OutOfScopePage({ title, description }: { title: string; description: string }) {
  return (
    <>
      <MobileTopBar title={title} />
      <Container className="py-6 lg:py-12">
        <h1 className="mb-6 hidden text-title-1 lg:block">{title}</h1>
        <EmptyState
          icon={<Compass className="size-5" />}
          title="Conteúdo fora desta demonstração"
          description={description}
          action={
            <Button asChild variant="outline">
              <Link to="/mercado">Explorar o mercado</Link>
            </Button>
          }
        />
      </Container>
    </>
  )
}
