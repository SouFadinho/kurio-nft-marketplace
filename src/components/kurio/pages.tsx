/**
 * Página genérica `OutOfScopePage`: DEFINITIVA, para páginas fora da entrega (Criadores, Aprenda),
 *   coerente com o visual e sem aparentar função (CHALLENGE §3).
 */
import { Link } from '@tanstack/react-router'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MobileTopBar } from '@/components/layout/MobileTopBar'
import { Container } from './basics'
import { EmptyState } from './states'

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
